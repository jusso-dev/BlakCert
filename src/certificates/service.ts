import { and, desc, eq, gt, or, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { db } from "@/db/client";
import { setTenantContext, withTenantContext } from "@/db/tenant-context";
import {
  auditEvents,
  certificateChains,
  certificateNames,
  certificates,
  organisationMemberships,
  outboxEvents,
  users,
} from "@db/schema";
import { PERMISSIONS } from "@/permissions/model";
import { requirePermission } from "@/permissions/require";
import { recordAudit } from "@/audit/service";
import { calculateCertificateRisk } from "./risk";
import { importCertificateInput, parseCertificateBundle } from "./parser";

export type CertificateActor = {
  userId: string;
  organisationId: string;
  requestId?: string;
  correlationId?: string;
};

export async function importCertificate(actor: CertificateActor, unknownInput: unknown) {
  const input = importCertificateInput.parse(unknownInput);
  await requirePermission(PERMISSIONS.certificateImport, {
    userId: actor.userId,
    organisationId: actor.organisationId,
    environment: input.environment,
  });
  if (input.ownerUserId) {
    const [owner] = await db
      .select({ id: users.id })
      .from(organisationMemberships)
      .innerJoin(users, eq(users.id, organisationMemberships.userId))
      .where(
        and(
          eq(organisationMemberships.organisationId, actor.organisationId),
          eq(organisationMemberships.userId, input.ownerUserId),
          eq(organisationMemberships.state, "active"),
        ),
      )
      .limit(1);
    if (!owner) throw new Error("Certificate owner must be an active member of the organisation");
  }

  const parsed = parseCertificateBundle(input.pem);
  const risk = calculateCertificateRisk({
    ...parsed,
    ownerUserId: input.ownerUserId,
    managedStatus: input.managedStatus,
  });
  const correlationId = actor.correlationId ?? uuidv7();
  const requestId = actor.requestId ?? uuidv7();

  return db.transaction(async (tx) => {
    await setTenantContext(tx, actor.organisationId);
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${actor.organisationId + parsed.fingerprintSha256}))`,
    );
    const [existing] = await tx
      .select()
      .from(certificates)
      .where(
        and(
          eq(certificates.organisationId, actor.organisationId),
          eq(certificates.fingerprintSha256, parsed.fingerprintSha256),
        ),
      )
      .limit(1);
    if (existing) {
      const auditEventId = await recordAudit(tx, {
        organisationId: actor.organisationId,
        actorType: "user",
        actorId: actor.userId,
        action: "certificate.import_duplicate",
        resourceType: "certificate",
        resourceId: existing.id,
        outcome: "success",
        requestId,
        correlationId,
        metadata: { fingerprintSha256: parsed.fingerprintSha256 },
      });
      return { certificate: existing, duplicate: true, auditEventId, correlationId };
    }

    const id = uuidv7();
    const [created] = await tx
      .insert(certificates)
      .values({
        id,
        organisationId: actor.organisationId,
        fingerprintSha256: parsed.fingerprintSha256,
        serialNumber: parsed.serialNumber,
        certificateType: parsed.certificateType,
        subjectDn: parsed.subjectDn,
        commonName: parsed.commonName,
        issuerDn: parsed.issuerDn,
        notBefore: parsed.notBefore,
        notAfter: parsed.notAfter,
        signatureAlgorithm: parsed.signatureAlgorithm,
        publicKeyAlgorithm: parsed.publicKeyAlgorithm,
        publicKeySize: parsed.publicKeySize,
        ellipticCurve: parsed.ellipticCurve,
        keyUsages: parsed.keyUsages,
        extendedKeyUsages: parsed.extendedKeyUsages,
        authorityKeyIdentifier: parsed.authorityKeyIdentifier,
        subjectKeyIdentifier: parsed.subjectKeyIdentifier,
        pem: parsed.pem,
        source: input.source,
        managedStatus: input.managedStatus,
        lifecycleState: parsed.notAfter < new Date() ? "expired" : "active",
        environment: input.environment,
        ownerUserId: input.ownerUserId,
        ownerTeam: input.ownerTeam,
        businessService: input.businessService,
        application: input.application,
        trustChainState: parsed.trustChainState,
        hasPrivateKeyCustody: false,
        riskLevel: risk.level,
        riskScore: risk.score,
        riskModelVersion: risk.modelVersion,
        riskReasons: risk.reasons,
        lastDiscoveredAt: new Date(),
        lastValidatedAt: new Date(),
        createdBy: actor.userId,
        updatedBy: actor.userId,
      })
      .returning();
    if (!created) throw new Error("Certificate creation failed");

    if (parsed.names.length) {
      await tx.insert(certificateNames).values(
        parsed.names.map((name) => ({
          certificateId: id,
          type: name.type,
          value: name.value,
          normalisedValue: name.value.toLowerCase(),
          isCommonName: name.value === parsed.commonName,
        })),
      );
    }
    await tx.insert(certificateChains).values(
      parsed.chain.map((entry) => ({
        id: uuidv7(),
        organisationId: actor.organisationId,
        leafCertificateId: id,
        ...entry,
      })),
    );
    await tx.insert(outboxEvents).values({
      id: uuidv7(),
      organisationId: actor.organisationId,
      aggregateType: "certificate",
      aggregateId: id,
      eventType: "CertificateImported",
      payload: {
        certificateId: id,
        fingerprintSha256: parsed.fingerprintSha256,
        riskLevel: risk.level,
      },
      correlationId,
    });
    const auditEventId = await recordAudit(tx, {
      organisationId: actor.organisationId,
      actorType: "user",
      actorId: actor.userId,
      action: "certificate.imported",
      resourceType: "certificate",
      resourceId: id,
      outcome: "success",
      requestId,
      correlationId,
      after: {
        id,
        fingerprintSha256: parsed.fingerprintSha256,
        commonName: parsed.commonName,
        environment: input.environment,
        ownerUserId: input.ownerUserId ?? null,
        riskLevel: risk.level,
      },
      metadata: { chainLength: parsed.chain.length, source: input.source },
    });
    return { certificate: created, duplicate: false, auditEventId, correlationId };
  });
}

export async function getCertificate(actor: CertificateActor, id: string) {
  await requirePermission(PERMISSIONS.certificateView, actor);
  return withTenantContext(actor.organisationId, async (tx) => {
    const [certificate] = await tx
      .select()
      .from(certificates)
      .where(and(eq(certificates.organisationId, actor.organisationId), eq(certificates.id, id)))
      .limit(1);
    if (!certificate) return null;
    const [names, chain, audit] = await Promise.all([
      tx.select().from(certificateNames).where(eq(certificateNames.certificateId, id)),
      tx
        .select({
          id: certificateChains.id,
          organisationId: certificateChains.organisationId,
          leafCertificateId: certificateChains.leafCertificateId,
          parentCertificateId: certificateChains.parentCertificateId,
          depth: certificateChains.depth,
          subjectDn: certificateChains.subjectDn,
          issuerDn: certificateChains.issuerDn,
          fingerprintSha256: certificateChains.fingerprintSha256,
          trusted: certificateChains.trusted,
          validationError: certificateChains.validationError,
          createdAt: certificateChains.createdAt,
        })
        .from(certificateChains)
        .where(eq(certificateChains.leafCertificateId, id))
        .orderBy(certificateChains.depth),
      tx
        .select()
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.organisationId, actor.organisationId),
            eq(auditEvents.resourceType, "certificate"),
            eq(auditEvents.resourceId, id),
          ),
        )
        .orderBy(desc(auditEvents.occurredAt))
        .limit(100),
    ]);
    const { pem: publicCertificatePem, ...metadata } = certificate;
    void publicCertificatePem;
    return { ...metadata, names, chain, audit };
  });
}

export async function listCertificates(
  actor: CertificateActor,
  options: {
    limit?: number | undefined;
    cursor?: { notAfter: Date; id: string } | undefined;
    search?: string | undefined;
    risk?: string | undefined;
  } = {},
) {
  await requirePermission(PERMISSIONS.certificateView, actor);
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const cursorCondition = options.cursor
    ? or(
        gt(certificates.notAfter, options.cursor.notAfter),
        and(
          eq(certificates.notAfter, options.cursor.notAfter),
          gt(certificates.id, options.cursor.id),
        ),
      )
    : undefined;
  const searchCondition = options.search
    ? or(
        sql`${certificates.commonName} ILIKE ${`%${options.search}%`}`,
        sql`${certificates.subjectDn} ILIKE ${`%${options.search}%`}`,
        sql`${certificates.fingerprintSha256} ILIKE ${`${options.search}%`}`,
      )
    : undefined;
  const riskCondition = options.risk
    ? eq(certificates.riskLevel, options.risk as never)
    : undefined;
  const rows = await withTenantContext(actor.organisationId, (tx) =>
    tx
      .select({
        id: certificates.id,
        commonName: certificates.commonName,
        subjectDn: certificates.subjectDn,
        issuerDn: certificates.issuerDn,
        fingerprintSha256: certificates.fingerprintSha256,
        notAfter: certificates.notAfter,
        environment: certificates.environment,
        managedStatus: certificates.managedStatus,
        lifecycleState: certificates.lifecycleState,
        riskLevel: certificates.riskLevel,
        riskScore: certificates.riskScore,
        ownerUserId: certificates.ownerUserId,
        policyComplianceStatus: certificates.policyComplianceStatus,
        lastValidatedAt: certificates.lastValidatedAt,
      })
      .from(certificates)
      .where(
        and(
          eq(certificates.organisationId, actor.organisationId),
          cursorCondition,
          searchCondition,
          riskCondition,
        ),
      )
      .orderBy(certificates.notAfter, certificates.id)
      .limit(limit + 1),
  );
  const hasMore = rows.length > limit;
  const data = rows.slice(0, limit);
  const last = data.at(-1);
  return { data, nextCursor: hasMore && last ? { notAfter: last.notAfter, id: last.id } : null };
}

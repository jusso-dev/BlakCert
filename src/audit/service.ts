import { createHash, createHmac } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { db } from "@/db/client";
import { auditEvents } from "@db/schema";
import { env } from "@/config/env";
import { assertNoPrivateMaterial, redactSecrets } from "@/security/redaction";

type AuditWriter = Pick<typeof db, "execute" | "insert" | "select">;

export type AuditInput = {
  organisationId: string | null;
  workspaceId?: string | null;
  actorType: "user" | "service_account" | "agent" | "mcp_client" | "system";
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  outcome: "success" | "denied" | "failure";
  reason?: string;
  requestId?: string;
  correlationId?: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  sourceIp?: string;
  userAgent?: string;
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function recordAudit(writer: AuditWriter, input: AuditInput): Promise<string> {
  const safeMetadata = redactSecrets(input.metadata ?? {}) as Record<string, unknown>;
  const safeBefore = redactSecrets(input.before);
  const safeAfter = redactSecrets(input.after);
  assertNoPrivateMaterial({ safeMetadata, safeBefore, safeAfter });

  if (input.organisationId) {
    await writer.execute(sql`select pg_advisory_xact_lock(hashtext(${input.organisationId}))`);
  }
  const previous = input.organisationId
    ? await writer
        .select({ hash: auditEvents.eventHash })
        .from(auditEvents)
        .where(eq(auditEvents.organisationId, input.organisationId))
        .orderBy(desc(auditEvents.occurredAt), desc(auditEvents.id))
        .limit(1)
    : [];

  const id = uuidv7();
  const occurredAt = new Date();
  const requestId = input.requestId ?? uuidv7();
  const correlationId = input.correlationId ?? uuidv7();
  const previousEventHash = previous[0]?.hash ?? null;
  const beforeHash = safeBefore
    ? createHash("sha256").update(canonical(safeBefore)).digest("hex")
    : null;
  const afterHash = safeAfter
    ? createHash("sha256").update(canonical(safeAfter)).digest("hex")
    : null;
  const eventHash = createHmac("sha256", env.AUDIT_HMAC_KEY)
    .update(
      canonical({
        id,
        occurredAt: occurredAt.toISOString(),
        organisationId: input.organisationId,
        actorType: input.actorType,
        actorId: input.actorId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        outcome: input.outcome,
        requestId,
        correlationId,
        beforeHash,
        afterHash,
        metadata: safeMetadata,
        previousEventHash,
      }),
    )
    .digest("hex");

  await writer.insert(auditEvents).values({
    id,
    occurredAt,
    organisationId: input.organisationId,
    workspaceId: input.workspaceId,
    actorType: input.actorType,
    actorId: input.actorId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    outcome: input.outcome,
    reason: input.reason,
    sourceIp: input.sourceIp,
    userAgent: input.userAgent,
    requestId,
    correlationId,
    beforeHash,
    afterHash,
    safeDiff:
      safeAfter && typeof safeAfter === "object" ? (safeAfter as Record<string, unknown>) : null,
    metadata: safeMetadata,
    previousEventHash,
    eventHash,
    keyVersion: "v1",
  });
  return id;
}

export async function verifyAuditChain(organisationId: string): Promise<boolean> {
  const events = await db
    .select({
      id: auditEvents.id,
      hash: auditEvents.eventHash,
      previous: auditEvents.previousEventHash,
    })
    .from(auditEvents)
    .where(eq(auditEvents.organisationId, organisationId))
    .orderBy(auditEvents.occurredAt, auditEvents.id);
  return events.every(
    (event, index) => event.previous === (index === 0 ? null : events[index - 1]?.hash),
  );
}

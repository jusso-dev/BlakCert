import { and, count, eq, gt, lte } from "drizzle-orm";
import { withTenantContext } from "@/db/tenant-context";
import {
  approvalWorkflows,
  certificates,
  connectors,
  policyViolations,
  renewalWorkflows,
} from "@db/schema";
import { PERMISSIONS } from "@/permissions/model";
import { requirePermission } from "@/permissions/require";
import type { CertificateActor } from "./service";

export async function certificateOverview(actor: CertificateActor) {
  await requirePermission(PERMISSIONS.certificateView, actor);
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 86_400_000);
  const [
    total,
    expiring,
    expired,
    unmanaged,
    violations,
    failedRenewals,
    pendingApprovals,
    unhealthyConnectors,
  ] = await withTenantContext(actor.organisationId, (tx) =>
    Promise.all([
      tx
        .select({ value: count() })
        .from(certificates)
        .where(eq(certificates.organisationId, actor.organisationId)),
      tx
        .select({ value: count() })
        .from(certificates)
        .where(
          and(
            eq(certificates.organisationId, actor.organisationId),
            gt(certificates.notAfter, now),
            lte(certificates.notAfter, in30Days),
          ),
        ),
      tx
        .select({ value: count() })
        .from(certificates)
        .where(
          and(
            eq(certificates.organisationId, actor.organisationId),
            lte(certificates.notAfter, now),
          ),
        ),
      tx
        .select({ value: count() })
        .from(certificates)
        .where(
          and(
            eq(certificates.organisationId, actor.organisationId),
            eq(certificates.managedStatus, "unmanaged"),
          ),
        ),
      tx
        .select({ value: count() })
        .from(policyViolations)
        .where(
          and(
            eq(policyViolations.organisationId, actor.organisationId),
            eq(policyViolations.status, "open"),
          ),
        ),
      tx
        .select({ value: count() })
        .from(renewalWorkflows)
        .where(
          and(
            eq(renewalWorkflows.organisationId, actor.organisationId),
            eq(renewalWorkflows.state, "failed"),
          ),
        ),
      tx
        .select({ value: count() })
        .from(approvalWorkflows)
        .where(
          and(
            eq(approvalWorkflows.organisationId, actor.organisationId),
            eq(approvalWorkflows.status, "pending"),
          ),
        ),
      tx
        .select({ value: count() })
        .from(connectors)
        .where(
          and(
            eq(connectors.organisationId, actor.organisationId),
            eq(connectors.health, "unhealthy"),
          ),
        ),
    ]),
  );
  return {
    total: total[0]?.value ?? 0,
    expiring30: expiring[0]?.value ?? 0,
    expired: expired[0]?.value ?? 0,
    unmanaged: unmanaged[0]?.value ?? 0,
    violations: violations[0]?.value ?? 0,
    failedRenewals: failedRenewals[0]?.value ?? 0,
    pendingApprovals: pendingApprovals[0]?.value ?? 0,
    unhealthyConnectors: unhealthyConnectors[0]?.value ?? 0,
  };
}

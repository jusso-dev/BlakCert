import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { withTenantContext } from "@/db/tenant-context";
import { auditEvents } from "@db/schema";
import { requirePageSession } from "@/auth/session";
import { resolveActiveOrganisation } from "@/auth/active-organisation";
import { PERMISSIONS } from "@/permissions/model";
import { requirePermission } from "@/permissions/require";
import { StatusBadge } from "@/components/status-badge";

export const metadata: Metadata = { title: "Audit" };

export default async function AuditPage() {
  const session = await requirePageSession();
  const organisation = await resolveActiveOrganisation(session.user.id);
  if (!organisation) return null;
  await requirePermission(PERMISSIONS.auditView, {
    userId: session.user.id,
    organisationId: organisation.id,
  });
  const events = await withTenantContext(organisation.id, (tx) =>
    tx
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.organisationId, organisation.id))
      .orderBy(desc(auditEvents.occurredAt))
      .limit(200),
  );
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Immutable audit</h1>
          <p>
            Append-only, tenant-scoped events linked by keyed hashes. Sensitive values are redacted
            before persistence.
          </p>
        </div>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Resource</th>
              <th>Outcome</th>
              <th>Correlation</th>
              <th>Chain hash</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{event.occurredAt.toLocaleString("en-AU")}</td>
                <td>{event.action}</td>
                <td>
                  {event.actorType}
                  <div className="mono muted">{event.actorId ?? "system"}</div>
                </td>
                <td>
                  {event.resourceType}
                  <div className="mono muted">{event.resourceId}</div>
                </td>
                <td>
                  <StatusBadge value={event.outcome} />
                </td>
                <td className="mono">{event.correlationId.slice(0, 8)}…</td>
                <td className="mono">{event.eventHash.slice(0, 12)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

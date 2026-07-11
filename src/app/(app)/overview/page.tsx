import Link from "next/link";
import { AlertTriangle, ArrowRight, Bot, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import { requirePageSession } from "@/auth/session";
import { resolveActiveOrganisation } from "@/auth/active-organisation";
import { certificateOverview } from "@/certificates/queries";
import { listCertificates } from "@/certificates/service";
import { StatusBadge } from "@/components/status-badge";
import { daysUntil } from "@/certificates/risk";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const session = await requirePageSession();
  const organisation = await resolveActiveOrganisation(session.user.id);
  if (!organisation) return null;
  const actor = { userId: session.user.id, organisationId: organisation.id };
  const [summary, expiring] = await Promise.all([
    certificateOverview(actor),
    listCertificates(actor, { limit: 8 }),
  ]);
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Certificate operations</h1>
          <p>
            Prioritised lifecycle work across {organisation.name}. Every count opens the underlying
            operational scope.
          </p>
        </div>
        <Link className="button button-primary" href="/certificates/import">
          Import certificate
        </Link>
      </div>
      <section className="stat-strip" aria-label="Certificate posture">
        <Link className="stat" href="/certificates">
          <span className="stat-label">Total inventory</span>
          <strong className="stat-value">{summary.total}</strong>
        </Link>
        <Link className="stat" href="/certificates?expiry=30">
          <span className="stat-label">Expiring in 30 days</span>
          <strong className="stat-value">{summary.expiring30}</strong>
        </Link>
        <Link className="stat" href="/certificates?state=expired">
          <span className="stat-label">Expired</span>
          <strong className="stat-value">{summary.expired}</strong>
        </Link>
        <Link className="stat" href="/certificates?managed=unmanaged">
          <span className="stat-label">Unmanaged</span>
          <strong className="stat-value">{summary.unmanaged}</strong>
        </Link>
        <Link className="stat" href="/risks">
          <span className="stat-label">Policy violations</span>
          <strong className="stat-value">{summary.violations}</strong>
        </Link>
      </section>
      <div className="detail-grid">
        <section className="panel">
          <div className="panel-header">
            <h2>Next certificate deadlines</h2>
            <Link href="/certificates?sort=expiry">
              View inventory <ArrowRight size={14} />
            </Link>
          </div>
          {expiring.data.length === 0 ? (
            <div className="empty">
              <CheckCircle2 size={26} />
              <p>No certificates have been imported yet.</p>
              <Link className="button" href="/certificates/import">
                Import the first certificate
              </Link>
            </div>
          ) : (
            <div className="table-wrap" style={{ border: 0, borderRadius: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Certificate</th>
                    <th>Expiry</th>
                    <th>Risk</th>
                    <th>Managed</th>
                  </tr>
                </thead>
                <tbody>
                  {expiring.data.map((certificate) => (
                    <tr key={certificate.id}>
                      <td>
                        <Link className="table-link" href={`/certificates/${certificate.id}`}>
                          {certificate.commonName ?? certificate.subjectDn}
                        </Link>
                      </td>
                      <td>{daysUntil(certificate.notAfter)} days</td>
                      <td>
                        <StatusBadge value={certificate.riskLevel} />
                      </td>
                      <td>
                        <StatusBadge value={certificate.managedStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <aside className="panel">
          <div className="panel-header">
            <h2>Control queue</h2>
          </div>
          <div className="panel-body form-stack">
            <div>
              <AlertTriangle size={17} />
              <strong>{summary.failedRenewals} failed renewals</strong>
              <p className="muted">Requires lifecycle owner review.</p>
            </div>
            <div>
              <CheckCircle2 size={17} />
              <strong>{summary.pendingApprovals} pending approvals</strong>
              <p className="muted">Separation-of-duties decisions waiting.</p>
            </div>
            <div>
              <Bot size={17} />
              <strong>Agent actions default to dry-run</strong>
              <p className="muted">Tool calls are scoped, policy checked, and audited.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

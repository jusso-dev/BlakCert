import { notFound } from "next/navigation";
import { Clock3, Fingerprint, GitBranch, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { requirePageSession } from "@/auth/session";
import { resolveActiveOrganisation } from "@/auth/active-organisation";
import { getCertificate } from "@/certificates/service";
import { daysUntil } from "@/certificates/risk";
import { StatusBadge } from "@/components/status-badge";

export const metadata: Metadata = { title: "Certificate detail" };

export default async function CertificateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [session, { id }] = await Promise.all([requirePageSession(), params]);
  const organisation = await resolveActiveOrganisation(session.user.id);
  if (!organisation) return null;
  const certificate = await getCertificate(
    { userId: session.user.id, organisationId: organisation.id },
    id,
  );
  if (!certificate) notFound();
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{certificate.commonName ?? certificate.subjectDn}</h1>
          <p className="mono">{certificate.fingerprintSha256}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <StatusBadge value={certificate.riskLevel} />
          <StatusBadge value={certificate.lifecycleState} />
        </div>
      </div>
      <div className="detail-grid">
        <div className="form-stack">
          <section className="panel">
            <div className="panel-header">
              <h2>
                <Fingerprint size={16} /> Certificate metadata
              </h2>
            </div>
            <div className="panel-body">
              <dl className="definition-grid">
                <dt>Subject</dt>
                <dd>{certificate.subjectDn}</dd>
                <dt>Issuer</dt>
                <dd>{certificate.issuerDn}</dd>
                <dt>Serial number</dt>
                <dd className="mono">{certificate.serialNumber}</dd>
                <dt>Validity</dt>
                <dd>
                  {certificate.notBefore.toLocaleString("en-AU")} to{" "}
                  {certificate.notAfter.toLocaleString("en-AU")} ({daysUntil(certificate.notAfter)}{" "}
                  days)
                </dd>
                <dt>Public key</dt>
                <dd>
                  {certificate.publicKeyAlgorithm}{" "}
                  {certificate.publicKeySize
                    ? `${certificate.publicKeySize} bit`
                    : certificate.ellipticCurve}
                </dd>
                <dt>Signature</dt>
                <dd>{certificate.signatureAlgorithm}</dd>
                <dt>Names</dt>
                <dd>{certificate.names.map((name) => name.value).join(", ") || "None"}</dd>
                <dt>Environment</dt>
                <dd>
                  <StatusBadge value={certificate.environment} />
                </dd>
                <dt>Managed state</dt>
                <dd>
                  <StatusBadge value={certificate.managedStatus} />
                </dd>
              </dl>
            </div>
          </section>
          <section className="panel">
            <div className="panel-header">
              <h2>
                <GitBranch size={16} /> Included trust chain
              </h2>
              <StatusBadge value={certificate.trustChainState} />
            </div>
            <div className="panel-body">
              <ol className="timeline">
                {certificate.chain.map((entry) => (
                  <li key={entry.id}>
                    <span className="muted">Depth {entry.depth}</span>
                    <div>
                      <strong>{entry.subjectDn}</strong>
                      <div className="mono muted">{entry.fingerprintSha256}</div>
                      {entry.validationError ? (
                        <div className="alert alert-error" style={{ marginTop: 8 }}>
                          {entry.validationError}
                        </div>
                      ) : (
                        <div className="muted">
                          <ShieldCheck size={14} /> Signature validated against the included issuer
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>
          <section className="panel">
            <div className="panel-header">
              <h2>
                <Clock3 size={16} /> Audit history
              </h2>
            </div>
            <div className="panel-body">
              <ol className="timeline">
                {certificate.audit.map((event) => (
                  <li key={event.id}>
                    <time className="muted">{event.occurredAt.toLocaleString("en-AU")}</time>
                    <div>
                      <strong>{event.action}</strong>
                      <div className="muted">
                        {event.actorType} · {event.outcome}
                      </div>
                      <div className="mono muted">Correlation {event.correlationId}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        </div>
        <aside className="form-stack">
          <section className="panel">
            <div className="panel-header">
              <h2>Explainable risk</h2>
              <StatusBadge value={certificate.riskLevel} />
            </div>
            <div className="panel-body">
              <strong style={{ fontSize: "1.25rem" }}>{certificate.riskScore}/100</strong>
              <p className="muted">Model {certificate.riskModelVersion}</p>
              <div className="form-stack">
                {certificate.riskReasons.map((reason) => (
                  <div key={reason.code}>
                    <strong>
                      {reason.code.replaceAll("_", " ")} (+{reason.score})
                    </strong>
                    <div className="muted">{reason.evidence}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <section className="panel">
            <div className="panel-header">
              <h2>Ownership</h2>
            </div>
            <div className="panel-body">
              <dl className="definition-grid" style={{ gridTemplateColumns: "100px 1fr" }}>
                <dt>User</dt>
                <dd>{certificate.ownerUserId ?? "Unassigned"}</dd>
                <dt>Team</dt>
                <dd>{certificate.ownerTeam ?? "Unassigned"}</dd>
                <dt>Service</dt>
                <dd>{certificate.businessService ?? "Unassigned"}</dd>
                <dt>Application</dt>
                <dd>{certificate.application ?? "Unassigned"}</dd>
              </dl>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

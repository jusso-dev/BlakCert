import Link from "next/link";
import { FileKey2, Search } from "lucide-react";
import type { Metadata } from "next";
import { requirePageSession } from "@/auth/session";
import { resolveActiveOrganisation } from "@/auth/active-organisation";
import { listCertificates } from "@/certificates/service";
import { daysUntil } from "@/certificates/risk";
import { StatusBadge } from "@/components/status-badge";

export const metadata: Metadata = { title: "Certificates" };

export default async function CertificatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; risk?: string }>;
}) {
  const [session, query] = await Promise.all([requirePageSession(), searchParams]);
  const organisation = await resolveActiveOrganisation(session.user.id);
  if (!organisation) return null;
  const result = await listCertificates(
    { userId: session.user.id, organisationId: organisation.id },
    { search: query.q, risk: query.risk, limit: 100 },
  );
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Certificates</h1>
          <p>
            Stable certificate identities with deployment, ownership, renewal, and policy context.
          </p>
        </div>
        <Link className="button button-primary" href="/certificates/import">
          Import certificate
        </Link>
      </div>
      <form style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <div className="field" style={{ maxWidth: 440, flex: 1 }}>
          <label className="sr-only" htmlFor="certificate-search">
            Search certificates
          </label>
          <input
            className="input"
            defaultValue={query.q}
            id="certificate-search"
            name="q"
            placeholder="Common name, subject, or fingerprint"
          />
        </div>
        <button className="button" type="submit">
          <Search size={15} />
          Search
        </button>
      </form>
      {result.data.length === 0 ? (
        <div className="panel empty">
          <FileKey2 size={30} />
          <h2>No certificates match this view</h2>
          <p>Import a PEM bundle or adjust the search criteria.</p>
          <Link className="button" href="/certificates/import">
            Import certificate
          </Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Common name</th>
                <th>Issuer</th>
                <th>Expiry</th>
                <th>Environment</th>
                <th>Managed</th>
                <th>Risk</th>
                <th>Policy</th>
                <th>Last validated</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((certificate) => (
                <tr key={certificate.id}>
                  <td>
                    <Link className="table-link" href={`/certificates/${certificate.id}`}>
                      {certificate.commonName ?? certificate.subjectDn}
                    </Link>
                    <div className="mono muted">{certificate.fingerprintSha256.slice(0, 16)}…</div>
                  </td>
                  <td>{certificate.issuerDn}</td>
                  <td>
                    {certificate.notAfter.toLocaleDateString("en-AU")}
                    <div className="muted">{daysUntil(certificate.notAfter)} days</div>
                  </td>
                  <td>
                    <StatusBadge value={certificate.environment} />
                  </td>
                  <td>
                    <StatusBadge value={certificate.managedStatus} />
                  </td>
                  <td>
                    <StatusBadge value={certificate.riskLevel} />
                  </td>
                  <td>
                    <StatusBadge value={certificate.policyComplianceStatus} />
                  </td>
                  <td>{certificate.lastValidatedAt?.toLocaleString("en-AU") ?? "Never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

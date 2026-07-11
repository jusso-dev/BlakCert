import { notFound } from "next/navigation";
import { Construction } from "lucide-react";

const SECTIONS: Record<string, { title: string; description: string }> = {
  deployments: {
    title: "Deployments",
    description: "Certificate targets, handshake observations, staged rollout, and rollback state.",
  },
  requests: {
    title: "Certificate requests",
    description: "Template-driven issuance requests with policy and approval context.",
  },
  renewals: {
    title: "Renewal workflows",
    description: "Durable renewal state machines, maintenance windows, validation, and rollback.",
  },
  discovery: {
    title: "Discovery",
    description: "Authorised discovery scopes, scans, endpoint review, and controlled import.",
  },
  "certificate-authorities": {
    title: "Certificate authorities",
    description: "Capability-declared CA providers and their health state.",
  },
  "trust-stores": {
    title: "Trust stores",
    description: "Approved roots, intermediates, target diffs, staged changes, and rollback.",
  },
  policies: {
    title: "Policies",
    description:
      "Versioned and explainable certificate governance with simulation before activation.",
  },
  risks: {
    title: "Risks",
    description: "Evidence-backed certificate and deployment risks, prioritised for remediation.",
  },
  approvals: {
    title: "Approvals",
    description: "Separation-of-duties decisions with step-up authentication and evidence.",
  },
  agents: {
    title: "Agents",
    description:
      "Constrained agent profiles, dry-run plans, tool calls, approvals, and recommendations.",
  },
  reports: {
    title: "Reports",
    description: "Audited, asynchronous inventory, expiry, compliance, and executive evidence.",
  },
};

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const content = SECTIONS[section];
  if (!content) notFound();
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{content.title}</h1>
          <p>{content.description}</p>
        </div>
      </div>
      <div className="panel empty">
        <Construction size={28} />
        <h2>Domain foundation ready</h2>
        <p>
          The schema, authorisation boundaries, audit contracts, and job architecture for this
          domain are established. Credential-dependent operations remain disabled until configured.
        </p>
      </div>
    </div>
  );
}

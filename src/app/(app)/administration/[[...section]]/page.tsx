import { Settings } from "lucide-react";

export default async function AdministrationPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section = [] } = await params;
  const title = section.length
    ? section.map((value) => value.replaceAll("-", " ")).join(" / ")
    : "Administration";
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 style={{ textTransform: "capitalize" }}>{title}</h1>
          <p>Organisation-scoped administration with step-up controls and immutable audit.</p>
        </div>
      </div>
      <div className="panel empty">
        <Settings size={28} />
        <h2>Administrative domain foundation ready</h2>
        <p>
          Identity, SSO, SCIM, service account, API key, connector, retention, and security models
          are present. Configuration screens activate as each integration is credentialled.
        </p>
      </div>
    </div>
  );
}

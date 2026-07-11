import type { Metadata } from "next";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Import certificate" };

export default function ImportCertificatePage() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Import certificate</h1>
          <p>
            BlakCert calculates a stable SHA-256 fingerprint, validates the included chain, prevents
            duplicates, assigns explainable risk, and records one immutable audit event.
          </p>
        </div>
      </div>
      <div className="panel" style={{ maxWidth: 920 }}>
        <div className="panel-header">
          <h2>Certificate material and ownership</h2>
        </div>
        <div className="panel-body">
          <ImportForm />
        </div>
      </div>
    </div>
  );
}

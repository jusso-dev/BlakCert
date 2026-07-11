"use client";

import { useActionState } from "react";
import { Upload } from "lucide-react";
import { importCertificateAction } from "./actions";

export function ImportForm() {
  const [state, action, pending] = useActionState(importCertificateAction, {});
  return (
    <form action={action} className="form-stack">
      {state.error && (
        <div className="alert alert-error" role="alert">
          <strong>Import failed</strong>
          <div>{state.error}</div>
        </div>
      )}
      <div className="field">
        <label htmlFor="pem">PEM certificate or certificate chain</label>
        <textarea
          className="textarea"
          id="pem"
          name="pem"
          placeholder="-----BEGIN CERTIFICATE-----"
          spellCheck={false}
          required
        />
        <span className="field-hint">
          Certificate blocks only. Private keys are rejected before parsing and never enter audit
          metadata.
        </span>
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="environment">Environment</label>
          <select className="select" id="environment" name="environment" defaultValue="production">
            <option value="development">Development</option>
            <option value="test">Test</option>
            <option value="staging">Staging</option>
            <option value="production">Production</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="managedStatus">Management state</label>
          <select
            className="select"
            id="managedStatus"
            name="managedStatus"
            defaultValue="unmanaged"
          >
            <option value="managed">Managed by BlakCert</option>
            <option value="unmanaged">Unmanaged</option>
            <option value="externally_managed">Externally managed</option>
          </select>
        </div>
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="ownerTeam">Owner team</label>
          <input
            className="input"
            id="ownerTeam"
            name="ownerTeam"
            placeholder="Platform Security"
          />
        </div>
        <div className="field">
          <label htmlFor="businessService">Business service</label>
          <input
            className="input"
            id="businessService"
            name="businessService"
            placeholder="Customer identity"
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="application">Application</label>
        <input
          className="input"
          id="application"
          name="application"
          placeholder="Authentication gateway"
        />
      </div>
      <div>
        <button className="button button-primary" disabled={pending} type="submit">
          <Upload size={15} />
          {pending ? "Parsing and validating…" : "Import and validate"}
        </button>
      </div>
    </form>
  );
}

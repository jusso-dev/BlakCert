"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Smartphone } from "lucide-react";
import { authClient } from "@/auth/client";

export function MfaPanel() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [totpUri, setTotpUri] = useState<string>();
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  async function startTotp(formData: FormData) {
    setError(undefined);
    const result = await authClient.twoFactor.enable({
      password: String(formData.get("password")),
    });
    if (result.error) return setError(result.error.message ?? "Could not start TOTP enrolment");
    setTotpUri(result.data?.totpURI);
    setRecoveryCodes(result.data?.backupCodes ?? []);
  }

  async function verifyTotp(formData: FormData) {
    const result = await authClient.twoFactor.verifyTotp({ code: String(formData.get("code")) });
    if (result.error) return setError(result.error.message ?? "The TOTP code was not accepted");
    router.push("/overview");
    router.refresh();
  }

  async function addPasskey() {
    setError(undefined);
    const result = await authClient.passkey.addPasskey({ name: "BlakCert passkey" });
    if (result?.error) return setError(result.error.message ?? "Passkey enrolment failed");
    router.push("/overview");
    router.refresh();
  }

  return (
    <div className="form-stack">
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      <div className="panel">
        <div className="panel-header">
          <h2>
            <Smartphone size={16} /> Authenticator app
          </h2>
        </div>
        <div className="panel-body">
          {!totpUri ? (
            <form action={startTotp} className="form-stack">
              <div className="field">
                <label htmlFor="mfa-password">Confirm password</label>
                <input
                  className="input"
                  id="mfa-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              <button className="button" type="submit">
                Set up TOTP
              </button>
            </form>
          ) : (
            <form action={verifyTotp} className="form-stack">
              <div className="alert">
                <strong>Authenticator URI</strong>
                <div className="mono" style={{ overflowWrap: "anywhere", marginTop: 6 }}>
                  {totpUri}
                </div>
              </div>
              <div className="field">
                <label htmlFor="totp-code">Six-digit code</label>
                <input
                  className="input"
                  id="totp-code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  required
                />
              </div>
              {recoveryCodes.length > 0 && (
                <div className="alert">
                  <strong>Save these one-time recovery codes now</strong>
                  <pre className="mono">{recoveryCodes.join("\n")}</pre>
                </div>
              )}
              <button className="button button-primary" type="submit">
                Verify and finish
              </button>
            </form>
          )}
        </div>
      </div>
      <div className="panel">
        <div className="panel-header">
          <h2>
            <KeyRound size={16} /> Passkey
          </h2>
        </div>
        <div className="panel-body form-stack">
          <p className="muted">
            Use your device biometrics or security key for phishing-resistant authentication.
          </p>
          <button className="button" onClick={addPasskey} type="button">
            Create passkey
          </button>
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { requirePageSession } from "@/auth/session";
import { MfaPanel } from "./mfa-panel";

export const metadata: Metadata = { title: "Authentication methods" };

export default async function MfaPage() {
  await requirePageSession();
  return (
    <>
      <h1 className="auth-title">Protect your account</h1>
      <p className="auth-copy">
        Enrol TOTP or a phishing-resistant passkey. Your organisation may require one or both.
      </p>
      <MfaPanel />
    </>
  );
}

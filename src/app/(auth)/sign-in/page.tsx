import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <>
      <h1 className="auth-title">Sign in to BlakCert</h1>
      <p className="auth-copy">Continue to your organisation’s certificate control plane.</p>
      <Suspense fallback={<div className="alert">Loading secure sign-in…</div>}>
        <SignInForm />
      </Suspense>
      <p className="muted">
        New to BlakCert? <Link href="/sign-up">Create an account</Link>
      </p>
    </>
  );
}

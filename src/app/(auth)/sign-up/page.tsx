import Link from "next/link";
import type { Metadata } from "next";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <>
      <h1 className="auth-title">Create your account</h1>
      <p className="auth-copy">Start a new organisation or accept an enterprise invitation.</p>
      <SignUpForm />
      <p className="muted">
        Already have an account? <Link href="/sign-in">Sign in</Link>
      </p>
    </>
  );
}

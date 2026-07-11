"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/auth/client";

export function SignUpForm() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirmation"))) {
      setPending(false);
      return setError("Passwords do not match");
    }
    const result = await authClient.signUp.email({
      name: String(form.get("name")),
      email: String(form.get("email")),
      password,
    });
    setPending(false);
    if (result.error) return setError(result.error.message ?? "Account creation failed");
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <form className="form-stack" onSubmit={onSubmit}>
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      <div className="field">
        <label htmlFor="name">Full name</label>
        <input className="input" id="name" name="name" autoComplete="name" required />
      </div>
      <div className="field">
        <label htmlFor="email">Work email</label>
        <input
          className="input"
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          className="input"
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={14}
          required
        />
        <span className="field-hint">
          At least 14 characters and not found in known breach data.
        </span>
      </div>
      <div className="field">
        <label htmlFor="confirmation">Confirm password</label>
        <input
          className="input"
          id="confirmation"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          minLength={14}
          required
        />
      </div>
      <button className="button button-primary" disabled={pending} type="submit">
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}

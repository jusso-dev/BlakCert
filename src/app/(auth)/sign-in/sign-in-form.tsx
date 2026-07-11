"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound } from "lucide-react";
import { authClient } from "@/auth/client";

export function SignInForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const result = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
      rememberMe: form.get("remember") === "on",
    });
    setPending(false);
    if (result.error) return setError(result.error.message ?? "Sign in failed");
    router.push(search.get("next") ?? "/overview");
    router.refresh();
  }

  async function signInWithPasskey() {
    setPending(true);
    setError(undefined);
    const result = await authClient.signIn.passkey({ autoFill: false });
    setPending(false);
    if (result?.error) return setError(result.error.message ?? "Passkey sign in failed");
    router.push(search.get("next") ?? "/overview");
    router.refresh();
  }

  return (
    <div className="form-stack">
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      <form className="form-stack" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="email">Email</label>
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
            autoComplete="current-password"
            minLength={14}
            required
          />
        </div>
        <label>
          <input name="remember" type="checkbox" /> Keep me signed in on this device
        </label>
        <button className="button button-primary" disabled={pending} type="submit">
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <button className="button" disabled={pending} onClick={signInWithPasskey} type="button">
        <KeyRound size={16} />
        Use a passkey
      </button>
    </div>
  );
}

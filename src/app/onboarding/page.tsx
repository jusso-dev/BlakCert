import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Brand } from "@/components/brand";
import { requirePageSession } from "@/auth/session";
import { resolveActiveOrganisation } from "@/auth/active-organisation";
import { createOrganisationAction } from "./actions";

export const metadata: Metadata = { title: "Create organisation" };

export default async function OnboardingPage() {
  const session = await requirePageSession();
  if (await resolveActiveOrganisation(session.user.id)) redirect("/overview");
  return (
    <div className="auth-layout">
      <section className="auth-form">
        <Brand />
        <h1 className="auth-title">Create your organisation</h1>
        <p className="auth-copy">
          Organisation boundaries control data access, encryption policy, identity, audit retention,
          and agent scope.
        </p>
        <form action={createOrganisationAction} className="form-stack">
          <div className="field">
            <label htmlFor="name">Organisation name</label>
            <input className="input" id="name" name="name" minLength={2} maxLength={100} required />
          </div>
          <button className="button button-primary" type="submit">
            Create organisation
          </button>
        </form>
      </section>
      <aside className="auth-aside">
        <blockquote>
          Tenant context is verified against your authenticated membership on every request.
        </blockquote>
      </aside>
    </div>
  );
}

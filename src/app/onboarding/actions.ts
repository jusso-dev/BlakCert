"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/auth/session";
import { ACTIVE_ORGANISATION_COOKIE } from "@/auth/active-organisation";
import { createOrganisation } from "@/organisations/service";

export async function createOrganisationAction(formData: FormData) {
  const session = await requireSession();
  const organisation = await createOrganisation(session.user.id, { name: formData.get("name") });
  const store = await cookies();
  store.set(ACTIVE_ORGANISATION_COOKIE, organisation.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/overview");
}

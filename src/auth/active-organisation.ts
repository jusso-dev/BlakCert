import { and, asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db/client";
import { organisationMemberships, organisations } from "@db/schema";

export const ACTIVE_ORGANISATION_COOKIE = "blakcert_active_organisation";

export async function resolveActiveOrganisation(userId: string) {
  const cookieStore = await cookies();
  const hintedId = cookieStore.get(ACTIVE_ORGANISATION_COOKIE)?.value;

  if (hintedId) {
    const [match] = await db
      .select({ id: organisations.id, name: organisations.name, slug: organisations.slug })
      .from(organisationMemberships)
      .innerJoin(organisations, eq(organisations.id, organisationMemberships.organisationId))
      .where(
        and(
          eq(organisationMemberships.userId, userId),
          eq(organisationMemberships.organisationId, hintedId),
          eq(organisationMemberships.state, "active"),
          eq(organisations.state, "active"),
        ),
      )
      .limit(1);
    if (match) return match;
  }

  const [fallback] = await db
    .select({ id: organisations.id, name: organisations.name, slug: organisations.slug })
    .from(organisationMemberships)
    .innerJoin(organisations, eq(organisations.id, organisationMemberships.organisationId))
    .where(
      and(
        eq(organisationMemberships.userId, userId),
        eq(organisationMemberships.state, "active"),
        eq(organisations.state, "active"),
      ),
    )
    .orderBy(asc(organisationMemberships.createdAt))
    .limit(1);
  return fallback ?? null;
}

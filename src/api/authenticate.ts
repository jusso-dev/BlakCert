import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { auth } from "@/auth/auth";
import { resolveActiveOrganisation } from "@/auth/active-organisation";
import { db } from "@/db/client";
import { apiKeys } from "@db/schema";
import { env } from "@/config/env";
import { AuthenticationRequiredError } from "@/auth/session";

export function hashApiKey(value: string): string {
  return createHmac("sha256", env.MCP_API_KEY_PEPPER).update(value).digest("hex");
}

export async function authenticateApiKeyValue(value: string) {
  if (!value.startsWith("bk_")) throw new AuthenticationRequiredError();
  const prefix = value.slice(0, 12);
  const [key] = await db
    .select()
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.prefix, prefix),
        isNull(apiKeys.revokedAt),
        or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, new Date())),
      ),
    )
    .limit(1);
  if (!key?.userId) throw new AuthenticationRequiredError();
  const actual = Buffer.from(hashApiKey(value), "hex");
  const expected = Buffer.from(key.secretHash, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new AuthenticationRequiredError();
  }
  return {
    userId: key.userId,
    organisationId: key.organisationId,
    scopes: key.scopes,
    apiKeyId: key.id,
    actorType: "user" as const,
  };
}

export async function authenticateHeaders(headers: Headers) {
  const authorization = headers.get("authorization");
  if (authorization?.startsWith("Bearer bk_")) {
    return authenticateApiKeyValue(authorization.slice(7));
  }
  const session = await auth.api.getSession({ headers });
  if (!session) throw new AuthenticationRequiredError();
  const organisation = await resolveActiveOrganisation(session.user.id);
  if (!organisation) throw new AuthenticationRequiredError();
  return {
    userId: session.user.id,
    organisationId: organisation.id,
    scopes: ["session"],
    actorType: "user" as const,
  };
}

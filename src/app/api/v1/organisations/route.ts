import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { v7 as uuidv7 } from "uuid";
import { auth } from "@/auth/auth";
import { ACTIVE_ORGANISATION_COOKIE } from "@/auth/active-organisation";
import { db } from "@/db/client";
import { organisationMemberships, organisations } from "@db/schema";
import { createOrganisation } from "@/organisations/service";
import { handleApiError, problem } from "@/api/problem";

export async function GET(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? uuidv7();
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session)
      return problem(401, "Authentication required", "A browser session is required.", requestId);
    const rows = await db
      .select({
        id: organisations.id,
        name: organisations.name,
        slug: organisations.slug,
        state: organisations.state,
      })
      .from(organisationMemberships)
      .innerJoin(organisations, eq(organisations.id, organisationMemberships.organisationId))
      .where(eq(organisationMemberships.userId, session.user.id));
    return Response.json(
      { data: rows },
      { headers: { "X-Request-ID": requestId, "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? uuidv7();
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session)
      return problem(401, "Authentication required", "A browser session is required.", requestId);
    const organisation = await createOrganisation(session.user.id, await request.json());
    const response = NextResponse.json(
      { data: organisation },
      {
        status: 201,
        headers: {
          "X-Request-ID": requestId,
          "X-Correlation-ID": organisation.correlationId,
          Location: `/api/v1/organisations/${organisation.id}`,
        },
      },
    );
    response.cookies.set(ACTIVE_ORGANISATION_COOKIE, organisation.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

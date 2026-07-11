import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthenticationRequiredError } from "@/auth/session";
import { PermissionDeniedError } from "@/permissions/require";

export function problem(
  status: number,
  title: string,
  detail: string,
  requestId: string,
  errors?: Array<{ path: string; message: string }>,
) {
  return NextResponse.json(
    {
      type: `https://docs.blakcert.local/problems/${title.toLowerCase().replaceAll(" ", "-")}`,
      title,
      status,
      detail,
      instance: requestId,
      ...(errors ? { errors } : {}),
    },
    { status, headers: { "Content-Type": "application/problem+json", "X-Request-ID": requestId } },
  );
}

export function handleApiError(error: unknown, requestId: string) {
  if (error instanceof ZodError) {
    return problem(
      422,
      "Validation failed",
      "One or more request fields are invalid.",
      requestId,
      error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    );
  }
  if (error instanceof AuthenticationRequiredError)
    return problem(401, "Authentication required", error.message, requestId);
  if (error instanceof PermissionDeniedError)
    return problem(403, "Permission denied", error.message, requestId);
  return problem(500, "Internal server error", "The request could not be completed.", requestId);
}

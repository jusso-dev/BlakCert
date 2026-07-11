import { v7 as uuidv7 } from "uuid";
import { authenticateHeaders } from "@/api/authenticate";
import { decodeCertificateCursor, encodeCursor } from "@/api/cursor";
import { handleApiError } from "@/api/problem";
import { importCertificate, listCertificates } from "@/certificates/service";

export async function GET(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? uuidv7();
  try {
    const principal = await authenticateHeaders(request.headers);
    const url = new URL(request.url);
    const result = await listCertificates(principal, {
      limit: Number(url.searchParams.get("limit") ?? 50),
      cursor: decodeCertificateCursor(url.searchParams.get("cursor")),
      search: url.searchParams.get("q") ?? undefined,
      risk: url.searchParams.get("risk") ?? undefined,
    });
    return Response.json(
      {
        data: result.data,
        pagination: {
          nextCursor: result.nextCursor ? encodeCursor(result.nextCursor) : null,
          hasMore: Boolean(result.nextCursor),
        },
      },
      {
        headers: {
          "X-Request-ID": requestId,
          "X-Correlation-ID": requestId,
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? uuidv7();
  const correlationId = request.headers.get("x-correlation-id") ?? uuidv7();
  try {
    const principal = await authenticateHeaders(request.headers);
    const result = await importCertificate(
      { ...principal, requestId, correlationId },
      await request.json(),
    );
    const { pem: publicCertificatePem, ...metadata } = result.certificate;
    void publicCertificatePem;
    return Response.json(
      {
        data: metadata,
        meta: { duplicate: result.duplicate, auditEventId: result.auditEventId, correlationId },
      },
      {
        status: result.duplicate ? 200 : 201,
        headers: {
          "X-Request-ID": requestId,
          "X-Correlation-ID": correlationId,
          Location: `/api/v1/certificates/${result.certificate.id}`,
        },
      },
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

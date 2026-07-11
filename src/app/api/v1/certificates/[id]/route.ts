import { v7 as uuidv7 } from "uuid";
import { authenticateHeaders } from "@/api/authenticate";
import { handleApiError, problem } from "@/api/problem";
import { getCertificate } from "@/certificates/service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = request.headers.get("x-request-id") ?? uuidv7();
  try {
    const [principal, { id }] = await Promise.all([authenticateHeaders(request.headers), params]);
    const certificate = await getCertificate(principal, id);
    if (!certificate) return problem(404, "Not found", "Certificate was not found.", requestId);
    return Response.json(
      { data: certificate },
      {
        headers: {
          "X-Request-ID": requestId,
          ETag: `"${certificate.version}"`,
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

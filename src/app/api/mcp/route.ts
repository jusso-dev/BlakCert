import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { v7 as uuidv7 } from "uuid";
import { authenticateApiKeyValue } from "@/api/authenticate";
import { handleApiError, problem } from "@/api/problem";
import { env } from "@/config/env";
import { createMcpServer } from "@/mcp/create-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? uuidv7();
  if (process.env.MCP_HTTP_ENABLED === "false") {
    return problem(
      404,
      "Not found",
      "The MCP HTTP transport is not enabled in this process.",
      requestId,
    );
  }
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer bk_")) {
      return problem(
        401,
        "Authentication required",
        "A scoped MCP API key is required.",
        requestId,
      );
    }
    const principal = await authenticateApiKeyValue(authorization.slice(7));
    if (!principal.scopes.includes("mcp:connect") && !principal.scopes.includes("*")) {
      return problem(
        403,
        "Permission denied",
        "The API key does not include mcp:connect.",
        requestId,
      );
    }

    const applicationUrl = new URL(env.BETTER_AUTH_URL);
    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
      allowedHosts: [applicationUrl.host],
      allowedOrigins: [applicationUrl.origin],
      enableDnsRebindingProtection: true,
    });
    const server = createMcpServer(principal);
    await server.connect(transport);
    const response = await transport.handleRequest(request, {
      authInfo: {
        token: authorization.slice(7),
        clientId: principal.apiKeyId,
        scopes: principal.scopes,
        expiresAt: Math.floor(Date.now() / 1000) + 300,
      },
    });
    response.headers.set("X-Request-ID", requestId);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { authenticateApiKeyValue } from "@/api/authenticate";
import { createMcpServer } from "./create-server";
import { logger } from "@/observability/logger";

async function main() {
  const value = process.env.BLAKCERT_MCP_API_KEY;
  if (!value) throw new Error("BLAKCERT_MCP_API_KEY is required for the stdio MCP server");
  const principal = await authenticateApiKeyValue(value);
  if (!principal.scopes.includes("mcp:connect") && !principal.scopes.includes("*")) {
    throw new Error("API key does not include the mcp:connect scope");
  }
  const server = createMcpServer(principal);
  await server.connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  logger.error({ error }, "MCP server failed");
  process.exitCode = 1;
});

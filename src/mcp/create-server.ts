import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { v7 as uuidv7 } from "uuid";
import { db } from "@/db/client";
import { recordAudit } from "@/audit/service";
import { getCertificate, listCertificates } from "@/certificates/service";
import { assertNoPrivateMaterial } from "@/security/redaction";
import { toolResultSchema, type ToolResult } from "./contracts";

export type McpPrincipal = {
  userId: string;
  organisationId: string;
  apiKeyId: string;
  scopes: string[];
};

async function auditMcpCall(
  principal: McpPrincipal,
  tool: string,
  resourceId: string | null,
  correlationId: string,
) {
  return db.transaction((tx) =>
    recordAudit(tx, {
      organisationId: principal.organisationId,
      actorType: "mcp_client",
      actorId: principal.apiKeyId,
      action: `mcp.${tool}`,
      resourceType: resourceId ? "certificate" : "certificate_collection",
      resourceId,
      outcome: "success",
      correlationId,
      metadata: { delegatedUserId: principal.userId, scopes: principal.scopes },
    }),
  );
}

function output(result: ToolResult) {
  assertNoPrivateMaterial(result);
  return {
    structuredContent: result,
    content: [{ type: "text" as const, text: JSON.stringify(result) }],
  };
}

export function createMcpServer(principal: McpPrincipal) {
  const server = new McpServer({ name: "BlakCert", version: "1.0.0" });

  server.registerTool(
    "search_certificates",
    {
      title: "Search certificates",
      description:
        "Search certificate metadata in the authenticated organisation. Never returns PEM or private-key material.",
      inputSchema: {
        query: z.string().max(200).default(""),
        limit: z.number().int().min(1).max(100).default(25),
      },
      outputSchema: toolResultSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ query, limit }) => {
      const operationId = uuidv7();
      const correlationId = uuidv7();
      const found = await listCertificates(principal, { search: query, limit });
      const auditEventId = await auditMcpCall(
        principal,
        "search_certificates",
        null,
        correlationId,
      );
      return output({
        success: true,
        operationId,
        correlationId,
        dryRun: false,
        status: "completed",
        summary: `Found ${found.data.length} certificate records in the authorised organisation.`,
        data: { certificates: found.data, nextCursor: found.nextCursor },
        warnings: [],
        policyDecisions: [
          {
            policy: "tenant-boundary",
            outcome: "allow",
            explanation: "Query was bound to the API key organisation.",
          },
        ],
        approvalRequired: false,
        auditEventId,
      });
    },
  );

  server.registerTool(
    "get_certificate",
    {
      title: "Get certificate",
      description:
        "Retrieve certificate metadata, included trust chain validation, risk evidence, and audit history.",
      inputSchema: { certificateId: z.string().uuid() },
      outputSchema: toolResultSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ certificateId }) => {
      const operationId = uuidv7();
      const correlationId = uuidv7();
      const certificate = await getCertificate(principal, certificateId);
      const auditEventId = await auditMcpCall(
        principal,
        "get_certificate",
        certificateId,
        correlationId,
      );
      return output({
        success: Boolean(certificate),
        operationId,
        correlationId,
        dryRun: false,
        status: certificate ? "completed" : "not_found",
        summary: certificate
          ? `Retrieved metadata for ${certificate.commonName ?? certificate.subjectDn}.`
          : "Certificate not found in the authorised organisation.",
        data: certificate ? { certificate } : {},
        warnings: [],
        policyDecisions: [
          {
            policy: "private-key-non-disclosure",
            outcome: "allow",
            explanation:
              "Response contains metadata only; PEM and private-key material are excluded.",
          },
        ],
        approvalRequired: false,
        auditEventId,
      });
    },
  );

  server.registerTool(
    "find_expiring_certificates",
    {
      title: "Find expiring certificates",
      description: "Return certificate metadata ordered by expiry, constrained to 1-365 days.",
      inputSchema: {
        withinDays: z.number().int().min(1).max(365).default(30),
        limit: z.number().int().min(1).max(100).default(50),
      },
      outputSchema: toolResultSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ withinDays, limit }) => {
      const operationId = uuidv7();
      const correlationId = uuidv7();
      const all = await listCertificates(principal, { limit: Math.min(limit * 2, 200) });
      const threshold = Date.now() + withinDays * 86_400_000;
      const matching = all.data
        .filter(
          (item) => item.notAfter.getTime() <= threshold && item.notAfter.getTime() > Date.now(),
        )
        .slice(0, limit);
      const auditEventId = await auditMcpCall(
        principal,
        "find_expiring_certificates",
        null,
        correlationId,
      );
      return output({
        success: true,
        operationId,
        correlationId,
        dryRun: false,
        status: "completed",
        summary: `Found ${matching.length} certificates expiring within ${withinDays} days.`,
        data: { certificates: matching, withinDays },
        warnings:
          matching.length === limit
            ? ["Result reached the requested limit; narrow the scope or paginate."]
            : [],
        policyDecisions: [
          {
            policy: "read-only-inventory",
            outcome: "allow",
            explanation: "This tool cannot modify certificate state.",
          },
        ],
        approvalRequired: false,
        auditEventId,
      });
    },
  );

  server.registerResource(
    "certificate",
    new ResourceTemplate("blakcert://certificates/{certificateId}", { list: undefined }),
    {
      title: "Certificate metadata",
      description: "Read-only certificate metadata without PEM or private keys",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const certificateId = String(variables.certificateId);
      const certificate = await getCertificate(principal, certificateId);
      return {
        contents: [
          { uri: uri.href, mimeType: "application/json", text: JSON.stringify(certificate) },
        ],
      };
    },
  );

  return server;
}

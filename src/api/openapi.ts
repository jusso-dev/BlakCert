export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "BlakCert API",
    version: "1.0.0",
    description:
      "Organisation-scoped enterprise certificate lifecycle API. Private keys are never returned by certificate metadata endpoints.",
  },
  servers: [{ url: "/api/v1" }],
  security: [{ browserSession: [] }, { bearerAuth: [] }],
  paths: {
    "/organisations": {
      get: {
        operationId: "listOrganisations",
        summary: "List organisations for the current user",
        responses: { "200": { description: "Organisation memberships" } },
      },
      post: {
        operationId: "createOrganisation",
        summary: "Create an organisation and owner role assignment",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: { name: { type: "string", minLength: 2, maxLength: 100 } },
              },
            },
          },
        },
        responses: {
          "201": { description: "Organisation created" },
          "401": { $ref: "#/components/responses/Problem" },
        },
      },
    },
    "/certificates": {
      get: {
        operationId: "listCertificates",
        summary: "List certificates with cursor pagination",
        parameters: [
          { name: "cursor", in: "query", schema: { type: "string" } },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 200, default: 50 },
          },
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "risk", in: "query", schema: { $ref: "#/components/schemas/RiskLevel" } },
        ],
        responses: {
          "200": { description: "Paginated certificate metadata" },
          "401": { $ref: "#/components/responses/Problem" },
          "403": { $ref: "#/components/responses/Problem" },
        },
      },
      post: {
        operationId: "importCertificate",
        summary: "Import and validate a PEM certificate bundle",
        parameters: [
          { name: "Idempotency-Key", in: "header", schema: { type: "string", format: "uuid" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CertificateImport" } },
          },
        },
        responses: {
          "201": { description: "Certificate imported" },
          "200": { description: "Existing fingerprint returned idempotently" },
          "422": { $ref: "#/components/responses/Problem" },
        },
      },
    },
    "/certificates/{id}": {
      get: {
        operationId: "getCertificate",
        summary: "Get certificate metadata, names, validated chain, and audit history",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        responses: {
          "200": { description: "Certificate metadata" },
          "404": { $ref: "#/components/responses/Problem" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      browserSession: { type: "apiKey", in: "cookie", name: "better-auth.session_token" },
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "BlakCert API key or OAuth access token",
      },
    },
    schemas: {
      RiskLevel: { type: "string", enum: ["informational", "low", "medium", "high", "critical"] },
      CertificateImport: {
        type: "object",
        required: ["pem", "environment"],
        properties: {
          pem: {
            type: "string",
            description: "PEM certificate blocks only; private keys are rejected",
          },
          environment: {
            type: "string",
            enum: ["development", "test", "staging", "production", "other"],
          },
          ownerUserId: { type: ["string", "null"], format: "uuid" },
          ownerTeam: { type: "string", maxLength: 120 },
          managedStatus: { type: "string", enum: ["managed", "unmanaged", "externally_managed"] },
        },
      },
      Problem: {
        type: "object",
        required: ["type", "title", "status", "detail", "instance"],
        properties: {
          type: { type: "string", format: "uri" },
          title: { type: "string" },
          status: { type: "integer" },
          detail: { type: "string" },
          instance: { type: "string" },
        },
      },
    },
    responses: {
      Problem: {
        description: "RFC 9457 Problem Details",
        content: {
          "application/problem+json": { schema: { $ref: "#/components/schemas/Problem" } },
        },
      },
    },
  },
} as const;

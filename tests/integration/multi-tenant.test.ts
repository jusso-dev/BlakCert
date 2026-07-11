import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { db, sqlClient } from "../../src/db/client";
import { auditEvents, certificates, users } from "../../db/schema";
import { createOrganisation } from "../../src/organisations/service";
import { getCertificate } from "../../src/certificates/service";
import { createMcpServer, type McpPrincipal } from "../../src/mcp/create-server";
import { toolResultSchema } from "../../src/mcp/contracts";

let mcpPrincipal: McpPrincipal | undefined;

afterAll(async () => {
  await sqlClient.end();
});

describe("database tenant and audit boundaries", () => {
  it("does not expose a certificate through another organisation context", async () => {
    const userA = uuidv7();
    const userB = uuidv7();
    await db.insert(users).values([
      { id: userA, name: "Isolation A", email: `${userA}@test.invalid`, emailVerified: true },
      { id: userB, name: "Isolation B", email: `${userB}@test.invalid`, emailVerified: true },
    ]);
    const organisationA = await createOrganisation(userA, {
      name: `Isolation A ${userA.slice(-8)}`,
    });
    const organisationB = await createOrganisation(userB, {
      name: `Isolation B ${userB.slice(-8)}`,
    });
    mcpPrincipal = {
      userId: userA,
      organisationId: organisationA.id,
      apiKeyId: uuidv7(),
      scopes: ["mcp:connect", "certificate:view"],
    };
    const certificateId = uuidv7();
    await db.insert(certificates).values({
      id: certificateId,
      organisationId: organisationB.id,
      fingerprintSha256: "a".repeat(64),
      serialNumber: "01",
      certificateType: "tls_server",
      subjectDn: "CN=tenant-b.test",
      commonName: "tenant-b.test",
      issuerDn: "CN=Test CA",
      notBefore: new Date("2026-01-01T00:00:00Z"),
      notAfter: new Date("2027-01-01T00:00:00Z"),
      signatureAlgorithm: "sha256WithRSAEncryption",
      publicKeyAlgorithm: "rsa",
      publicKeySize: 3072,
      pem: "SYNTHETIC TEST METADATA",
      source: "test",
      riskReasons: [],
      createdBy: userB,
      updatedBy: userB,
    });

    await expect(
      getCertificate({ userId: userA, organisationId: organisationA.id }, certificateId),
    ).resolves.toBeNull();
    await expect(
      getCertificate({ userId: userA, organisationId: organisationB.id }, certificateId),
    ).rejects.toThrow(/Permission denied/);
  });

  it("rejects updates to append-only audit events", async () => {
    const [event] = await db.select({ id: auditEvents.id }).from(auditEvents).limit(1);
    expect(event).toBeDefined();
    let rejection: unknown;
    try {
      await db
        .update(auditEvents)
        .set({ reason: "tampered" })
        .where(eq(auditEvents.id, event?.id ?? uuidv7()));
    } catch (error) {
      rejection = error;
    }
    expect(rejection).toBeInstanceOf(Error);
    const cause = (rejection as { cause?: { message?: string } }).cause;
    expect(cause?.message).toMatch(/append-only/);
  });

  it("returns the strict MCP contract through permission-aware tools", async () => {
    expect(mcpPrincipal).toBeDefined();
    const server = createMcpServer(mcpPrincipal as McpPrincipal);
    const client = new Client({ name: "BlakCert integration test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const response = await client.callTool({
      name: "search_certificates",
      arguments: { query: "", limit: 5 },
    });
    const result = toolResultSchema.parse(response.structuredContent);
    expect(result.success).toBe(true);
    expect(result.auditEventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(result)).not.toMatch(/BEGIN (?:RSA )?PRIVATE KEY/);
    await Promise.all([client.close(), server.close()]);
  });
});

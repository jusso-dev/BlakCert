import { describe, expect, it } from "vitest";
import { calculateCertificateRisk, daysUntil } from "../risk";

const now = new Date("2026-07-11T00:00:00Z");

describe("certificate risk", () => {
  it("makes critical expiry risk explainable", () => {
    const result = calculateCertificateRisk(
      {
        notBefore: new Date("2026-04-13T00:00:00Z"),
        notAfter: new Date("2026-07-16T00:00:00Z"),
        signatureAlgorithm: "sha256WithRSAEncryption",
        publicKeyAlgorithm: "rsa",
        publicKeySize: 3072,
        trustChainState: "valid",
        names: [{ type: "dns", value: "api.example.test" }],
        ownerUserId: "owner",
        managedStatus: "managed",
      },
      now,
    );
    expect(result.level).toBe("critical");
    expect(result.reasons).toContainEqual(expect.objectContaining({ code: "expiry_7d" }));
    expect(daysUntil(new Date("2026-07-16T00:00:00Z"), now)).toBe(5);
  });
});

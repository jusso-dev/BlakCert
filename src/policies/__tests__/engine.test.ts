import { describe, expect, it } from "vitest";
import { evaluateCertificatePolicy, type PolicyCertificate } from "../engine";

const certificate: PolicyCertificate = {
  issuerDn: "CN=Approved Internal CA",
  signatureAlgorithm: "sha256WithRSAEncryption",
  publicKeyAlgorithm: "rsa",
  publicKeySize: 3072,
  notBefore: new Date("2026-07-01T00:00:00Z"),
  notAfter: new Date("2026-09-29T00:00:00Z"),
  dnsNames: ["api.example.test"],
  ownerUserId: "owner",
  certificateTransparencyPresent: true,
  trustChainState: "valid",
  privateKeyCustody: "cloud_kms",
  renewalLeadDays: 30,
};

describe("certificate policy engine", () => {
  it("allows a compliant certificate with evidence for every rule", () => {
    const result = evaluateCertificatePolicy(
      {
        outcome: "deny",
        approvedIssuerPatterns: ["Internal CA"],
        approvedSignatureAlgorithms: ["sha256WithRSAEncryption"],
        minimumRsaKeySize: 3072,
        maximumValidityDays: 90,
        allowedDnsSuffixes: [".example.test"],
        allowWildcards: false,
        requireOwner: true,
        requireValidTrustChain: true,
        allowedCustodyModes: ["cloud_kms"],
      },
      certificate,
    );
    expect(result.outcome).toBe("allow");
    expect(result.explanation.every((item) => item.result)).toBe(true);
  });

  it("requires approval for a wildcard and missing owner", () => {
    const result = evaluateCertificatePolicy(
      { outcome: "require_approval", allowWildcards: false, requireOwner: true },
      { ...certificate, dnsNames: ["*.example.test"], ownerUserId: null },
    );
    expect(result.outcome).toBe("require_approval");
    expect(result.violations.map((item) => item.rule)).toEqual([
      "wildcard_restriction",
      "required_owner",
    ]);
  });
});

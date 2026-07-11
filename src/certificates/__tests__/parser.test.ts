import { describe, expect, it } from "vitest";
import { TEST_CERTIFICATE } from "../../../tests/fixtures/certificate";
import { parseCertificateBundle } from "../parser";

describe("certificate parser", () => {
  it("parses a PEM certificate and stable identity fields", () => {
    const parsed = parseCertificateBundle(TEST_CERTIFICATE);
    expect(parsed.fingerprintSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(parsed.commonName).toBe("api.example.test");
    expect(parsed.names.map((name) => name.value)).toContain("www.example.test");
    expect(parsed.publicKeyAlgorithm).toBe("rsa");
    expect(parsed.publicKeySize).toBe(2048);
  });

  it("rejects private key material before certificate parsing", () => {
    expect(() =>
      parseCertificateBundle("-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----"),
    ).toThrow(/Private key material/);
  });
});

import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "../envelope";

describe("envelope encryption", () => {
  it("authenticates ciphertext against tenant and connector context", () => {
    const encrypted = encryptSecret("connector-token", "org-1:connector-1");
    expect(encrypted.ciphertext).not.toContain("connector-token");
    expect(decryptSecret(encrypted, "org-1:connector-1")).toBe("connector-token");
    expect(() => decryptSecret(encrypted, "org-2:connector-1")).toThrow();
  });
});

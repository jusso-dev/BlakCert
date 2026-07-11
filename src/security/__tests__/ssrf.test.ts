import { describe, expect, it } from "vitest";
import { validateOutboundTarget } from "../ssrf";

describe("SSRF target validation", () => {
  it("blocks metadata and private destinations by default", async () => {
    await expect(
      validateOutboundTarget(
        { url: "http://metadata.internal", allowedProtocols: ["http:"], allowedPorts: [80] },
        async () => ["169.254.169.254"],
      ),
    ).rejects.toThrow(/metadata/i);
    await expect(
      validateOutboundTarget(
        { url: "https://internal.example", allowedProtocols: ["https:"], allowedPorts: [443] },
        async () => ["10.0.0.4"],
      ),
    ).rejects.toThrow(/not explicitly approved/i);
  });

  it("permits an explicitly approved private CIDR", async () => {
    const result = await validateOutboundTarget(
      {
        url: "https://internal.example",
        allowedProtocols: ["https:"],
        allowedPorts: [443],
        approvedPrivateCidrs: ["10.0.0.0/24"],
      },
      async () => ["10.0.0.4"],
    );
    expect(result.addresses).toEqual(["10.0.0.4"]);
  });
});

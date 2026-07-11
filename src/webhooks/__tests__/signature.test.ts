import { describe, expect, it } from "vitest";
import { signWebhook, verifyWebhookSignature } from "../signature";

describe("webhook signatures", () => {
  it("authenticates current payloads and rejects replay windows", () => {
    const signature = signWebhook("test-secret", "event-1", 1_000, '{"ok":true}');
    expect(
      verifyWebhookSignature({
        secret: "test-secret",
        eventId: "event-1",
        timestamp: 1_000,
        payload: '{"ok":true}',
        signature,
        now: 1_100,
      }),
    ).toBe(true);
    expect(
      verifyWebhookSignature({
        secret: "test-secret",
        eventId: "event-1",
        timestamp: 1_000,
        payload: '{"ok":true}',
        signature,
        now: 2_000,
      }),
    ).toBe(false);
  });
});

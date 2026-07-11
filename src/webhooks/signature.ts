import { createHmac, timingSafeEqual } from "node:crypto";

export function signWebhook(
  secret: string,
  eventId: string,
  timestamp: number,
  payload: string,
): string {
  return `v1=${createHmac("sha256", secret).update(`${eventId}.${timestamp}.${payload}`).digest("hex")}`;
}

export function verifyWebhookSignature(input: {
  secret: string;
  eventId: string;
  timestamp: number;
  payload: string;
  signature: string;
  now?: number;
  toleranceSeconds?: number;
}): boolean {
  const now = input.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - input.timestamp) > (input.toleranceSeconds ?? 300)) return false;
  const expected = Buffer.from(
    signWebhook(input.secret, input.eventId, input.timestamp, input.payload),
  );
  const actual = Buffer.from(input.signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

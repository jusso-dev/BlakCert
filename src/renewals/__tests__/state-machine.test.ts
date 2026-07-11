import { describe, expect, it } from "vitest";
import { assertRenewalTransition, canTransitionRenewal } from "../state-machine";

describe("renewal state machine", () => {
  it("supports the validated issuance and deployment path", () => {
    const path = [
      "scheduled",
      "queued",
      "awaiting_approval",
      "generating_key",
      "generating_csr",
      "requesting_issuance",
      "awaiting_ca",
      "issued",
      "deploying",
      "validating",
      "completed",
    ] as const;
    for (let index = 0; index < path.length - 1; index += 1) {
      expect(canTransitionRenewal(path[index]!, path[index + 1]!)).toBe(true);
    }
  });

  it("rejects skipping validation or reopening terminal completion", () => {
    expect(() => assertRenewalTransition("deploying", "completed")).toThrow(
      /Invalid renewal transition/,
    );
    expect(() => assertRenewalTransition("completed", "queued")).toThrow(
      /Invalid renewal transition/,
    );
  });
});

export const RENEWAL_STATES = [
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
  "failed",
  "rolled_back",
  "cancelled",
] as const;

export type RenewalState = (typeof RENEWAL_STATES)[number];

const transitions: Record<RenewalState, readonly RenewalState[]> = {
  scheduled: ["queued", "cancelled"],
  queued: ["awaiting_approval", "generating_key", "cancelled", "failed"],
  awaiting_approval: ["generating_key", "cancelled", "failed"],
  generating_key: ["generating_csr", "failed", "cancelled"],
  generating_csr: ["requesting_issuance", "failed", "cancelled"],
  requesting_issuance: ["awaiting_ca", "issued", "failed"],
  awaiting_ca: ["issued", "failed", "cancelled"],
  issued: ["deploying", "failed"],
  deploying: ["validating", "failed", "rolled_back"],
  validating: ["completed", "failed", "rolled_back"],
  completed: [],
  failed: ["queued", "rolled_back", "cancelled"],
  rolled_back: [],
  cancelled: [],
};

export function canTransitionRenewal(from: RenewalState, to: RenewalState): boolean {
  return transitions[from].includes(to);
}

export function assertRenewalTransition(from: RenewalState, to: RenewalState): void {
  if (!canTransitionRenewal(from, to)) {
    throw new Error(`Invalid renewal transition: ${from} -> ${to}`);
  }
}

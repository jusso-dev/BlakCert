import { describe, expect, it } from "vitest";
import { assertSeparationOfDuties, BUILT_IN_ROLES, PERMISSIONS } from "../model";

describe("built-in permissions", () => {
  it("enforces separation of duties for requesters and agents", () => {
    expect(assertSeparationOfDuties).not.toThrow();
    expect(BUILT_IN_ROLES.certificate_requester).not.toContain(PERMISSIONS.certificateApprove);
    expect(BUILT_IN_ROLES.agent_service_account).not.toContain(PERMISSIONS.privateKeyExport);
  });
});

export const PERMISSIONS = {
  certificateView: "certificate:view",
  certificateImport: "certificate:import",
  certificateRequest: "certificate:request",
  certificateApprove: "certificate:approve",
  certificateRenew: "certificate:renew",
  certificateRevoke: "certificate:revoke",
  certificateExport: "certificate:export",
  privateKeyExport: "private_key:export",
  deploymentView: "deployment:view",
  authorityManage: "authority:manage",
  connectorManage: "connector:manage",
  discoveryScopeManage: "discovery_scope:manage",
  discoveryRun: "discovery:run",
  trustStoreManage: "trust_store:manage",
  auditView: "audit:view",
  auditExport: "audit:export",
  userManage: "user:manage",
  ssoManage: "sso:manage",
  apiKeyManage: "api_key:manage",
  agentManage: "agent:manage",
  agentApprove: "agent:approve",
  policyManage: "policy:manage",
  exceptionApprove: "exception:approve",
  organisationManage: "organisation:manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const BUILT_IN_ROLES: Record<string, readonly Permission[]> = {
  organisation_owner: Object.values(PERMISSIONS),
  organisation_administrator: Object.values(PERMISSIONS).filter(
    (permission) => permission !== PERMISSIONS.privateKeyExport,
  ),
  security_administrator: [
    PERMISSIONS.certificateView,
    PERMISSIONS.certificateRevoke,
    PERMISSIONS.trustStoreManage,
    PERMISSIONS.auditView,
    PERMISSIONS.auditExport,
    PERMISSIONS.ssoManage,
    PERMISSIONS.policyManage,
    PERMISSIONS.exceptionApprove,
    PERMISSIONS.agentApprove,
  ],
  pki_administrator: [
    PERMISSIONS.certificateView,
    PERMISSIONS.certificateImport,
    PERMISSIONS.certificateRequest,
    PERMISSIONS.certificateRenew,
    PERMISSIONS.certificateRevoke,
    PERMISSIONS.certificateExport,
    PERMISSIONS.deploymentView,
    PERMISSIONS.authorityManage,
    PERMISSIONS.connectorManage,
    PERMISSIONS.discoveryScopeManage,
    PERMISSIONS.discoveryRun,
  ],
  certificate_manager: [
    PERMISSIONS.certificateView,
    PERMISSIONS.certificateImport,
    PERMISSIONS.certificateRequest,
    PERMISSIONS.certificateRenew,
    PERMISSIONS.deploymentView,
  ],
  certificate_requester: [PERMISSIONS.certificateView, PERMISSIONS.certificateRequest],
  certificate_approver: [PERMISSIONS.certificateView, PERMISSIONS.certificateApprove],
  auditor: [
    PERMISSIONS.certificateView,
    PERMISSIONS.deploymentView,
    PERMISSIONS.auditView,
    PERMISSIONS.auditExport,
  ],
  read_only_analyst: [PERMISSIONS.certificateView, PERMISSIONS.deploymentView],
  developer: [
    PERMISSIONS.certificateView,
    PERMISSIONS.certificateRequest,
    PERMISSIONS.deploymentView,
  ],
  connector_service_account: [
    PERMISSIONS.certificateView,
    PERMISSIONS.discoveryRun,
    PERMISSIONS.deploymentView,
  ],
  agent_service_account: [PERMISSIONS.certificateView, PERMISSIONS.deploymentView],
};

export function assertSeparationOfDuties(): void {
  const agent = BUILT_IN_ROLES.agent_service_account ?? [];
  if (
    agent.includes(PERMISSIONS.privateKeyExport) ||
    agent.includes(PERMISSIONS.certificateRevoke)
  ) {
    throw new Error(
      "Agent service accounts may not export private keys or directly revoke certificates",
    );
  }
  const requester = BUILT_IN_ROLES.certificate_requester ?? [];
  if (requester.includes(PERMISSIONS.certificateApprove)) {
    throw new Error("Certificate requesters may not approve requests by role");
  }
}

assertSeparationOfDuties();

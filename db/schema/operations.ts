import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  cidr,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { environmentEnum, id, policyOutcomeEnum, riskLevelEnum, timestamps } from "./common";
import { users } from "./auth";
import { certificates } from "./certificates";
import { organisations, workspaces } from "./organisations";

export const renewalStateEnum = pgEnum("renewal_state", [
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
]);
export const approvalStatusEnum = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
  "expired",
  "cancelled",
]);
export const connectorHealthEnum = pgEnum("connector_health", [
  "unknown",
  "healthy",
  "degraded",
  "unhealthy",
  "disabled",
]);

export const approvalWorkflows = pgTable(
  "approval_workflows",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "restrict" }),
    resourceType: text("resource_type").notNull(),
    resourceId: uuid("resource_id").notNull(),
    action: text("action").notNull(),
    requesterId: uuid("requester_id")
      .notNull()
      .references(() => users.id),
    status: approvalStatusEnum("status").notNull().default("pending"),
    mode: text("mode").notNull(),
    requiredApprovals: integer("required_approvals").notNull().default(1),
    currentSequence: integer("current_sequence").notNull().default(1),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    correlationId: uuid("correlation_id").notNull(),
    ...timestamps,
  },
  (table) => [index("approval_workflows_org_status_idx").on(table.organisationId, table.status)],
);

export const approvalSteps = pgTable(
  "approval_steps",
  {
    id: id(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => approvalWorkflows.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    mode: text("mode").notNull(),
    approverRoleKey: text("approver_role_key"),
    approverGroupId: uuid("approver_group_id"),
    approverUserId: uuid("approver_user_id").references(() => users.id),
    requiredDecisions: integer("required_decisions").notNull().default(1),
    stepUpRequired: boolean("step_up_required").notNull().default(false),
    status: approvalStatusEnum("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("approval_steps_workflow_sequence_unique").on(table.workflowId, table.sequence),
  ],
);

export const approvalDecisions = pgTable(
  "approval_decisions",
  {
    id: id(),
    stepId: uuid("step_id")
      .notNull()
      .references(() => approvalSteps.id, { onDelete: "cascade" }),
    approverId: uuid("approver_id")
      .notNull()
      .references(() => users.id),
    decision: text("decision").notNull(),
    comment: text("comment"),
    evidence: jsonb("evidence").$type<Array<{ type: string; reference: string }>>(),
    stepUpVerifiedAt: timestamp("step_up_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("approval_decisions_step_approver_unique").on(table.stepId, table.approverId),
  ],
);

export const renewalWorkflows = pgTable(
  "renewal_workflows",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "restrict" }),
    certificateId: uuid("certificate_id")
      .notNull()
      .references(() => certificates.id, { onDelete: "restrict" }),
    replacementCertificateId: uuid("replacement_certificate_id").references(() => certificates.id),
    state: renewalStateEnum("state").notNull().default("scheduled"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    maintenanceWindow: jsonb("maintenance_window").$type<{
      timezone: string;
      start: string;
      end: string;
    }>(),
    approvalWorkflowId: uuid("approval_workflow_id").references(() => approvalWorkflows.id),
    idempotencyKey: text("idempotency_key").notNull(),
    dryRun: boolean("dry_run").notNull().default(false),
    progress: integer("progress").notNull().default(0),
    failureCode: text("failure_code"),
    failureSummary: text("failure_summary"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    correlationId: uuid("correlation_id").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("renewal_workflows_org_idempotency_unique").on(
      table.organisationId,
      table.idempotencyKey,
    ),
    index("renewal_workflows_due_idx").on(table.state, table.scheduledFor),
    check("renewal_progress_range", sql`${table.progress} BETWEEN 0 AND 100`),
  ],
);

export const renewalSteps = pgTable(
  "renewal_steps",
  {
    id: id(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => renewalWorkflows.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    name: text("name").notNull(),
    state: text("state").notNull().default("pending"),
    attempt: integer("attempt").notNull().default(0),
    input: jsonb("input").$type<Record<string, unknown>>(),
    safeOutput: jsonb("safe_output").$type<Record<string, unknown>>(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorCode: text("error_code"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("renewal_steps_workflow_sequence_unique").on(table.workflowId, table.sequence),
  ],
);

export const revocationRequests = pgTable("revocation_requests", {
  id: id(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "restrict" }),
  certificateId: uuid("certificate_id")
    .notNull()
    .references(() => certificates.id, { onDelete: "restrict" }),
  requesterId: uuid("requester_id")
    .notNull()
    .references(() => users.id),
  reason: text("reason").notNull(),
  justification: text("justification").notNull(),
  emergency: boolean("emergency").notNull().default(false),
  incidentReference: text("incident_reference"),
  status: text("status").notNull().default("awaiting_approval"),
  approvalWorkflowId: uuid("approval_workflow_id").references(() => approvalWorkflows.id),
  caConfirmation: jsonb("ca_confirmation").$type<Record<string, string>>(),
  ocspVerifiedAt: timestamp("ocsp_verified_at", { withTimezone: true }),
  crlVerifiedAt: timestamp("crl_verified_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  correlationId: uuid("correlation_id").notNull(),
  ...timestamps,
});

export const trustStores = pgTable(
  "trust_stores",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "restrict" }),
    workspaceId: uuid("workspace_id").references(() => workspaces.id),
    name: text("name").notNull(),
    type: text("type").notNull(),
    targetReference: text("target_reference").notNull(),
    environment: environmentEnum("environment").notNull(),
    status: text("status").notNull().default("unknown"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("trust_stores_org_target_unique").on(table.organisationId, table.targetReference),
  ],
);

export const trustStoreCertificates = pgTable(
  "trust_store_certificates",
  {
    trustStoreId: uuid("trust_store_id")
      .notNull()
      .references(() => trustStores.id, { onDelete: "cascade" }),
    certificateId: uuid("certificate_id")
      .notNull()
      .references(() => certificates.id, { onDelete: "restrict" }),
    trustStatus: text("trust_status").notNull(),
    deployedAt: timestamp("deployed_at", { withTimezone: true }),
    removalPlannedAt: timestamp("removal_planned_at", { withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.trustStoreId, table.certificateId] })],
);

export const connectors = pgTable(
  "connectors",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    version: text("version").notNull(),
    capabilities: text("capabilities").array().notNull(),
    configuration: jsonb("configuration").$type<Record<string, unknown>>().notNull(),
    authenticationType: text("authentication_type").notNull(),
    health: connectorHealthEnum("health").notNull().default("unknown"),
    allowedScopes: jsonb("allowed_scopes").$type<Record<string, unknown>>().notNull(),
    rateLimitPerMinute: integer("rate_limit_per_minute").notNull().default(60),
    retryPolicy: jsonb("retry_policy")
      .$type<{ maxAttempts: number; baseDelayMs: number }>()
      .notNull(),
    webhookSupport: boolean("webhook_support").notNull().default(false),
    lastSuccessfulSyncAt: timestamp("last_successful_sync_at", { withTimezone: true }),
    lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
    lastFailureSummary: text("last_failure_summary"),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex("connectors_org_name_unique").on(table.organisationId, table.name)],
);

export const connectorSecrets = pgTable("connector_secrets", {
  id: id(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  connectorId: uuid("connector_id")
    .notNull()
    .references(() => connectors.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  ciphertext: text("ciphertext").notNull(),
  encryptedDataKey: text("encrypted_data_key").notNull(),
  nonce: text("nonce").notNull(),
  authTag: text("auth_tag").notNull(),
  keyVersion: text("key_version").notNull(),
  rotatedAt: timestamp("rotated_at", { withTimezone: true }),
  ...timestamps,
});

export const connectorSyncRuns = pgTable("connector_sync_runs", {
  id: id(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  connectorId: uuid("connector_id")
    .notNull()
    .references(() => connectors.id, { onDelete: "cascade" }),
  mode: text("mode").notNull(),
  status: text("status").notNull(),
  cursor: text("cursor"),
  discoveredCount: integer("discovered_count").notNull().default(0),
  changedCount: integer("changed_count").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  correlationId: uuid("correlation_id").notNull(),
});

export const discoveryScopes = pgTable(
  "discovery_scopes",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "restrict" }),
    connectorId: uuid("connector_id").references(() => connectors.id),
    name: text("name").notNull(),
    networks: cidr("networks")
      .array()
      .notNull()
      .default(sql`'{}'::cidr[]`),
    domains: text("domains")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    ports: integer("ports")
      .array()
      .notNull()
      .default(sql`'{}'::integer[]`),
    protocols: text("protocols")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    rateLimitPerMinute: integer("rate_limit_per_minute").notNull().default(60),
    allowedWindows:
      jsonb("allowed_windows").$type<Array<{ timezone: string; start: string; end: string }>>(),
    exclusions: jsonb("exclusions").$type<{ networks?: string[]; domains?: string[] }>(),
    dataClassification: text("data_classification").notNull(),
    responsibleOwnerId: uuid("responsible_owner_id")
      .notNull()
      .references(() => users.id),
    approvalWorkflowId: uuid("approval_workflow_id").references(() => approvalWorkflows.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex("discovery_scopes_org_name_unique").on(table.organisationId, table.name)],
);

export const discoveryScans = pgTable("discovery_scans", {
  id: id(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  scopeId: uuid("scope_id")
    .notNull()
    .references(() => discoveryScopes.id, { onDelete: "restrict" }),
  requestedBy: uuid("requested_by")
    .notNull()
    .references(() => users.id),
  dryRun: boolean("dry_run").notNull().default(true),
  status: text("status").notNull().default("queued"),
  progress: integer("progress").notNull().default(0),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  correlationId: uuid("correlation_id").notNull(),
  ...timestamps,
});

export const discoveredEndpoints = pgTable(
  "discovered_endpoints",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => discoveryScans.id, { onDelete: "cascade" }),
    hostname: text("hostname"),
    ipAddress: text("ip_address"),
    port: integer("port").notNull(),
    protocol: text("protocol").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    handshakeMetadata: jsonb("handshake_metadata").$type<Record<string, unknown>>(),
  },
  (table) => [index("discovered_endpoints_scan_idx").on(table.scanId)],
);

export const discoveredCertificates = pgTable("discovered_certificates", {
  id: id(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  scanId: uuid("scan_id")
    .notNull()
    .references(() => discoveryScans.id, { onDelete: "cascade" }),
  endpointId: uuid("endpoint_id").references(() => discoveredEndpoints.id, { onDelete: "cascade" }),
  fingerprintSha256: text("fingerprint_sha256").notNull(),
  pem: text("pem").notNull(),
  reviewStatus: text("review_status").notNull().default("pending"),
  importedCertificateId: uuid("imported_certificate_id").references(() => certificates.id),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
});

export const policies = pgTable(
  "policies",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description"),
    priority: integer("priority").notNull().default(100),
    scope: jsonb("scope").$type<Record<string, unknown>>().notNull(),
    enabled: boolean("enabled").notNull().default(false),
    currentVersionId: uuid("current_version_id"),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveUntil: timestamp("effective_until", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex("policies_org_name_unique").on(table.organisationId, table.name)],
);

export const policyVersions = pgTable(
  "policy_versions",
  {
    id: id(),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => policies.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    definition: jsonb("definition")
      .$type<{
        all?: Array<Record<string, unknown>>;
        any?: Array<Record<string, unknown>>;
        outcome: string;
      }>()
      .notNull(),
    checksum: text("checksum").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("policy_versions_policy_version_unique").on(table.policyId, table.version),
  ],
);

export const policyEvaluations = pgTable("policy_evaluations", {
  id: id(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  policyVersionId: uuid("policy_version_id")
    .notNull()
    .references(() => policyVersions.id, { onDelete: "restrict" }),
  resourceType: text("resource_type").notNull(),
  resourceId: uuid("resource_id").notNull(),
  outcome: policyOutcomeEnum("outcome").notNull(),
  explanation: jsonb("explanation")
    .$type<Array<{ rule: string; result: boolean; evidence: string }>>()
    .notNull(),
  inputHash: text("input_hash").notNull(),
  evaluatedAt: timestamp("evaluated_at", { withTimezone: true }).notNull().defaultNow(),
  correlationId: uuid("correlation_id").notNull(),
});

export const policyViolations = pgTable("policy_violations", {
  id: id(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  evaluationId: uuid("evaluation_id")
    .notNull()
    .references(() => policyEvaluations.id, { onDelete: "cascade" }),
  policyId: uuid("policy_id")
    .notNull()
    .references(() => policies.id),
  resourceType: text("resource_type").notNull(),
  resourceId: uuid("resource_id").notNull(),
  severity: riskLevelEnum("severity").notNull(),
  code: text("code").notNull(),
  summary: text("summary").notNull(),
  status: text("status").notNull().default("open"),
  firstDetectedAt: timestamp("first_detected_at", { withTimezone: true }).notNull().defaultNow(),
  lastDetectedAt: timestamp("last_detected_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const policyExceptions = pgTable("policy_exceptions", {
  id: id(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "restrict" }),
  policyId: uuid("policy_id")
    .notNull()
    .references(() => policies.id),
  resourceType: text("resource_type").notNull(),
  resourceId: uuid("resource_id").notNull(),
  requesterId: uuid("requester_id")
    .notNull()
    .references(() => users.id),
  businessJustification: text("business_justification").notNull(),
  riskAcceptance: text("risk_acceptance").notNull(),
  compensatingControls: text("compensating_controls").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  reviewAt: timestamp("review_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("pending"),
  approvalWorkflowId: uuid("approval_workflow_id").references(() => approvalWorkflows.id),
  evidence: jsonb("evidence").$type<Array<{ type: string; reference: string }>>(),
  ...timestamps,
});

export const risks = pgTable(
  "risks",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    resourceType: text("resource_type").notNull(),
    resourceId: uuid("resource_id").notNull(),
    level: riskLevelEnum("level").notNull(),
    score: integer("score").notNull(),
    modelVersion: text("model_version").notNull(),
    factors: jsonb("factors")
      .$type<Array<{ code: string; score: number; evidence: string }>>()
      .notNull(),
    status: text("status").notNull().default("open"),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("risks_resource_model_unique").on(
      table.organisationId,
      table.resourceType,
      table.resourceId,
      table.modelVersion,
    ),
    check("risks_score_range", sql`${table.score} BETWEEN 0 AND 100`),
  ],
);

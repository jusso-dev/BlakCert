import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  inet,
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
import { actorTypeEnum, id, policyOutcomeEnum, riskLevelEnum, timestamps } from "./common";
import { users } from "./auth";
import { organisations, workspaces } from "./organisations";

export const jobStatusEnum = pgEnum("job_status", [
  "scheduled",
  "queued",
  "leased",
  "running",
  "retrying",
  "completed",
  "failed",
  "dead_letter",
  "cancelled",
]);
export const agentRunStatusEnum = pgEnum("agent_run_status", [
  "draft",
  "planning",
  "awaiting_approval",
  "running",
  "partially_completed",
  "completed",
  "failed",
  "cancelled",
]);

export const serviceAccounts = pgTable(
  "service_accounts",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex("service_accounts_org_name_unique").on(table.organisationId, table.name)],
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    serviceAccountId: uuid("service_account_id").references(() => serviceAccounts.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(),
    secretHash: text("secret_hash").notNull(),
    scopes: text("scopes").array().notNull(),
    ipRestrictions: inet("ip_restrictions").array(),
    allowedOrigins: text("allowed_origins").array(),
    environmentRestrictions: text("environment_restrictions").array(),
    rateLimitPerMinute: integer("rate_limit_per_minute").notNull().default(120),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    lastUsedIp: inet("last_used_ip"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex("api_keys_prefix_unique").on(table.prefix)],
);

export const oauthClients = pgTable("oauth_clients", {
  id: id(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  clientId: text("client_id").notNull().unique(),
  clientSecretHash: text("client_secret_hash"),
  name: text("name").notNull(),
  redirectUris: text("redirect_uris").array().notNull(),
  grantTypes: text("grant_types").array().notNull(),
  scopes: text("scopes").array().notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  ...timestamps,
});

export const oauthTokens = pgTable("oauth_tokens", {
  id: id(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  clientId: uuid("client_id")
    .notNull()
    .references(() => oauthClients.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  serviceAccountId: uuid("service_account_id").references(() => serviceAccounts.id, {
    onDelete: "cascade",
  }),
  tokenHash: text("token_hash").notNull().unique(),
  type: text("type").notNull(),
  scopes: text("scopes").array().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const backgroundJobs = pgTable(
  "background_jobs",
  {
    id: id(),
    organisationId: uuid("organisation_id").references(() => organisations.id, {
      onDelete: "cascade",
    }),
    queue: text("queue").notNull(),
    type: text("type").notNull(),
    status: jobStatusEnum("status").notNull().default("queued"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    safeResult: jsonb("safe_result").$type<Record<string, unknown>>(),
    idempotencyKey: text("idempotency_key").notNull(),
    priority: integer("priority").notNull().default(100),
    attempt: integer("attempt").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull().defaultNow(),
    leaseOwner: text("lease_owner"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
    progress: integer("progress").notNull().default(0),
    cancellationRequestedAt: timestamp("cancellation_requested_at", { withTimezone: true }),
    errorCode: text("error_code"),
    errorSummary: text("error_summary"),
    correlationId: uuid("correlation_id").notNull(),
    auditEventId: uuid("audit_event_id"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("background_jobs_org_idempotency_unique").on(
      table.organisationId,
      table.type,
      table.idempotencyKey,
    ),
    index("background_jobs_claim_idx").on(
      table.queue,
      table.status,
      table.scheduledFor,
      table.priority,
    ),
    check("background_jobs_progress_range", sql`${table.progress} BETWEEN 0 AND 100`),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: id(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    organisationId: uuid("organisation_id").references(() => organisations.id, {
      onDelete: "restrict",
    }),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "restrict" }),
    actorType: actorTypeEnum("actor_type").notNull(),
    actorId: uuid("actor_id"),
    impersonatorId: uuid("impersonator_id"),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    outcome: text("outcome").notNull(),
    reason: text("reason"),
    sourceIp: inet("source_ip"),
    userAgent: text("user_agent"),
    sessionId: uuid("session_id"),
    requestId: uuid("request_id").notNull(),
    correlationId: uuid("correlation_id").notNull(),
    beforeHash: text("before_hash"),
    afterHash: text("after_hash"),
    safeDiff: jsonb("safe_diff").$type<Record<string, unknown>>(),
    policyDecision: policyOutcomeEnum("policy_decision"),
    approvalReference: uuid("approval_reference"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    previousEventHash: text("previous_event_hash"),
    eventHash: text("event_hash").notNull(),
    keyVersion: text("key_version").notNull().default("v1"),
  },
  (table) => [
    uniqueIndex("audit_events_event_hash_unique").on(table.eventHash),
    index("audit_events_org_time_idx").on(table.organisationId, table.occurredAt, table.id),
    index("audit_events_correlation_idx").on(table.correlationId),
  ],
);

export const auditExports = pgTable("audit_exports", {
  id: id(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "restrict" }),
  requestedBy: uuid("requested_by")
    .notNull()
    .references(() => users.id),
  format: text("format").notNull(),
  filters: jsonb("filters").$type<Record<string, unknown>>().notNull(),
  fileObjectId: uuid("file_object_id"),
  status: text("status").notNull().default("queued"),
  legalHold: boolean("legal_hold").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  ...timestamps,
});

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: id(),
    organisationId: uuid("organisation_id").references(() => organisations.id),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    correlationId: uuid("correlation_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
  },
  (table) => [index("outbox_unpublished_idx").on(table.publishedAt, table.occurredAt)],
);

export const webhooks = pgTable(
  "webhooks",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    endpointUrl: text("endpoint_url").notNull(),
    secretCiphertext: text("secret_ciphertext").notNull(),
    secretKeyVersion: text("secret_key_version").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    disabledReason: text("disabled_reason"),
    ...timestamps,
  },
  (table) => [uniqueIndex("webhooks_org_name_unique").on(table.organisationId, table.name)],
);

export const webhookSubscriptions = pgTable(
  "webhook_subscriptions",
  {
    webhookId: uuid("webhook_id")
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    filter: jsonb("filter").$type<Record<string, unknown>>(),
  },
  (table) => [primaryKey({ columns: [table.webhookId, table.eventType] })],
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    webhookId: uuid("webhook_id")
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    eventId: uuid("event_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    signature: text("signature").notNull(),
    status: text("status").notNull().default("queued"),
    attempt: integer("attempt").notNull().default(0),
    responseStatus: integer("response_status"),
    responseBodyHash: text("response_body_hash"),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("webhook_deliveries_hook_event_unique").on(table.webhookId, table.eventId),
  ],
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    minimumSeverity: riskLevelEnum("minimum_severity").notNull().default("low"),
    quietHours: jsonb("quiet_hours").$type<{ timezone: string; start: string; end: string }>(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.organisationId, table.userId, table.channel] })],
);

export const notifications = pgTable("notifications", {
  id: id(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  recipientUserId: uuid("recipient_user_id").references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  severity: riskLevelEnum("severity").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  resourceType: text("resource_type"),
  resourceId: text("resource_id"),
  deduplicationKey: text("deduplication_key"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notificationDeliveries = pgTable("notification_deliveries", {
  id: id(),
  notificationId: uuid("notification_id")
    .notNull()
    .references(() => notifications.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(),
  destinationHash: text("destination_hash").notNull(),
  status: text("status").notNull().default("queued"),
  attempt: integer("attempt").notNull().default(0),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  errorSummary: text("error_summary"),
  ...timestamps,
});

export const mcpClients = pgTable("mcp_clients", {
  id: id(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  serviceAccountId: uuid("service_account_id").references(() => serviceAccounts.id),
  apiKeyId: uuid("api_key_id").references(() => apiKeys.id),
  allowedTools: text("allowed_tools").array().notNull(),
  allowedResources: text("allowed_resources").array().notNull(),
  maxResponseBytes: integer("max_response_bytes").notNull().default(262144),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  ...timestamps,
});

export const mcpSessions = pgTable("mcp_sessions", {
  id: id(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  clientId: uuid("client_id")
    .notNull()
    .references(() => mcpClients.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  scopes: text("scopes").array().notNull(),
  correlationId: uuid("correlation_id").notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentProfiles = pgTable(
  "agent_profiles",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull(),
    systemInstructions: text("system_instructions").notNull(),
    allowedTools: text("allowed_tools").array().notNull(),
    permissionScopes: text("permission_scopes").array().notNull(),
    maxSteps: integer("max_steps").notNull().default(12),
    maxToolCalls: integer("max_tool_calls").notNull().default(20),
    maxAffectedResources: integer("max_affected_resources").notNull().default(50),
    timeoutSeconds: integer("timeout_seconds").notNull().default(300),
    dryRunDefault: boolean("dry_run_default").notNull().default(true),
    enabled: boolean("enabled").notNull().default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex("agent_profiles_org_name_unique").on(table.organisationId, table.name)],
);

export const agentRuns = pgTable("agent_runs", {
  id: id(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "restrict" }),
  agentProfileId: uuid("agent_profile_id")
    .notNull()
    .references(() => agentProfiles.id, { onDelete: "restrict" }),
  initiatingActorType: actorTypeEnum("initiating_actor_type").notNull(),
  initiatingActorId: uuid("initiating_actor_id").notNull(),
  goal: text("goal").notNull(),
  input: jsonb("input").$type<Record<string, unknown>>().notNull(),
  status: agentRunStatusEnum("status").notNull().default("draft"),
  plan: jsonb("plan").$type<Array<{ step: number; intent: string; tool?: string }>>(),
  output: jsonb("output").$type<Record<string, unknown>>(),
  policyDecisions: jsonb("policy_decisions").$type<Array<Record<string, unknown>>>().notNull(),
  dryRun: boolean("dry_run").notNull().default(true),
  model: text("model"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  costMicros: bigint("cost_micros", { mode: "number" }),
  correlationId: uuid("correlation_id").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestamps,
});

export const agentToolCalls = pgTable(
  "agent_tool_calls",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "restrict" }),
    agentRunId: uuid("agent_run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    toolName: text("tool_name").notNull(),
    intent: text("intent").notNull(),
    input: jsonb("input").$type<Record<string, unknown>>().notNull(),
    safeOutput: jsonb("safe_output").$type<Record<string, unknown>>(),
    dryRun: boolean("dry_run").notNull(),
    status: text("status").notNull(),
    affectedResourceCount: integer("affected_resource_count").notNull().default(0),
    approvalWorkflowId: uuid("approval_workflow_id"),
    auditEventId: uuid("audit_event_id").references(() => auditEvents.id),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("agent_tool_calls_run_sequence_unique").on(table.agentRunId, table.sequence),
  ],
);

export const agentRecommendations = pgTable("agent_recommendations", {
  id: id(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  agentRunId: uuid("agent_run_id").references(() => agentRuns.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  summary: text("summary").notNull(),
  evidence: jsonb("evidence").$type<Array<{ source: string; fact: string }>>().notNull(),
  confidence: integer("confidence").notNull(),
  risk: riskLevelEnum("risk").notNull(),
  affectedResources: jsonb("affected_resources")
    .$type<Array<{ type: string; id: string }>>()
    .notNull(),
  suggestedAction: text("suggested_action").notNull(),
  reversible: boolean("reversible").notNull(),
  approvalRequired: boolean("approval_required").notNull(),
  policyReferences: text("policy_references").array().notNull(),
  status: text("status").notNull().default("open"),
  ...timestamps,
});

export const fileObjects = pgTable("file_objects", {
  id: id(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "restrict" }),
  purpose: text("purpose").notNull(),
  storageProvider: text("storage_provider").notNull(),
  bucket: text("bucket").notNull(),
  objectKey: text("object_key").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  sha256: text("sha256").notNull(),
  encrypted: boolean("encrypted").notNull().default(true),
  encryptionMetadata: jsonb("encryption_metadata").$type<Record<string, string>>(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  legalHold: boolean("legal_hold").notNull().default(false),
  createdBy: uuid("created_by").references(() => users.id),
  ...timestamps,
});

export const reports = pgTable("reports", {
  id: id(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "restrict" }),
  type: text("type").notNull(),
  format: text("format").notNull(),
  parameters: jsonb("parameters").$type<Record<string, unknown>>().notNull(),
  status: text("status").notNull().default("queued"),
  fileObjectId: uuid("file_object_id").references(() => fileObjects.id),
  requestedBy: uuid("requested_by")
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestamps,
});

export const reportSchedules = pgTable("report_schedules", {
  id: id(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  format: text("format").notNull(),
  parameters: jsonb("parameters").$type<Record<string, unknown>>().notNull(),
  cronExpression: text("cron_expression").notNull(),
  timezone: text("timezone").notNull(),
  recipients: text("recipients").array().notNull(),
  enabled: boolean("enabled").notNull().default(true),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  ...timestamps,
});

import { boolean, jsonb, pgEnum, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const actorTypeEnum = pgEnum("actor_type", [
  "user",
  "service_account",
  "agent",
  "mcp_client",
  "system",
]);
export const environmentEnum = pgEnum("environment", [
  "development",
  "test",
  "staging",
  "production",
  "other",
]);
export const lifecycleStateEnum = pgEnum("lifecycle_state", [
  "discovered",
  "requested",
  "active",
  "expiring",
  "expired",
  "revoked",
  "retired",
]);
export const riskLevelEnum = pgEnum("risk_level", [
  "informational",
  "low",
  "medium",
  "high",
  "critical",
]);
export const policyOutcomeEnum = pgEnum("policy_outcome", [
  "allow",
  "warn",
  "deny",
  "require_approval",
  "require_remediation",
  "require_exception",
]);
export const statusEnum = pgEnum("record_status", [
  "active",
  "inactive",
  "pending",
  "suspended",
  "failed",
  "completed",
  "cancelled",
]);

export type SafeJson = null | boolean | number | string | SafeJson[] | { [key: string]: SafeJson };

export const id = () => uuid("id").primaryKey().defaultRandom();
export const organisationId = () => uuid("organisation_id").notNull();
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
export const actorAttribution = {
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
};
export const softDelete = {
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: uuid("deleted_by"),
};

export const safeJson = (name: string) => jsonb(name).$type<SafeJson>();
export const enabled = () => boolean("enabled").notNull().default(true);
export const description = () => text("description");

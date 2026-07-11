import {
  boolean,
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
import { id, timestamps } from "./common";
import { users } from "./auth";

export const organisationStateEnum = pgEnum("organisation_state", [
  "active",
  "suspended",
  "deleting",
  "deleted",
]);
export const membershipStateEnum = pgEnum("membership_state", [
  "invited",
  "active",
  "suspended",
  "deactivated",
]);
export const ssoProtocolEnum = pgEnum("sso_protocol", ["saml", "oidc"]);

export type OrganisationSecurityPolicy = {
  mfaMode: "optional" | "admin_required" | "all_users_required";
  mfaGracePeriodDays: number;
  requireStepUpFor: string[];
  allowPrivateKeyExport: boolean;
  sessionHours: number;
};

export const organisations = pgTable(
  "organisations",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    state: organisationStateEnum("state").notNull().default("active"),
    branding: jsonb("branding").$type<{ logoUrl?: string; accent?: string }>(),
    securityPolicy: jsonb("security_policy").$type<OrganisationSecurityPolicy>().notNull(),
    retentionDays: integer("retention_days").notNull().default(2555),
    dataRegion: text("data_region").notNull().default("au"),
    encryptionKeyVersion: text("encryption_key_version").notNull().default("v1"),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    deletionRequestedAt: timestamp("deletion_requested_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex("organisations_slug_unique").on(table.slug)],
);

export const organisationDomains = pgTable(
  "organisation_domains",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    verificationTokenHash: text("verification_token_hash").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    discoveryEnabled: boolean("discovery_enabled").notNull().default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex("organisation_domains_domain_unique").on(table.domain)],
);

export const workspaces = pgTable(
  "workspaces",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    createdBy: uuid("created_by").references(() => users.id),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex("workspaces_org_slug_unique").on(table.organisationId, table.slug)],
);

export const roles = pgTable(
  "roles",
  {
    id: id(),
    organisationId: uuid("organisation_id").references(() => organisations.id, {
      onDelete: "cascade",
    }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    builtIn: boolean("built_in").notNull().default(false),
    ...timestamps,
  },
  (table) => [uniqueIndex("roles_org_key_unique").on(table.organisationId, table.key)],
);

export const permissions = pgTable("permissions", {
  id: id(),
  key: text("key").notNull().unique(),
  description: text("description").notNull(),
  sensitive: boolean("sensitive").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })],
);

export const organisationMemberships = pgTable(
  "organisation_memberships",
  {
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    state: membershipStateEnum("state").notNull().default("active"),
    invitedBy: uuid("invited_by").references(() => users.id),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.organisationId, table.userId] }),
    index("organisation_memberships_user_idx").on(table.userId),
  ],
);

export const workspaceMemberships = pgTable(
  "workspace_memberships",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceId, table.userId] })],
);

export const groups = pgTable(
  "groups",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    source: text("source").notNull().default("local"),
    externalId: text("external_id"),
    dynamicRule: jsonb("dynamic_rule").$type<Record<string, string>>(),
    ...timestamps,
  },
  (table) => [uniqueIndex("groups_org_name_unique").on(table.organisationId, table.name)],
);

export const groupMemberships = pgTable(
  "group_memberships",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.groupId, table.userId] })],
);

export const roleAssignments = pgTable(
  "role_assignments",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    conditions: jsonb("conditions").$type<{
      environments?: string[];
      tags?: string[];
      riskLevels?: string[];
      ownersOnly?: boolean;
    }>(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    grantedBy: uuid("granted_by").references(() => users.id),
    ...timestamps,
  },
  (table) => [index("role_assignments_subject_idx").on(table.organisationId, table.userId)],
);

export const organisationInvitations = pgTable("organisation_invitations", {
  id: id(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  roleKey: text("role_key").notNull(),
  invitedBy: uuid("invited_by")
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  ...timestamps,
});

export const ssoConnections = pgTable(
  "sso_connections",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    protocol: ssoProtocolEnum("protocol").notNull(),
    name: text("name").notNull(),
    issuer: text("issuer").notNull(),
    discoveryUrl: text("discovery_url"),
    clientId: text("client_id"),
    encryptedClientSecret: text("encrypted_client_secret"),
    samlMetadata: text("saml_metadata"),
    attributeMapping: jsonb("attribute_mapping").$type<Record<string, string>>().notNull(),
    groupMapping: jsonb("group_mapping").$type<Record<string, string>>(),
    jitProvisioning: boolean("jit_provisioning").notNull().default(true),
    enforced: boolean("enforced").notNull().default(false),
    testMode: boolean("test_mode").notNull().default(true),
    certificateExpiresAt: timestamp("certificate_expires_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex("sso_connections_org_name_unique").on(table.organisationId, table.name)],
);

export const scimTokens = pgTable("scim_tokens", {
  id: id(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  ...timestamps,
});

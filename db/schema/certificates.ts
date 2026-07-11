import { sql } from "drizzle-orm";
import {
  boolean,
  check,
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
import {
  actorAttribution,
  environmentEnum,
  id,
  lifecycleStateEnum,
  policyOutcomeEnum,
  riskLevelEnum,
  timestamps,
} from "./common";
import { users } from "./auth";
import { organisations, workspaces } from "./organisations";

export const certificateTypeEnum = pgEnum("certificate_type", [
  "tls_server",
  "tls_client",
  "code_signing",
  "smime",
  "device",
  "user",
  "kubernetes",
  "root_ca",
  "intermediate_ca",
  "cloud_managed",
  "other",
]);
export const managedStatusEnum = pgEnum("managed_status", [
  "managed",
  "unmanaged",
  "externally_managed",
]);
export const custodyModeEnum = pgEnum("custody_mode", [
  "external",
  "customer_hsm",
  "cloud_kms",
  "vault",
  "kubernetes_secret",
  "encrypted_application",
  "agent_local",
  "ephemeral",
]);
export const nameTypeEnum = pgEnum("certificate_name_type", ["dns", "ip", "email", "uri", "other"]);

export const certificates = pgTable(
  "certificates",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "restrict" }),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
    fingerprintSha256: text("fingerprint_sha256").notNull(),
    serialNumber: text("serial_number").notNull(),
    certificateType: certificateTypeEnum("certificate_type").notNull(),
    subjectDn: text("subject_dn").notNull(),
    commonName: text("common_name"),
    issuerDn: text("issuer_dn").notNull(),
    notBefore: timestamp("not_before", { withTimezone: true }).notNull(),
    notAfter: timestamp("not_after", { withTimezone: true }).notNull(),
    signatureAlgorithm: text("signature_algorithm").notNull(),
    publicKeyAlgorithm: text("public_key_algorithm").notNull(),
    publicKeySize: integer("public_key_size"),
    ellipticCurve: text("elliptic_curve"),
    keyUsages: text("key_usages")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    extendedKeyUsages: text("extended_key_usages")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    authorityKeyIdentifier: text("authority_key_identifier"),
    subjectKeyIdentifier: text("subject_key_identifier"),
    pem: text("pem").notNull(),
    source: text("source").notNull(),
    managedStatus: managedStatusEnum("managed_status").notNull().default("unmanaged"),
    lifecycleState: lifecycleStateEnum("lifecycle_state").notNull().default("discovered"),
    environment: environmentEnum("environment").notNull().default("other"),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    ownerTeam: text("owner_team"),
    businessService: text("business_service"),
    application: text("application"),
    revocationStatus: text("revocation_status").notNull().default("unknown"),
    ocspState: text("ocsp_state").notNull().default("unknown"),
    crlState: text("crl_state").notNull().default("unknown"),
    trustChainState: text("trust_chain_state").notNull().default("unknown"),
    certificateTransparencyPresent: boolean("certificate_transparency_present"),
    renewalState: text("renewal_state").notNull().default("not_configured"),
    privateKeyCustody: custodyModeEnum("private_key_custody").notNull().default("external"),
    privateKeyLocation: jsonb("private_key_location").$type<{
      provider: string;
      reference: string;
      keyVersion?: string;
    }>(),
    hasPrivateKeyCustody: boolean("has_private_key_custody").notNull().default(false),
    policyComplianceStatus: policyOutcomeEnum("policy_compliance_status")
      .notNull()
      .default("allow"),
    riskLevel: riskLevelEnum("risk_level").notNull().default("informational"),
    riskScore: integer("risk_score").notNull().default(0),
    riskModelVersion: text("risk_model_version").notNull().default("2026.1"),
    riskReasons: jsonb("risk_reasons")
      .$type<Array<{ code: string; score: number; evidence: string }>>()
      .notNull(),
    lastDiscoveredAt: timestamp("last_discovered_at", { withTimezone: true }),
    lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    ...actorAttribution,
    ...timestamps,
  },
  (table) => [
    uniqueIndex("certificates_org_fingerprint_unique").on(
      table.organisationId,
      table.fingerprintSha256,
    ),
    index("certificates_org_expiry_idx").on(table.organisationId, table.notAfter, table.id),
    index("certificates_org_risk_idx").on(table.organisationId, table.riskLevel, table.id),
    index("certificates_org_owner_idx").on(table.organisationId, table.ownerUserId),
    check("certificates_dates_valid", sql`${table.notAfter} > ${table.notBefore}`),
    check("certificates_risk_score_range", sql`${table.riskScore} BETWEEN 0 AND 100`),
  ],
);

export const certificateNames = pgTable(
  "certificate_names",
  {
    certificateId: uuid("certificate_id")
      .notNull()
      .references(() => certificates.id, { onDelete: "cascade" }),
    type: nameTypeEnum("type").notNull(),
    value: text("value").notNull(),
    normalisedValue: text("normalised_value").notNull(),
    isCommonName: boolean("is_common_name").notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.certificateId, table.type, table.normalisedValue] }),
    index("certificate_names_lookup_idx").on(table.normalisedValue),
  ],
);

export const certificateChains = pgTable(
  "certificate_chains",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    leafCertificateId: uuid("leaf_certificate_id")
      .notNull()
      .references(() => certificates.id, { onDelete: "cascade" }),
    parentCertificateId: uuid("parent_certificate_id").references(() => certificates.id, {
      onDelete: "set null",
    }),
    depth: integer("depth").notNull(),
    subjectDn: text("subject_dn").notNull(),
    issuerDn: text("issuer_dn").notNull(),
    fingerprintSha256: text("fingerprint_sha256").notNull(),
    pem: text("pem").notNull(),
    trusted: boolean("trusted").notNull().default(false),
    validationError: text("validation_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("certificate_chains_leaf_depth_unique").on(table.leafCertificateId, table.depth),
  ],
);

export const certificateDeployments = pgTable(
  "certificate_deployments",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    certificateId: uuid("certificate_id")
      .notNull()
      .references(() => certificates.id, { onDelete: "cascade" }),
    connectorId: uuid("connector_id"),
    targetType: text("target_type").notNull(),
    targetReference: text("target_reference").notNull(),
    location: text("location"),
    environment: environmentEnum("environment").notNull(),
    status: text("status").notNull().default("unknown"),
    hostname: text("hostname"),
    ipAddress: text("ip_address"),
    port: integer("port"),
    cloudAccount: text("cloud_account"),
    region: text("region"),
    kubernetesCluster: text("kubernetes_cluster"),
    namespace: text("namespace"),
    secretName: text("secret_name"),
    lastDeployedAt: timestamp("last_deployed_at", { withTimezone: true }),
    lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }),
    lastSuccessfulHandshakeAt: timestamp("last_successful_handshake_at", { withTimezone: true }),
    chainPresented: jsonb("chain_presented").$type<string[]>(),
    protocolObservations: jsonb("protocol_observations").$type<Record<string, string[]>>(),
    cipherObservations: text("cipher_observations").array(),
    renewalConfiguration:
      jsonb("renewal_configuration").$type<Record<string, string | number | boolean>>(),
    rollbackInformation: jsonb("rollback_information").$type<Record<string, string>>(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("certificate_deployments_target_unique").on(
      table.organisationId,
      table.certificateId,
      table.targetType,
      table.targetReference,
    ),
    index("certificate_deployments_certificate_idx").on(table.certificateId),
  ],
);

export const certificateProfiles = pgTable(
  "certificate_profiles",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    certificateType: certificateTypeEnum("certificate_type").notNull(),
    allowedAlgorithms: text("allowed_algorithms").array().notNull(),
    minimumKeySize: integer("minimum_key_size"),
    maximumValidityDays: integer("maximum_validity_days").notNull(),
    renewalLeadDays: integer("renewal_lead_days").notNull().default(30),
    defaultCustodyMode: custodyModeEnum("default_custody_mode").notNull(),
    approvalPolicy: jsonb("approval_policy").$type<Record<string, unknown>>().notNull(),
    enabled: boolean("enabled").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("certificate_profiles_org_name_unique").on(table.organisationId, table.name),
  ],
);

export const certificateAuthorities = pgTable(
  "certificate_authorities",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    providerType: text("provider_type").notNull(),
    capabilities: text("capabilities").array().notNull(),
    status: text("status").notNull().default("pending"),
    externalReference: text("external_reference"),
    configuration: jsonb("configuration").$type<Record<string, unknown>>().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("certificate_authorities_org_name_unique").on(table.organisationId, table.name),
  ],
);

export const certificateAuthorityConnectors = pgTable("certificate_authority_connectors", {
  certificateAuthorityId: uuid("certificate_authority_id")
    .primaryKey()
    .references(() => certificateAuthorities.id, { onDelete: "cascade" }),
  connectorId: uuid("connector_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const certificateRequests = pgTable(
  "certificate_requests",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "restrict" }),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => certificateProfiles.id, { onDelete: "restrict" }),
    authorityId: uuid("authority_id").references(() => certificateAuthorities.id, {
      onDelete: "restrict",
    }),
    requesterId: uuid("requester_id")
      .notNull()
      .references(() => users.id),
    commonName: text("common_name").notNull(),
    subjectAlternativeNames: text("subject_alternative_names").array().notNull(),
    intendedUse: text("intended_use").notNull(),
    businessJustification: text("business_justification").notNull(),
    environment: environmentEnum("environment").notNull(),
    requestedValidityDays: integer("requested_validity_days").notNull(),
    keyAlgorithm: text("key_algorithm").notNull(),
    keySize: integer("key_size"),
    custodyMode: custodyModeEnum("custody_mode").notNull(),
    renewalPreference: text("renewal_preference").notNull(),
    changeReference: text("change_reference"),
    relatedAsset: text("related_asset"),
    csrPem: text("csr_pem"),
    status: text("status").notNull().default("draft"),
    issuedCertificateId: uuid("issued_certificate_id").references(() => certificates.id),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    ...timestamps,
  },
  (table) => [index("certificate_requests_org_status_idx").on(table.organisationId, table.status)],
);

export const tags = pgTable(
  "tags",
  {
    id: id(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("tags_org_key_value_unique").on(table.organisationId, table.key, table.value),
  ],
);

export const resourceTags = pgTable(
  "resource_tags",
  {
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    resourceType: text("resource_type").notNull(),
    resourceId: uuid("resource_id").notNull(),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.resourceType, table.resourceId, table.tagId] }),
    index("resource_tags_org_resource_idx").on(
      table.organisationId,
      table.resourceType,
      table.resourceId,
    ),
  ],
);

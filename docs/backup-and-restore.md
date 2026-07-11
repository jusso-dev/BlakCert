# Backup, restore, and disaster recovery

Enable continuous WAL archiving and daily encrypted base backups for PostgreSQL. Enable object versioning, cross-account backup, and retention lock for reports and audit archives. Back up configuration exports and KMS key identifiers separately; wrapping-key recovery requires a tested escrow or multi-party cloud recovery process.

A backup is `successful` only after integrity verification. Recovery readiness is tracked separately and becomes `verified` only after an isolated restore test can start BlakCert, verify the audit chain, retrieve a report, and reconcile certificate counts. Record actual recovery point and recovery duration.

Organisation offboarding produces a signed metadata/audit export, waits for legal-hold and retention approval, revokes identities and connectors, destroys tenant data keys, and records completion in the platform audit domain.

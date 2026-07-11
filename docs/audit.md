# Audit logging and export

Privileged authentication, identity, API/MCP, agent, certificate, connector, discovery, policy, approval, secret-access, webhook, report, and security-control events are append-only. Metadata passes structural redaction and a private-key marker guard before persistence.

Events are chained per organisation with HMAC-SHA-256 over canonical safe fields and the previous event hash. PostgreSQL advisory locks serialise writers. Triggers reject UPDATE and DELETE. A verification job checks linkage; signed archive batches provide an external anchor.

Exports run asynchronously and support CSV, JSON, and NDJSON. Audit export itself requires step-up, permission, purpose, expiry, and an audit event. Legal hold overrides normal expiry. SIEM/syslog/webhook forwarding is an outbox consumer with replay-safe delivery IDs.

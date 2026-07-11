# Connector development

A connector declares type, semantic version, capabilities, configuration and secret schemas, authentication mode, allowed scopes, rate limit, retry policy, and webhook support. Implementations expose `testConnection`, `testPermissions`, `discover`, `sync`, `deploy`, `validate`, and credential-rotation operations only when declared.

```mermaid
sequenceDiagram
  participant U as User, API, or agent
  participant S as Domain service
  participant J as PostgreSQL jobs
  participant W as Worker
  participant C as Connector adapter
  participant A as Audit and outbox
  U->>S: Scoped dry-run or action request
  S->>S: Permission, policy, approval, SSRF scope
  S->>J: Idempotent job
  W->>J: Lease with SKIP LOCKED
  W->>C: Capability-specific operation
  C-->>W: Structured safe result
  W->>S: Reconcile and verify
  S->>A: Immutable outcome
```

Secrets are write-only, AES-256-GCM encrypted locally, and KMS-wrapped in production. Never return them from repositories, browsers, logs, audit, MCP, or agent context. HTTP connectors must use `validateOutboundTarget` before initial requests and every redirect, pin resolved addresses, and enforce time/size limits.

Credential-dependent adapters remain disabled until configured. Test mode must use sandbox endpoints and visibly label its results; it must never report a live operation as successful.

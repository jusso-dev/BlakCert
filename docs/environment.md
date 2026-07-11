# Environment variable reference

| Variable                      |   Required | Purpose                                                        |
| ----------------------------- | ---------: | -------------------------------------------------------------- |
| `DATABASE_URL`                |        yes | TLS PostgreSQL connection URI                                  |
| `BETTER_AUTH_SECRET`          |        yes | 32+ byte Better Auth signing/encryption secret                 |
| `BETTER_AUTH_URL`             |        yes | Canonical origin for cookies and WebAuthn                      |
| `NEXT_PUBLIC_BETTER_AUTH_URL` |    browser | Public canonical auth origin                                   |
| `APP_ENCRYPTION_KEK`          | local only | 32-byte hex local wrapping key; replace with KMS in production |
| `AUDIT_HMAC_KEY`              |        yes | Versioned audit-chain key                                      |
| `MCP_API_KEY_PEPPER`          |        yes | HMAC pepper for API/MCP keys                                   |
| `OBJECT_STORAGE_ENDPOINT`     |   provider | S3, R2, or MinIO endpoint                                      |
| `OBJECT_STORAGE_REGION`       |   provider | S3-compatible region                                           |
| `OBJECT_STORAGE_BUCKET`       |   provider | Private report/artifact bucket                                 |
| `OBJECT_STORAGE_ACCESS_KEY`   |   provider | Development credential or workload identity fallback           |
| `OBJECT_STORAGE_SECRET_KEY`   |   provider | Development credential; secret-manager injected                |
| `BLAKCERT_MCP_API_KEY`        |  stdio MCP | Organisation-bound key with `mcp:connect`                      |
| `CRON_TIMEZONE`               |         no | Scheduler display timezone; stored schedules remain explicit   |
| `LOG_LEVEL`                   |         no | Structured logger level                                        |

Startup validation rejects missing or malformed required values. Production secrets come from Vault or a cloud secret manager and never from committed files.

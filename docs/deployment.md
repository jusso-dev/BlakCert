# Production deployment

Build the immutable non-root image with `docker build -t blakcert:<version> .`. Run migrations as a one-shot job before rolling web and worker processes. Configure a managed PostgreSQL service with PITR, TLS, connection limits, statement timeouts, and application/audit roles. Configure S3-compatible object storage with versioning, retention, and KMS encryption.

Web, worker, and MCP processes scale independently. Use at least two web and two worker replicas across failure zones, a PodDisruptionBudget, ingress TLS, network policies, read-only filesystems, secret-manager injection, and OpenTelemetry export. `/health` is liveness; `/ready` is readiness; `/metrics` is Prometheus text.

RPO target is 5 minutes with WAL archival. RTO target is 4 hours for the default self-hosted profile. Validate these targets through restore tests, not backup job completion. Quarterly tests restore PostgreSQL, object versions, audit archives, and wrapping-key access into an isolated environment and record recovery duration and evidence.

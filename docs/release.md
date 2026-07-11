# Release process

1. Confirm conventional commits and review migration/backward-compatibility notes.
2. Run dependency, secret, SAST, unit, integration, E2E, tenant-isolation, and container scans.
3. Build a reproducible non-root image and generate an SBOM and provenance attestation.
4. Sign the image and release manifest.
5. Back up and verify restore readiness before irreversible migrations.
6. Run migrations as a one-shot job, then canary web and workers.
7. Verify health, readiness, metrics, authentication, job leases, MCP, audit chain, and connector health.
8. Promote by immutable digest. Record release evidence and rollback decision points.

Security fixes follow the same evidence path with an accelerated approval window. Database and application rollback compatibility must be documented before promotion.

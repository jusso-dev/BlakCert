# Contributing

Use Node.js 22+, strict TypeScript, conventional commits, and small domain-focused changes. Critical business rules belong in services, not UI components or route handlers. Every tenant query, API/MCP operation, job, and privileged action requires explicit authorisation and audit treatment.

Add a Drizzle migration for schema changes and test it against a clean PostgreSQL database. Add permission-boundary, isolation, and security-regression tests for sensitive changes. Run:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Never commit credentials, private keys, recovery codes, tokens, or production certificate bundles. Security reports should use the private disclosure channel configured by the deploying organisation.

# Local development

Requirements: Node.js 22+, Docker, and npm.

1. Copy `.env.example` to `.env.local` and replace every development secret.
2. Run `docker compose up -d postgres minio`.
3. Run `npm install`, `npm run db:generate`, `npm run db:migrate`, and `npm run db:seed`.
4. Run `npm run dev` and, in a second terminal, `npm run worker`.
5. Register, create an organisation, enrol TOTP or a passkey, and import a certificate bundle.

The development MinIO console is at <http://localhost:9101>. Do not reuse development secrets in another environment.

Before committing, run `npm run lint && npm run typecheck && npm test && npm run build`.

# BlakCert

<p align="center">
  <img src="./public/brand/blakcert-logo.png" alt="BlakCert certificate management logo" width="180" height="180" />
</p>

[![CI](https://github.com/jusso-dev/BlakCert/actions/workflows/ci.yml/badge.svg)](https://github.com/jusso-dev/BlakCert/actions/workflows/ci.yml)

BlakCert is an agentic-first, API-first, MCP-native enterprise certificate lifecycle management platform. The initial production vertical slice provides secure authentication, organisation isolation, certificate import and parsing, explainable risk, immutable audit events, REST access, and permission-aware MCP tools.

## Quick start

```bash
cp .env.example .env.local
docker compose up -d postgres minio
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open <http://localhost:3000>. Development email messages are written to structured logs unless an email provider is configured.

## Commands

```bash
npm run dev             # web process
npm run worker          # durable job worker
npm run mcp             # stdio MCP server
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run db:generate
npm run db:migrate
npm run db:seed
```

## Architecture

BlakCert is a modular monolith. React Server Components, route handlers, workers, and MCP tools call shared application services. Services enforce tenant context, permissions, policy checks, idempotency, and immutable audit recording. See [docs/architecture.md](docs/architecture.md) and [docs/security.md](docs/security.md).

## Current scope

The repository establishes the architecture and the first vertical slice. Connector capability/configuration contracts are modelled, but credential-dependent CA and infrastructure adapters are not represented as live integrations until their implementation and provider contract tests are added.

# syntax=docker/dockerfile:1.7
FROM node:26-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM node:26-alpine AS build
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN DATABASE_URL=postgres://build:build@localhost:5432/build \
    BETTER_AUTH_SECRET=build-only-secret-that-is-at-least-32-bytes \
    BETTER_AUTH_URL=http://localhost:3000 \
    APP_ENCRYPTION_KEK=0000000000000000000000000000000000000000000000000000000000000000 \
    AUDIT_HMAC_KEY=build-only-audit-key-that-is-at-least-32-bytes \
    MCP_API_KEY_PEPPER=build-only-mcp-pepper-that-is-at-least-32-bytes \
    npm run build

FROM dependencies AS worker
COPY --chown=node:node . .
USER node
CMD ["npm", "run", "worker"]

FROM node:26-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
RUN addgroup --system --gid 1001 blakcert && adduser --system --uid 1001 --ingroup blakcert blakcert
COPY --from=build --chown=blakcert:blakcert /app/public ./public
COPY --from=build --chown=blakcert:blakcert /app/.next/standalone ./
COPY --from=build --chown=blakcert:blakcert /app/.next/static ./.next/static
USER blakcert
EXPOSE 3000
CMD ["node", "server.js"]

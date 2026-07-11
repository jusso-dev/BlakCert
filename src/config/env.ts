import { z } from "zod";

const developmentDefaults = {
  DATABASE_URL: "postgres://blakcert:dev-only@localhost:55432/blakcert_dev",
  BETTER_AUTH_SECRET: "development-only-secret-that-is-at-least-32-bytes",
  BETTER_AUTH_URL: "http://localhost:3000",
  APP_ENCRYPTION_KEK: "0".repeat(64),
  AUDIT_HMAC_KEY: "development-only-audit-key-at-least-32-bytes",
  MCP_API_KEY_PEPPER: "development-only-mcp-pepper-at-least-32-bytes",
} as const;

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  NEXT_PUBLIC_BETTER_AUTH_URL: z.string().url().optional(),
  APP_ENCRYPTION_KEK: z.string().regex(/^[a-fA-F0-9]{64}$/),
  AUDIT_HMAC_KEY: z.string().min(32),
  MCP_API_KEY_PEPPER: z.string().min(32),
  OBJECT_STORAGE_ENDPOINT: z.string().url().optional(),
  OBJECT_STORAGE_REGION: z.string().default("auto"),
  OBJECT_STORAGE_BUCKET: z.string().default("blakcert"),
  OBJECT_STORAGE_ACCESS_KEY: z.string().optional(),
  OBJECT_STORAGE_SECRET_KEY: z.string().optional(),
  CRON_TIMEZONE: z.string().default("UTC"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

const input =
  process.env.NODE_ENV === "production" ? process.env : { ...developmentDefaults, ...process.env };

const parsed = schema.safeParse(input);
if (!parsed.success) {
  const names = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
  throw new Error(`Invalid environment configuration: ${names}`);
}

export const env = parsed.data;

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@db/schema";
import { env } from "@/config/env";

const globalForDb = globalThis as unknown as { blakcertSql?: ReturnType<typeof postgres> };

export const sqlClient =
  globalForDb.blakcertSql ??
  postgres(env.DATABASE_URL, {
    max: env.NODE_ENV === "production" ? 20 : 5,
    idle_timeout: 30,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
    prepare: false,
    onnotice: () => undefined,
  });

if (env.NODE_ENV !== "production") globalForDb.blakcertSql = sqlClient;

export const db = drizzle(sqlClient, { schema, casing: "snake_case" });
export type Database = typeof db;
export { schema };

import { sql } from "drizzle-orm";
import { db } from "./client";

export type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function setTenantContext(
  transaction: DatabaseTransaction,
  organisationId: string,
): Promise<void> {
  await transaction.execute(
    sql`select set_config('blakcert.organisation_id', ${organisationId}, true)`,
  );
}

export function withTenantContext<T>(
  organisationId: string,
  operation: (transaction: DatabaseTransaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (transaction) => {
    await setTenantContext(transaction, organisationId);
    return operation(transaction);
  });
}

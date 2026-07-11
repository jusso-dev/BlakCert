import { sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { db } from "@/db/client";
import { backgroundJobs } from "@db/schema";

export type JobDefinition = {
  organisationId?: string | null;
  queue: string;
  type: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  correlationId: string;
  scheduledFor?: Date;
  maxAttempts?: number;
  priority?: number;
};

export async function enqueueJob(definition: JobDefinition) {
  const [job] = await db
    .insert(backgroundJobs)
    .values({
      id: uuidv7(),
      organisationId: definition.organisationId,
      queue: definition.queue,
      type: definition.type,
      payload: definition.payload,
      idempotencyKey: definition.idempotencyKey,
      correlationId: definition.correlationId,
      scheduledFor: definition.scheduledFor,
      maxAttempts: definition.maxAttempts,
      priority: definition.priority,
    })
    .onConflictDoNothing()
    .returning();
  return job ?? null;
}

export async function claimJobs(queue: string, workerId: string, limit = 5) {
  return db.transaction(async (tx) => {
    const result = await tx.execute(sql`
      WITH candidates AS (
        SELECT id
        FROM background_jobs
        WHERE queue = ${queue}
          AND status IN ('queued', 'retrying')
          AND scheduled_for <= now()
          AND cancellation_requested_at IS NULL
          AND (lease_expires_at IS NULL OR lease_expires_at < now())
        ORDER BY priority ASC, scheduled_for ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
      UPDATE background_jobs jobs
      SET status = 'leased',
          lease_owner = ${workerId},
          lease_expires_at = now() + interval '60 seconds',
          heartbeat_at = now(),
          attempt = attempt + 1,
          updated_at = now()
      FROM candidates
      WHERE jobs.id = candidates.id
      RETURNING jobs.*
    `);
    return Array.from(result) as Array<typeof backgroundJobs.$inferSelect>;
  });
}

export async function completeJob(id: string, safeResult: Record<string, unknown>) {
  await db
    .update(backgroundJobs)
    .set({
      status: "completed",
      safeResult,
      progress: 100,
      completedAt: new Date(),
      leaseOwner: null,
      leaseExpiresAt: null,
    })
    .where(sql`${backgroundJobs.id} = ${id} AND ${backgroundJobs.status} IN ('leased', 'running')`);
}

export async function failJob(job: typeof backgroundJobs.$inferSelect, error: unknown) {
  const exhausted = job.attempt >= job.maxAttempts;
  const delaySeconds = Math.min(
    3600,
    2 ** Math.max(0, job.attempt - 1) * 15 + Math.floor(Math.random() * 10),
  );
  await db
    .update(backgroundJobs)
    .set({
      status: exhausted ? "dead_letter" : "retrying",
      errorCode: error instanceof Error ? error.name : "UnknownError",
      errorSummary: error instanceof Error ? error.message.slice(0, 500) : "Unknown job failure",
      scheduledFor: exhausted ? job.scheduledFor : new Date(Date.now() + delaySeconds * 1000),
      leaseOwner: null,
      leaseExpiresAt: null,
    })
    .where(sql`${backgroundJobs.id} = ${job.id}`);
}

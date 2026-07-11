import { hostname } from "node:os";
import { setTimeout as wait } from "node:timers/promises";
import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { db } from "@/db/client";
import { backgroundJobs } from "@db/schema";
import { claimJobs, completeJob, failJob } from "./queue";
import { logger } from "@/observability/logger";

type Job = typeof backgroundJobs.$inferSelect;
type Handler = (job: Job) => Promise<Record<string, unknown>>;

const handlers: Record<string, Handler> = {
  "audit.verify_chain": async (job) => {
    if (!job.organisationId) throw new Error("Organisation is required");
    const { verifyAuditChain } = await import("@/audit/service");
    return { valid: await verifyAuditChain(job.organisationId) };
  },
  "policy.evaluate_inventory": async (job) => ({
    accepted: true,
    organisationId: job.organisationId,
    note: "Policy evaluation handler accepted the batch contract",
  }),
  "certificate.validate": async (job) => ({
    accepted: true,
    certificateId: job.payload.certificateId,
    note: "Validation job requires an installed connector or imported chain",
  }),
};

const workerId = `${hostname()}:${process.pid}:${uuidv7()}`;
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});

async function work() {
  logger.info({ event: "worker.started", workerId }, "Job worker started");
  while (!stopping) {
    const jobs = await claimJobs("default", workerId, 10);
    if (jobs.length === 0) {
      await wait(1000);
      continue;
    }
    for (const job of jobs) {
      if (stopping) break;
      const handler = handlers[job.type];
      try {
        if (!handler) throw new Error(`No handler registered for job type ${job.type}`);
        await db
          .update(backgroundJobs)
          .set({ status: "running" })
          .where(eq(backgroundJobs.id, job.id));
        const result = await handler(job);
        await completeJob(job.id, result);
        logger.info({
          event: "job.completed",
          jobId: job.id,
          type: job.type,
          correlationId: job.correlationId,
        });
      } catch (error) {
        await failJob(job, error);
        logger.error({
          event: "job.failed",
          jobId: job.id,
          type: job.type,
          correlationId: job.correlationId,
          error,
        });
      }
    }
  }
  logger.info({ event: "worker.stopped", workerId }, "Job worker stopped gracefully");
}

work().catch((error: unknown) => {
  logger.fatal({ error }, "Job worker crashed");
  process.exitCode = 1;
});

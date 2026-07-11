import { count, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { backgroundJobs, certificates } from "@db/schema";

export async function GET() {
  const [certificateCount, queuedJobs] = await Promise.all([
    db.select({ value: count() }).from(certificates),
    db.select({ value: count() }).from(backgroundJobs).where(eq(backgroundJobs.status, "queued")),
  ]);
  const body = [
    "# HELP blakcert_certificates_total Number of certificate records.",
    "# TYPE blakcert_certificates_total gauge",
    `blakcert_certificates_total ${certificateCount[0]?.value ?? 0}`,
    "# HELP blakcert_jobs_queued Number of queued background jobs.",
    "# TYPE blakcert_jobs_queued gauge",
    `blakcert_jobs_queued ${queuedJobs[0]?.value ?? 0}`,
    "",
  ].join("\n");
  return new Response(body, {
    headers: { "Content-Type": "text/plain; version=0.0.4", "Cache-Control": "no-store" },
  });
}

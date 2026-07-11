import { z } from "zod";

export const toolResultSchema = z.object({
  success: z.boolean(),
  operationId: z.string().uuid(),
  correlationId: z.string().uuid(),
  dryRun: z.boolean(),
  status: z.string(),
  summary: z.string(),
  data: z.record(z.string(), z.unknown()),
  warnings: z.array(z.string()),
  policyDecisions: z.array(
    z.object({ policy: z.string(), outcome: z.string(), explanation: z.string() }),
  ),
  approvalRequired: z.boolean(),
  auditEventId: z.string().uuid(),
});

export type ToolResult = z.infer<typeof toolResultSchema>;

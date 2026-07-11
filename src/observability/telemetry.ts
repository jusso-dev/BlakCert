import { logger } from "./logger";

let registered = false;

export async function registerTelemetry() {
  if (registered) return;
  registered = true;
  logger.info({ event: "telemetry.registered" }, "OpenTelemetry instrumentation hook registered");
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerTelemetry } = await import("./src/observability/telemetry");
    await registerTelemetry();
  }
}

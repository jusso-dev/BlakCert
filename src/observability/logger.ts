import pino from "pino";
import { env } from "@/config/env";

const REDACT_PATHS = [
  "password",
  "token",
  "secret",
  "privateKey",
  "req.headers.authorization",
  "req.headers.cookie",
  "*.password",
  "*.token",
  "*.secret",
  "*.privateKey",
];

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
  base: { service: "blakcert" },
  timestamp: pino.stdTimeFunctions.isoTime,
});

import pino from "pino";

const isProd = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProd ? "info" : "debug"),
  redact: {
    paths: [
      "password",
      "passwordHash",
      "*.password",
      "*.passwordHash",
      "req.headers.cookie",
      "req.headers.authorization",
    ],
    censor: "[REDACTED]",
  },
});

export function logError(msg: string, err: unknown, ctx: Record<string, unknown> = {}) {
  const errObj =
    err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : { err };
  logger.error({ ...ctx, ...errObj }, msg);
}

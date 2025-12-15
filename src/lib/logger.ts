/**
 * Pino logger with structured JSON output.
 *
 * Features:
 * - Pretty-print logs in development via pino-pretty
 * - Structured JSON output in production
 * - Sensitive data redaction (auth headers, passwords, tokens)
 * - Child logger factory for request context
 */
import pino from "pino"
import env from "@/lib/env"

const isDevelopment = env.NODE_ENV === "development" || !env.NODE_ENV

// Sensitive data redaction paths
const redactPaths = [
	"req.headers.authorization",
	"req.headers.cookie",
	"req.body.password",
	"req.body.token",
	"req.body.refreshToken",
	"req.body.accessToken",
	"*.password",
	"*.secret",
	"*.apiKey",
	"*.token"
]

// Build pino options based on environment
const pinoOptions: pino.LoggerOptions = {
	level: env.LOG_LEVEL ?? "info",
	redact: {
		paths: redactPaths,
		censor: "[REDACTED]"
	},
	base: {
		service: "node-ts-template"
	},
	formatters: {
		level: (label) => ({ level: label })
	}
}

// Add pretty transport in development
if (isDevelopment) {
	pinoOptions.transport = {
		target: "pino-pretty",
		options: {
			colorize: true,
			translateTime: "SYS:standard",
			ignore: "pid,hostname"
		}
	}
}

export const logger = pino(pinoOptions)

/**
 * Create a child logger with request context
 */
export const createRequestLogger = (requestId: string) =>
	logger.child({ requestId })

export type Logger = typeof logger
export type RequestLogger = ReturnType<typeof createRequestLogger>

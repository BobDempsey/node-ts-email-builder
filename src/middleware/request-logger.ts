/**
 * Request logging middleware.
 *
 * Logs incoming requests and response completion with:
 * - HTTP method and path
 * - User agent
 * - Response status code and duration
 */
import type { IncomingMessage, ServerResponse } from "http"
import { createRequestLogger } from "@/lib/logger"

export interface RequestLoggerOptions {
	/** Paths to exclude from logging (e.g., frequent health checks) */
	excludePaths?: string[]
}

/**
 * Log request start and hook response end for completion logging
 */
export function requestLoggerMiddleware(
	req: IncomingMessage,
	res: ServerResponse,
	requestId: string,
	options: RequestLoggerOptions = {}
): void {
	const startTime = process.hrtime.bigint()
	const reqLogger = createRequestLogger(requestId)
	const path = req.url?.split("?")[0] ?? "/"

	// Skip excluded paths (e.g., /live for frequent liveness probes)
	const excludePaths = options.excludePaths ?? ["/live"]
	if (excludePaths.includes(path)) {
		return
	}

	// Log incoming request
	reqLogger.info({
		msg: "Incoming request",
		method: req.method,
		path,
		userAgent: req.headers["user-agent"]
	})

	// Hook into response finish to log completion
	const originalEnd = res.end.bind(res)
	res.end = ((
		chunk?: unknown,
		encoding?: BufferEncoding | (() => void),
		cb?: () => void
	) => {
		const duration = Number(process.hrtime.bigint() - startTime) / 1e6 // ms

		reqLogger.info({
			msg: "Request completed",
			method: req.method,
			path,
			statusCode: res.statusCode,
			durationMs: Math.round(duration * 100) / 100
		})

		return originalEnd(chunk, encoding as BufferEncoding, cb as () => void)
	}) as typeof res.end
}

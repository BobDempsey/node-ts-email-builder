/**
 * Centralized error handling middleware.
 *
 * Provides environment-aware error responses:
 * - Development: includes stack traces
 * - Production: sanitized messages for non-operational errors
 */
import type { ServerResponse } from "http"
import env from "@/lib/env"
import { AppError } from "@/lib/errors"
import { logger } from "@/lib/logger"
import { type SendErrorOptions, sendError } from "@/lib/response"

/**
 * Handle errors and send appropriate response
 */
export function handleError(
	error: Error | AppError,
	res: ServerResponse,
	requestId: string
): void {
	const isDev = env.NODE_ENV === "development" || !env.NODE_ENV

	if (error instanceof AppError) {
		// Operational errors - expected, safe to expose message
		logger.warn({
			requestId,
			error: error.name,
			message: error.message,
			statusCode: error.statusCode,
			code: error.code
		})

		const opts: SendErrorOptions = {
			statusCode: error.statusCode,
			message: error.message,
			requestId
		}
		if (error.code) opts.code = error.code
		if (isDev && error.stack) opts.stack = error.stack

		sendError(res, opts)
	} else {
		// Programmer errors - unexpected, don't expose details in production
		logger.error({
			requestId,
			error: error.name,
			message: error.message,
			stack: error.stack
		})

		const opts: SendErrorOptions = {
			statusCode: 500,
			message: isDev ? error.message : "Internal server error",
			code: "INTERNAL_ERROR",
			requestId
		}
		if (isDev && error.stack) opts.stack = error.stack

		sendError(res, opts)
	}
}

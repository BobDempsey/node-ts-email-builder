/**
 * Standardized API response helpers.
 *
 * Provides consistent response envelope formatting for success and error responses.
 */
import type { ServerResponse } from "http"
import type { ApiErrorResponse, ApiSuccessResponse } from "@/types/http"

export interface SendSuccessOptions<T> {
	data: T
	statusCode?: number
	requestId?: string
	meta?: Record<string, unknown>
}

export interface SendErrorOptions {
	statusCode: number
	message: string
	code?: string
	details?: unknown
	stack?: string
	requestId?: string
}

/**
 * Send a standardized success response
 */
export function sendSuccess<T>(
	res: ServerResponse,
	options: SendSuccessOptions<T>
): void {
	const { data, statusCode = 200, requestId, meta = {} } = options

	const response: ApiSuccessResponse<T> = {
		success: true,
		data,
		meta: {
			timestamp: new Date().toISOString(),
			...meta
		}
	}

	if (requestId && response.meta) {
		response.meta.requestId = requestId
	}

	res.writeHead(statusCode, { "Content-Type": "application/json" })
	res.end(JSON.stringify(response))
}

/**
 * Send a standardized error response
 */
export function sendError(
	res: ServerResponse,
	options: SendErrorOptions
): void {
	const { statusCode, message, code, details, stack, requestId } = options

	const errorObj: ApiErrorResponse["error"] = { message }
	if (code !== undefined) errorObj.code = code
	if (details !== undefined) errorObj.details = details
	if (stack !== undefined) errorObj.stack = stack

	const response: ApiErrorResponse = {
		success: false,
		error: errorObj,
		meta: {
			timestamp: new Date().toISOString()
		}
	}

	if (requestId && response.meta) {
		response.meta.requestId = requestId
	}

	res.writeHead(statusCode, { "Content-Type": "application/json" })
	res.end(JSON.stringify(response))
}

/**
 * Send a 404 Not Found response
 */
export function sendNotFound(
	res: ServerResponse,
	message = "Resource not found",
	requestId?: string
): void {
	const opts: SendErrorOptions = { statusCode: 404, message, code: "NOT_FOUND" }
	if (requestId) opts.requestId = requestId
	sendError(res, opts)
}

/**
 * Send a 400 Bad Request response
 */
export function sendBadRequest(
	res: ServerResponse,
	message: string,
	details?: unknown,
	requestId?: string
): void {
	const opts: SendErrorOptions = {
		statusCode: 400,
		message,
		code: "BAD_REQUEST"
	}
	if (details !== undefined) opts.details = details
	if (requestId) opts.requestId = requestId
	sendError(res, opts)
}

/**
 * Send a 401 Unauthorized response
 */
export function sendUnauthorized(
	res: ServerResponse,
	message = "Unauthorized",
	requestId?: string
): void {
	const opts: SendErrorOptions = {
		statusCode: 401,
		message,
		code: "UNAUTHORIZED"
	}
	if (requestId) opts.requestId = requestId
	sendError(res, opts)
}

/**
 * Send a 403 Forbidden response
 */
export function sendForbidden(
	res: ServerResponse,
	message = "Forbidden",
	requestId?: string
): void {
	const opts: SendErrorOptions = { statusCode: 403, message, code: "FORBIDDEN" }
	if (requestId) opts.requestId = requestId
	sendError(res, opts)
}

/**
 * Send a 500 Internal Server Error response
 */
export function sendInternalError(
	res: ServerResponse,
	message = "Internal server error",
	requestId?: string
): void {
	const opts: SendErrorOptions = {
		statusCode: 500,
		message,
		code: "INTERNAL_ERROR"
	}
	if (requestId) opts.requestId = requestId
	sendError(res, opts)
}

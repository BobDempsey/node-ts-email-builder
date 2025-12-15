/**
 * HTTP types and interfaces for the API.
 */
import type { IncomingMessage, ServerResponse } from "http"

/**
 * Extended request with parsed body and context
 */
export interface ParsedRequest extends IncomingMessage {
	body?: unknown
	params?: Record<string, string>
	query?: Record<string, string>
	requestId: string
}

/**
 * Standard API success response envelope
 */
export interface ApiSuccessResponse<T = unknown> {
	success: true
	data: T
	meta?: {
		timestamp: string
		requestId?: string
		[key: string]: unknown
	}
}

/**
 * Standard API error response envelope
 */
export interface ApiErrorResponse {
	success: false
	error: {
		message: string
		code?: string
		details?: unknown
		stack?: string
	}
	meta?: {
		timestamp: string
		requestId?: string
	}
}

/**
 * Union type for all API responses
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse

/**
 * Route handler function type
 */
export type RouteHandler = (
	req: ParsedRequest,
	res: ServerResponse
) => void | Promise<void>

/**
 * HTTP method type
 */
export type HttpMethod =
	| "GET"
	| "POST"
	| "PUT"
	| "PATCH"
	| "DELETE"
	| "HEAD"
	| "OPTIONS"

/**
 * Route definition
 */
export interface Route {
	method: HttpMethod
	path: string
	handler: RouteHandler
}

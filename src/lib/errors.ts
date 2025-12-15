/**
 * Custom error classes for standardized error handling
 */

export class AppError extends Error {
	public readonly statusCode: number
	public readonly isOperational: boolean
	public readonly code: string | undefined

	constructor(
		message: string,
		statusCode = 500,
		isOperational = true,
		code?: string
	) {
		super(message)
		this.name = this.constructor.name
		this.statusCode = statusCode
		this.isOperational = isOperational
		this.code = code
		Error.captureStackTrace(this, this.constructor)
	}

	/**
	 * Serialize error for JSON response
	 */
	toJSON(includeStack = false): Record<string, unknown> {
		const base: Record<string, unknown> = {
			error: this.name,
			message: this.message,
			statusCode: this.statusCode
		}

		if (this.code !== undefined) {
			base.code = this.code
		}

		if (includeStack && this.stack) {
			base.stack = this.stack
		}

		return base
	}
}

export class ValidationError extends AppError {
	constructor(message: string) {
		super(message, 400, true, "VALIDATION_ERROR")
	}
}

export class NotFoundError extends AppError {
	constructor(message = "Resource not found") {
		super(message, 404, true, "NOT_FOUND")
	}
}

export class UnauthorizedError extends AppError {
	constructor(message = "Unauthorized") {
		super(message, 401, true, "UNAUTHORIZED")
	}
}

export class ForbiddenError extends AppError {
	constructor(message = "Forbidden") {
		super(message, 403, true, "FORBIDDEN")
	}
}

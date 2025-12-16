/**
 * Custom error classes for standardized error handling
 */

export class AppError extends Error {
	public readonly isOperational: boolean
	public readonly code: string | undefined

	constructor(message: string, code?: string, isOperational = true) {
		super(message)
		this.name = this.constructor.name
		this.code = code
		this.isOperational = isOperational
		Error.captureStackTrace(this, this.constructor)
	}

	/**
	 * Serialize error for JSON output
	 */
	toJSON(includeStack = false): Record<string, unknown> {
		const base: Record<string, unknown> = {
			error: this.name,
			message: this.message
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
		super(message, "VALIDATION_ERROR")
	}
}

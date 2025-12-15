/**
 * Request body parsing and validation utilities.
 *
 * Provides JSON body parsing and Zod schema validation.
 */
import type { IncomingMessage } from "http"
import type { ZodSchema } from "zod"
import { ValidationError } from "@/lib/errors"

/**
 * Parse JSON body from request stream
 */
export async function parseBody(req: IncomingMessage): Promise<unknown> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = []

		req.on("data", (chunk: Buffer) => {
			chunks.push(chunk)
		})

		req.on("end", () => {
			const body = Buffer.concat(chunks).toString()

			if (!body) {
				resolve(undefined)
				return
			}

			try {
				resolve(JSON.parse(body))
			} catch {
				reject(new ValidationError("Invalid JSON body"))
			}
		})

		req.on("error", reject)
	})
}

/**
 * Validate data against a Zod schema
 */
export function validateBody<T>(body: unknown, schema: ZodSchema<T>): T {
	const result = schema.safeParse(body)

	if (!result.success) {
		const formattedErrors = result.error.issues.map((issue) => ({
			path: issue.path.join("."),
			message: issue.message
		}))

		throw new ValidationError(
			`Validation failed: ${JSON.stringify(formattedErrors)}`
		)
	}

	return result.data
}

/**
 * Parse request body and validate against schema in one step
 */
export async function parseAndValidate<T>(
	req: IncomingMessage,
	schema: ZodSchema<T>
): Promise<T> {
	const body = await parseBody(req)
	return validateBody(body, schema)
}

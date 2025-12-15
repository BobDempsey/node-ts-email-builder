/**
 * Validates environment variables against a Zod schema and provides helpful error messages. This utility function attempts to parse environment variables using the provided Zod schema, and if validation fails, it formats the error to clearly show which required environment variables are missing, making it easier for developers to identify configuration issues.
 */

import type { ZodObject, ZodRawShape } from "zod"

import { ZodError } from "zod"

export default function tryParseEnv<T extends ZodRawShape>(
	EnvSchema: ZodObject<T>,
	buildEnv: Record<string, string | undefined> = process.env
) {
	try {
		EnvSchema.parse(buildEnv)
	} catch (error) {
		if (error instanceof ZodError) {
			let message: string = "Missing required values in .env:\n"
			for (const issue of error.issues) {
				message += `${String(issue.path[0])}\n`
			}
			const e = new Error(message)
			e.stack = ""
			throw e
		} else {
			console.error(error)
		}
	}
}

/**
 * Environment variable schema definition and validation using Zod.
 *
 * This module defines the expected environment variables for the application
 * using Zod schemas, validates them at runtime, and exports a parsed
 * environment object with type safety.
 */
import { z } from "zod"

import { NODE_ENV_VALUES } from "@/lib/constants"
import tryParseEnv from "@/lib/try-parse-env"

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace"] as const

const EnvSchema = z.object({
	NODE_ENV: z.enum(NODE_ENV_VALUES).optional(),
	LOG_LEVEL: z.enum(LOG_LEVELS).default("info").optional()
})

export type EnvSchema = z.infer<typeof EnvSchema>

tryParseEnv(EnvSchema)

export default EnvSchema.parse(process.env)

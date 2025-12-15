/**
 * Common Zod validation schemas.
 *
 * Reusable schemas for request validation.
 */
import { z } from "zod"

/**
 * UUID parameter validation
 */
export const IdParamSchema = z.object({
	id: z.string().uuid()
})

/**
 * Pagination query parameters
 */
export const PaginationSchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(100).default(20)
})

export type IdParam = z.infer<typeof IdParamSchema>
export type Pagination = z.infer<typeof PaginationSchema>

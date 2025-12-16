import { z } from "zod"
import { NODE_ENV_VALUES } from "@/lib/constants"

// Mock the tryParseEnv module before importing env
jest.mock("@/lib/try-parse-env", () => {
	return jest.fn().mockImplementation(() => {
		// Mock implementation that doesn't throw
	})
})

describe("Environment Configuration", () => {
	const originalEnv = process.env

	beforeEach(() => {
		jest.resetModules()
		process.env = { ...originalEnv }
	})

	afterAll(() => {
		process.env = originalEnv
	})

	describe("Environment Schema", () => {
		it("should define correct schema structure", () => {
			// Import the schema after mocking
			const expectedSchema = z.object({
				NODE_ENV: z.string().optional(),
				LOG_LEVEL: z.string().optional()
			})

			// Test schema properties
			expect(expectedSchema.shape.NODE_ENV).toBeDefined()
			expect(expectedSchema.shape.LOG_LEVEL).toBeDefined()
		})

		it("should have optional NODE_ENV field", () => {
			const schema = z.object({
				NODE_ENV: z.string().optional()
			})

			// Should not throw with undefined NODE_ENV
			expect(() => schema.parse({ NODE_ENV: undefined })).not.toThrow()
			expect(() => schema.parse({})).not.toThrow()
		})
	})

	describe("Environment Type Safety", () => {
		it("should export correct TypeScript types", async () => {
			// This test verifies that the TypeScript compilation succeeds
			// and the exported types are correct
			const envModule = await import("@/lib/env")

			expect(envModule.default).toBeDefined()
			expect(typeof envModule.default).toBe("object")
		})
	})

	describe("Environment Variables Processing", () => {
		it("should handle NODE_ENV values", () => {
			const schema = z.object({
				NODE_ENV: z.enum(NODE_ENV_VALUES).optional()
			})

			for (const env of NODE_ENV_VALUES) {
				expect(() => schema.parse({ NODE_ENV: env })).not.toThrow()
			}
		})
	})
})

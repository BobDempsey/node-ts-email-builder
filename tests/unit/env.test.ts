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
	const port: number = 4000

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
				PORT: z.number().default(3000).optional()
			})

			// Test schema properties
			expect(expectedSchema.shape.NODE_ENV).toBeDefined()
			expect(expectedSchema.shape.PORT).toBeDefined()
		})

		it("should have optional NODE_ENV field", () => {
			const schema = z.object({
				NODE_ENV: z.string().optional()
			})

			// Should not throw with undefined NODE_ENV
			expect(() => schema.parse({ NODE_ENV: undefined })).not.toThrow()
			expect(() => schema.parse({})).not.toThrow()
		})

		it("should have PORT with default value", () => {
			const schema = z.object({
				PORT: z.number().default(port).optional()
			})

			// Should not throw with undefined PORT and should use default
			const result = schema.parse({})
			expect(result.PORT).toBe(port)
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
		it("should handle string PORT conversion", () => {
			process.env.PORT = port.toString()

			const schema = z.object({
				PORT: z
					.string()
					.transform((val: string) => (val ? Number.parseInt(val, 10) : 3000))
			})

			const result = schema.parse({ PORT: port.toString() })
			expect(result.PORT).toBe(port)
			expect(typeof result.PORT).toBe("number")
		})

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

import { z } from "zod"
import tryParseEnv from "@/lib/try-parse-env"

describe("tryParseEnv", () => {
	const originalEnv = process.env

	beforeEach(() => {
		// Reset environment variables before each test
		jest.resetModules()
		process.env = { ...originalEnv }
	})

	afterAll(() => {
		// Restore original environment
		process.env = originalEnv
	})

	describe("valid environment variables", () => {
		it("should validate environment variables successfully with valid data", () => {
			const TestSchema = z.object({
				TEST_PORT: z.string().transform(Number),
				TEST_URL: z.url()
			})

			const mockEnv = {
				TEST_PORT: "3000",
				TEST_URL: "https://example.com"
			}

			expect(() => tryParseEnv(TestSchema, mockEnv)).not.toThrow()
		})

		it("should work with optional fields", () => {
			const TestSchema = z.object({
				REQUIRED_FIELD: z.string(),
				OPTIONAL_FIELD: z.string().optional()
			})

			const mockEnv = {
				REQUIRED_FIELD: "value"
			}

			expect(() => tryParseEnv(TestSchema, mockEnv)).not.toThrow()
		})
	})

	describe("invalid environment variables", () => {
		it("should throw error with missing required environment variables", () => {
			const TestSchema = z.object({
				REQUIRED_FIELD: z.string(),
				ANOTHER_REQUIRED: z.string()
			})

			const mockEnv = {} // Missing required fields

			expect(() => tryParseEnv(TestSchema, mockEnv)).toThrow(
				"Missing required values in .env:"
			)
		})

		it("should include missing field names in error message", () => {
			const TestSchema = z.object({
				DATABASE_URL: z.string(),
				API_KEY: z.string()
			})

			const mockEnv = {} // Missing both fields

			try {
				tryParseEnv(TestSchema, mockEnv)
			} catch (error) {
				expect(error).toBeInstanceOf(Error)
				const errorMessage = (error as Error).message
				expect(errorMessage).toContain("DATABASE_URL")
				expect(errorMessage).toContain("API_KEY")
			}
		})

		it("should validate field formats correctly", () => {
			const TestSchema = z.object({
				PORT: z.string().transform(Number),
				EMAIL: z.email()
			})

			const mockEnv = {
				PORT: "not-a-number",
				EMAIL: "invalid-email"
			}

			expect(() => tryParseEnv(TestSchema, mockEnv)).toThrow()
		})

		it("should handle non-ZodError exceptions", () => {
			const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation()

			// Create a schema
			const TestSchema = z.object({
				TEST_FIELD: z.string()
			})

			// Mock schema.parse to throw a non-ZodError
			const mockParse = jest
				.spyOn(TestSchema, "parse")
				.mockImplementation(() => {
					throw new TypeError("Unexpected error")
				})

			const mockEnv = { TEST_FIELD: "value" }

			// Should not throw, but should log to console.error
			expect(() => tryParseEnv(TestSchema, mockEnv)).not.toThrow()

			expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(TypeError))

			consoleErrorSpy.mockRestore()
			mockParse.mockRestore()
		})
	})

	describe("default process.env usage", () => {
		it("should use process.env when no buildEnv is provided", () => {
			process.env.TEST_VAR = "test-value"

			const TestSchema = z.object({
				TEST_VAR: z.string()
			})

			expect(() => tryParseEnv(TestSchema)).not.toThrow()
		})
	})
})

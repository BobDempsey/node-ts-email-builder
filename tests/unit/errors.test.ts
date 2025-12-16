import { AppError, ValidationError } from "@/lib/errors"

describe("Custom Error Classes", () => {
	describe("AppError", () => {
		it("should create error with default values", () => {
			const error = new AppError("Test error")

			expect(error.message).toBe("Test error")
			expect(error.isOperational).toBe(true)
			expect(error.name).toBe("AppError")
			expect(error.code).toBeUndefined()
		})

		it("should create error with custom code", () => {
			const error = new AppError("Test error", "CUSTOM_ERROR")

			expect(error.message).toBe("Test error")
			expect(error.code).toBe("CUSTOM_ERROR")
			expect(error.isOperational).toBe(true)
		})

		it("should create error with custom isOperational flag", () => {
			const error = new AppError("Test error", "ERROR_CODE", false)

			expect(error.isOperational).toBe(false)
		})

		it("should be instance of Error", () => {
			const error = new AppError("Test error")

			expect(error).toBeInstanceOf(Error)
			expect(error).toBeInstanceOf(AppError)
		})

		it("should capture stack trace", () => {
			const error = new AppError("Test error")

			expect(error.stack).toBeDefined()
			expect(error.stack).toContain("AppError")
		})

		it("should serialize to JSON without stack by default", () => {
			const error = new AppError("Test error", "TEST_CODE")
			const json = error.toJSON()

			expect(json.error).toBe("AppError")
			expect(json.message).toBe("Test error")
			expect(json.code).toBe("TEST_CODE")
			expect(json.stack).toBeUndefined()
		})

		it("should serialize to JSON with stack when requested", () => {
			const error = new AppError("Test error")
			const json = error.toJSON(true)

			expect(json.stack).toBeDefined()
		})
	})

	describe("ValidationError", () => {
		it("should create error with VALIDATION_ERROR code", () => {
			const error = new ValidationError("Invalid input")

			expect(error.message).toBe("Invalid input")
			expect(error.code).toBe("VALIDATION_ERROR")
			expect(error.isOperational).toBe(true)
			expect(error.name).toBe("ValidationError")
		})

		it("should be instance of AppError", () => {
			const error = new ValidationError("Invalid input")

			expect(error).toBeInstanceOf(Error)
			expect(error).toBeInstanceOf(AppError)
			expect(error).toBeInstanceOf(ValidationError)
		})
	})
})

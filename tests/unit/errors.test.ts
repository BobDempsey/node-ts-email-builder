import {
	AppError,
	NotFoundError,
	UnauthorizedError,
	ValidationError
} from "@/lib/errors"

describe("Custom Error Classes", () => {
	describe("AppError", () => {
		it("should create error with default values", () => {
			const error = new AppError("Test error")

			expect(error.message).toBe("Test error")
			expect(error.statusCode).toBe(500)
			expect(error.isOperational).toBe(true)
			expect(error.name).toBe("AppError")
		})

		it("should create error with custom status code", () => {
			const error = new AppError("Test error", 400)

			expect(error.message).toBe("Test error")
			expect(error.statusCode).toBe(400)
			expect(error.isOperational).toBe(true)
		})

		it("should create error with custom isOperational flag", () => {
			const error = new AppError("Test error", 500, false)

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
	})

	describe("ValidationError", () => {
		it("should create error with status 400", () => {
			const error = new ValidationError("Invalid input")

			expect(error.message).toBe("Invalid input")
			expect(error.statusCode).toBe(400)
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

	describe("NotFoundError", () => {
		it("should create error with default message", () => {
			const error = new NotFoundError()

			expect(error.message).toBe("Resource not found")
			expect(error.statusCode).toBe(404)
			expect(error.isOperational).toBe(true)
			expect(error.name).toBe("NotFoundError")
		})

		it("should create error with custom message", () => {
			const error = new NotFoundError("User not found")

			expect(error.message).toBe("User not found")
			expect(error.statusCode).toBe(404)
		})

		it("should be instance of AppError", () => {
			const error = new NotFoundError()

			expect(error).toBeInstanceOf(Error)
			expect(error).toBeInstanceOf(AppError)
			expect(error).toBeInstanceOf(NotFoundError)
		})
	})

	describe("UnauthorizedError", () => {
		it("should create error with default message", () => {
			const error = new UnauthorizedError()

			expect(error.message).toBe("Unauthorized")
			expect(error.statusCode).toBe(401)
			expect(error.isOperational).toBe(true)
			expect(error.name).toBe("UnauthorizedError")
		})

		it("should create error with custom message", () => {
			const error = new UnauthorizedError("Invalid token")

			expect(error.message).toBe("Invalid token")
			expect(error.statusCode).toBe(401)
		})

		it("should be instance of AppError", () => {
			const error = new UnauthorizedError()

			expect(error).toBeInstanceOf(Error)
			expect(error).toBeInstanceOf(AppError)
			expect(error).toBeInstanceOf(UnauthorizedError)
		})
	})
})

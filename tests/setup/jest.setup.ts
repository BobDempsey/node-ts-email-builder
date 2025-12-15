// Jest setup file for global test configuration
import { jest } from "@jest/globals"

// Set test environment variables
process.env.NODE_ENV = "test"
process.env.PORT = "0" // Use random port for tests

// Global test timeout
jest.setTimeout(10000)

// Mock console methods to reduce test output noise
const originalConsoleLog = console.log
const originalConsoleError = console.error

beforeAll(() => {
	// Suppress dotenv console output during tests
	console.log = ((...args: unknown[]) => {
		// Filter out dotenv logs
		const message = String(args[0])
		if (message.includes("[dotenv@")) {
			return
		}
		// Pass through other console.log calls
		originalConsoleLog(...args)
	}) as typeof console.log
})

afterAll(() => {
	// Restore console methods
	console.log = originalConsoleLog
	console.error = originalConsoleError
})

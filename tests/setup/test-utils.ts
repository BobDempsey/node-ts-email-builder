import type { Server } from "http"

/**
 * Test utilities and helper functions for testing environment variables and server setup.
 */

/**
 * Creates a mock environment object for testing
 * @param overrides - Environment variables to override
 * @returns Mock environment object
 */
export function createMockEnv(
	overrides: Record<string, string> = {}
): Record<string, string | undefined> {
	return {
		NODE_ENV: "test",
		PORT: "0",
		...overrides
	}
}

/**
 * Temporarily sets environment variables for testing
 * @param envVars - Environment variables to set
 * @param testFn - Test function to run with the environment
 */
export async function withTestEnv<T>(
	envVars: Record<string, string>,
	testFn: () => Promise<T> | T
): Promise<T> {
	const originalEnv = { ...process.env }

	try {
		// Set test environment variables
		for (const [key, value] of Object.entries(envVars)) {
			process.env[key] = value
		}

		return await testFn()
	} finally {
		// Restore original environment
		process.env = originalEnv
	}
}

/**
 * Waits for a server to start listening
 * @param server - HTTP server instance
 * @param timeout - Maximum time to wait in milliseconds
 */

export function waitForServer(
	server: Server,
	timeout: number = 5000
): Promise<void> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			reject(new Error(`Server did not start within ${timeout}ms`))
		}, timeout)

		if (server.listening) {
			clearTimeout(timer)
			resolve()
			return
		}

		server.on("listening", () => {
			clearTimeout(timer)
			resolve()
		})

		server.on("error", (error: Error) => {
			clearTimeout(timer)
			reject(error)
		})
	})
}

/**
 * Gets a free port for testing
 * @returns Promise that resolves to an available port number
 */
export function getFreePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = require("net").createServer()

		server.listen(0, () => {
			const port = server.address()?.port
			server.close(() => {
				if (port) {
					resolve(port)
				} else {
					reject(new Error("Could not get free port"))
				}
			})
		})

		server.on("error", reject)
	})
}

/**
 * Cleans up test resources and resets modules
 */
export function cleanupTest(): void {
	// Reset all modules to ensure clean state
	jest.resetModules()

	// Clear all mocks
	jest.clearAllMocks()
}

/**
 * Type definitions for test utilities
 */
export interface TestServerOptions {
	port?: number
	env?: Record<string, string>
	timeout?: number
}

/**
 * Mock server response for testing
 */
export interface MockResponse {
	status: number
	headers: Record<string, string>
	body: string
}

/**
 * Test utilities and helper functions for testing environment variables.
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
 * Cleans up test resources and resets modules
 */
export function cleanupTest(): void {
	// Reset all modules to ensure clean state
	jest.resetModules()

	// Clear all mocks
	jest.clearAllMocks()
}

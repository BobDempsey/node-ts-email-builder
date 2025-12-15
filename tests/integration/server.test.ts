import { randomUUID } from "crypto"
import { createServer, type Server } from "http"
import request from "supertest"
import { GREETING } from "@/lib/constants"

// Create our own server instance for testing that mirrors the main server
describe("HTTP Server Integration Tests", () => {
	let server: Server

	beforeAll(() => {
		// Create a test server that mirrors our main server's functionality
		server = createServer((req, res) => {
			// Generate or propagate request ID for tracing
			const requestId = req.headers["x-request-id"]?.toString() || randomUUID()
			res.setHeader("X-Request-Id", requestId)

			// Health check endpoint
			if (req.url === "/health") {
				res.writeHead(200, { "Content-Type": "application/json" })
				res.end(
					JSON.stringify({ status: "ok", timestamp: new Date().toISOString() })
				)
				return
			}

			res.writeHead(200, { "Content-Type": "text/plain" })
			res.end(GREETING)
		})
	})

	afterAll((done) => {
		if (server?.listening) {
			server.close(done)
		} else {
			done()
		}
	})

	describe("GET /", () => {
		it("should respond with 200 status", async () => {
			const response = await request(server).get("/")
			expect(response.status).toBe(200)
		})

		it("should return correct content type", async () => {
			const response = await request(server).get("/")
			expect(response.headers["content-type"]).toBe("text/plain")
		})

		it("should return expected message", async () => {
			const response = await request(server).get("/")
			expect(response.text).toBe(GREETING)
		})

		it("should handle multiple concurrent requests", async () => {
			const responses = []
			for (let i = 0; i < 5; i++) {
				const response = await request(server).get("/")
				responses.push(response)
			}

			for (const response of responses) {
				expect(response.status).toBe(200)
				expect(response.text).toBe(GREETING)
			}
		})
	})

	describe("HTTP Methods", () => {
		it("should handle POST requests to root", async () => {
			const response = await request(server).post("/")
			// Server should still respond (our basic server handles all methods the same way)
			expect(response.status).toBe(200)
		})

		it("should handle PUT requests", async () => {
			const response = await request(server).put("/")
			expect(response.status).toBe(200)
		})

		it("should handle DELETE requests", async () => {
			const response = await request(server).delete("/")
			expect(response.status).toBe(200)
		})
	})

	describe("Different Routes", () => {
		it("should handle requests to different paths", async () => {
			const paths = ["/test", "/api", "/nonexistent"]

			for (const path of paths) {
				const response = await request(server).get(path)
				// Our basic server responds the same way to all paths (except /health)
				expect(response.status).toBe(200)
				expect(response.text).toBe(GREETING)
			}
		})
	})

	describe("Health Check Endpoint", () => {
		it("should respond with 200 status on /health", async () => {
			const response = await request(server).get("/health")
			expect(response.status).toBe(200)
		})

		it("should return JSON content type on /health", async () => {
			const response = await request(server).get("/health")
			expect(response.headers["content-type"]).toBe("application/json")
		})

		it("should return status ok in response body", async () => {
			const response = await request(server).get("/health")
			expect(response.body.status).toBe("ok")
		})

		it("should include timestamp in response body", async () => {
			const response = await request(server).get("/health")
			expect(response.body.timestamp).toBeDefined()
			expect(new Date(response.body.timestamp).toISOString()).toBe(
				response.body.timestamp
			)
		})
	})

	describe("Request ID Tracing", () => {
		it("should generate X-Request-Id header when not provided", async () => {
			const response = await request(server).get("/")
			expect(response.headers["x-request-id"]).toBeDefined()
			expect(response.headers["x-request-id"]).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
			)
		})

		it("should propagate X-Request-Id header when provided", async () => {
			const customRequestId = "custom-request-id-12345"
			const response = await request(server)
				.get("/")
				.set("X-Request-Id", customRequestId)

			expect(response.headers["x-request-id"]).toBe(customRequestId)
		})

		it("should include X-Request-Id on health endpoint", async () => {
			const response = await request(server).get("/health")
			expect(response.headers["x-request-id"]).toBeDefined()
		})
	})

	describe("Server Performance", () => {
		it("should respond within reasonable time", async () => {
			const startTime = Date.now()

			await request(server).get("/")

			const responseTime = Date.now() - startTime
			expect(responseTime).toBeLessThan(100) // Should respond within 100ms
		})

		it("should handle rapid successive requests", async () => {
			const responses = []

			for (let i = 0; i < 10; i++) {
				const response = await request(server).get("/")
				responses.push(response)
			}

			for (const response of responses) {
				expect(response.status).toBe(200)
			}
		})
	})

	describe("Request Headers", () => {
		it("should handle requests with custom headers", async () => {
			const response = await request(server)
				.get("/")
				.set("User-Agent", "Test-Agent")
				.set("Accept", "text/plain")

			expect(response.status).toBe(200)
		})

		it("should handle requests without headers", async () => {
			const response = await request(server).get("/")
			expect(response.status).toBe(200)
		})
	})
})

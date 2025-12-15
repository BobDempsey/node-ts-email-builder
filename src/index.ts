import { randomUUID } from "crypto"
import dotenv from "dotenv"
import { createServer, type IncomingMessage, type ServerResponse } from "http"
import { parseBody } from "@/lib/body-parser"
import { GREETING } from "@/lib/constants"
import env from "@/lib/env"
import { logger } from "@/lib/logger"
import { sendNotFound } from "@/lib/response"
import { handleError } from "@/middleware/error-handler"
import { requestLoggerMiddleware } from "@/middleware/request-logger"
import {
	handleHealth,
	handleLive,
	handleReady,
	setReadyState
} from "@/routes/health"
import type { ParsedRequest, Route } from "@/types/http"

dotenv.config()
const PORT: number = env.PORT ?? 3000
const SHUTDOWN_TIMEOUT = 10000
let shutdownTimer: NodeJS.Timeout | null = null

// Route definitions
const routes: Route[] = [
	{
		method: "GET",
		path: "/health",
		handler: (req, res) => handleHealth(res, req.requestId)
	},
	{
		method: "GET",
		path: "/ready",
		handler: (req, res) => handleReady(res, req.requestId)
	},
	{ method: "GET", path: "/live", handler: (_, res) => handleLive(res) }
]

/**
 * Find matching route for request
 */
function findRoute(method: string, url: string): Route | undefined {
	const path = url.split("?")[0]
	return routes.find((r) => r.method === method && r.path === path)
}

/**
 * Handle incoming HTTP request
 */
async function handleRequest(
	req: IncomingMessage,
	res: ServerResponse
): Promise<void> {
	// Generate or propagate request ID for tracing
	const requestId = req.headers["x-request-id"]?.toString() || randomUUID()
	res.setHeader("X-Request-Id", requestId)

	// Cast to ParsedRequest and add requestId
	const parsedReq = req as ParsedRequest
	parsedReq.requestId = requestId

	// Request logging middleware
	requestLoggerMiddleware(req, res, requestId, { excludePaths: ["/live"] })

	try {
		// Find matching route
		const route = findRoute(req.method ?? "GET", req.url ?? "/")

		if (route) {
			// Parse body for non-GET requests
			if (
				req.method !== "GET" &&
				req.method !== "HEAD" &&
				req.method !== "OPTIONS"
			) {
				parsedReq.body = await parseBody(req)
			}

			await route.handler(parsedReq, res)
			return
		}

		// Default route - greeting for root path
		if (req.url === "/" || req.url?.startsWith("/?")) {
			res.writeHead(200, { "Content-Type": "text/plain" })
			res.end(GREETING)
			return
		}

		// No matching route found
		sendNotFound(res, "Route not found", requestId)
	} catch (error) {
		handleError(error as Error, res, requestId)
	}
}

const server = createServer((req, res) => {
	handleRequest(req, res).catch((err) => {
		logger.error({ err }, "Unhandled request error")
		if (!res.headersSent) {
			res.writeHead(500)
			res.end("Internal Server Error")
		}
	})
})

// Handle server errors
server.on("error", (err: NodeJS.ErrnoException) => {
	if (err.code === "EADDRINUSE") {
		logger.error(`Port ${PORT} is already in use`)
		process.exit(1)
	}
	logger.error({ err }, "Server error")
	process.exit(1)
})

server.listen(PORT, () => {
	setReadyState(true)
	logger.info(
		{ port: PORT, env: env.NODE_ENV || "development" },
		"Server started"
	)
})

// Graceful shutdown with timeout
const shutdown = (signal: string) => {
	setReadyState(false)
	logger.info({ signal }, "Shutting down gracefully")
	server.close(() => {
		logger.info("Process terminated")
		process.exit(0)
	})

	// Force exit after timeout if connections don't close
	shutdownTimer = setTimeout(() => {
		logger.error("Forced shutdown after timeout")
		process.exit(1)
	}, SHUTDOWN_TIMEOUT)
	shutdownTimer.unref()
}

// Signal handlers
const sigTermHandler = () => shutdown("SIGTERM")
const sigIntHandler = () => shutdown("SIGINT")
const sigHupHandler = () => shutdown("SIGHUP")

process.on("SIGTERM", sigTermHandler)
process.on("SIGINT", sigIntHandler)
process.on("SIGHUP", sigHupHandler)

// Uncaught exception handling
const uncaughtExceptionHandler = (err: Error) => {
	logger.error({ err }, "Uncaught exception")
	process.exit(1)
}

const unhandledRejectionHandler = (reason: unknown) => {
	logger.error({ reason }, "Unhandled rejection")
	process.exit(1)
}

process.on("uncaughtException", uncaughtExceptionHandler)
process.on("unhandledRejection", unhandledRejectionHandler)

// Export cleanup function for testing
export const cleanup = () => {
	process.removeListener("SIGTERM", sigTermHandler)
	process.removeListener("SIGINT", sigIntHandler)
	process.removeListener("SIGHUP", sigHupHandler)
	process.removeListener("uncaughtException", uncaughtExceptionHandler)
	process.removeListener("unhandledRejection", unhandledRejectionHandler)
	if (shutdownTimer) {
		clearTimeout(shutdownTimer)
		shutdownTimer = null
	}
}

export default server

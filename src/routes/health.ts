/**
 * Health check endpoints for Kubernetes-style probes.
 *
 * - /health - Comprehensive health check (backward compatible)
 * - /ready  - Readiness probe (can fail during initialization/shutdown)
 * - /live   - Liveness probe (always succeeds if process is running)
 */
import type { ServerResponse } from "http"
import { sendSuccess } from "@/lib/response"

// Application readiness state
let isReady = false

/**
 * Set the application readiness state
 */
export function setReadyState(ready: boolean): void {
	isReady = ready
}

/**
 * Get the current readiness state
 */
export function getReadyState(): boolean {
	return isReady
}

/**
 * GET /health - Comprehensive health check
 * Returns status and timestamp in success envelope
 */
export function handleHealth(res: ServerResponse, requestId: string): void {
	sendSuccess(res, {
		data: {
			status: "ok",
			timestamp: new Date().toISOString()
		},
		requestId
	})
}

/**
 * GET /ready - Readiness probe
 * Returns 503 if not ready, 200 if ready
 */
export function handleReady(res: ServerResponse, requestId: string): void {
	if (isReady) {
		sendSuccess(res, {
			data: {
				status: "ready",
				timestamp: new Date().toISOString()
			},
			requestId
		})
	} else {
		res.writeHead(503, { "Content-Type": "application/json" })
		res.end(
			JSON.stringify({
				success: false,
				error: {
					message: "Service not ready",
					code: "NOT_READY"
				},
				meta: {
					timestamp: new Date().toISOString(),
					requestId
				}
			})
		)
	}
}

/**
 * GET /live - Liveness probe
 * Always returns 200 if the process is running
 * Minimal response for frequent health checks
 */
export function handleLive(res: ServerResponse): void {
	res.writeHead(200, { "Content-Type": "application/json" })
	res.end(JSON.stringify({ status: "live" }))
}

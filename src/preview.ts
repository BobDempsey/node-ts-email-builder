#!/usr/bin/env node

/**
 * Email Preview Server - Start with: npm run preview
 */

import type { UserConfig } from "@/email-builder"
import EmailBuilder from "@/email-builder"

// Configuration - customize as needed
const config: UserConfig = {
	// Server port
	port: process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000,

	// Data source options:
	// 1. Local JSON (default)
	dataSource: {
		type: "json"
	}

	// 2. API endpoint
	// dataSource: {
	//   type: "api",
	//   api: {
	//     endpoint: "https://api.example.com/email-data",
	//     headers: {
	//       "Authorization": "Bearer YOUR_TOKEN",
	//     },
	//   },
	// },

	// 3. Database (requires custom implementation)
	// dataSource: {
	//   type: "database",
	//   database: {
	//     client: "pg",
	//     connection: process.env.DATABASE_URL,
	//   },
	// },
}

async function main(): Promise<void> {
	const builder = new EmailBuilder(config)

	try {
		const port = config.port ?? 3000
		const { url } = await builder.startPreview({
			port,
			open: true
		})

		console.log(`
Email Builder Preview Server
================================
URL:       ${url}
Templates: ${builder.config.emailsDir}

Hot reload is enabled - edit any .hbs file to see changes instantly!

Press Ctrl+C to stop the server.
`)
	} catch (err) {
		console.error("Failed to start preview server:", err)
		process.exit(1)
	}
}

main()

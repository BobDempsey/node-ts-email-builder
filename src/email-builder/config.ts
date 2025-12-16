/**
 * Email Builder Configuration
 */

import path from "path"
import type { Config, UserConfig } from "./types"

// Resolve to the source directory (works for both compiled and source)
const sourceDir = __dirname.includes("dist")
	? path.join(__dirname, "..", "..", "src", "email-builder")
	: __dirname

export const defaults: Config = {
	// Server settings
	port: 3000,
	host: "localhost",

	// Paths (relative to email-builder root)
	templatesDir: path.join(sourceDir, "templates"),
	layoutsDir: path.join(sourceDir, "templates", "layouts"),
	partialsDir: path.join(sourceDir, "templates", "partials"),
	emailsDir: path.join(sourceDir, "templates", "emails"),
	dataDir: path.join(sourceDir, "data"),
	publicDir: path.join(sourceDir, "public"),

	// Default layout
	defaultLayout: "default",

	// Data source configuration
	dataSource: {
		type: "json",
		api: {
			endpoint: null,
			headers: {},
			timeout: 5000
		},
		database: {
			client: null,
			connection: null
		}
	},

	// Cache settings
	cache: {
		enabled: true,
		ttl: 60000
	},

	// CSS inlining options (juice)
	juice: {
		preserveMediaQueries: true,
		preserveFontFaces: true,
		preserveKeyFrames: true,
		applyWidthAttributes: true,
		applyHeightAttributes: true,
		removeStyleTags: false
	},

	// File watcher options
	watcher: {
		debounce: 100,
		ignored: /node_modules/
	}
}

/**
 * Merge user config with defaults
 */
export function createConfig(userConfig: UserConfig = {}): Config {
	return {
		...defaults,
		...userConfig,
		templatesDir: userConfig.templatesDir ?? defaults.templatesDir,
		layoutsDir: userConfig.layoutsDir ?? defaults.layoutsDir,
		partialsDir: userConfig.partialsDir ?? defaults.partialsDir,
		emailsDir: userConfig.emailsDir ?? defaults.emailsDir,
		dataDir: userConfig.dataDir ?? defaults.dataDir,
		publicDir: userConfig.publicDir ?? defaults.publicDir,
		dataSource: {
			...defaults.dataSource,
			...userConfig.dataSource,
			type: userConfig.dataSource?.type ?? defaults.dataSource.type,
			api: {
				...defaults.dataSource.api,
				...(userConfig.dataSource?.api ?? {})
			},
			database: {
				...defaults.dataSource.database,
				...(userConfig.dataSource?.database ?? {})
			}
		},
		cache: {
			...defaults.cache,
			...userConfig.cache
		},
		juice: {
			...defaults.juice,
			...userConfig.juice
		},
		watcher: {
			...defaults.watcher,
			...userConfig.watcher
		}
	}
}

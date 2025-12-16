/**
 * Email Builder Type Definitions
 */

import type { HelperOptions } from "handlebars"

// ============================================================================
// Configuration Types
// ============================================================================

export interface ApiConfig {
	endpoint: string | null
	headers: Record<string, string>
	timeout: number
}

export interface DatabaseConfig {
	client: string | null
	connection: string | null
}

export interface DataSourceConfig {
	type: "json" | "api" | "database"
	api: ApiConfig
	database: DatabaseConfig
}

export interface CacheConfig {
	enabled: boolean
	ttl: number
}

export interface JuiceConfig {
	preserveMediaQueries: boolean
	preserveFontFaces: boolean
	preserveKeyFrames: boolean
	applyWidthAttributes: boolean
	applyHeightAttributes: boolean
	removeStyleTags: boolean
}

export interface WatcherConfig {
	debounce: number
	ignored: RegExp
}

export interface Config {
	port: number
	host: string
	templatesDir: string
	layoutsDir: string
	partialsDir: string
	emailsDir: string
	dataDir: string
	publicDir: string
	defaultLayout: string
	dataSource: DataSourceConfig
	cache: CacheConfig
	juice: JuiceConfig
	watcher: WatcherConfig
}

export interface UserConfig {
	port?: number
	host?: string
	templatesDir?: string
	layoutsDir?: string
	partialsDir?: string
	emailsDir?: string
	dataDir?: string
	publicDir?: string
	defaultLayout?: string
	dataSource?: Partial<DataSourceConfig> & {
		api?: Partial<ApiConfig>
		database?: Partial<DatabaseConfig>
	}
	cache?: Partial<CacheConfig>
	juice?: Partial<JuiceConfig>
	watcher?: Partial<WatcherConfig>
}

// ============================================================================
// Compilation Types
// ============================================================================

export interface CompileOptions {
	layout?: string
	inlineCss?: boolean
}

export interface CompileResult {
	html: string
	text: string
	subject: string | null
}

// ============================================================================
// Data Types
// ============================================================================

export type TemplateData = Record<string, unknown>

// ============================================================================
// Watcher Types
// ============================================================================

export interface FileChange {
	event: "change" | "add" | "unlink"
	filePath: string
	relativePath: string
	type: "layout" | "partial" | "email" | "unknown"
	name: string
}

export interface WatcherChangeEvent {
	changes: FileChange[]
	reloadTypes: string[]
	changedTemplates: string[]
	needsFullReload: boolean
}

// ============================================================================
// Preview Server Types
// ============================================================================

export interface PreviewServerOptions {
	port?: number
	open?: boolean
}

export interface PreviewStartResult {
	url: string
	port: number
}

// ============================================================================
// Handlebars Helper Types
// ============================================================================

export type HandlebarsHelperFn = (...args: unknown[]) => unknown

export interface BlockHelperOptions extends HelperOptions {
	fn: (context?: unknown) => string
	inverse: (context?: unknown) => string
}

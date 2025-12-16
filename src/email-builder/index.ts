/**
 * Email Builder - Dynamic email creation with Handlebars and live preview
 */

import EmailCompiler from "./compiler"
import { createConfig, defaults } from "./config"
import DataLoader from "./data-loader"
import PreviewServer from "./preview-server"
import type {
	CompileOptions,
	CompileResult,
	Config,
	HandlebarsHelperFn,
	PreviewServerOptions,
	PreviewStartResult,
	TemplateData,
	UserConfig
} from "./types"
import FileWatcher from "./watcher"

class EmailBuilder {
	public config: Config
	private compiler: EmailCompiler
	private dataLoader: DataLoader
	private watcher: FileWatcher
	private previewServer: PreviewServer | null

	/**
	 * Create an EmailBuilder instance
	 */
	constructor(userConfig: UserConfig = {}) {
		this.config = createConfig(userConfig)
		this.compiler = new EmailCompiler(this.config)
		this.dataLoader = new DataLoader(this.config)
		this.watcher = new FileWatcher(this.config)
		this.previewServer = null
	}

	/**
	 * Initialize the email builder
	 */
	async init(): Promise<void> {
		await this.compiler.init()
	}

	/**
	 * Compile an email template
	 */
	async compile(
		templateName: string,
		data: TemplateData = {},
		options: CompileOptions = {}
	): Promise<CompileResult> {
		// Load data from configured source
		const loadedData = await this.dataLoader.load(templateName)

		// Merge with provided data (provided data takes precedence)
		const mergedData = { ...loadedData, ...data }

		return this.compiler.compile(templateName, mergedData, options)
	}

	/**
	 * Compile an email with custom data override
	 */
	async compileWithOverrides(
		templateName: string,
		overrides: TemplateData = {},
		options: CompileOptions = {}
	): Promise<CompileResult> {
		const data = await this.dataLoader.loadWithOverrides(
			templateName,
			overrides
		)
		return this.compiler.compile(templateName, data, options)
	}

	/**
	 * Get list of available templates
	 */
	async listTemplates(): Promise<string[]> {
		return this.compiler.listTemplates()
	}

	/**
	 * Register a custom Handlebars helper
	 */
	registerHelper(name: string, fn: HandlebarsHelperFn): void {
		this.compiler.registerHelper(name, fn)
	}

	/**
	 * Start the preview server with hot reload
	 */
	async startPreview(
		options: PreviewServerOptions = {}
	): Promise<PreviewStartResult> {
		this.previewServer = new PreviewServer({
			config: this.config,
			compiler: this.compiler,
			dataLoader: this.dataLoader,
			watcher: this.watcher
		})

		return this.previewServer.start(options)
	}

	/**
	 * Stop the preview server
	 */
	async stopPreview(): Promise<void> {
		if (this.previewServer) {
			await this.previewServer.stop()
			this.previewServer = null
		}
	}

	/**
	 * Clear the data cache
	 */
	clearCache(): void {
		this.dataLoader.clearCache()
	}
}

// Export the class and utilities
export default EmailBuilder
export { EmailBuilder }
export { EmailCompiler }
export { DataLoader }
export { FileWatcher }
export { PreviewServer }
export { createConfig, defaults }

// Export types
export type {
	Config,
	UserConfig,
	CompileOptions,
	CompileResult,
	TemplateData,
	PreviewServerOptions,
	PreviewStartResult,
	HandlebarsHelperFn
}

// Export errors
export {
	CompilationError,
	ConfigurationError,
	DataLoadError,
	TemplateNotFoundError
} from "./errors"

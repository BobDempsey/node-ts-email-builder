/**
 * File Watcher - Watches template files for changes
 */

import chokidar, { type FSWatcher } from "chokidar"
import { EventEmitter } from "events"
import path from "path"
import { logger } from "@/lib/logger"
import type { Config, FileChange, WatcherChangeEvent } from "./types"

interface FileWatcherEvents {
	change: (event: WatcherChangeEvent) => void
	error: (error: Error) => void
}

class FileWatcher extends EventEmitter {
	private config: Config
	private watcher: FSWatcher | null
	private debounceTimer: NodeJS.Timeout | null
	private pendingChanges: Set<string>

	constructor(config: Config) {
		super()
		this.config = config
		this.watcher = null
		this.debounceTimer = null
		this.pendingChanges = new Set()
	}

	// Type-safe event emitter methods
	override on<K extends keyof FileWatcherEvents>(
		event: K,
		listener: FileWatcherEvents[K]
	): this {
		return super.on(event, listener)
	}

	override emit<K extends keyof FileWatcherEvents>(
		event: K,
		...args: Parameters<FileWatcherEvents[K]>
	): boolean {
		return super.emit(event, ...args)
	}

	/**
	 * Start watching template files
	 */
	start(): void {
		if (this.watcher) {
			return
		}

		const watchPaths = [
			path.join(this.config.templatesDir, "**", "*.hbs"),
			path.join(this.config.templatesDir, "**", "*.css")
		]

		this.watcher = chokidar.watch(watchPaths, {
			ignored: this.config.watcher.ignored,
			persistent: true,
			ignoreInitial: true,
			awaitWriteFinish: {
				stabilityThreshold: 100,
				pollInterval: 50
			}
		})

		this.watcher
			.on("change", (filePath: string) =>
				this._handleChange("change", filePath)
			)
			.on("add", (filePath: string) => this._handleChange("add", filePath))
			.on("unlink", (filePath: string) =>
				this._handleChange("unlink", filePath)
			)
			.on("error", (error: Error) => this.emit("error", error))

		logger.debug(
			{ templatesDir: this.config.templatesDir },
			"Watching for file changes"
		)
	}

	/**
	 * Stop watching
	 */
	async stop(): Promise<void> {
		if (this.watcher) {
			await this.watcher.close()
			this.watcher = null
			logger.debug("File watcher stopped")
		}

		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer)
			this.debounceTimer = null
		}
	}

	/**
	 * Handle file change with debouncing
	 */
	private _handleChange(
		event: "change" | "add" | "unlink",
		filePath: string
	): void {
		const relativePath = path.relative(this.config.templatesDir, filePath)
		const fileInfo = this._parseFilePath(filePath)

		this.pendingChanges.add(
			JSON.stringify({
				event,
				filePath,
				relativePath,
				...fileInfo
			})
		)

		// Debounce rapid changes
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer)
		}

		this.debounceTimer = setTimeout(() => {
			this._emitChanges()
		}, this.config.watcher.debounce)
	}

	/**
	 * Emit batched changes
	 */
	private _emitChanges(): void {
		const changes: FileChange[] = Array.from(this.pendingChanges).map(
			(str) => JSON.parse(str) as FileChange
		)
		this.pendingChanges.clear()

		// Determine what needs to reload
		const reloadTypes = new Set<string>()
		const changedTemplates = new Set<string>()

		for (const change of changes) {
			if (change.type === "layout") {
				reloadTypes.add("layouts")
			} else if (change.type === "partial") {
				reloadTypes.add("partials")
			} else if (change.type === "email") {
				changedTemplates.add(change.name)
			}
		}

		logger.debug(
			{
				changes: changes.length,
				reloadTypes: Array.from(reloadTypes),
				changedTemplates: Array.from(changedTemplates)
			},
			"File changes detected"
		)

		// Emit a single reload event with all changes
		this.emit("change", {
			changes,
			reloadTypes: Array.from(reloadTypes),
			changedTemplates: Array.from(changedTemplates),
			needsFullReload: reloadTypes.size > 0
		})
	}

	/**
	 * Parse file path to determine type and name
	 */
	private _parseFilePath(filePath: string): {
		type: FileChange["type"]
		name: string
	} {
		const relativePath = path.relative(this.config.templatesDir, filePath)
		const parts = relativePath.split(path.sep)
		const name = path.basename(filePath, path.extname(filePath))

		let type: FileChange["type"] = "unknown"

		if (parts[0] === "layouts") {
			type = "layout"
		} else if (parts[0] === "partials") {
			type = "partial"
		} else if (parts[0] === "emails") {
			type = "email"
		}

		return { type, name }
	}
}

export default FileWatcher

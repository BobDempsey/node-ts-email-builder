/**
 * Data Loader - Fetches template data from various sources
 */

import fs from "fs/promises"
import path from "path"
import { logger } from "@/lib/logger"
import { DataLoadError } from "./errors"
import type { Config, TemplateData } from "./types"

class DataLoader {
	private config: Config
	private cache: Map<string, TemplateData>
	private cacheTimestamps: Map<string, number>

	constructor(config: Config) {
		this.config = config
		this.cache = new Map()
		this.cacheTimestamps = new Map()
	}

	/**
	 * Load data for a template
	 */
	async load(
		templateName: string,
		params: Record<string, string> = {}
	): Promise<TemplateData> {
		const cacheKey = this._getCacheKey(templateName, params)

		// Check cache
		const cached = this.cache.get(cacheKey)
		if (cached && this._isCacheValid(cacheKey)) {
			return cached
		}

		let data: TemplateData

		switch (this.config.dataSource.type) {
			case "api":
				data = await this._loadFromApi(templateName, params)
				break
			case "database":
				data = await this._loadFromDatabase(templateName, params)
				break
			default:
				data = await this._loadFromJson(templateName)
		}

		// Cache the result
		if (this.config.cache.enabled) {
			this.cache.set(cacheKey, data)
			this.cacheTimestamps.set(cacheKey, Date.now())
		}

		return data
	}

	/**
	 * Generate cache key from template name and params
	 */
	private _getCacheKey(
		templateName: string,
		params: Record<string, string>
	): string {
		return `${templateName}:${JSON.stringify(params)}`
	}

	/**
	 * Check if cached data is still valid
	 */
	private _isCacheValid(cacheKey: string): boolean {
		if (!this.config.cache.enabled) return false
		if (!this.cache.has(cacheKey)) return false

		const timestamp = this.cacheTimestamps.get(cacheKey)
		if (timestamp === undefined) return false
		return Date.now() - timestamp < this.config.cache.ttl
	}

	/**
	 * Clear the cache
	 */
	clearCache(): void {
		this.cache.clear()
		this.cacheTimestamps.clear()
		logger.debug("Data cache cleared")
	}

	/**
	 * Load data from a JSON file
	 */
	private async _loadFromJson(templateName: string): Promise<TemplateData> {
		// Try template-specific data file first
		const specificPath = path.join(this.config.dataDir, `${templateName}.json`)
		try {
			const content = await fs.readFile(specificPath, "utf8")
			return JSON.parse(content) as TemplateData
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
		}

		// Fall back to sample-data.json
		const fallbackPath = path.join(this.config.dataDir, "sample-data.json")
		try {
			const content = await fs.readFile(fallbackPath, "utf8")
			const allData = JSON.parse(content) as Record<string, TemplateData>
			return allData[templateName] || allData.default || {}
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "ENOENT") {
				return {}
			}
			throw err
		}
	}

	/**
	 * Load data from an API endpoint
	 */
	private async _loadFromApi(
		templateName: string,
		params: Record<string, string>
	): Promise<TemplateData> {
		const { endpoint, headers, timeout } = this.config.dataSource.api

		if (!endpoint) {
			logger.warn("API endpoint not configured, falling back to JSON")
			return this._loadFromJson(templateName)
		}

		const url = new URL(endpoint)
		url.searchParams.set("template", templateName)
		for (const [key, value] of Object.entries(params)) {
			url.searchParams.set(key, value)
		}

		try {
			const controller = new AbortController()
			const timeoutId = setTimeout(() => controller.abort(), timeout)

			const response = await fetch(url.toString(), {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
					...headers
				},
				signal: controller.signal
			})

			clearTimeout(timeoutId)

			if (!response.ok) {
				throw new DataLoadError(
					`API returned ${response.status}: ${response.statusText}`,
					endpoint
				)
			}

			return (await response.json()) as TemplateData
		} catch (err) {
			logger.warn(
				{ error: (err as Error).message },
				"API fetch failed, falling back to JSON"
			)
			return this._loadFromJson(templateName)
		}
	}

	/**
	 * Load data from a database
	 */
	private async _loadFromDatabase(
		templateName: string,
		_params: Record<string, string>
	): Promise<TemplateData> {
		const { client, connection } = this.config.dataSource.database

		if (!client || !connection) {
			logger.warn("Database not configured, falling back to JSON")
			return this._loadFromJson(templateName)
		}

		// Placeholder implementation
		// Users should extend this class or provide their own data loader
		logger.warn("Database loader not implemented, falling back to JSON")
		return this._loadFromJson(templateName)
	}

	/**
	 * Merge multiple data sources
	 */
	async loadWithOverrides(
		templateName: string,
		overrides: TemplateData = {},
		params: Record<string, string> = {}
	): Promise<TemplateData> {
		const baseData = await this.load(templateName, params)
		return this._deepMerge(baseData, overrides)
	}

	/**
	 * Deep merge two objects
	 */
	private _deepMerge(target: TemplateData, source: TemplateData): TemplateData {
		const result: TemplateData = { ...target }

		for (const key of Object.keys(source)) {
			if (
				source[key] &&
				typeof source[key] === "object" &&
				!Array.isArray(source[key])
			) {
				result[key] = this._deepMerge(
					(result[key] as TemplateData) || {},
					source[key] as TemplateData
				)
			} else {
				result[key] = source[key]
			}
		}

		return result
	}
}

export default DataLoader

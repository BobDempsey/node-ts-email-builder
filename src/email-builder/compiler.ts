/**
 * Handlebars Email Compiler
 */

import fs from "fs/promises"
import Handlebars, { type TemplateDelegate } from "handlebars"
import { convert } from "html-to-text"
import juice from "juice"
import path from "path"
import { logger } from "@/lib/logger"
import { CompilationError, TemplateNotFoundError } from "./errors"
import type {
	BlockHelperOptions,
	CompileOptions,
	CompileResult,
	Config,
	HandlebarsHelperFn,
	TemplateData
} from "./types"

class EmailCompiler {
	private config: Config
	private handlebars: typeof Handlebars
	private layouts: Map<string, TemplateDelegate>
	private partials: Map<string, string>
	private templates: Map<string, TemplateDelegate>
	private initialized: boolean

	constructor(config: Config) {
		this.config = config
		this.handlebars = Handlebars.create()
		this.layouts = new Map()
		this.partials = new Map()
		this.templates = new Map()
		this.initialized = false

		this._registerHelpers()
	}

	/**
	 * Initialize compiler by loading layouts and partials
	 */
	async init(): Promise<void> {
		if (this.initialized) return

		await Promise.all([this._loadLayouts(), this._loadPartials()])

		this.initialized = true
		logger.debug("Email compiler initialized")
	}

	/**
	 * Register built-in Handlebars helpers
	 */
	private _registerHelpers(): void {
		// Date formatting
		this.handlebars.registerHelper(
			"formatDate",
			(date: unknown, format: unknown) => {
				if (!date) return ""
				const d = new Date(date as string | number | Date)

				const formats: Record<string, string> = {
					short: d.toLocaleDateString(),
					long: d.toLocaleDateString("en-US", {
						weekday: "long",
						year: "numeric",
						month: "long",
						day: "numeric"
					}),
					iso: d.toISOString(),
					time: d.toLocaleTimeString(),
					datetime: d.toLocaleString()
				}

				return formats[format as string] || formats.short
			}
		)

		// Currency formatting
		this.handlebars.registerHelper(
			"formatCurrency",
			(amount: unknown, currency: unknown) => {
				if (amount == null) return ""
				const currencyCode = typeof currency === "string" ? currency : "USD"
				return new Intl.NumberFormat("en-US", {
					style: "currency",
					currency: currencyCode
				}).format(amount as number)
			}
		)

		// Number formatting
		this.handlebars.registerHelper(
			"formatNumber",
			(num: unknown, decimals: unknown) => {
				if (num == null) return ""
				const decimalPlaces = typeof decimals === "number" ? decimals : 0
				return new Intl.NumberFormat("en-US", {
					minimumFractionDigits: decimalPlaces,
					maximumFractionDigits: decimalPlaces
				}).format(num as number)
			}
		)

		// Equality check
		this.handlebars.registerHelper(
			"ifEquals",
			function (
				this: unknown,
				a: unknown,
				b: unknown,
				options: BlockHelperOptions
			) {
				return a === b ? options.fn(this) : options.inverse(this)
			}
		)

		// Not equals check
		this.handlebars.registerHelper(
			"ifNotEquals",
			function (
				this: unknown,
				a: unknown,
				b: unknown,
				options: BlockHelperOptions
			) {
				return a !== b ? options.fn(this) : options.inverse(this)
			}
		)

		// Greater than
		this.handlebars.registerHelper(
			"ifGt",
			function (
				this: unknown,
				a: unknown,
				b: unknown,
				options: BlockHelperOptions
			) {
				return (a as number) > (b as number)
					? options.fn(this)
					: options.inverse(this)
			}
		)

		// Less than
		this.handlebars.registerHelper(
			"ifLt",
			function (
				this: unknown,
				a: unknown,
				b: unknown,
				options: BlockHelperOptions
			) {
				return (a as number) < (b as number)
					? options.fn(this)
					: options.inverse(this)
			}
		)

		// Uppercase
		this.handlebars.registerHelper("uppercase", (str: unknown) => {
			return str ? (str as string).toUpperCase() : ""
		})

		// Lowercase
		this.handlebars.registerHelper("lowercase", (str: unknown) => {
			return str ? (str as string).toLowerCase() : ""
		})

		// Capitalize first letter
		this.handlebars.registerHelper("capitalize", (str: unknown) => {
			if (!str) return ""
			const s = str as string
			return s.charAt(0).toUpperCase() + s.slice(1)
		})

		// Truncate text
		this.handlebars.registerHelper(
			"truncate",
			(str: unknown, length: unknown, suffix: unknown) => {
				if (!str) return ""
				const s = str as string
				const actualSuffix = typeof suffix === "string" ? suffix : "..."
				if (s.length <= (length as number)) return s
				return s.substring(0, length as number) + actualSuffix
			}
		)

		// Pluralize
		this.handlebars.registerHelper(
			"pluralize",
			(count: unknown, singular: unknown, plural: unknown) => {
				return count === 1 ? singular : plural || (singular as string) + "s"
			}
		)

		// JSON stringify (useful for debugging)
		this.handlebars.registerHelper("json", (obj: unknown) => {
			return JSON.stringify(obj, null, 2)
		})

		// Each with index
		this.handlebars.registerHelper(
			"eachWithIndex",
			function (this: unknown, array: unknown[], options: BlockHelperOptions) {
				let result = ""
				if (array && array.length) {
					for (let i = 0; i < array.length; i++) {
						result += options.fn({
							...(array[i] as object),
							_index: i,
							_first: i === 0,
							_last: i === array.length - 1
						})
					}
				}
				return result
			}
		)
	}

	/**
	 * Register a custom helper
	 */
	registerHelper(name: string, fn: HandlebarsHelperFn): void {
		this.handlebars.registerHelper(name, fn)
	}

	/**
	 * Load all layouts from the layouts directory
	 */
	private async _loadLayouts(): Promise<void> {
		try {
			const files = await fs.readdir(this.config.layoutsDir)
			const hbsFiles = files.filter((f) => f.endsWith(".hbs"))

			for (const file of hbsFiles) {
				const name = path.basename(file, ".hbs")
				const content = await fs.readFile(
					path.join(this.config.layoutsDir, file),
					"utf8"
				)
				this.layouts.set(name, this.handlebars.compile(content))
			}

			logger.debug({ count: hbsFiles.length }, "Loaded layouts")
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
		}
	}

	/**
	 * Load all partials from the partials directory
	 */
	private async _loadPartials(): Promise<void> {
		try {
			const files = await fs.readdir(this.config.partialsDir)
			const hbsFiles = files.filter((f) => f.endsWith(".hbs"))

			for (const file of hbsFiles) {
				const name = path.basename(file, ".hbs")
				const content = await fs.readFile(
					path.join(this.config.partialsDir, file),
					"utf8"
				)
				this.handlebars.registerPartial(name, content)
				this.partials.set(name, content)
			}

			logger.debug({ count: hbsFiles.length }, "Loaded partials")
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
		}
	}

	/**
	 * Reload layouts and partials (for hot reload)
	 */
	async reload(): Promise<void> {
		this.layouts.clear()
		this.partials.clear()
		this.templates.clear()

		// Clear registered partials
		for (const name of Object.keys(this.handlebars.partials)) {
			this.handlebars.unregisterPartial(name)
		}

		await Promise.all([this._loadLayouts(), this._loadPartials()])

		logger.debug("Compiler reloaded")
	}

	/**
	 * Get a compiled template
	 */
	private async _getTemplate(templateName: string): Promise<TemplateDelegate> {
		if (this.templates.has(templateName)) {
			return this.templates.get(templateName)!
		}

		const templatePath = path.join(this.config.emailsDir, `${templateName}.hbs`)

		try {
			const content = await fs.readFile(templatePath, "utf8")
			const compiled = this.handlebars.compile(content)

			this.templates.set(templateName, compiled)
			return compiled
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "ENOENT") {
				throw new TemplateNotFoundError(templateName)
			}
			throw new CompilationError((err as Error).message, templateName)
		}
	}

	/**
	 * Compile an email template with data
	 */
	async compile(
		templateName: string,
		data: TemplateData = {},
		options: CompileOptions = {}
	): Promise<CompileResult> {
		await this.init()

		const template = await this._getTemplate(templateName)

		// Merge data with common variables
		const templateData = {
			...data,
			_templateName: templateName,
			_year: new Date().getFullYear(),
			_timestamp: new Date().toISOString()
		}

		// Render the email content
		let html = template(templateData)

		// Apply layout if specified
		const layoutName =
			options.layout ??
			(data._layout as string | undefined) ??
			this.config.defaultLayout
		if (layoutName && this.layouts.has(layoutName)) {
			const layout = this.layouts.get(layoutName)!
			html = layout({
				...templateData,
				body: new this.handlebars.SafeString(html)
			})
		}

		// Inline CSS
		if (options.inlineCss !== false) {
			html = juice(html, this.config.juice)
		}

		// Generate plain text version
		const text = convert(html, {
			wordwrap: 80,
			selectors: [
				{ selector: "a", options: { hideLinkHrefIfSameAsText: true } },
				{ selector: "img", format: "skip" }
			]
		})

		// Extract subject from template if present
		const subjectMatch = html.match(/<!--\s*subject:\s*(.+?)\s*-->/i)
		const subject = subjectMatch?.[1]?.trim() ?? null

		return { html, text, subject }
	}

	/**
	 * Get list of available email templates
	 */
	async listTemplates(): Promise<string[]> {
		try {
			const files = await fs.readdir(this.config.emailsDir)
			return files
				.filter((f) => f.endsWith(".hbs"))
				.map((f) => path.basename(f, ".hbs"))
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "ENOENT") return []
			throw err
		}
	}
}

export default EmailCompiler

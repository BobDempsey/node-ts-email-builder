/**
 * Email Builder specific error classes
 */

import { AppError } from "@/lib/errors"

export class TemplateNotFoundError extends AppError {
	constructor(templateName: string) {
		super(`Template "${templateName}" not found`, "TEMPLATE_NOT_FOUND")
	}
}

export class CompilationError extends AppError {
	constructor(message: string, templateName?: string) {
		const fullMessage = templateName
			? `Failed to compile template "${templateName}": ${message}`
			: `Compilation error: ${message}`
		super(fullMessage, "COMPILATION_ERROR")
	}
}

export class DataLoadError extends AppError {
	constructor(message: string, source?: string) {
		const fullMessage = source
			? `Failed to load data from "${source}": ${message}`
			: `Data load error: ${message}`
		super(fullMessage, "DATA_LOAD_ERROR")
	}
}

export class ConfigurationError extends AppError {
	constructor(message: string) {
		super(`Configuration error: ${message}`, "CONFIGURATION_ERROR")
	}
}

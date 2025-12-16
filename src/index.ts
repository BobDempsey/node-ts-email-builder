/**
 * Node.js TypeScript Library Template
 *
 * A collection of TypeScript utilities for Node.js applications.
 */

// Email Builder
export {
	CompilationError,
	type CompileOptions,
	type CompileResult,
	type Config,
	ConfigurationError,
	createConfig,
	DataLoadError,
	DataLoader,
	default as EmailBuilderDefault,
	defaults,
	EmailBuilder,
	EmailCompiler,
	FileWatcher,
	type HandlebarsHelperFn,
	PreviewServer,
	type PreviewServerOptions,
	type PreviewStartResult,
	type TemplateData,
	TemplateNotFoundError,
	type UserConfig
} from "@/email-builder"
// Constants
export { NODE_ENV_VALUES, type NodeEnv } from "@/lib/constants"
// Environment configuration
export { default as env, type EnvSchema } from "@/lib/env"
// Error handling
export { AppError, ValidationError } from "@/lib/errors"
// Logging
export {
	type ContextLogger,
	createContextLogger,
	type Logger,
	logger
} from "@/lib/logger"
export { default as tryParseEnv } from "@/lib/try-parse-env"
// Schemas
export {
	type IdParam,
	IdParamSchema,
	type Pagination,
	PaginationSchema
} from "@/schemas/common"

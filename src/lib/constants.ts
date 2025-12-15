/**
 * Application constants and enums
 */

export const NODE_ENV_VALUES = [
	"development",
	"production",
	"test",
	"staging"
] as const

export const GREETING: string = "Hello, TypeScript Node.js World!"

export type NodeEnv = (typeof NODE_ENV_VALUES)[number]

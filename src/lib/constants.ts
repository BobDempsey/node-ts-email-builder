/**
 * Application constants and enums
 */

export const NODE_ENV_VALUES = [
	"development",
	"production",
	"test",
	"staging"
] as const

export type NodeEnv = (typeof NODE_ENV_VALUES)[number]

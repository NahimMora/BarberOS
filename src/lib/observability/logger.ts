const REDACT_KEY_PATTERN = /password|token|secret|authorization|dni|cvv/i
const REDACTED_VALUE = '[REDACTED]'
const MAX_DEPTH = 6

type LogLevel = 'info' | 'warn' | 'error'

export type LogContext = Record<string, unknown>

function serializeError(error: Error): Record<string, unknown> {
  return { name: error.name, message: error.message, stack: error.stack }
}

function redact(value: unknown, depth = 0): unknown {
  if (depth >= MAX_DEPTH || value === null || typeof value !== 'object') {
    return value
  }
  if (value instanceof Error) {
    return redact(serializeError(value), depth + 1)
  }
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1))
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, val]) => [
      key,
      REDACT_KEY_PATTERN.test(key) ? REDACTED_VALUE : redact(val, depth + 1),
    ]),
  )
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ? (redact(context) as LogContext) : {}),
  }
  const line = JSON.stringify(entry)
  if (level === 'error') {
    console.error(line)
  } else if (level === 'warn') {
    console.warn(line)
  } else {
    console.log(line)
  }
}

export const logger = {
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  error: (message: string, context?: LogContext) => log('error', message, context),
}

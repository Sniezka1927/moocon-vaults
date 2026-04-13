import { appendFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'

const POINTS_CRON_LOG_PATH =
  process.env.POINTS_CRON_LOG_PATH ?? './points-cron.txt'

let logPathInitialized = false

function ensureLogPathReady(): void {
  if (logPathInitialized) return
  mkdirSync(dirname(POINTS_CRON_LOG_PATH), { recursive: true })
  logPathInitialized = true
}

function replacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    }
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString('hex')
  }
  return value
}

function serializeMeta(meta: unknown): string {
  if (meta === undefined) return ''
  if (typeof meta === 'string') return meta

  try {
    return JSON.stringify(meta, replacer)
  } catch {
    return String(meta)
  }
}

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'

function writeLine(level: LogLevel, message: string, meta?: unknown): void {
  const timestamp = new Date().toISOString()
  const prefix = `[points-cron][${timestamp}][${level}] ${message}`

  if (level === 'ERROR') {
    if (meta === undefined) console.error(prefix)
    else console.error(prefix, meta)
  } else if (level === 'WARN') {
    if (meta === undefined) console.warn(prefix)
    else console.warn(prefix, meta)
  } else if (level === 'DEBUG') {
    if (meta === undefined) console.debug(prefix)
    else console.debug(prefix, meta)
  } else {
    if (meta === undefined) console.log(prefix)
    else console.log(prefix, meta)
  }

  const metaText = serializeMeta(meta)
  const line =
    metaText.length > 0
      ? `${timestamp} [${level}] ${message} ${metaText}\n`
      : `${timestamp} [${level}] ${message}\n`

  try {
    ensureLogPathReady()
    appendFileSync(POINTS_CRON_LOG_PATH, line, 'utf8')
  } catch (err) {
    console.error(
      `[points-cron][${timestamp}][ERROR] failed to append log file ${POINTS_CRON_LOG_PATH}`,
      err
    )
  }
}

export function pointsLogInfo(message: string, meta?: unknown): void {
  writeLine('INFO', message, meta)
}

export function pointsLogWarn(message: string, meta?: unknown): void {
  writeLine('WARN', message, meta)
}

export function pointsLogError(message: string, meta?: unknown): void {
  writeLine('ERROR', message, meta)
}

export function pointsLogDebug(message: string, meta?: unknown): void {
  writeLine('DEBUG', message, meta)
}

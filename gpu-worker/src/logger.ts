// Minimal pino logger — no external dependency required
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? 'info';

function formatLevel(level: LogLevel): string {
  const labels: Record<LogLevel, string> = {
    debug: 'DEBUG',
    info: ' INFO',
    warn: ' WARN',
    error: 'ERROR',
  };
  return labels[level];
}

function formatMessage(
  level: LogLevel,
  msg: string,
  meta?: unknown
): string {
  const ts = new Date().toISOString();
  const prefix = `${ts} [${formatLevel(level)}]`;
  if (meta !== undefined) {
    const metaStr = typeof meta === 'object'
      ? JSON.stringify(meta)
      : String(meta);
    return `${prefix} ${msg} ${metaStr}`;
  }
  return `${prefix} ${msg}`;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
}

function log(level: LogLevel, msg: string, meta?: unknown): void {
  if (!shouldLog(level)) return;
  const formatted = formatMessage(level, msg, meta);
  if (level === 'error') {
    console.error(formatted);
  } else if (level === 'warn') {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
}

// Named loggers for different event domains
function makeLogger(domain: string) {
  return {
    debug(msg: string, meta?: unknown) { log('debug', `[${domain}] ${msg}`, meta); },
    info(msg: string, meta?: unknown) { log('info', `[${domain}] ${msg}`, meta); },
    warn(msg: string, meta?: unknown) { log('warn', `[${domain}] ${msg}`, meta); },
    error(msg: string, meta?: unknown) { log('error', `[${domain}] ${msg}`, meta); },
    child(_meta: Record<string, unknown>) { return this; },
  };
}

export const logger = {
  debug(msg: string, meta?: unknown) { log('debug', msg, meta); },
  info(msg: string, meta?: unknown) { log('info', msg, meta); },
  warn(msg: string, meta?: unknown) { log('warn', msg, meta); },
  error(msg: string, meta?: unknown) { log('error', msg, meta); },
  child(_meta: Record<string, unknown>) {
    return this;
  },
  clip: makeLogger('clip'),
};

/**
 * Structured logger for PropFrame.
 * Simple console-based logging with JSON output option.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? 'info';

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
}

function formatMessage(level: LogLevel, msg: string, meta?: Record<string, unknown>): string {
  const ts = new Date().toISOString();
  const base = `${ts} [${level.toUpperCase().padEnd(5)}] ${msg}`;
  if (meta && Object.keys(meta).length > 0) {
    return `${base} ${JSON.stringify(meta)}`;
  }
  return base;
}

// Domain-specific logger factory
function makeDomainLogger(domain: string) {
  return {
    debug(msg: string, meta?: Record<string, unknown>) {
      if (!shouldLog('debug')) return;
      console.log(formatMessage('debug', `[${domain}] ${msg}`, meta));
    },
    info(msg: string, meta?: Record<string, unknown>) {
      if (!shouldLog('info')) return;
      console.log(formatMessage('info', `[${domain}] ${msg}`, meta));
    },
    warn(msg: string, meta?: Record<string, unknown>) {
      if (!shouldLog('warn')) return;
      console.warn(formatMessage('warn', `[${domain}] ${msg}`, meta));
    },
    error(msg: string, meta?: Record<string, unknown>) {
      if (!shouldLog('error')) return;
      console.error(formatMessage('error', `[${domain}] ${msg}`, meta));
    },
    child(_meta: Record<string, unknown>) {
      return this;
    },
  };
}

export const logger = {
  debug(msg: string, meta?: Record<string, unknown>) {
    if (!shouldLog('debug')) return;
    console.log(formatMessage('debug', msg, meta));
  },
  info(msg: string, meta?: Record<string, unknown>) {
    if (!shouldLog('info')) return;
    console.log(formatMessage('info', msg, meta));
  },
  warn(msg: string, meta?: Record<string, unknown>) {
    if (!shouldLog('warn')) return;
    console.warn(formatMessage('warn', msg, meta));
  },
  error(msg: string, meta?: Record<string, unknown>) {
    if (!shouldLog('error')) return;
    console.error(formatMessage('error', msg, meta));
  },
  child(_meta: Record<string, unknown>) {
    // Placeholder — for production use pino child loggers
    return this;
  },
  // Domain loggers
  project: makeDomainLogger('project'),
  projects: makeDomainLogger('projects'),
  clip: makeDomainLogger('clip'),
  email: makeDomainLogger('email'),
};

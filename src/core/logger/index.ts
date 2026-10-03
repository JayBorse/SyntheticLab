export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
}

const LEVEL_PRECEDENCE: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export class StructuredLogger {
  private baseContext: LogContext;
  private minLevel: LogLevel;

  constructor(context: LogContext = {}, minLevel: LogLevel = 'info') {
    this.baseContext = context;
    this.minLevel = minLevel;
  }

  public child(context: LogContext): StructuredLogger {
    return new StructuredLogger({ ...this.baseContext, ...context }, this.minLevel);
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRECEDENCE[level] >= LEVEL_PRECEDENCE[this.minLevel];
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const ctx = { ...this.baseContext, ...context };
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    const details = Object.keys(ctx).length > 0 ? ` ${JSON.stringify(ctx)}` : '';
    return `${prefix} ${message}${details}`;
  }

  public debug(message: string, context?: LogContext): void {
    if (!this.shouldLog('debug')) return;
    console.debug(this.formatMessage('debug', message, context));
  }

  public info(message: string, context?: LogContext): void {
    if (!this.shouldLog('info')) return;
    console.info(this.formatMessage('info', message, context));
  }

  public warn(message: string, context?: LogContext): void {
    if (!this.shouldLog('warn')) return;
    console.warn(this.formatMessage('warn', message, context));
  }

  public error(message: string, error?: unknown, context?: LogContext): void {
    if (!this.shouldLog('error')) return;
    const errorDetails =
      error instanceof Error
        ? { errorMessage: error.message, stack: error.stack }
        : { rawError: error };
    console.error(this.formatMessage('error', message, { ...context, ...errorDetails }));
  }
}

export const logger = new StructuredLogger();

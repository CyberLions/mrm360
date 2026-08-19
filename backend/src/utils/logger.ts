export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  }

  private log(level: LogLevel, levelName: string, message: string, meta?: any) {
    if (level >= this.level) {
      const formattedMessage = this.formatMessage(levelName, message, meta);
      
      switch (level) {
        case LogLevel.ERROR:
          console.error(formattedMessage);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage);
          break;
        case LogLevel.INFO:
          console.info(formattedMessage);
          break;
        case LogLevel.DEBUG:
          console.debug(formattedMessage);
          break;
      }
    }
  }

  debug(message: string, meta?: any) {
    this.log(LogLevel.DEBUG, 'DEBUG', message, meta);
  }

  info(message: string, meta?: any) {
    this.log(LogLevel.INFO, 'INFO', message, meta);
  }

  warn(message: string, meta?: any) {
    this.log(LogLevel.WARN, 'WARN', message, meta);
  }

  error(message: string, meta?: any) {
    this.log(LogLevel.ERROR, 'ERROR', message, meta);
  }

  setLevel(level: LogLevel) {
    this.level = level;
  }
}

function getConfiguredLogLevel(): LogLevel {
  const configuredLevel = process.env.LOG_LEVEL?.toUpperCase();
  if (configuredLevel && configuredLevel in LogLevel) {
    const level = LogLevel[configuredLevel as keyof typeof LogLevel];
    if (typeof level === 'number') return level;
  }

  // Production logs should focus on actionable warnings and errors. Set
  // LOG_LEVEL=INFO or DEBUG explicitly when temporary diagnostics are needed.
  return process.env.NODE_ENV === 'production' ? LogLevel.WARN : LogLevel.DEBUG;
}

export const logger = new Logger(getConfiguredLogLevel());

export default logger;

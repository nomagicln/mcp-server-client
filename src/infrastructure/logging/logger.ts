import pino from 'pino';
import { CorrelationManager } from '@infrastructure/logging/correlation';

export enum LogLevel {
  TRACE = 'trace',
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  component: string;
  traceId: string;
  metadata: Record<string, any>;
}

export interface LoggerConfig {
  level: LogLevel;
  component: string;
  output?: (entry: LogEntry) => void;
  maskSensitiveData?: boolean;
  sensitiveFields?: string[];
}

export class Logger {
  private pinoLogger: pino.Logger | null = null;
  private config: LoggerConfig;
  private context: Record<string, any> = {};
  private readonly defaultSensitiveFields = [
    'password',
    'passwd',
    'secret',
    'token',
    'key',
    'apikey',
    'api_key',
    'authorization',
    'auth',
    'credential',
    'credentials',
    'private',
  ];

  constructor(config: LoggerConfig) {
    this.config = {
      maskSensitiveData: true,
      sensitiveFields: this.defaultSensitiveFields,
      ...config,
    };

    if (!config.output) {
      // Use standard pino logger when no custom output is provided
      this.pinoLogger = pino({
        level: config.level,
        timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
        formatters: {
          level: label => ({ level: label }),
        },
        serializers: {
          error: pino.stdSerializers.err,
        },
      });
    }
  }

  trace(message: string, metadata: Record<string, any> = {}): void {
    this.log(LogLevel.TRACE, message, metadata);
  }

  debug(message: string, metadata: Record<string, any> = {}): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  info(message: string, metadata: Record<string, any> = {}): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  warn(message: string, metadata: Record<string, any> = {}): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  error(message: string, metadata: Record<string, any> = {}): void {
    this.log(LogLevel.ERROR, message, metadata);
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
    if (this.pinoLogger) {
      this.pinoLogger.level = level;
    }
  }

  addContext(context: Record<string, any>): void {
    this.context = { ...this.context, ...context };
  }

  clearContext(): void {
    this.context = {};
  }

  private log(level: LogLevel, message: string, metadata: Record<string, any>): void {
    // Check if we should log based on level
    if (!this.shouldLog(level)) {
      return;
    }

    const enrichedMetadata = {
      ...this.context,
      ...metadata,
    };

    const processedMetadata = this.processMetadata(enrichedMetadata);

    if (this.config.output) {
      // Use custom output function
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        component: this.config.component,
        traceId: CorrelationManager.getCorrelationId() || '',
        metadata: processedMetadata,
      };
      this.config.output(entry);
    } else if (this.pinoLogger) {
      // Use pino logger - include component and traceId in the log data
      const logData = {
        ...processedMetadata,
        component: this.config.component,
        traceId: CorrelationManager.getCorrelationId(),
      };

      switch (level) {
        case LogLevel.TRACE:
          this.pinoLogger.trace(logData, message);
          break;
        case LogLevel.DEBUG:
          this.pinoLogger.debug(logData, message);
          break;
        case LogLevel.INFO:
          this.pinoLogger.info(logData, message);
          break;
        case LogLevel.WARN:
          this.pinoLogger.warn(logData, message);
          break;
        case LogLevel.ERROR:
          this.pinoLogger.error(logData, message);
          break;
      }
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.TRACE, LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const logLevelIndex = levels.indexOf(level);
    return logLevelIndex >= currentLevelIndex;
  }

  private processMetadata(metadata: Record<string, any>): Record<string, any> {
    if (!this.config.maskSensitiveData) {
      return metadata;
    }

    return this.maskSensitiveData(metadata);
  }

  private maskSensitiveData(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.maskSensitiveData(item));
    }

    if (obj instanceof Error) {
      return {
        name: obj.name,
        message: obj.message,
        stack: obj.stack,
      };
    }

    const masked: Record<string, any> = {};
    const sensitiveFields = this.config.sensitiveFields || this.defaultSensitiveFields;

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()));

      if (isSensitive && typeof value === 'string') {
        masked[key] = '[MASKED]';
      } else if (typeof value === 'object' && value !== null) {
        masked[key] = this.maskSensitiveData(value);
      } else {
        masked[key] = value;
      }
    }

    return masked;
  }
}

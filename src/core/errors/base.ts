import { randomUUID } from 'crypto';
import { getErrorInfo, isRecoverableError } from '@core/errors/codes';

/**
 * Error category enumeration
 */
export enum ErrorCategory {
  CONFIGURATION = 'configuration',
  CONNECTION = 'connection',
  RESOURCE = 'resource',
  PROTOCOL = 'protocol',
  EXECUTION = 'execution',
  SYSTEM = 'system',
}

/**
 * Error severity enumeration
 */
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Base error class for mcpsc with enhanced error handling capabilities
 */
export class MCPSCError extends Error {
  public readonly code: number;
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly timestamp: Date;
  public readonly correlationId: string;
  public readonly context?: any;
  public readonly suggestions: string[] | undefined;
  public override readonly cause: Error | undefined;

  constructor(
    code: number,
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    context?: any,
    suggestions?: string[],
    cause?: Error
  ) {
    super(message);

    this.name = 'MCPSCError';
    this.code = code;
    this.category = category;
    this.severity = severity;
    this.timestamp = new Date();
    this.correlationId = randomUUID();
    this.context = context;
    this.suggestions = suggestions;
    this.cause = cause;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MCPSCError);
    }
  }

  /**
   * Check if this is a configuration error
   */
  isConfigurationError(): boolean {
    return this.category === ErrorCategory.CONFIGURATION;
  }

  /**
   * Check if this is a connection error
   */
  isConnectionError(): boolean {
    return this.category === ErrorCategory.CONNECTION;
  }

  /**
   * Check if this is a resource error
   */
  isResourceError(): boolean {
    return this.category === ErrorCategory.RESOURCE;
  }

  /**
   * Check if this is a protocol error
   */
  isProtocolError(): boolean {
    return this.category === ErrorCategory.PROTOCOL;
  }

  /**
   * Check if this is an execution error
   */
  isExecutionError(): boolean {
    return this.category === ErrorCategory.EXECUTION;
  }

  /**
   * Check if this is a system error
   */
  isSystemError(): boolean {
    return this.category === ErrorCategory.SYSTEM;
  }

  /**
   * Check if this is an info level error
   */
  isInfo(): boolean {
    return this.severity === ErrorSeverity.INFO;
  }

  /**
   * Check if this is a warning level error
   */
  isWarning(): boolean {
    return this.severity === ErrorSeverity.WARNING;
  }

  /**
   * Check if this is an error level error
   */
  isError(): boolean {
    return this.severity === ErrorSeverity.ERROR;
  }

  /**
   * Check if this is a critical level error
   */
  isCritical(): boolean {
    return this.severity === ErrorSeverity.CRITICAL;
  }

  /**
   * Check if this error is recoverable
   */
  isRecoverable(): boolean {
    return isRecoverableError(this.code);
  }

  /**
   * Get recovery suggestions for this error
   */
  getRecoverySuggestions(): string[] {
    const suggestions = this.suggestions || [];
    const errorInfo = getErrorInfo(this.code);

    if (errorInfo?.suggestions) {
      suggestions.push(...errorInfo.suggestions);
    }

    return [...new Set(suggestions)]; // Remove duplicates
  }

  /**
   * Serialize error to JSON
   */
  toJSON(): ErrorJSON {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      category: this.category,
      severity: this.severity,
      timestamp: this.timestamp.toISOString(),
      correlationId: this.correlationId,
      context: this.context,
      suggestions: this.suggestions,
      stack: this.stack,
      recoverable: this.isRecoverable(),
    };
  }

  /**
   * Create MCPSCError from JSON
   */
  static fromJSON(json: ErrorJSON): MCPSCError {
    const error = new MCPSCError(
      json.code,
      json.message,
      json.category as ErrorCategory,
      json.severity as ErrorSeverity,
      json.context,
      json.suggestions
    );

    // Override generated values with serialized ones
    (error as any).correlationId = json.correlationId;
    (error as any).timestamp = new Date(json.timestamp);

    if (json.stack) {
      error.stack = json.stack;
    }

    return error;
  }

  /**
   * Create a formatted error message for display
   */
  getDisplayMessage(): string {
    let message = `[${this.code}] ${this.message}`;

    if (this.context) {
      const contextStr =
        typeof this.context === 'string' ? this.context : JSON.stringify(this.context);
      message += ` (Context: ${contextStr})`;
    }

    return message;
  }

  /**
   * Create a detailed error report
   */
  getDetailedReport(): string {
    const lines = [
      `Error Code: ${this.code}`,
      `Category: ${this.category}`,
      `Severity: ${this.severity}`,
      `Message: ${this.message}`,
      `Timestamp: ${this.timestamp.toISOString()}`,
      `Correlation ID: ${this.correlationId}`,
      `Recoverable: ${this.isRecoverable()}`,
    ];

    if (this.context) {
      lines.push(`Context: ${JSON.stringify(this.context, null, 2)}`);
    }

    if (this.suggestions && this.suggestions.length > 0) {
      lines.push('Suggestions:');
      this.suggestions.forEach(suggestion => {
        lines.push(`  - ${suggestion}`);
      });
    }

    if (this.stack) {
      lines.push('Stack Trace:');
      lines.push(this.stack);
    }

    return lines.join('\n');
  }
}

/**
 * JSON representation of an error
 */
export interface ErrorJSON {
  name: string;
  code: number;
  message: string;
  category: string;
  severity: string;
  timestamp: string;
  correlationId: string;
  context?: any;
  suggestions: string[] | undefined;
  stack: string | undefined;
  recoverable: boolean;
}

/**
 * Error handler interface
 */
export interface IErrorHandler {
  handle(error: Error): ErrorResponse;
  canHandle(error: Error): boolean;
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: number;
    message: string;
    category: string;
    severity: string;
    correlationId: string;
    context?: any;
    suggestions?: string[];
    recoverable: boolean;
  };
}

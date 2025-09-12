/**
 * Error handling system exports
 */

import { MCPSCError, ErrorCategory, ErrorSeverity } from '@core/errors/base';

export {
  MCPSCError,
  ErrorCategory,
  ErrorSeverity,
  type ErrorJSON,
  type IErrorHandler,
  type ErrorResponse,
} from '@core/errors/base';
export {
  ErrorCodes,
  type ErrorInfo,
  getErrorInfo,
  isRecoverableError,
  getErrorCategory,
  getErrorSeverity,
  getErrorCodesByCategory,
  getErrorCodesBySeverity,
} from '@core/errors/codes';

// Convenience error creation functions
export function createConfigurationError(
  code: number,
  message: string,
  context?: any,
  suggestions?: string[]
): MCPSCError {
  return new MCPSCError(
    code,
    message,
    ErrorCategory.CONFIGURATION,
    ErrorSeverity.ERROR,
    context,
    suggestions
  );
}

export function createConnectionError(
  code: number,
  message: string,
  context?: any,
  suggestions?: string[]
): MCPSCError {
  return new MCPSCError(
    code,
    message,
    ErrorCategory.CONNECTION,
    ErrorSeverity.ERROR,
    context,
    suggestions
  );
}

export function createResourceError(
  code: number,
  message: string,
  context?: any,
  suggestions?: string[]
): MCPSCError {
  return new MCPSCError(
    code,
    message,
    ErrorCategory.RESOURCE,
    ErrorSeverity.ERROR,
    context,
    suggestions
  );
}

export function createProtocolError(
  code: number,
  message: string,
  context?: any,
  suggestions?: string[]
): MCPSCError {
  return new MCPSCError(
    code,
    message,
    ErrorCategory.PROTOCOL,
    ErrorSeverity.ERROR,
    context,
    suggestions
  );
}

export function createExecutionError(
  code: number,
  message: string,
  context?: any,
  suggestions?: string[]
): MCPSCError {
  return new MCPSCError(
    code,
    message,
    ErrorCategory.EXECUTION,
    ErrorSeverity.ERROR,
    context,
    suggestions
  );
}

export function createSystemError(
  code: number,
  message: string,
  context?: any,
  suggestions?: string[]
): MCPSCError {
  return new MCPSCError(
    code,
    message,
    ErrorCategory.SYSTEM,
    ErrorSeverity.CRITICAL,
    context,
    suggestions
  );
}

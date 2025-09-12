/**
 * Error codes for mcpsc following categorized ranges
 */
export const ErrorCodes = {
  // Configuration Errors (1000-1099)
  CONFIG_INVALID_FORMAT: 1001,
  CONFIG_MISSING_REQUIRED: 1002,
  CONFIG_VALIDATION_FAILED: 1003,
  CONFIG_FILE_NOT_FOUND: 1004,
  CONFIG_PARSE_ERROR: 1005,
  CONFIG_SCHEMA_MISMATCH: 1006,
  CONFIG_ENVIRONMENT_ERROR: 1007,
  CONFIG_PERMISSION_DENIED: 1008,
  CONFIG_VALIDATION_ERROR: 1009,
  CONFIG_VALIDATION_TIMEOUT: 1010,
  CONFIG_CIRCULAR_REFERENCE: 1011,
  CONFIG_UNSUPPORTED_FORMAT: 1012,
  CONFIG_LOAD_ERROR: 1013,
  CONFIG_ENV_VAR_NOT_FOUND: 1014,

  // Connection Errors (2000-2099)
  CONNECTION_FAILED: 2001,
  CONNECTION_TIMEOUT: 2002,
  CONNECTION_AUTH_FAILED: 2003,
  CONNECTION_REFUSED: 2004,
  CONNECTION_LOST: 2005,
  CONNECTION_PROTOCOL_ERROR: 2006,
  CONNECTION_TLS_ERROR: 2007,
  CONNECTION_POOL_EXHAUSTED: 2008,
  CONNECTION_SLOW: 2009,

  // Resource Errors (3000-3099)
  RESOURCE_NOT_FOUND: 3001,
  RESOURCE_INVALID_DEFINITION: 3002,
  RESOURCE_LOAD_FAILED: 3003,
  RESOURCE_VALIDATION_FAILED: 3004,
  RESOURCE_ACCESS_DENIED: 3005,
  RESOURCE_DISABLED: 3006,
  RESOURCE_DEPENDENCY_MISSING: 3007,
  RESOURCE_QUOTA_EXCEEDED: 3008,

  // Protocol Errors (4000-4099)
  PROTOCOL_INVALID_MESSAGE: 4001,
  PROTOCOL_UNSUPPORTED_METHOD: 4002,
  PROTOCOL_VERSION_MISMATCH: 4003,
  PROTOCOL_SERIALIZATION_ERROR: 4004,
  PROTOCOL_NEGOTIATION_FAILED: 4005,
  PROTOCOL_TRANSPORT_ERROR: 4006,
  PROTOCOL_CAPABILITY_MISSING: 4007,

  // System Errors (5000-5099)
  SYSTEM_INTERNAL_ERROR: 5001,
  SYSTEM_OUT_OF_MEMORY: 5002,
  SYSTEM_DISK_FULL: 5003,
  SYSTEM_PERMISSION_DENIED: 5004,
  SYSTEM_RESOURCE_EXHAUSTED: 5005,
  SYSTEM_SHUTDOWN: 5006,
  SYSTEM_DEPENDENCY_UNAVAILABLE: 5007,

  // Execution Errors (6000-6099)
  EXECUTION_FAILED: 6001,
  EXECUTION_TIMEOUT: 6002,
  EXECUTION_PERMISSION_DENIED: 6003,
  EXECUTION_COMMAND_NOT_FOUND: 6004,
  EXECUTION_INVALID_PARAMETERS: 6005,
  EXECUTION_RESOURCE_LIMIT_EXCEEDED: 6006,
  EXECUTION_SECURITY_VIOLATION: 6007,
  EXECUTION_INTERRUPTED: 6008,
} as const;

/**
 * Error information structure
 */
export interface ErrorInfo {
  category: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  recoverable: boolean;
  description: string;
  suggestions?: string[];
}

/**
 * Error information mapping
 */
const ERROR_INFO_MAP: Record<number, ErrorInfo> = {
  // Configuration Errors
  [ErrorCodes.CONFIG_INVALID_FORMAT]: {
    category: 'configuration',
    severity: 'error',
    recoverable: false,
    description: 'Configuration file has invalid format',
    suggestions: [
      'Check JSON/YAML syntax',
      'Validate configuration schema',
      'Use configuration validation command',
    ],
  },
  [ErrorCodes.CONFIG_MISSING_REQUIRED]: {
    category: 'configuration',
    severity: 'error',
    recoverable: false,
    description: 'Required configuration parameter is missing',
    suggestions: [
      'Check configuration documentation',
      'Add missing required parameters',
      'Use init command to generate default configuration',
    ],
  },
  [ErrorCodes.CONFIG_VALIDATION_FAILED]: {
    category: 'configuration',
    severity: 'error',
    recoverable: false,
    description: 'Configuration validation failed',
    suggestions: [
      'Run validation command for detailed errors',
      'Check parameter types and values',
      'Refer to configuration schema',
    ],
  },
  [ErrorCodes.CONFIG_FILE_NOT_FOUND]: {
    category: 'configuration',
    severity: 'error',
    recoverable: false,
    description: 'Configuration file not found',
    suggestions: [
      'Create configuration file',
      'Use init command to generate configuration',
      'Check file path and permissions',
    ],
  },
  [ErrorCodes.CONFIG_PARSE_ERROR]: {
    category: 'configuration',
    severity: 'error',
    recoverable: false,
    description: 'Failed to parse configuration file',
    suggestions: [
      'Check file syntax (JSON/YAML/JS/TS)',
      'Validate file format',
      'Remove invalid characters or syntax',
    ],
  },
  [ErrorCodes.CONFIG_VALIDATION_ERROR]: {
    category: 'configuration',
    severity: 'error',
    recoverable: false,
    description: 'Configuration validation error',
    suggestions: ['Check configuration schema', 'Verify required fields', 'Fix validation errors'],
  },
  [ErrorCodes.CONFIG_VALIDATION_TIMEOUT]: {
    category: 'configuration',
    severity: 'error',
    recoverable: true,
    description: 'Configuration validation timed out',
    suggestions: [
      'Reduce configuration complexity',
      'Increase validation timeout',
      'Split large configurations',
    ],
  },
  [ErrorCodes.CONFIG_CIRCULAR_REFERENCE]: {
    category: 'configuration',
    severity: 'error',
    recoverable: false,
    description: 'Configuration contains circular references',
    suggestions: [
      'Remove circular references',
      'Restructure configuration',
      'Use references instead of duplication',
    ],
  },
  [ErrorCodes.CONFIG_UNSUPPORTED_FORMAT]: {
    category: 'configuration',
    severity: 'error',
    recoverable: false,
    description: 'Unsupported configuration file format',
    suggestions: [
      'Use supported formats: JSON, YAML, JS, TS',
      'Convert to supported format',
      'Check file extension',
    ],
  },
  [ErrorCodes.CONFIG_LOAD_ERROR]: {
    category: 'configuration',
    severity: 'error',
    recoverable: true,
    description: 'Failed to load configuration',
    suggestions: ['Check file permissions', 'Verify file exists', 'Check file system access'],
  },
  [ErrorCodes.CONFIG_ENV_VAR_NOT_FOUND]: {
    category: 'configuration',
    severity: 'error',
    recoverable: false,
    description: 'Required environment variable not found',
    suggestions: [
      'Set missing environment variable',
      'Check environment variable name',
      'Use default values instead',
    ],
  },

  // Connection Errors
  [ErrorCodes.CONNECTION_FAILED]: {
    category: 'connection',
    severity: 'error',
    recoverable: true,
    description: 'Failed to establish connection',
    suggestions: [
      'Check network connectivity',
      'Verify host and port configuration',
      'Check firewall settings',
      'Retry connection',
    ],
  },
  [ErrorCodes.CONNECTION_TIMEOUT]: {
    category: 'connection',
    severity: 'warning',
    recoverable: true,
    description: 'Connection attempt timed out',
    suggestions: [
      'Increase timeout value',
      'Check network latency',
      'Verify target service is running',
      'Retry with exponential backoff',
    ],
  },
  [ErrorCodes.CONNECTION_AUTH_FAILED]: {
    category: 'connection',
    severity: 'error',
    recoverable: true,
    description: 'Authentication failed',
    suggestions: [
      'Check credentials',
      'Verify authentication method',
      'Check key file permissions',
      'Regenerate authentication tokens',
    ],
  },
  [ErrorCodes.CONNECTION_SLOW]: {
    category: 'connection',
    severity: 'warning',
    recoverable: true,
    description: 'Connection is slower than expected',
    suggestions: [
      'Check network conditions',
      'Consider connection pooling',
      'Optimize connection parameters',
    ],
  },

  // Resource Errors
  [ErrorCodes.RESOURCE_NOT_FOUND]: {
    category: 'resource',
    severity: 'error',
    recoverable: false,
    description: 'Resource not found',
    suggestions: [
      'Check resource ID or name',
      'Verify resource exists in registry',
      'Refresh resource registry',
      'Check resource path configuration',
    ],
  },
  [ErrorCodes.RESOURCE_INVALID_DEFINITION]: {
    category: 'resource',
    severity: 'error',
    recoverable: false,
    description: 'Resource definition is invalid',
    suggestions: [
      'Validate resource schema',
      'Check required fields',
      'Fix resource definition format',
      'Use resource validation tools',
    ],
  },
  [ErrorCodes.RESOURCE_DISABLED]: {
    category: 'resource',
    severity: 'info',
    recoverable: true,
    description: 'Resource is disabled',
    suggestions: [
      'Enable resource if needed',
      'Check resource configuration',
      'Verify resource dependencies',
    ],
  },

  // Protocol Errors
  [ErrorCodes.PROTOCOL_INVALID_MESSAGE]: {
    category: 'protocol',
    severity: 'error',
    recoverable: false,
    description: 'Invalid MCP protocol message',
    suggestions: [
      'Check message format',
      'Verify JSON-RPC 2.0 compliance',
      'Check message schema',
      'Update client/server versions',
    ],
  },
  [ErrorCodes.PROTOCOL_UNSUPPORTED_METHOD]: {
    category: 'protocol',
    severity: 'error',
    recoverable: false,
    description: 'Unsupported MCP method',
    suggestions: [
      'Check supported methods',
      'Update server capabilities',
      'Use alternative methods',
      'Check protocol version compatibility',
    ],
  },

  // Execution Errors
  [ErrorCodes.EXECUTION_TIMEOUT]: {
    category: 'execution',
    severity: 'error',
    recoverable: true,
    description: 'Command execution timed out',
    suggestions: [
      'Increase execution timeout',
      'Optimize command performance',
      'Check system resources',
      'Retry with different parameters',
    ],
  },
  [ErrorCodes.EXECUTION_PERMISSION_DENIED]: {
    category: 'execution',
    severity: 'error',
    recoverable: false,
    description: 'Permission denied for command execution',
    suggestions: [
      'Check user permissions',
      'Verify security policies',
      'Request elevated privileges',
      'Check command whitelist',
    ],
  },

  // System Errors
  [ErrorCodes.SYSTEM_INTERNAL_ERROR]: {
    category: 'system',
    severity: 'critical',
    recoverable: false,
    description: 'Internal system error occurred',
    suggestions: [
      'Check system logs',
      'Restart application',
      'Report bug with details',
      'Check system resources',
    ],
  },
  [ErrorCodes.SYSTEM_OUT_OF_MEMORY]: {
    category: 'system',
    severity: 'critical',
    recoverable: false,
    description: 'System is out of memory',
    suggestions: [
      'Increase available memory',
      'Reduce memory usage',
      'Restart application',
      'Check for memory leaks',
    ],
  },
  [ErrorCodes.SYSTEM_SHUTDOWN]: {
    category: 'system',
    severity: 'critical',
    recoverable: false,
    description: 'System is shutting down',
    suggestions: [
      'Wait for shutdown to complete',
      'Save work before shutdown',
      'Check shutdown reason',
    ],
  },
};

/**
 * Get error information for a given error code
 */
export function getErrorInfo(code: number): ErrorInfo | undefined {
  return ERROR_INFO_MAP[code];
}

/**
 * Check if an error code represents a recoverable error
 */
export function isRecoverableError(code: number): boolean {
  const info = getErrorInfo(code);
  return info?.recoverable ?? false;
}

/**
 * Get error category for a given error code
 */
export function getErrorCategory(code: number): string | undefined {
  const info = getErrorInfo(code);
  return info?.category;
}

/**
 * Get error severity for a given error code
 */
export function getErrorSeverity(code: number): string | undefined {
  const info = getErrorInfo(code);
  return info?.severity;
}

/**
 * Get all error codes in a specific category
 */
export function getErrorCodesByCategory(category: string): number[] {
  return Object.entries(ERROR_INFO_MAP)
    .filter(([, info]) => info.category === category)
    .map(([code]) => parseInt(code, 10));
}

/**
 * Get all error codes with a specific severity
 */
export function getErrorCodesBySeverity(severity: string): number[] {
  return Object.entries(ERROR_INFO_MAP)
    .filter(([, info]) => info.severity === severity)
    .map(([code]) => parseInt(code, 10));
}

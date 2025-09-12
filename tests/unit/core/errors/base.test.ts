import { MCPSCError, ErrorCategory, ErrorSeverity } from '@core/errors/base';
import { ErrorCodes } from '@core/errors/codes';

describe('MCPSCError Class', () => {
  describe('Error Construction', () => {
    it('should create error with basic properties', () => {
      const error = new MCPSCError(
        ErrorCodes.CONFIG_INVALID_FORMAT,
        'Invalid configuration format',
        ErrorCategory.CONFIGURATION,
        ErrorSeverity.ERROR
      );

      expect(error.code).toBe(ErrorCodes.CONFIG_INVALID_FORMAT);
      expect(error.message).toBe('Invalid configuration format');
      expect(error.category).toBe(ErrorCategory.CONFIGURATION);
      expect(error.severity).toBe(ErrorSeverity.ERROR);
      expect(error.name).toBe('MCPSCError');
      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.correlationId).toBeDefined();
    });

    it('should create error with context and suggestions', () => {
      const context = { file: 'config.json', line: 10 };
      const suggestions = ['Check JSON syntax', 'Validate schema'];

      const error = new MCPSCError(
        ErrorCodes.CONFIG_INVALID_FORMAT,
        'Invalid JSON syntax',
        ErrorCategory.CONFIGURATION,
        ErrorSeverity.ERROR,
        context,
        suggestions
      );

      expect(error.context).toEqual(context);
      expect(error.suggestions).toEqual(suggestions);
    });

    it('should create error with cause', () => {
      const cause = new Error('Original error');
      const error = new MCPSCError(
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
        'Internal system error',
        ErrorCategory.SYSTEM,
        ErrorSeverity.CRITICAL,
        undefined,
        undefined,
        cause
      );

      expect(error.cause).toBe(cause);
    });
  });

  describe('Error Categories', () => {
    it('should handle configuration errors', () => {
      const error = new MCPSCError(
        ErrorCodes.CONFIG_MISSING_REQUIRED,
        'Missing required parameter',
        ErrorCategory.CONFIGURATION,
        ErrorSeverity.ERROR
      );

      expect(error.category).toBe(ErrorCategory.CONFIGURATION);
      expect(error.isConfigurationError()).toBe(true);
      expect(error.isConnectionError()).toBe(false);
    });

    it('should handle connection errors', () => {
      const error = new MCPSCError(
        ErrorCodes.CONNECTION_FAILED,
        'Connection failed',
        ErrorCategory.CONNECTION,
        ErrorSeverity.ERROR
      );

      expect(error.category).toBe(ErrorCategory.CONNECTION);
      expect(error.isConnectionError()).toBe(true);
      expect(error.isResourceError()).toBe(false);
    });

    it('should handle resource errors', () => {
      const error = new MCPSCError(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'Resource not found',
        ErrorCategory.RESOURCE,
        ErrorSeverity.WARNING
      );

      expect(error.category).toBe(ErrorCategory.RESOURCE);
      expect(error.isResourceError()).toBe(true);
      expect(error.isProtocolError()).toBe(false);
    });

    it('should handle protocol errors', () => {
      const error = new MCPSCError(
        ErrorCodes.PROTOCOL_INVALID_MESSAGE,
        'Invalid MCP message',
        ErrorCategory.PROTOCOL,
        ErrorSeverity.ERROR
      );

      expect(error.category).toBe(ErrorCategory.PROTOCOL);
      expect(error.isProtocolError()).toBe(true);
      expect(error.isExecutionError()).toBe(false);
    });

    it('should handle execution errors', () => {
      const error = new MCPSCError(
        ErrorCodes.EXECUTION_TIMEOUT,
        'Command execution timeout',
        ErrorCategory.EXECUTION,
        ErrorSeverity.ERROR
      );

      expect(error.category).toBe(ErrorCategory.EXECUTION);
      expect(error.isExecutionError()).toBe(true);
      expect(error.isSystemError()).toBe(false);
    });

    it('should handle system errors', () => {
      const error = new MCPSCError(
        ErrorCodes.SYSTEM_OUT_OF_MEMORY,
        'Out of memory',
        ErrorCategory.SYSTEM,
        ErrorSeverity.CRITICAL
      );

      expect(error.category).toBe(ErrorCategory.SYSTEM);
      expect(error.isSystemError()).toBe(true);
      expect(error.isConfigurationError()).toBe(false);
    });
  });

  describe('Error Severity', () => {
    it('should handle different severity levels', () => {
      const infoError = new MCPSCError(
        ErrorCodes.RESOURCE_DISABLED,
        'Resource disabled',
        ErrorCategory.RESOURCE,
        ErrorSeverity.INFO
      );

      const warningError = new MCPSCError(
        ErrorCodes.CONNECTION_SLOW,
        'Slow connection',
        ErrorCategory.CONNECTION,
        ErrorSeverity.WARNING
      );

      const criticalError = new MCPSCError(
        ErrorCodes.SYSTEM_SHUTDOWN,
        'System shutdown',
        ErrorCategory.SYSTEM,
        ErrorSeverity.CRITICAL
      );

      expect(infoError.severity).toBe(ErrorSeverity.INFO);
      expect(infoError.isInfo()).toBe(true);
      expect(infoError.isCritical()).toBe(false);

      expect(warningError.severity).toBe(ErrorSeverity.WARNING);
      expect(warningError.isWarning()).toBe(true);
      expect(warningError.isError()).toBe(false);

      expect(criticalError.severity).toBe(ErrorSeverity.CRITICAL);
      expect(criticalError.isCritical()).toBe(true);
      expect(criticalError.isInfo()).toBe(false);
    });
  });

  describe('Error Serialization', () => {
    it('should serialize to JSON', () => {
      const error = new MCPSCError(
        ErrorCodes.CONFIG_INVALID_FORMAT,
        'Invalid format',
        ErrorCategory.CONFIGURATION,
        ErrorSeverity.ERROR,
        { file: 'test.json' },
        ['Check syntax']
      );

      const json = error.toJSON();

      expect(json.code).toBe(ErrorCodes.CONFIG_INVALID_FORMAT);
      expect(json.message).toBe('Invalid format');
      expect(json.category).toBe(ErrorCategory.CONFIGURATION);
      expect(json.severity).toBe(ErrorSeverity.ERROR);
      expect(json.context).toEqual({ file: 'test.json' });
      expect(json.suggestions).toEqual(['Check syntax']);
      expect(json.timestamp).toBeDefined();
      expect(json.correlationId).toBeDefined();
    });

    it('should create from JSON', () => {
      const json = {
        name: 'MCPSCError',
        code: ErrorCodes.CONNECTION_FAILED,
        message: 'Connection failed',
        category: ErrorCategory.CONNECTION,
        severity: ErrorSeverity.ERROR,
        context: { host: 'example.com' },
        suggestions: ['Check network'],
        timestamp: new Date().toISOString(),
        correlationId: 'test-id',
        recoverable: true,
        stack: undefined,
      };

      const error = MCPSCError.fromJSON(json);

      expect(error.code).toBe(json.code);
      expect(error.message).toBe(json.message);
      expect(error.category).toBe(json.category);
      expect(error.severity).toBe(json.severity);
      expect(error.context).toEqual(json.context);
      expect(error.suggestions).toEqual(json.suggestions);
      expect(error.correlationId).toBe(json.correlationId);
    });
  });

  describe('Error Recovery', () => {
    it('should indicate if error is recoverable', () => {
      const recoverableError = new MCPSCError(
        ErrorCodes.CONNECTION_TIMEOUT,
        'Connection timeout',
        ErrorCategory.CONNECTION,
        ErrorSeverity.WARNING
      );

      const nonRecoverableError = new MCPSCError(
        ErrorCodes.CONFIG_INVALID_FORMAT,
        'Invalid config',
        ErrorCategory.CONFIGURATION,
        ErrorSeverity.ERROR
      );

      expect(recoverableError.isRecoverable()).toBe(true);
      expect(nonRecoverableError.isRecoverable()).toBe(false);
    });

    it('should provide recovery suggestions', () => {
      const error = new MCPSCError(
        ErrorCodes.CONNECTION_FAILED,
        'Connection failed',
        ErrorCategory.CONNECTION,
        ErrorSeverity.ERROR,
        { host: 'example.com' },
        ['Check network connectivity', 'Verify host is reachable']
      );

      const suggestions = error.getRecoverySuggestions();
      expect(suggestions).toContain('Check network connectivity');
      expect(suggestions).toContain('Verify host is reachable');
    });
  });
});

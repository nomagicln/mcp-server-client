import { Logger, LogLevel, LogEntry } from '@infrastructure/logging/logger';
import { CorrelationManager } from '@infrastructure/logging/correlation';

describe('Logger', () => {
  let logger: Logger;
  let mockOutput: jest.Mock;

  beforeEach(() => {
    mockOutput = jest.fn();
    logger = new Logger({
      level: LogLevel.INFO,
      output: mockOutput,
      component: 'test-component',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('structured logging behavior', () => {
    it('should create structured log entries with required fields', () => {
      const message = 'Test message';
      const metadata = { field: 'value' };

      logger.info(message, metadata);

      expect(mockOutput).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(String),
          level: 'info',
          message,
          component: 'test-component',
          metadata,
          traceId: expect.any(String),
        })
      );
    });

    it('should format timestamps in ISO format', () => {
      logger.info('test message');

      const logEntry = mockOutput.mock.calls[0][0] as LogEntry;
      expect(logEntry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should include correlation ID in log entries', () => {
      const correlationId = 'test-correlation-id';
      CorrelationManager.setCorrelationId(correlationId);

      logger.info('test message');

      const logEntry = mockOutput.mock.calls[0][0] as LogEntry;
      expect(logEntry.traceId).toBe(correlationId);
    });

    it('should handle nested metadata objects', () => {
      const complexMetadata = {
        user: { id: 123, name: 'test' },
        request: { method: 'GET', path: '/api' },
        nested: { deep: { value: 'test' } },
      };

      logger.info('test message', complexMetadata);

      const logEntry = mockOutput.mock.calls[0][0] as LogEntry;
      expect(logEntry.metadata).toEqual(complexMetadata);
    });
  });

  describe('log level management', () => {
    it('should respect configured log level', () => {
      const debugLogger = new Logger({
        level: LogLevel.WARN,
        output: mockOutput,
        component: 'test',
      });

      debugLogger.debug('debug message');
      debugLogger.info('info message');
      debugLogger.warn('warn message');
      debugLogger.error('error message');

      expect(mockOutput).toHaveBeenCalledTimes(2);
      expect(mockOutput).toHaveBeenNthCalledWith(1, expect.objectContaining({ level: 'warn' }));
      expect(mockOutput).toHaveBeenNthCalledWith(2, expect.objectContaining({ level: 'error' }));
    });

    it('should support dynamic log level changes', () => {
      logger.setLevel(LogLevel.ERROR);

      logger.info('info message');
      logger.error('error message');

      expect(mockOutput).toHaveBeenCalledTimes(1);
      expect(mockOutput).toHaveBeenCalledWith(expect.objectContaining({ level: 'error' }));
    });

    it('should validate log level hierarchy', () => {
      const levels = [LogLevel.TRACE, LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];

      levels.forEach((level, index) => {
        const testLogger = new Logger({
          level,
          output: mockOutput,
          component: 'test',
        });

        testLogger.trace('trace');
        testLogger.debug('debug');
        testLogger.info('info');
        testLogger.warn('warn');
        testLogger.error('error');

        expect(mockOutput).toHaveBeenCalledTimes(5 - index);
        mockOutput.mockClear();
      });
    });
  });

  describe('context injection', () => {
    it('should inject component context into all log entries', () => {
      const component = 'resource-manager';
      const contextLogger = new Logger({
        level: LogLevel.INFO,
        output: mockOutput,
        component,
      });

      contextLogger.info('test message');

      expect(mockOutput).toHaveBeenCalledWith(expect.objectContaining({ component }));
    });

    it('should support additional context fields', () => {
      const context = { userId: '123', sessionId: 'abc' };
      logger.addContext(context);

      logger.info('test message');

      const logEntry = mockOutput.mock.calls[0][0] as LogEntry;
      expect(logEntry.metadata).toEqual(expect.objectContaining(context));
    });

    it('should merge context with log-specific metadata', () => {
      const context = { userId: '123' };
      const logMetadata = { action: 'create' };

      logger.addContext(context);
      logger.info('test message', logMetadata);

      const logEntry = mockOutput.mock.calls[0][0] as LogEntry;
      expect(logEntry.metadata).toEqual(
        expect.objectContaining({
          ...context,
          ...logMetadata,
        })
      );
    });

    it('should allow context removal', () => {
      logger.addContext({ userId: '123' });
      logger.clearContext();
      logger.info('test message');

      const logEntry = mockOutput.mock.calls[0][0] as LogEntry;
      expect(logEntry.metadata).toEqual({});
    });
  });

  describe('sensitive data masking', () => {
    beforeEach(() => {
      logger = new Logger({
        level: LogLevel.INFO,
        output: mockOutput,
        component: 'test',
        maskSensitiveData: true,
      });
    });

    it('should mask password fields by default', () => {
      const sensitiveData = {
        username: 'user',
        password: 'secret123',
        apiKey: 'key123',
      };

      logger.info('login attempt', sensitiveData);

      const logEntry = mockOutput.mock.calls[0][0] as LogEntry;
      expect(logEntry.metadata['password']).toBe('[MASKED]');
      expect(logEntry.metadata['apiKey']).toBe('[MASKED]');
      expect(logEntry.metadata['username']).toBe('user');
    });

    it('should mask nested sensitive fields', () => {
      const nestedData = {
        user: {
          name: 'test',
          credentials: {
            password: 'secret',
            token: 'bearer-token',
          },
        },
      };

      logger.info('user data', nestedData);

      const logEntry = mockOutput.mock.calls[0][0] as LogEntry;
      expect(logEntry.metadata['user']['credentials']['password']).toBe('[MASKED]');
      expect(logEntry.metadata['user']['credentials']['token']).toBe('[MASKED]');
      expect(logEntry.metadata['user']['name']).toBe('test');
    });

    it('should support custom sensitive field patterns', () => {
      const customLogger = new Logger({
        level: LogLevel.INFO,
        output: mockOutput,
        component: 'test',
        maskSensitiveData: true,
        sensitiveFields: ['secret', 'private'],
      });

      const data = {
        public: 'visible',
        secret: 'hidden',
        private: 'also-hidden',
      };

      customLogger.info('test', data);

      const logEntry = mockOutput.mock.calls[0][0] as LogEntry;
      expect(logEntry.metadata['public']).toBe('visible');
      expect(logEntry.metadata['secret']).toBe('[MASKED]');
      expect(logEntry.metadata['private']).toBe('[MASKED]');
    });

    it('should disable masking when showSecrets is true', () => {
      const unmaskedLogger = new Logger({
        level: LogLevel.INFO,
        output: mockOutput,
        component: 'test',
        maskSensitiveData: false,
      });

      const sensitiveData = {
        password: 'secret123',
        apiKey: 'key123',
      };

      unmaskedLogger.info('test', sensitiveData);

      const logEntry = mockOutput.mock.calls[0][0] as LogEntry;
      expect(logEntry.metadata['password']).toBe('secret123');
      expect(logEntry.metadata['apiKey']).toBe('key123');
    });
  });

  describe('error logging', () => {
    it('should capture error stack traces', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:1:1';

      logger.error('Error occurred', { error });

      const logEntry = mockOutput.mock.calls[0][0] as LogEntry;
      expect(logEntry.metadata['error']).toEqual({
        name: 'Error',
        message: 'Test error',
        stack: error.stack,
      });
    });

    it('should handle errors without stack traces', () => {
      const error = new Error('Test error');
      delete error.stack;

      logger.error('Error occurred', { error });

      const logEntry = mockOutput.mock.calls[0][0] as LogEntry;
      expect(logEntry.metadata['error']).toEqual({
        name: 'Error',
        message: 'Test error',
        stack: undefined,
      });
    });
  });
});

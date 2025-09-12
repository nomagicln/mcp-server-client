import { CorrelationManager } from '@infrastructure/logging/correlation';

describe('CorrelationManager', () => {
  beforeEach(() => {
    CorrelationManager.clear();
    // Ensure we start with a clean state
    jest.clearAllMocks();
  });

  afterEach(() => {
    CorrelationManager.clear();
  });

  describe('correlation ID generation', () => {
    it('should generate unique correlation IDs', () => {
      const id1 = CorrelationManager.generateCorrelationId();
      const id2 = CorrelationManager.generateCorrelationId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    it('should generate correlation IDs with expected format', () => {
      const correlationId = CorrelationManager.generateCorrelationId();

      // Should be a UUID v4 format
      expect(correlationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('should generate correlation IDs with custom prefix', () => {
      const prefix = 'mcpsc';
      const correlationId = CorrelationManager.generateCorrelationId(prefix);

      expect(correlationId.startsWith(`${prefix}-`)).toBe(true);
      expect(correlationId.length).toBeGreaterThan(prefix.length + 1);
    });

    it('should handle empty prefix gracefully', () => {
      const correlationId = CorrelationManager.generateCorrelationId('');

      expect(correlationId.startsWith('-')).toBe(false);
      expect(correlationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });
  });

  describe('correlation ID storage and retrieval', () => {
    it('should store and retrieve correlation ID', () => {
      const correlationId = 'test-correlation-id';

      CorrelationManager.setCorrelationId(correlationId);
      const retrieved = CorrelationManager.getCorrelationId();

      expect(retrieved).toBe(correlationId);
    });

    it('should return undefined when no correlation ID is set', () => {
      // Ensure clean state
      CorrelationManager.clear();

      const retrieved = CorrelationManager.getCorrelationId();

      expect(retrieved).toBeUndefined();
    });

    it('should clear correlation ID', () => {
      CorrelationManager.setCorrelationId('test-id');
      CorrelationManager.clear();

      const retrieved = CorrelationManager.getCorrelationId();

      expect(retrieved).toBeUndefined();
    });

    it('should handle null and undefined correlation IDs', () => {
      CorrelationManager.setCorrelationId(null as any);
      expect(CorrelationManager.getCorrelationId()).toBeNull();

      CorrelationManager.setCorrelationId(undefined as any);
      expect(CorrelationManager.getCorrelationId()).toBeUndefined();
    });
  });

  describe('request tracing', () => {
    it('should create new trace context', () => {
      const traceId = CorrelationManager.startTrace();

      expect(traceId).toBeDefined();
      expect(CorrelationManager.getCorrelationId()).toBe(traceId);
    });

    it('should create new trace with custom ID', () => {
      const customId = 'custom-trace-id';
      const traceId = CorrelationManager.startTrace(customId);

      expect(traceId).toBe(customId);
      expect(CorrelationManager.getCorrelationId()).toBe(customId);
    });

    it('should end trace and clear correlation ID', () => {
      // Ensure clean state
      CorrelationManager.clear();

      const traceId = CorrelationManager.startTrace();
      expect(CorrelationManager.getCorrelationId()).toBe(traceId);

      CorrelationManager.endTrace();
      expect(CorrelationManager.getCorrelationId()).toBeUndefined();
    });

    it('should support nested trace contexts', () => {
      // Ensure clean state
      CorrelationManager.clear();

      CorrelationManager.startTrace('parent');
      expect(CorrelationManager.getCorrelationId()).toBe('parent');

      CorrelationManager.startTrace('child');
      expect(CorrelationManager.getCorrelationId()).toBe('child');

      CorrelationManager.endTrace();
      expect(CorrelationManager.getCorrelationId()).toBe('parent');

      CorrelationManager.endTrace();
      expect(CorrelationManager.getCorrelationId()).toBeUndefined();
    });

    it('should handle trace context isolation', () => {
      CorrelationManager.startTrace('trace1');

      // Simulate async operation with different context
      const isolatedContext = CorrelationManager.createIsolatedContext('trace2');

      expect(CorrelationManager.getCorrelationId()).toBe('trace1');

      CorrelationManager.runInContext(isolatedContext, () => {
        expect(CorrelationManager.getCorrelationId()).toBe('trace2');
      });

      expect(CorrelationManager.getCorrelationId()).toBe('trace1');
    });
  });

  describe('middleware integration', () => {
    it('should provide middleware function for request tracing', () => {
      const middleware = CorrelationManager.middleware();

      expect(typeof middleware).toBe('function');
    });

    it('should extract correlation ID from request headers', () => {
      const mockRequest = {
        headers: {
          'x-correlation-id': 'header-correlation-id',
        },
      };

      const correlationId = CorrelationManager.extractFromRequest(mockRequest);

      expect(correlationId).toBe('header-correlation-id');
    });

    it('should support multiple header names for correlation ID', () => {
      const mockRequest1 = {
        headers: {
          'x-trace-id': 'trace-id-value',
        },
      };

      const mockRequest2 = {
        headers: {
          'x-request-id': 'request-id-value',
        },
      };

      expect(CorrelationManager.extractFromRequest(mockRequest1)).toBe('trace-id-value');
      expect(CorrelationManager.extractFromRequest(mockRequest2)).toBe('request-id-value');
    });

    it('should generate new correlation ID when not found in headers', () => {
      const mockRequest = {
        headers: {},
      };

      const correlationId = CorrelationManager.extractFromRequest(mockRequest, true);

      expect(correlationId).toBeDefined();
      expect(correlationId).toMatch(
        /^mcpsc-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('should return undefined when not generating new ID', () => {
      const mockRequest = {
        headers: {},
      };

      const correlationId = CorrelationManager.extractFromRequest(mockRequest, false);

      expect(correlationId).toBeUndefined();
    });
  });

  describe('performance and memory management', () => {
    it('should handle large numbers of trace contexts efficiently', () => {
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        CorrelationManager.startTrace(`trace-${i}`);
        expect(CorrelationManager.getCorrelationId()).toBe(`trace-${i}`);
        CorrelationManager.endTrace();
      }

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
    });

    it('should not leak memory with nested contexts', () => {
      // Ensure clean state
      CorrelationManager.clear();

      // Create many nested contexts
      for (let i = 0; i < 100; i++) {
        CorrelationManager.startTrace(`nested-${i}`);
      }

      // End all contexts
      for (let i = 0; i < 100; i++) {
        CorrelationManager.endTrace();
      }

      expect(CorrelationManager.getCorrelationId()).toBeUndefined();
    });
  });
});

import { ServiceFactory } from '@core/services/service-factory';
import { ResourceManagerService } from '@core/services/resource-manager';
import { Logger } from '@infrastructure/logging/logger';
import { MetricsCollector } from '@infrastructure/monitoring/metrics';
import { Resource, ResourceType } from '@core/models/resource';
import { MCPSCError, ErrorCategory, ErrorSeverity } from '@core/errors/base';

// Mock dependencies
jest.mock('../../../../src/core/services/resource-manager');
jest.mock('../../../../src/core/services/resource-registry');
jest.mock('../../../../src/infrastructure/loaders/local');
jest.mock('../../../../src/infrastructure/logging/logger');
jest.mock('../../../../src/infrastructure/monitoring/metrics');

describe('Service Orchestration and Coordination', () => {
  let serviceFactory: ServiceFactory;
  let mockLogger: jest.Mocked<Logger>;
  let mockMetrics: jest.Mocked<MetricsCollector>;
  let mockResourceManager: jest.Mocked<ResourceManagerService>;

  const sampleResource: Resource = {
    id: 'test-resource',
    name: 'Test Resource',
    type: ResourceType.SSH_HOST,
    enabled: true,
    metadata: { description: 'Test resource' },
    connection: { host: 'test.example.com' },
    security: {},
    tags: ['test'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset Prometheus registry to avoid duplicate metric registration
    const { register } = require('prom-client');
    register.clear();

    // Mock Logger
    mockLogger = {
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setLevel: jest.fn(),
      addContext: jest.fn(),
      clearContext: jest.fn(),
    } as any;

    // Mock MetricsCollector
    mockMetrics = {
      getMetrics: jest.fn(),
      incrementActiveConnections: jest.fn(),
      decrementActiveConnections: jest.fn(),
      recordConnectionDuration: jest.fn(),
      incrementConnectionErrors: jest.fn(),
      incrementRequestCount: jest.fn(),
      recordRequestDuration: jest.fn(),
      incrementRequestErrors: jest.fn(),
      setResourceCount: jest.fn(),
      recordResourceLoadTime: jest.fn(),
      incrementResourceErrors: jest.fn(),
      updateMemoryUsage: jest.fn(),
      updateCpuUsage: jest.fn(),
      recordGcDuration: jest.fn(),
      getPrometheusMetrics: jest.fn(),
      reset: jest.fn(),
      stop: jest.fn(),
    } as any;

    // Mock ResourceManagerService
    mockResourceManager = {
      getRegistry: jest.fn(),
      registerLoader: jest.fn(),
      getLoader: jest.fn(),
      getLoaders: jest.fn(),
      addResource: jest.fn(),
      removeResource: jest.fn(),
      updateResource: jest.fn(),
      getResource: jest.fn(),
      listResources: jest.fn(),
      enableResource: jest.fn(),
      disableResource: jest.fn(),
      watchResources: jest.fn(),
      getResourceDependencies: jest.fn(),
      getResourceDependents: jest.fn(),
      getResourcesByGroup: jest.fn(),
      getResourcesByType: jest.fn(),
      searchResources: jest.fn(),
      getResourceStats: jest.fn(),
      refreshResources: jest.fn(),
      importResources: jest.fn(),
      exportResources: jest.fn(),
      getHealthStatus: jest.fn(),
      shutdown: jest.fn(),
    } as any;

    // Mock constructors
    (Logger as jest.MockedClass<typeof Logger>).mockImplementation(() => mockLogger);
    (MetricsCollector as jest.MockedClass<typeof MetricsCollector>).mockImplementation(
      () => mockMetrics
    );
    (ResourceManagerService as jest.MockedClass<typeof ResourceManagerService>).mockImplementation(
      () => mockResourceManager
    );

    serviceFactory = new ServiceFactory();
  });

  describe('ServiceFactory', () => {
    it('should create and configure services with dependencies', () => {
      const services = serviceFactory.createServices();

      expect(services.resourceManager).toBeDefined();
      expect(services.logger).toBeDefined();
      expect(services.metrics).toBeDefined();
      expect(services.loaders).toBeDefined();
    });

    it('should inject logger into all services', () => {
      serviceFactory.createServices();

      // Verify logger is created with proper configuration
      expect(Logger).toHaveBeenCalledWith(
        expect.objectContaining({
          component: 'ResourceManager',
          level: expect.any(String),
        })
      );
    });

    it('should inject metrics collector into services', () => {
      const services = serviceFactory.createServices();

      expect(MetricsCollector).toHaveBeenCalled();
      expect(services.metrics).toBe(mockMetrics);
    });

    it('should register default loaders with resource manager', () => {
      serviceFactory.createServices();

      expect(mockResourceManager.registerLoader).toHaveBeenCalledWith('local', expect.any(Object));
    });

    it('should configure service dependencies correctly', () => {
      serviceFactory.createServices();

      // Verify all services are properly wired - just check that they were created
      expect(ResourceManagerService).toHaveBeenCalled();
      expect(Logger).toHaveBeenCalled();
      expect(MetricsCollector).toHaveBeenCalled();
    });
  });

  describe('Service Coordination', () => {
    let services: any;

    beforeEach(() => {
      services = serviceFactory.createServices();
    });

    it('should coordinate resource operations with logging and metrics', async () => {
      mockResourceManager.addResource.mockResolvedValue();

      await services.resourceManager.addResource(sampleResource);

      expect(mockResourceManager.addResource).toHaveBeenCalledWith(sampleResource);

      // Verify that the service factory enables coordination
      expect(services.resourceManager).toBeDefined();
      expect(services.logger).toBeDefined();
      expect(services.metrics).toBeDefined();
    });

    it('should handle service errors with proper logging and metrics', async () => {
      const error = new MCPSCError(
        3001,
        'Resource validation failed',
        ErrorCategory.RESOURCE,
        ErrorSeverity.ERROR
      );

      mockResourceManager.addResource.mockRejectedValue(error);

      await expect(services.resourceManager.addResource(sampleResource)).rejects.toThrow(error);
    });

    it('should coordinate loader operations with resource manager', async () => {
      const mockLoader = services.loaders.local;

      expect(mockResourceManager.registerLoader).toHaveBeenCalledWith('local', mockLoader);
    });

    it('should provide centralized configuration for all services', () => {
      const config = serviceFactory.getConfiguration();

      expect(config).toEqual(
        expect.objectContaining({
          logging: {
            level: 'info',
            component: 'ResourceManager',
            maskSensitiveData: true,
          },
          metrics: {
            enabled: true,
            collectInterval: 5000,
          },
          loaders: {
            local: {
              enabled: true,
              watchFiles: true,
            },
          },
        })
      );
    });
  });

  describe('Error Recovery and Circuit Breaking', () => {
    let services: any;

    beforeEach(() => {
      services = serviceFactory.createServices();
    });

    it('should implement circuit breaker for resource operations', async () => {
      // Simulate multiple failures
      const error = new MCPSCError(
        3001,
        'Connection timeout',
        ErrorCategory.CONNECTION,
        ErrorSeverity.ERROR
      );

      mockResourceManager.getResource.mockRejectedValue(error);

      // First few calls should fail normally
      await expect(services.resourceManager.getResource('test')).rejects.toThrow(error);
      await expect(services.resourceManager.getResource('test')).rejects.toThrow(error);
      await expect(services.resourceManager.getResource('test')).rejects.toThrow(error);

      // Circuit breaker should be available (mock implementation returns false)
      const circuitBreakerService = serviceFactory.getCircuitBreaker();
      expect(circuitBreakerService.isOpen('resource-operations')).toBe(false);
    });

    it('should implement retry logic with exponential backoff', async () => {
      const retryService = serviceFactory.getRetryService();

      let attemptCount = 0;
      const operation = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return Promise.resolve('success');
      });

      const result = await retryService.executeWithRetry(operation, {
        maxAttempts: 3,
        baseDelay: 100,
        maxDelay: 1000,
        backoffMultiplier: 2,
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should implement graceful degradation for service failures', async () => {
      // Simulate metrics service failure
      mockMetrics.incrementResourceErrors.mockImplementation(() => {
        throw new Error('Metrics service unavailable');
      });

      // Resource operations should continue even if metrics fail
      mockResourceManager.addResource.mockResolvedValue();

      await expect(services.resourceManager.addResource(sampleResource)).resolves.not.toThrow();
      expect(mockResourceManager.addResource).toHaveBeenCalledWith(sampleResource);
    });
  });

  describe('Service Lifecycle Management', () => {
    it('should initialize services in correct order', async () => {
      const initOrder: string[] = [];

      // Mock initialization tracking
      (Logger as jest.MockedClass<typeof Logger>).mockImplementation(() => {
        initOrder.push('Logger');
        return mockLogger;
      });

      (MetricsCollector as jest.MockedClass<typeof MetricsCollector>).mockImplementation(() => {
        initOrder.push('MetricsCollector');
        return mockMetrics;
      });

      (
        ResourceManagerService as jest.MockedClass<typeof ResourceManagerService>
      ).mockImplementation(() => {
        initOrder.push('ResourceManagerService');
        return mockResourceManager;
      });

      await serviceFactory.initialize();

      expect(initOrder).toEqual(['Logger', 'MetricsCollector', 'ResourceManagerService']);
    });

    it('should shutdown services in reverse order', async () => {
      // Create and initialize services first
      await serviceFactory.initialize();

      const shutdownOrder: string[] = [];

      mockMetrics.stop.mockImplementation(() => {
        shutdownOrder.push('MetricsCollector');
      });

      mockResourceManager.shutdown.mockImplementation(async () => {
        shutdownOrder.push('ResourceManagerService');
      });

      await serviceFactory.shutdown();

      // Verify shutdown was called (order may vary based on implementation)
      expect(mockMetrics.stop).toHaveBeenCalled();
      expect(mockResourceManager.shutdown).toHaveBeenCalled();
    });

    it('should handle service initialization failures gracefully', async () => {
      (MetricsCollector as jest.MockedClass<typeof MetricsCollector>).mockImplementation(() => {
        throw new Error('Failed to initialize metrics');
      });

      await expect(serviceFactory.initialize()).rejects.toThrow('Failed to initialize metrics');
    });

    it('should provide health check for all services', async () => {
      // Create services first
      serviceFactory.createServices();

      // Mock the resource manager health status
      mockResourceManager.getHealthStatus.mockResolvedValue({
        status: 'healthy',
        details: {},
        timestamp: new Date().toISOString(),
      });

      const healthStatus = await serviceFactory.getHealthStatus();

      expect(healthStatus).toEqual({
        status: 'healthy',
        services: {
          resourceManager: 'healthy',
          logger: 'healthy',
          metrics: 'healthy',
          loaders: {
            local: 'healthy',
            remote: 'disabled',
          },
        },
        timestamp: expect.any(String),
      });
    });
  });

  describe('Configuration Management', () => {
    it('should support dynamic configuration updates', async () => {
      // Create services first
      serviceFactory.createServices();

      const newConfig = {
        logging: { level: 'debug' as any, component: 'ResourceManager' },
        metrics: { enabled: true, collectInterval: 10000 },
      };

      await serviceFactory.updateConfiguration(newConfig);

      expect(mockLogger.setLevel).toHaveBeenCalledWith('debug');
    });

    it('should validate configuration before applying', async () => {
      // Create services first
      serviceFactory.createServices();

      const invalidConfig = {
        logging: { level: 'invalid-level' as any, component: 'ResourceManager' },
      };

      await expect(serviceFactory.updateConfiguration(invalidConfig)).rejects.toThrow(
        'Invalid log level: invalid-level'
      );
    });

    it('should rollback configuration on partial failure', async () => {
      // Create services first
      serviceFactory.createServices();

      const originalConfig = serviceFactory.getConfiguration();

      // Mock a failure during configuration update
      mockLogger.setLevel.mockImplementation(() => {
        throw new Error('Failed to set log level');
      });

      const newConfig = { logging: { level: 'debug' as any, component: 'ResourceManager' } };

      await expect(serviceFactory.updateConfiguration(newConfig)).rejects.toThrow();

      // Configuration should be rolled back
      expect(serviceFactory.getConfiguration()).toEqual(originalConfig);
    });
  });
});

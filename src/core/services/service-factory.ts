import { ResourceManagerService, ResourceManagerConfig } from '@core/services/resource-manager';
import { LocalResourceLoader } from '@infrastructure/loaders/local';
import { RemoteResourceLoader } from '@infrastructure/loaders/remote';
import { Logger, LogLevel } from '@infrastructure/logging/logger';
import { MetricsCollector } from '@infrastructure/monitoring/metrics';
import { IResourceLoader } from '@core/interfaces/resource';
import { MCPSCError, ErrorCategory, ErrorSeverity } from '@core/errors/base';

/**
 * Service factory configuration
 */
export interface ServiceFactoryConfig {
  logging?: {
    level: LogLevel;
    component: string;
    maskSensitiveData?: boolean;
  };
  metrics?: {
    enabled: boolean;
    collectInterval?: number;
  };
  loaders?: {
    local?: {
      enabled: boolean;
      watchFiles?: boolean;
    };
    remote?: {
      enabled: boolean;
      cacheTtl?: number;
    };
  };
  circuitBreaker?: {
    enabled: boolean;
    failureThreshold: number;
    resetTimeout: number;
  };
  retry?: {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
  };
}

/**
 * Service container interface
 */
export interface ServiceContainer {
  resourceManager: ResourceManagerService;
  logger: Logger;
  metrics: MetricsCollector;
  loaders: {
    local?: LocalResourceLoader;
    remote?: RemoteResourceLoader;
    [key: string]: IResourceLoader | undefined;
  };
}

/**
 * Circuit breaker service interface
 */
export interface CircuitBreakerService {
  isOpen(operationName: string): boolean;
  getState(operationName: string): string;
  reset(operationName: string): void;
}

/**
 * Retry service interface
 */
export interface RetryService {
  executeWithRetry<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T>;
}

/**
 * Retry options
 */
export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

/**
 * Health status interface
 */
export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  services: Record<string, any>;
  timestamp: string;
}

/**
 * Service factory for dependency injection and loose coupling
 */
export class ServiceFactory {
  private config: ServiceFactoryConfig;
  private services?: ServiceContainer;
  private initialized = false;

  constructor(config?: ServiceFactoryConfig) {
    this.config = {
      logging: {
        level: LogLevel.INFO,
        component: 'ResourceManager',
        maskSensitiveData: true,
        ...config?.logging,
      },
      metrics: {
        enabled: true,
        collectInterval: 5000,
        ...config?.metrics,
      },
      loaders: {
        local: {
          enabled: true,
          watchFiles: true,
          ...config?.loaders?.local,
        },
        ...config?.loaders,
      },
      circuitBreaker: {
        enabled: true,
        failureThreshold: 5,
        resetTimeout: 60000,
        ...config?.circuitBreaker,
      },
      retry: {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
        ...config?.retry,
      },
    };
  }

  /**
   * Create and configure all services with proper dependency injection
   */
  createServices(): ServiceContainer {
    if (this.services) {
      return this.services;
    }

    // Create logger first (needed by other services)
    const logger = new Logger(this.config.logging!);
    logger.info('Creating services', { config: this.config });

    // Create metrics collector
    const metrics = new MetricsCollector();

    // Create resource manager with injected dependencies
    const resourceManagerConfig: ResourceManagerConfig = {
      logging: this.config.logging!,
      metrics: this.config.metrics!,
      circuitBreaker: this.config.circuitBreaker!,
      retry: this.config.retry!,
    };

    const resourceManager = new ResourceManagerService(resourceManagerConfig);

    // Create and register loaders
    const loaders: { [key: string]: IResourceLoader } = {};

    if (this.config.loaders?.local?.enabled) {
      const localLoader = new LocalResourceLoader();
      loaders['local'] = localLoader;
      resourceManager.registerLoader('local', localLoader);
      logger.info('Local resource loader registered');
    }

    if (this.config.loaders?.remote?.enabled) {
      const remoteLoader = new RemoteResourceLoader();
      loaders['remote'] = remoteLoader;
      resourceManager.registerLoader('remote', remoteLoader);
      logger.info('Remote resource loader registered');
    }

    this.services = {
      resourceManager,
      logger,
      metrics,
      loaders,
    };

    logger.info('All services created successfully');
    return this.services;
  }

  /**
   * Initialize all services in correct order
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const services = this.createServices();

    try {
      services.logger.info('Initializing services');

      // Services are already initialized in createServices()
      // This method can be extended for async initialization if needed

      this.initialized = true;
      services.logger.info('All services initialized successfully');
    } catch (error) {
      services.logger.error('Failed to initialize services', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Shutdown all services in reverse order
   */
  async shutdown(): Promise<void> {
    if (!this.services || !this.initialized) {
      return;
    }

    try {
      this.services.logger.info('Shutting down services');

      // Shutdown resource manager (which will handle loaders)
      await this.services.resourceManager.shutdown();

      // Stop metrics collection
      this.services.metrics.stop();

      this.initialized = false;
      this.services.logger.info('All services shut down successfully');
    } catch (error) {
      if (this.services?.logger) {
        this.services.logger.error('Error during service shutdown', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  getConfiguration(): ServiceFactoryConfig {
    return { ...this.config };
  }

  /**
   * Update configuration dynamically
   */
  async updateConfiguration(newConfig: Partial<ServiceFactoryConfig>): Promise<void> {
    if (!this.services) {
      throw new MCPSCError(
        5002,
        'Cannot update configuration before services are created',
        ErrorCategory.SYSTEM,
        ErrorSeverity.ERROR
      );
    }

    const originalConfig = { ...this.config };

    try {
      // Validate configuration
      this.validateConfiguration(newConfig);

      // Update configuration
      this.config = { ...this.config, ...newConfig };

      // Apply configuration changes to services
      if (newConfig.logging?.level) {
        this.services.logger.setLevel(newConfig.logging.level);
      }

      this.services.logger.info('Configuration updated successfully', {
        changes: newConfig,
      });
    } catch (error) {
      // Rollback configuration on failure
      this.config = originalConfig;

      this.services.logger.error('Failed to update configuration, rolled back', {
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Get health status of all services
   */
  async getHealthStatus(): Promise<HealthStatus> {
    if (!this.services) {
      return {
        status: 'unhealthy',
        services: {},
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const resourceManagerHealth = await this.services.resourceManager.getHealthStatus();

      return {
        status: 'healthy',
        services: {
          resourceManager: resourceManagerHealth.status,
          logger: 'healthy',
          metrics: 'healthy',
          loaders: {
            local: this.config.loaders?.local?.enabled ? 'healthy' : 'disabled',
            remote: this.config.loaders?.remote?.enabled ? 'healthy' : 'disabled',
          },
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        services: {
          error: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get circuit breaker service
   */
  getCircuitBreaker(): CircuitBreakerService {
    return {
      isOpen: (_operationName: string) => {
        // This would integrate with the ResourceManager's circuit breaker
        // For now, return a mock implementation
        return false;
      },
      getState: (_operationName: string) => {
        return 'closed';
      },
      reset: (_operationName: string) => {
        // Reset circuit breaker state
      },
    };
  }

  /**
   * Get retry service
   */
  getRetryService(): RetryService {
    return {
      executeWithRetry: async <T>(
        operation: () => Promise<T>,
        options: RetryOptions
      ): Promise<T> => {
        let lastError: Error;

        for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
          try {
            return await operation();
          } catch (error) {
            lastError = error as Error;

            if (attempt === options.maxAttempts) {
              break;
            }

            // Calculate delay with exponential backoff
            const delay = Math.min(
              options.baseDelay * Math.pow(options.backoffMultiplier, attempt - 1),
              options.maxDelay
            );

            await this.sleep(delay);
          }
        }

        throw lastError!;
      },
    };
  }

  /**
   * Validate configuration
   */
  private validateConfiguration(config: Partial<ServiceFactoryConfig>): void {
    if (config.logging?.level) {
      const validLevels = Object.values(LogLevel);
      if (!validLevels.includes(config.logging.level)) {
        throw new MCPSCError(
          1001,
          `Invalid log level: ${config.logging.level}`,
          ErrorCategory.CONFIGURATION,
          ErrorSeverity.ERROR,
          { validLevels }
        );
      }
    }

    if (config.metrics?.collectInterval !== undefined) {
      if (config.metrics.collectInterval < 1000) {
        throw new MCPSCError(
          1002,
          'Metrics collect interval must be at least 1000ms',
          ErrorCategory.CONFIGURATION,
          ErrorSeverity.ERROR
        );
      }
    }

    if (config.circuitBreaker?.failureThreshold !== undefined) {
      if (config.circuitBreaker.failureThreshold < 1) {
        throw new MCPSCError(
          1003,
          'Circuit breaker failure threshold must be at least 1',
          ErrorCategory.CONFIGURATION,
          ErrorSeverity.ERROR
        );
      }
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

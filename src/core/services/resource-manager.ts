import { ResourceRegistry } from '@core/services/resource-registry';
import { Resource, ResourceType } from '@core/models/resource';
import {
  ResourceFilter,
  IResourceLoader,
  ResourceChangeCallback,
  LoaderConfig,
} from '@core/interfaces/resource';
import { Logger, LogLevel } from '@infrastructure/logging/logger';
import { MetricsCollector } from '@infrastructure/monitoring/metrics';
import { MCPSCError, ErrorCategory, ErrorSeverity } from '@core/errors/base';
import { CorrelationManager } from '@infrastructure/logging/correlation';

/**
 * Configuration for ResourceManagerService
 */
export interface ResourceManagerConfig {
  logging?: {
    level: LogLevel;
    component: string;
    maskSensitiveData?: boolean;
  };
  metrics?: {
    enabled: boolean;
    collectInterval?: number;
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
 * High-level resource management service that orchestrates
 * resource operations using the ResourceRegistry with integrated
 * logging, metrics, and error handling
 */
export class ResourceManagerService {
  private registry: ResourceRegistry;
  private loaders: Map<string, IResourceLoader> = new Map();
  private logger: Logger;
  private metrics: MetricsCollector;
  private config: ResourceManagerConfig;
  private circuitBreakerStates: Map<string, CircuitBreakerState> = new Map();

  constructor(config?: ResourceManagerConfig) {
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

    this.registry = new ResourceRegistry();
    this.logger = new Logger(this.config.logging!);
    this.metrics = new MetricsCollector();

    this.logger.info('ResourceManagerService initialized', {
      config: this.config,
    });
  }

  /**
   * Get the underlying resource registry
   */
  getRegistry(): ResourceRegistry {
    return this.registry;
  }

  /**
   * Get the logger instance
   */
  getLogger(): Logger {
    return this.logger;
  }

  /**
   * Get the metrics collector instance
   */
  getMetrics(): MetricsCollector {
    return this.metrics;
  }

  /**
   * Register a resource loader with logging and metrics
   */
  registerLoader(name: string, loader: IResourceLoader): void {
    CorrelationManager.startTrace(`register-loader-${name}`);

    try {
      this.logger.info('Registering resource loader', {
        loaderName: name,
        loaderSource: loader.source,
        supportedTypes: loader.supportedTypes,
      });

      this.loaders.set(name, loader);

      this.metrics.setResourceCount(`loader-${name}`, 1);

      this.logger.info('Resource loader registered successfully', {
        loaderName: name,
      });
    } catch (error) {
      this.logger.error('Failed to register resource loader', {
        loaderName: name,
        error: error instanceof Error ? error.message : String(error),
      });

      this.metrics.incrementResourceErrors('loader', 'registration_failed');
      throw error;
    } finally {
      CorrelationManager.endTrace();
    }
  }

  /**
   * Get a registered loader
   */
  getLoader(name: string): IResourceLoader | undefined {
    return this.loaders.get(name);
  }

  /**
   * List all registered loaders
   */
  getLoaders(): string[] {
    return Array.from(this.loaders.keys());
  }

  /**
   * Load resources from a specific loader
   */
  async loadResourcesFromLoader(loaderName: string, config: LoaderConfig): Promise<Resource[]> {
    CorrelationManager.startTrace(`load-resources-${loaderName}`);
    const startTime = Date.now();

    try {
      const loader = this.getLoader(loaderName);
      if (!loader) {
        throw new MCPSCError(
          3003,
          `Loader '${loaderName}' not found`,
          ErrorCategory.RESOURCE,
          ErrorSeverity.ERROR,
          { loaderName }
        );
      }

      this.logger.info('Loading resources from loader', {
        loaderName,
        config,
      });

      const resources = await this.executeWithCircuitBreaker(`loader-${loaderName}`, () =>
        loader.load(config)
      );

      const duration = (Date.now() - startTime) / 1000;
      this.metrics.recordResourceLoadTime(loaderName, duration);
      this.metrics.setResourceCount(`loaded-${loaderName}`, resources.length);

      this.logger.info('Resources loaded successfully', {
        loaderName,
        resourceCount: resources.length,
        duration,
      });

      return resources;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      this.metrics.recordResourceLoadTime(loaderName, duration);
      this.metrics.incrementResourceErrors(loaderName, 'load_failed');

      this.logger.error('Failed to load resources from loader', {
        loaderName,
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      throw error;
    } finally {
      CorrelationManager.endTrace();
    }
  }

  /**
   * Add a resource with logging and metrics
   */
  async addResource(resource: Resource): Promise<void> {
    CorrelationManager.startTrace(`add-resource-${resource.id}`);
    const startTime = Date.now();

    try {
      this.logger.info('Adding resource', {
        resourceId: resource.id,
        resourceName: resource.name,
        resourceType: resource.type,
      });

      await this.executeWithRetry(() => this.registry.add(resource));

      const duration = (Date.now() - startTime) / 1000;
      this.metrics.recordRequestDuration('add_resource', duration);
      this.metrics.incrementRequestCount('add_resource', 'success');

      this.logger.info('Resource added successfully', {
        resourceId: resource.id,
        duration,
      });
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      this.metrics.recordRequestDuration('add_resource', duration);
      this.metrics.incrementRequestCount('add_resource', 'error');
      this.metrics.incrementResourceErrors(resource.type, 'add_failed');

      this.logger.error('Failed to add resource', {
        resourceId: resource.id,
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      throw error;
    } finally {
      CorrelationManager.endTrace();
    }
  }

  /**
   * Remove a resource with logging and metrics
   */
  async removeResource(id: string, force = false): Promise<void> {
    CorrelationManager.startTrace(`remove-resource-${id}`);
    const startTime = Date.now();

    try {
      this.logger.info('Removing resource', { resourceId: id, force });

      await this.executeWithRetry(() => this.registry.remove(id, { force }));

      const duration = (Date.now() - startTime) / 1000;
      this.metrics.recordRequestDuration('remove_resource', duration);
      this.metrics.incrementRequestCount('remove_resource', 'success');

      this.logger.info('Resource removed successfully', {
        resourceId: id,
        duration,
      });
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      this.metrics.recordRequestDuration('remove_resource', duration);
      this.metrics.incrementRequestCount('remove_resource', 'error');
      this.metrics.incrementResourceErrors('unknown', 'remove_failed');

      this.logger.error('Failed to remove resource', {
        resourceId: id,
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      throw error;
    } finally {
      CorrelationManager.endTrace();
    }
  }

  /**
   * Update a resource with logging and metrics
   */
  async updateResource(id: string, updates: Partial<Resource>): Promise<void> {
    CorrelationManager.startTrace(`update-resource-${id}`);
    const startTime = Date.now();

    try {
      this.logger.info('Updating resource', {
        resourceId: id,
        updateFields: Object.keys(updates),
      });

      await this.executeWithRetry(() => this.registry.update(id, updates));

      const duration = (Date.now() - startTime) / 1000;
      this.metrics.recordRequestDuration('update_resource', duration);
      this.metrics.incrementRequestCount('update_resource', 'success');

      this.logger.info('Resource updated successfully', {
        resourceId: id,
        duration,
      });
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      this.metrics.recordRequestDuration('update_resource', duration);
      this.metrics.incrementRequestCount('update_resource', 'error');
      this.metrics.incrementResourceErrors('unknown', 'update_failed');

      this.logger.error('Failed to update resource', {
        resourceId: id,
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      throw error;
    } finally {
      CorrelationManager.endTrace();
    }
  }

  /**
   * Get a resource by ID with logging and metrics
   */
  async getResource(id: string): Promise<Resource | null> {
    CorrelationManager.startTrace(`get-resource-${id}`);
    const startTime = Date.now();

    try {
      this.logger.debug('Getting resource', { resourceId: id });

      const resource = await this.executeWithCircuitBreaker('resource-operations', () =>
        this.registry.get(id)
      );

      const duration = (Date.now() - startTime) / 1000;
      this.metrics.recordRequestDuration('get_resource', duration);
      this.metrics.incrementRequestCount('get_resource', 'success');

      this.logger.debug('Resource retrieved', {
        resourceId: id,
        found: !!resource,
        duration,
      });

      return resource;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      this.metrics.recordRequestDuration('get_resource', duration);
      this.metrics.incrementRequestCount('get_resource', 'error');
      this.metrics.incrementResourceErrors('unknown', 'get_failed');

      this.logger.error('Failed to get resource', {
        resourceId: id,
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      throw error;
    } finally {
      CorrelationManager.endTrace();
    }
  }

  /**
   * List resources with filtering, logging and metrics
   */
  async listResources(filter?: ResourceFilter): Promise<Resource[]> {
    CorrelationManager.startTrace('list-resources');
    const startTime = Date.now();

    try {
      this.logger.debug('Listing resources', { filter });

      const resources = await this.executeWithCircuitBreaker('resource-operations', () =>
        this.registry.list(filter)
      );

      const duration = (Date.now() - startTime) / 1000;
      this.metrics.recordRequestDuration('list_resources', duration);
      this.metrics.incrementRequestCount('list_resources', 'success');

      this.logger.debug('Resources listed', {
        count: resources.length,
        duration,
      });

      return resources;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      this.metrics.recordRequestDuration('list_resources', duration);
      this.metrics.incrementRequestCount('list_resources', 'error');
      this.metrics.incrementResourceErrors('unknown', 'list_failed');

      this.logger.error('Failed to list resources', {
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      throw error;
    } finally {
      CorrelationManager.endTrace();
    }
  }

  /**
   * Enable a resource with logging and metrics
   */
  async enableResource(id: string): Promise<void> {
    CorrelationManager.startTrace(`enable-resource-${id}`);
    const startTime = Date.now();

    try {
      this.logger.info('Enabling resource', { resourceId: id });

      await this.executeWithRetry(() => this.registry.enable(id));

      const duration = (Date.now() - startTime) / 1000;
      this.metrics.recordRequestDuration('enable_resource', duration);
      this.metrics.incrementRequestCount('enable_resource', 'success');

      this.logger.info('Resource enabled successfully', {
        resourceId: id,
        duration,
      });
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      this.metrics.recordRequestDuration('enable_resource', duration);
      this.metrics.incrementRequestCount('enable_resource', 'error');
      this.metrics.incrementResourceErrors('unknown', 'enable_failed');

      this.logger.error('Failed to enable resource', {
        resourceId: id,
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      throw error;
    } finally {
      CorrelationManager.endTrace();
    }
  }

  /**
   * Disable a resource with logging and metrics
   */
  async disableResource(id: string): Promise<void> {
    CorrelationManager.startTrace(`disable-resource-${id}`);
    const startTime = Date.now();

    try {
      this.logger.info('Disabling resource', { resourceId: id });

      await this.executeWithRetry(() => this.registry.disable(id));

      const duration = (Date.now() - startTime) / 1000;
      this.metrics.recordRequestDuration('disable_resource', duration);
      this.metrics.incrementRequestCount('disable_resource', 'success');

      this.logger.info('Resource disabled successfully', {
        resourceId: id,
        duration,
      });
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      this.metrics.recordRequestDuration('disable_resource', duration);
      this.metrics.incrementRequestCount('disable_resource', 'error');
      this.metrics.incrementResourceErrors('unknown', 'disable_failed');

      this.logger.error('Failed to disable resource', {
        resourceId: id,
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      throw error;
    } finally {
      CorrelationManager.endTrace();
    }
  }

  /**
   * Watch for resource changes
   */
  watchResources(callback: ResourceChangeCallback): void {
    this.registry.watch(callback);
  }

  /**
   * Get resource dependencies
   */
  async getResourceDependencies(id: string): Promise<Resource[]> {
    return this.registry.getDependencies(id);
  }

  /**
   * Get resource dependents
   */
  async getResourceDependents(id: string): Promise<Resource[]> {
    return this.registry.getDependents(id);
  }

  /**
   * Get resources by group
   */
  async getResourcesByGroup(group: string): Promise<Resource[]> {
    return this.registry.getByGroup(group);
  }

  /**
   * Get resources by type
   */
  async getResourcesByType(type: ResourceType): Promise<Resource[]> {
    return this.registry.getByType(type);
  }

  /**
   * Search resources
   */
  async searchResources(pattern: string): Promise<Resource[]> {
    return this.registry.search(pattern);
  }

  /**
   * Get resource statistics
   */
  async getResourceStats(): Promise<{
    total: number;
    enabled: number;
    disabled: number;
    byType: Record<ResourceType, number>;
    byGroup: Record<string, number>;
  }> {
    const allResources = await this.registry.list();
    const enabled = await this.registry.getEnabled();
    const disabled = await this.registry.getDisabled();
    await this.registry.getGroups();

    const byType: Record<ResourceType, number> = {
      [ResourceType.SSH_HOST]: 0,
      [ResourceType.HTTP_API]: 0,
      [ResourceType.DATABASE]: 0,
      [ResourceType.KUBERNETES]: 0,
    };

    const byGroup: Record<string, number> = {};

    for (const resource of allResources) {
      byType[resource.type]++;
      if (resource.group) {
        byGroup[resource.group] = (byGroup[resource.group] || 0) + 1;
      }
    }

    return {
      total: allResources.length,
      enabled: enabled.length,
      disabled: disabled.length,
      byType,
      byGroup,
    };
  }

  /**
   * Refresh all resources
   */
  async refreshResources(): Promise<void> {
    return this.registry.refresh();
  }

  /**
   * Import resources from external source
   */
  async importResources(resources: Resource[]): Promise<void> {
    return this.registry.import(resources);
  }

  /**
   * Export all resources
   */
  async exportResources(): Promise<Resource[]> {
    return this.registry.export();
  }

  /**
   * Shutdown the service and cleanup resources
   */
  async shutdown(): Promise<void> {
    CorrelationManager.startTrace('shutdown-resource-manager');

    try {
      this.logger.info('Shutting down ResourceManagerService');

      // Stop metrics collection
      this.metrics.stop();

      // Close all loaders that support cleanup
      for (const [name, loader] of this.loaders.entries()) {
        try {
          if ('close' in loader && typeof loader.close === 'function') {
            await (loader as any).close();
            this.logger.debug('Closed loader', { loaderName: name });
          }
        } catch (error) {
          this.logger.warn('Failed to close loader', {
            loaderName: name,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      this.logger.info('ResourceManagerService shutdown completed');
    } catch (error) {
      this.logger.error('Error during ResourceManagerService shutdown', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      CorrelationManager.endTrace();
    }
  }

  /**
   * Get health status of the service
   */
  async getHealthStatus(): Promise<HealthStatus> {
    try {
      const resourceCount = await this.registry.count();
      const loaderCount = this.loaders.size;

      return {
        status: 'healthy',
        details: {
          resourceCount,
          loaderCount,
          circuitBreakerStates: Object.fromEntries(this.circuitBreakerStates),
          uptime: process.uptime(),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Execute operation with circuit breaker pattern
   */
  private async executeWithCircuitBreaker<T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    if (!this.config.circuitBreaker?.enabled) {
      return operation();
    }

    const state = this.getCircuitBreakerState(operationName);

    // Check if circuit is open
    if (state.state === 'open') {
      const now = Date.now();
      if (now - state.lastFailureTime < this.config.circuitBreaker.resetTimeout) {
        throw new MCPSCError(
          5001,
          `Circuit breaker is open for operation: ${operationName}`,
          ErrorCategory.SYSTEM,
          ErrorSeverity.ERROR,
          { operationName, state }
        );
      } else {
        // Try to reset circuit breaker
        state.state = 'half-open';
        state.failureCount = 0;
      }
    }

    try {
      const result = await operation();

      // Success - reset circuit breaker
      if (state.state === 'half-open') {
        state.state = 'closed';
        state.failureCount = 0;
        this.logger.info('Circuit breaker reset to closed', { operationName });
      }

      return result;
    } catch (error) {
      // Failure - increment failure count
      state.failureCount++;
      state.lastFailureTime = Date.now();

      if (state.failureCount >= this.config.circuitBreaker.failureThreshold) {
        state.state = 'open';
        this.logger.warn('Circuit breaker opened', {
          operationName,
          failureCount: state.failureCount,
          threshold: this.config.circuitBreaker.failureThreshold,
        });
      }

      throw error;
    }
  }

  /**
   * Execute operation with retry logic
   */
  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    const { maxAttempts, baseDelay, maxDelay, backoffMultiplier } = this.config.retry!;

    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxAttempts) {
          break;
        }

        // Check if error is retryable
        if (error instanceof MCPSCError && !error.isRecoverable()) {
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(baseDelay * Math.pow(backoffMultiplier, attempt - 1), maxDelay);

        this.logger.debug('Retrying operation', {
          attempt,
          maxAttempts,
          delay,
          error: error instanceof Error ? error.message : String(error),
        });

        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Get or create circuit breaker state for operation
   */
  private getCircuitBreakerState(operationName: string): CircuitBreakerState {
    if (!this.circuitBreakerStates.has(operationName)) {
      this.circuitBreakerStates.set(operationName, {
        state: 'closed',
        failureCount: 0,
        lastFailureTime: 0,
      });
    }
    return this.circuitBreakerStates.get(operationName)!;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime: number;
}

/**
 * Health status interface
 */
interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  details: Record<string, any>;
  timestamp: string;
}

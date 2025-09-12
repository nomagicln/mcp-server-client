import { register, Counter, Gauge, Histogram, collectDefaultMetrics } from 'prom-client';

export interface MCPSCMetrics {
  // Connection metrics
  activeConnections: Gauge<string>;
  connectionDuration: Histogram<string>;
  connectionErrors: Counter<string>;

  // Request metrics
  requestDuration: Histogram<string>;
  requestCount: Counter<string>;
  requestErrors: Counter<string>;

  // Resource metrics
  resourceLoadTime: Histogram<string>;
  resourceCount: Gauge<string>;
  resourceErrors: Counter<string>;

  // System metrics
  memoryUsage: Gauge<string>;
  cpuUsage: Gauge<string>;
  gcDuration: Histogram<string>;
}

export class MetricsCollector {
  private metrics!: MCPSCMetrics;
  private initialized = false;

  constructor() {
    this.initializeMetrics();
    this.startSystemMetricsCollection();
  }

  private initializeMetrics(): void {
    if (this.initialized) {
      return;
    }

    // Connection metrics
    this.metrics = {
      activeConnections: new Gauge({
        name: 'mcpsc_active_connections',
        help: 'Number of active connections by connector type',
        labelNames: ['connector_type'],
        registers: [register],
      }),

      connectionDuration: new Histogram({
        name: 'mcpsc_connection_duration_seconds',
        help: 'Duration of connections in seconds',
        labelNames: ['connector_type'],
        buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
        registers: [register],
      }),

      connectionErrors: new Counter({
        name: 'mcpsc_connection_errors_total',
        help: 'Total number of connection errors',
        labelNames: ['connector_type', 'error_type'],
        registers: [register],
      }),

      // Request metrics
      requestDuration: new Histogram({
        name: 'mcpsc_request_duration_seconds',
        help: 'Duration of requests in seconds',
        labelNames: ['method'],
        buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
        registers: [register],
      }),

      requestCount: new Counter({
        name: 'mcpsc_request_count_total',
        help: 'Total number of requests',
        labelNames: ['method', 'status'],
        registers: [register],
      }),

      requestErrors: new Counter({
        name: 'mcpsc_request_errors_total',
        help: 'Total number of request errors',
        labelNames: ['method', 'error_type'],
        registers: [register],
      }),

      // Resource metrics
      resourceLoadTime: new Histogram({
        name: 'mcpsc_resource_load_time_seconds',
        help: 'Time taken to load resources in seconds',
        labelNames: ['loader_type'],
        buckets: [0.01, 0.1, 0.5, 1, 5, 10],
        registers: [register],
      }),

      resourceCount: new Gauge({
        name: 'mcpsc_resource_count',
        help: 'Number of loaded resources by type',
        labelNames: ['resource_type'],
        registers: [register],
      }),

      resourceErrors: new Counter({
        name: 'mcpsc_resource_errors_total',
        help: 'Total number of resource errors',
        labelNames: ['resource_type', 'error_type'],
        registers: [register],
      }),

      // System metrics
      memoryUsage: new Gauge({
        name: 'mcpsc_memory_usage_bytes',
        help: 'Memory usage in bytes',
        registers: [register],
      }),

      cpuUsage: new Gauge({
        name: 'mcpsc_cpu_usage_percent',
        help: 'CPU usage percentage',
        registers: [register],
      }),

      gcDuration: new Histogram({
        name: 'mcpsc_gc_duration_seconds',
        help: 'Garbage collection duration in seconds',
        labelNames: ['gc_type'],
        buckets: [0.001, 0.01, 0.1, 1],
        registers: [register],
      }),
    };

    this.initialized = true;
  }

  private systemMetricsInterval?: NodeJS.Timeout;

  private startSystemMetricsCollection(): void {
    // Collect default Node.js metrics
    collectDefaultMetrics({ register });

    // Start periodic system metrics collection
    this.systemMetricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 5000); // Collect every 5 seconds
  }

  stop(): void {
    if (this.systemMetricsInterval) {
      clearInterval(this.systemMetricsInterval);
      delete this.systemMetricsInterval;
    }
  }

  private collectSystemMetrics(): void {
    // Memory usage
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage.set(memUsage.heapUsed);

    // CPU usage (simplified - in real implementation would use more sophisticated calculation)
    const cpuUsage = process.cpuUsage();
    const totalUsage = cpuUsage.user + cpuUsage.system;
    this.metrics.cpuUsage.set(totalUsage / 1000000); // Convert to percentage approximation
  }

  getMetrics(): MCPSCMetrics {
    return this.metrics;
  }

  // Connection metrics methods
  incrementActiveConnections(connectorType: string): void {
    this.metrics.activeConnections.inc({ connector_type: connectorType });
  }

  decrementActiveConnections(connectorType: string): void {
    this.metrics.activeConnections.dec({ connector_type: connectorType });
  }

  recordConnectionDuration(connectorType: string, duration: number): void {
    this.metrics.connectionDuration.observe({ connector_type: connectorType }, duration);
  }

  incrementConnectionErrors(connectorType: string, errorType: string): void {
    this.metrics.connectionErrors.inc({ connector_type: connectorType, error_type: errorType });
  }

  // Request metrics methods
  incrementRequestCount(method: string, status: string): void {
    this.metrics.requestCount.inc({ method, status });
  }

  recordRequestDuration(method: string, duration: number): void {
    this.metrics.requestDuration.observe({ method }, duration);
  }

  incrementRequestErrors(method: string, errorType: string): void {
    this.metrics.requestErrors.inc({ method, error_type: errorType });
  }

  // Resource metrics methods
  setResourceCount(resourceType: string, count: number): void {
    this.metrics.resourceCount.set({ resource_type: resourceType }, count);
  }

  recordResourceLoadTime(loaderType: string, duration: number): void {
    this.metrics.resourceLoadTime.observe({ loader_type: loaderType }, duration);
  }

  incrementResourceErrors(resourceType: string, errorType: string): void {
    this.metrics.resourceErrors.inc({ resource_type: resourceType, error_type: errorType });
  }

  // System metrics methods
  updateMemoryUsage(bytes: number): void {
    this.metrics.memoryUsage.set(bytes);
  }

  updateCpuUsage(percentage: number): void {
    this.metrics.cpuUsage.set(percentage);
  }

  recordGcDuration(gcType: string, duration: number): void {
    this.metrics.gcDuration.observe({ gc_type: gcType }, duration);
  }

  // Export methods
  async getPrometheusMetrics(): Promise<string> {
    return register.metrics();
  }

  reset(): void {
    register.resetMetrics();
  }
}

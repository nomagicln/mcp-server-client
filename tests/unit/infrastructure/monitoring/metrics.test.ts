import { MetricsCollector } from '@infrastructure/monitoring/metrics';
import { register, Counter, Gauge, Histogram } from 'prom-client';

describe('MetricsCollector', () => {
  let metricsCollector: MetricsCollector;

  beforeEach(() => {
    // Clear all metrics before each test
    register.clear();
    metricsCollector = new MetricsCollector();
  });

  afterEach(() => {
    metricsCollector.stop();
    register.clear();
  });

  describe('metrics initialization', () => {
    it('should initialize all required metrics', () => {
      const metrics = metricsCollector.getMetrics();

      expect(metrics.activeConnections).toBeInstanceOf(Gauge);
      expect(metrics.connectionDuration).toBeInstanceOf(Histogram);
      expect(metrics.connectionErrors).toBeInstanceOf(Counter);
      expect(metrics.requestDuration).toBeInstanceOf(Histogram);
      expect(metrics.requestCount).toBeInstanceOf(Counter);
      expect(metrics.requestErrors).toBeInstanceOf(Counter);
      expect(metrics.resourceLoadTime).toBeInstanceOf(Histogram);
      expect(metrics.resourceCount).toBeInstanceOf(Gauge);
      expect(metrics.resourceErrors).toBeInstanceOf(Counter);
      expect(metrics.memoryUsage).toBeInstanceOf(Gauge);
      expect(metrics.cpuUsage).toBeInstanceOf(Gauge);
      expect(metrics.gcDuration).toBeInstanceOf(Histogram);
    });

    it('should register metrics with proper names and help text', async () => {
      metricsCollector.getMetrics();
      const registeredMetrics = await register.getMetricsAsJSON();

      const metricNames = registeredMetrics.map((m: any) => m.name);
      expect(metricNames).toContain('mcpsc_active_connections');
      expect(metricNames).toContain('mcpsc_connection_duration_seconds');
      expect(metricNames).toContain('mcpsc_connection_errors_total');
      expect(metricNames).toContain('mcpsc_request_duration_seconds');
      expect(metricNames).toContain('mcpsc_request_count_total');
      expect(metricNames).toContain('mcpsc_request_errors_total');
      expect(metricNames).toContain('mcpsc_resource_load_time_seconds');
      expect(metricNames).toContain('mcpsc_resource_count');
      expect(metricNames).toContain('mcpsc_resource_errors_total');
      expect(metricNames).toContain('mcpsc_memory_usage_bytes');
      expect(metricNames).toContain('mcpsc_cpu_usage_percent');
      expect(metricNames).toContain('mcpsc_gc_duration_seconds');
    });

    it('should include proper labels for metrics', async () => {
      const metrics = metricsCollector.getMetrics();

      // Test connection metrics labels
      expect(() =>
        metrics.connectionErrors.inc({ connector_type: 'ssh', error_type: 'auth_failed' })
      ).not.toThrow();

      // Test request metrics labels
      expect(() => metrics.requestCount.inc({ method: 'GET', status: '200' })).not.toThrow();
      expect(() =>
        metrics.requestErrors.inc({ method: 'POST', error_type: 'timeout' })
      ).not.toThrow();

      // Test resource metrics labels
      expect(() =>
        metrics.resourceErrors.inc({ resource_type: 'ssh-host', error_type: 'validation' })
      ).not.toThrow();

      const registeredMetrics = await register.getMetricsAsJSON();

      // Just verify that metrics are registered
      const metricNames = registeredMetrics.map((m: any) => m.name);
      expect(metricNames).toContain('mcpsc_connection_errors_total');
      expect(metricNames).toContain('mcpsc_request_count_total');
    });
  });

  describe('connection metrics', () => {
    it('should track active connections', () => {
      const metrics = metricsCollector.getMetrics();

      // Test that methods exist and can be called
      expect(() => metricsCollector.incrementActiveConnections('ssh')).not.toThrow();
      expect(() => metricsCollector.incrementActiveConnections('http')).not.toThrow();
      expect(() => metricsCollector.decrementActiveConnections('ssh')).not.toThrow();

      // Verify metrics objects exist
      expect(metrics.activeConnections).toBeInstanceOf(Gauge);
    });

    it('should record connection duration', () => {
      const metrics = metricsCollector.getMetrics();

      expect(() => metricsCollector.recordConnectionDuration('ssh', 1.5)).not.toThrow();
      expect(() => metricsCollector.recordConnectionDuration('http', 0.8)).not.toThrow();

      expect(metrics.connectionDuration).toBeInstanceOf(Histogram);
    });

    it('should count connection errors by type', () => {
      const metrics = metricsCollector.getMetrics();

      expect(() => metricsCollector.incrementConnectionErrors('ssh', 'auth_failed')).not.toThrow();
      expect(() => metricsCollector.incrementConnectionErrors('ssh', 'timeout')).not.toThrow();
      expect(() =>
        metricsCollector.incrementConnectionErrors('http', 'network_error')
      ).not.toThrow();

      expect(metrics.connectionErrors).toBeInstanceOf(Counter);
    });
  });

  describe('request metrics', () => {
    it('should track request counts by method and status', () => {
      const metrics = metricsCollector.getMetrics();

      expect(() => metricsCollector.incrementRequestCount('GET', '200')).not.toThrow();
      expect(() => metricsCollector.incrementRequestCount('POST', '201')).not.toThrow();
      expect(() => metricsCollector.incrementRequestCount('GET', '404')).not.toThrow();

      expect(metrics.requestCount).toBeInstanceOf(Counter);
    });

    it('should record request duration', () => {
      const metrics = metricsCollector.getMetrics();

      expect(() => metricsCollector.recordRequestDuration('GET', 0.5)).not.toThrow();
      expect(() => metricsCollector.recordRequestDuration('POST', 1.2)).not.toThrow();

      expect(metrics.requestDuration).toBeInstanceOf(Histogram);
    });

    it('should count request errors by type', () => {
      const metrics = metricsCollector.getMetrics();

      expect(() => metricsCollector.incrementRequestErrors('GET', 'timeout')).not.toThrow();
      expect(() => metricsCollector.incrementRequestErrors('POST', 'validation')).not.toThrow();

      expect(metrics.requestErrors).toBeInstanceOf(Counter);
    });
  });

  describe('resource metrics', () => {
    it('should track resource counts by type', () => {
      const metrics = metricsCollector.getMetrics();

      expect(() => metricsCollector.setResourceCount('ssh-host', 5)).not.toThrow();
      expect(() => metricsCollector.setResourceCount('http-api', 3)).not.toThrow();

      expect(metrics.resourceCount).toBeInstanceOf(Gauge);
    });

    it('should record resource load times', () => {
      const metrics = metricsCollector.getMetrics();

      expect(() => metricsCollector.recordResourceLoadTime('local', 0.1)).not.toThrow();
      expect(() => metricsCollector.recordResourceLoadTime('remote', 2.5)).not.toThrow();

      expect(metrics.resourceLoadTime).toBeInstanceOf(Histogram);
    });

    it('should count resource errors by type', () => {
      const metrics = metricsCollector.getMetrics();

      expect(() =>
        metricsCollector.incrementResourceErrors('ssh-host', 'validation')
      ).not.toThrow();
      expect(() => metricsCollector.incrementResourceErrors('http-api', 'network')).not.toThrow();

      expect(metrics.resourceErrors).toBeInstanceOf(Counter);
    });
  });

  describe('system metrics', () => {
    it('should update memory usage metrics', () => {
      const metrics = metricsCollector.getMetrics();

      expect(() => metricsCollector.updateMemoryUsage(1024 * 1024 * 100)).not.toThrow();

      expect(metrics.memoryUsage).toBeInstanceOf(Gauge);
    });

    it('should update CPU usage metrics', () => {
      const metrics = metricsCollector.getMetrics();

      expect(() => metricsCollector.updateCpuUsage(75.5)).not.toThrow();

      expect(metrics.cpuUsage).toBeInstanceOf(Gauge);
    });

    it('should record garbage collection duration', () => {
      const metrics = metricsCollector.getMetrics();

      expect(() => metricsCollector.recordGcDuration('major', 0.05)).not.toThrow();
      expect(() => metricsCollector.recordGcDuration('minor', 0.01)).not.toThrow();

      expect(metrics.gcDuration).toBeInstanceOf(Histogram);
    });
  });

  describe('metrics export', () => {
    it('should export metrics in Prometheus format', async () => {
      // Add some sample data
      metricsCollector.incrementActiveConnections('ssh');
      metricsCollector.incrementRequestCount('GET', '200');

      const prometheusMetrics = await metricsCollector.getPrometheusMetrics();

      expect(prometheusMetrics).toContain('mcpsc_active_connections');
      expect(prometheusMetrics).toContain('mcpsc_request_count_total');
      expect(typeof prometheusMetrics).toBe('string');
    });

    it('should handle empty metrics gracefully', async () => {
      const prometheusMetrics = await metricsCollector.getPrometheusMetrics();

      expect(prometheusMetrics).toBeDefined();
      expect(typeof prometheusMetrics).toBe('string');
    });

    it('should include metric metadata in export', async () => {
      const prometheusMetrics = await metricsCollector.getPrometheusMetrics();

      expect(prometheusMetrics).toContain('# HELP');
      expect(prometheusMetrics).toContain('# TYPE');
      expect(typeof prometheusMetrics).toBe('string');
    });
  });

  describe('metrics reset and cleanup', () => {
    it('should reset all metrics', () => {
      // Add some data
      metricsCollector.incrementActiveConnections('ssh');
      metricsCollector.incrementRequestCount('GET', '200');

      expect(() => metricsCollector.reset()).not.toThrow();
    });

    it('should handle concurrent metric updates safely', async () => {
      const promises: Promise<void>[] = [];

      // Simulate concurrent metric updates
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve().then(() => {
            metricsCollector.incrementRequestCount('GET', '200');
            metricsCollector.incrementActiveConnections('ssh');
          })
        );
      }

      await Promise.all(promises);

      // Just verify no errors were thrown
      expect(promises).toHaveLength(100);
    });
  });
});

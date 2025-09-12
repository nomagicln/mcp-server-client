export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  checks: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  duration: number;
  message?: string;
  metadata?: Record<string, any>;
}

export class HealthChecker {
  private checks: Map<string, () => Promise<HealthCheck>> = new Map();
  private startTime: number = Date.now();

  addCheck(name: string, checkFn: () => Promise<HealthCheck>): void {
    this.checks.set(name, checkFn);
  }

  removeCheck(name: string): void {
    this.checks.delete(name);
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const checkResults: HealthCheck[] = [];

    for (const [name, checkFn] of this.checks) {
      try {
        const startTime = Date.now();
        const result = await checkFn();
        const duration = Date.now() - startTime;

        checkResults.push({
          ...result,
          name,
          duration,
        });
      } catch (error) {
        checkResults.push({
          name,
          status: 'fail',
          duration: 0,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const overallStatus = this.determineOverallStatus(checkResults);

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: process.env['npm_package_version'] || '0.1.0',
      checks: checkResults,
    };
  }

  private determineOverallStatus(checks: HealthCheck[]): 'healthy' | 'unhealthy' | 'degraded' {
    if (checks.length === 0) {
      return 'healthy';
    }

    const hasFailures = checks.some(check => check.status === 'fail');
    const hasWarnings = checks.some(check => check.status === 'warn');

    if (hasFailures) {
      return 'unhealthy';
    } else if (hasWarnings) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }
}

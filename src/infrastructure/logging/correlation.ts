import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';

interface CorrelationContext {
  correlationId: string;
  parentId?: string;
}

export class CorrelationManager {
  private static asyncLocalStorage = new AsyncLocalStorage<CorrelationContext>();
  private static contextStack: string[] = [];
  private static currentCorrelationId: string | undefined;

  /**
   * Generate a new correlation ID
   */
  static generateCorrelationId(prefix?: string): string {
    const uuid = randomUUID();
    return prefix && prefix.length > 0 ? `${prefix}-${uuid}` : uuid;
  }

  /**
   * Set the correlation ID for the current context
   */
  static setCorrelationId(correlationId: string): void {
    this.currentCorrelationId = correlationId;
  }

  /**
   * Get the current correlation ID
   */
  static getCorrelationId(): string | undefined {
    // First try to get from AsyncLocalStorage
    const context = this.asyncLocalStorage.getStore();
    if (context?.correlationId) {
      return context.correlationId;
    }
    // Fallback to static storage for synchronous contexts
    return this.currentCorrelationId;
  }

  /**
   * Clear the correlation ID
   */
  static clear(): void {
    this.contextStack = [];
    this.currentCorrelationId = undefined;
  }

  /**
   * Start a new trace with optional custom ID
   */
  static startTrace(customId?: string): string {
    const traceId = customId || this.generateCorrelationId('mcpsc');
    const currentId = this.getCorrelationId();

    if (currentId) {
      this.contextStack.push(currentId);
    }

    this.setCorrelationId(traceId);
    return traceId;
  }

  /**
   * End the current trace and restore previous context
   */
  static endTrace(): void {
    const previousId = this.contextStack.pop();
    if (previousId) {
      this.setCorrelationId(previousId);
    } else {
      this.currentCorrelationId = undefined;
    }
  }

  /**
   * Create an isolated context for async operations
   */
  static createIsolatedContext(correlationId: string): CorrelationContext {
    return { correlationId };
  }

  /**
   * Run a function within a specific correlation context
   */
  static runInContext<T>(context: CorrelationContext, fn: () => T): T {
    return this.asyncLocalStorage.run(context, fn);
  }

  /**
   * Extract correlation ID from request headers
   */
  static extractFromRequest(
    request: { headers: Record<string, string | string[] | undefined> },
    generateIfMissing: boolean = false
  ): string | undefined {
    const headerNames = [
      'x-correlation-id',
      'x-trace-id',
      'x-request-id',
      'correlation-id',
      'trace-id',
      'request-id',
    ];

    for (const headerName of headerNames) {
      const value = request.headers[headerName];
      if (value) {
        return Array.isArray(value) ? value[0] : value;
      }
    }

    return generateIfMissing ? this.generateCorrelationId('mcpsc') : undefined;
  }

  /**
   * Middleware function for request tracing
   */
  static middleware() {
    return (request: any, reply: any, next: any) => {
      const correlationId = this.extractFromRequest(request, true);

      if (correlationId) {
        this.runInContext({ correlationId }, () => {
          // Set response header
          if (reply && reply.header) {
            reply.header('x-correlation-id', correlationId);
          }
          next();
        });
      } else {
        next();
      }
    };
  }
}

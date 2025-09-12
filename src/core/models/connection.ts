/**
 * Connection model for active resource connections
 */
export interface Connection {
  id: string;
  resourceId: string;
  type: string;
  status: ConnectionStatus;
  metadata: ConnectionMetadata;
  createdAt: Date;
  lastUsed: Date;
  expiresAt?: Date;
}

/**
 * Connection status enumeration
 */
export enum ConnectionStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  SUSPENDED = 'suspended',
  EXPIRED = 'expired',
}

/**
 * Connection metadata
 */
export interface ConnectionMetadata {
  host?: string;
  port?: number;
  protocol?: string;
  version?: string;
  features?: string[];
  performance?: PerformanceMetrics;
  security?: ConnectionSecurity;
  statistics?: ConnectionStatistics;
  [key: string]: any;
}

/**
 * Performance metrics for connections
 */
export interface PerformanceMetrics {
  latency: number;
  throughput?: number;
  errorRate?: number;
  uptime?: number;
  lastMeasured: Date;
}

/**
 * Connection security information
 */
export interface ConnectionSecurity {
  encrypted: boolean;
  protocol?: string;
  cipherSuite?: string;
  certificateFingerprint?: string;
  authenticated: boolean;
  authMethod?: string;
  permissions?: string[];
}

/**
 * Connection statistics
 */
export interface ConnectionStatistics {
  requestCount: number;
  errorCount: number;
  bytesTransferred: number;
  averageResponseTime: number;
  lastActivity: Date;
}

/**
 * Connection pool model
 */
export interface ConnectionPool {
  id: string;
  resourceType: string;
  size: number;
  active: number;
  idle: number;
  pending?: number;
  maxSize: number;
  minSize: number;
  connections: Connection[];
  configuration: PoolConfiguration;
  statistics: PoolStatistics;
}

/**
 * Pool configuration
 */
export interface PoolConfiguration {
  maxSize: number;
  minSize: number;
  maxIdleTime: number;
  maxLifetime: number;
  acquireTimeout: number;
  validationInterval: number;
  evictionPolicy: 'lru' | 'fifo' | 'lifo';
}

/**
 * Pool statistics
 */
export interface PoolStatistics {
  totalCreated: number;
  totalDestroyed: number;
  totalAcquired: number;
  totalReleased: number;
  currentWaitTime: number;
  averageWaitTime: number;
  peakSize: number;
}

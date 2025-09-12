import { Resource } from '@core/models/resource';

/**
 * Core connector interface for resource connections
 */
export interface IConnector {
  readonly type: string;
  readonly supportedProtocols: string[];
  readonly capabilities: ConnectorCapability[];

  connect(resource: Resource): Promise<Connection>;
  test(resource: Resource, options?: TestOptions): Promise<TestResult>;
  disconnect(connection: Connection): Promise<void>;
  execute(connection: Connection, command: Command): Promise<ExecutionResult>;
  getConnectionPool(): ConnectionPool;
  getSupportedCommands(): CommandDefinition[];
}

/**
 * Connector capability definition
 */
export interface ConnectorCapability {
  name: string;
  description: string;
  parameters: ParameterDefinition[];
  security: SecurityRequirement[];
}

/**
 * Parameter definition for capabilities
 */
export interface ParameterDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  default?: any;
  validation?: ValidationRule[];
}

/**
 * Security requirement for capabilities
 */
export interface SecurityRequirement {
  type: 'authentication' | 'authorization' | 'encryption';
  method: string;
  required: boolean;
  description: string;
}

/**
 * Validation rule for parameters
 */
export interface ValidationRule {
  type: 'min' | 'max' | 'pattern' | 'enum' | 'custom';
  value: any;
  message?: string;
}

/**
 * Connection representation
 */
export interface Connection {
  id: string;
  resourceId: string;
  type: string;
  status: ConnectionStatus;
  metadata: ConnectionMetadata;
  createdAt: Date;
  lastUsed: Date;
}

/**
 * Connection status enumeration
 */
export enum ConnectionStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
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
}

/**
 * Test options for connection testing
 */
export interface TestOptions {
  timeout?: number;
  dryRun?: boolean;
  verbose?: boolean;
  retries?: number;
}

/**
 * Test result for connection testing
 */
export interface TestResult {
  success: boolean;
  latency?: number;
  error?: string;
  details?: string;
  metadata?: Record<string, any>;
}

/**
 * Command for execution
 */
export interface Command {
  type: string;
  parameters: Record<string, any>;
  timeout?: number;
  retryPolicy?: RetryPolicy;
  securityContext?: SecurityContext;
}

/**
 * Retry policy for commands
 */
export interface RetryPolicy {
  maxRetries: number;
  backoffStrategy: 'linear' | 'exponential';
  baseDelay: number;
  maxDelay: number;
}

/**
 * Security context for command execution
 */
export interface SecurityContext {
  userId?: string;
  permissions: string[];
  restrictions: string[];
  auditRequired: boolean;
  commandWhitelist?: string[];
  commandBlacklist?: string[];
  resourceLimits?: {
    maxExecutionTime?: number;
    maxMemory?: number;
    maxCpu?: number;
    maxOutputSize?: number;
  };
}

/**
 * Execution result
 */
export interface ExecutionResult {
  success: boolean;
  output?: any;
  error?: ExecutionError;
  metadata: ExecutionMetadata;
}

/**
 * Execution error details
 */
export interface ExecutionError {
  code: string;
  message: string;
  details?: any;
  recoverable: boolean;
}

/**
 * Execution metadata
 */
export interface ExecutionMetadata {
  executionTime: number;
  resourceUsage?: ResourceUsage;
  exitCode?: number;
  warnings?: string[];
  [key: string]: any;
}

/**
 * Resource usage metrics
 */
export interface ResourceUsage {
  cpu?: number;
  memory?: number;
  network?: number;
  disk?: number;
}

/**
 * Connection pool information
 */
export interface ConnectionPool {
  size: number;
  active: number;
  idle: number;
  pending?: number;
  maxSize?: number;
}

/**
 * Command definition
 */
export interface CommandDefinition {
  name: string;
  description: string;
  parameters: ParameterDefinition[];
  examples?: CommandExample[];
  security?: SecurityRequirement[];
}

/**
 * Command example
 */
export interface CommandExample {
  description: string;
  parameters: Record<string, any>;
  expectedOutput?: string;
}

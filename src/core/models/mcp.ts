/**
 * MCP protocol message models following JSON-RPC 2.0 specification
 */

/**
 * Base MCP message structure
 */
export interface MCPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: any;
}

/**
 * MCP response structure
 */
export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: MCPError;
}

/**
 * MCP error structure
 */
export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

/**
 * MCP notification (no response expected)
 */
export interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

/**
 * MCP session model
 */
export interface MCPSession {
  id: string;
  clientId: string;
  transport: string;
  state: SessionState;
  capabilities: SessionCapabilities;
  security: SessionSecurity;
  createdAt: Date;
  lastActivity: Date;
  metadata: SessionMetadata;
}

/**
 * Session state enumeration
 */
export enum SessionState {
  INITIALIZING = 'initializing',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  TERMINATED = 'terminated',
  ERROR = 'error',
}

/**
 * Session capabilities
 */
export interface SessionCapabilities {
  supportedMethods: string[];
  maxConcurrentRequests: number;
  timeoutSettings: TimeoutConfig;
  resourceAccess: ResourceAccessConfig[];
  features: string[];
}

/**
 * Timeout configuration
 */
export interface TimeoutConfig {
  request: number;
  response: number;
  idle: number;
  total: number;
}

/**
 * Resource access configuration
 */
export interface ResourceAccessConfig {
  resourceType: string;
  permissions: string[];
  restrictions: string[];
}

/**
 * Session security
 */
export interface SessionSecurity {
  authenticationMethod: string;
  authenticated: boolean;
  permissions: Permission[];
  rateLimits: RateLimit[];
  auditSettings: AuditConfig;
  encryptionEnabled: boolean;
}

/**
 * Permission model
 */
export interface Permission {
  action: string;
  resource: string;
  conditions?: Record<string, any>;
  granted: boolean;
  grantedAt: Date;
  expiresAt?: Date;
}

/**
 * Rate limit configuration
 */
export interface RateLimit {
  type: 'requests' | 'bandwidth' | 'concurrent';
  limit: number;
  window: number;
  burst?: number;
  current: number;
  resetAt: Date;
}

/**
 * Audit configuration
 */
export interface AuditConfig {
  enabled: boolean;
  level: 'minimal' | 'standard' | 'detailed';
  events: string[];
  retention: number;
}

/**
 * Session metadata
 */
export interface SessionMetadata {
  userAgent?: string;
  clientVersion?: string;
  serverVersion?: string;
  protocol?: string;
  remoteAddress?: string;
  startTime: Date;
  statistics: SessionStatistics;
  [key: string]: any;
}

/**
 * Session statistics
 */
export interface SessionStatistics {
  requestCount: number;
  responseCount: number;
  errorCount: number;
  bytesReceived: number;
  bytesSent: number;
  averageResponseTime: number;
  lastRequestAt?: Date;
  lastResponseAt?: Date;
}

/**
 * MCP server capabilities
 */
export interface MCPServerCapabilities {
  transports: TransportCapability[];
  methods: MethodCapability[];
  resources: ResourceCapability[];
  security: SecurityCapability[];
  monitoring: MonitoringCapability[];
}

/**
 * Transport capability
 */
export interface TransportCapability {
  name: string;
  version: string;
  features: string[];
  configuration: Record<string, any>;
}

/**
 * Method capability
 */
export interface MethodCapability {
  name: string;
  description: string;
  parameters: ParameterSpec[];
  returns: ReturnSpec;
  errors: ErrorSpec[];
}

/**
 * Parameter specification
 */
export interface ParameterSpec {
  name: string;
  type: string;
  required: boolean;
  description: string;
  default?: any;
}

/**
 * Return specification
 */
export interface ReturnSpec {
  type: string;
  description: string;
  schema?: any;
}

/**
 * Error specification
 */
export interface ErrorSpec {
  code: number;
  message: string;
  description: string;
}

/**
 * Resource capability
 */
export interface ResourceCapability {
  type: string;
  operations: string[];
  authentication: string[];
  encryption: boolean;
}

/**
 * Security capability
 */
export interface SecurityCapability {
  authentication: string[];
  authorization: boolean;
  encryption: string[];
  audit: boolean;
}

/**
 * Monitoring capability
 */
export interface MonitoringCapability {
  metrics: boolean;
  healthChecks: boolean;
  logging: string[];
  tracing: boolean;
}

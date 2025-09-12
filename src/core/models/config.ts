/**
 * Main configuration model for mcpsc
 */
export interface MCPSCConfig {
  server: ServerConfig;
  client: ClientConfig;
  resources: ResourcesConfig;
  security: SecurityConfig;
  monitoring: MonitoringConfig;
  logging: LoggingConfig;
}

/**
 * Server configuration
 */
export interface ServerConfig {
  transports: TransportConfig[];
  host: string;
  port: number;
  tls?: TLSConfig;
  cors?: CORSConfig;
  middleware?: MiddlewareConfig[];
  limits?: ServerLimits;
}

/**
 * Transport configuration
 */
export interface TransportConfig {
  type: 'stdio' | 'sse' | 'http';
  enabled: boolean;
  options: Record<string, any>;
  security?: TransportSecurity;
}

/**
 * Transport security configuration
 */
export interface TransportSecurity {
  authentication: boolean;
  encryption: boolean;
  rateLimiting?: RateLimitConfig;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  enabled: boolean;
  requests: number;
  window: number;
  burst?: number;
}

/**
 * TLS configuration
 */
export interface TLSConfig {
  cert: string;
  key: string;
  ca?: string;
  minVersion?: string;
  maxVersion?: string;
  cipherSuites?: string[];
  rejectUnauthorized?: boolean;
}

/**
 * CORS configuration
 */
export interface CORSConfig {
  origin: string | string[] | boolean;
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

/**
 * Middleware configuration
 */
export interface MiddlewareConfig {
  name: string;
  enabled: boolean;
  options: Record<string, any>;
  order: number;
}

/**
 * Server limits configuration
 */
export interface ServerLimits {
  maxConnections: number;
  maxRequestSize: number;
  maxResponseSize: number;
  requestTimeout: number;
  keepAliveTimeout: number;
}

/**
 * Client configuration
 */
export interface ClientConfig {
  defaultTransport: string;
  timeout: number;
  retries: number;
  authentication?: ClientAuthentication;
  connections?: ClientConnectionConfig;
}

/**
 * Client authentication configuration
 */
export interface ClientAuthentication {
  type: string;
  credentials: Record<string, string>;
  refreshToken?: string;
  tokenEndpoint?: string;
}

/**
 * Client connection configuration
 */
export interface ClientConnectionConfig {
  poolSize: number;
  keepAlive: boolean;
  timeout: number;
  retryDelay: number;
}

/**
 * Resources configuration
 */
export interface ResourcesConfig {
  loaders: LoaderConfig[];
  registry: RegistryConfig;
  validation: ValidationConfig;
  caching?: CachingConfig;
}

/**
 * Loader configuration
 */
export interface LoaderConfig {
  type: 'local' | 'remote';
  source: string;
  enabled: boolean;
  options: Record<string, any>;
  authentication?: AuthConfig;
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  type: string;
  credentials: Record<string, string>;
  headers?: Record<string, string>;
}

/**
 * Registry configuration
 */
export interface RegistryConfig {
  autoRefresh: boolean;
  refreshInterval: number;
  maxResources: number;
  enableWatching: boolean;
}

/**
 * Validation configuration
 */
export interface ValidationConfig {
  strict: boolean;
  schemas: Record<string, any>;
  customValidators?: string[];
}

/**
 * Caching configuration
 */
export interface CachingConfig {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  strategy: 'lru' | 'fifo' | 'ttl';
  persistence?: PersistenceConfig;
}

/**
 * Persistence configuration
 */
export interface PersistenceConfig {
  enabled: boolean;
  path: string;
  format: 'json' | 'binary';
  compression?: boolean;
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  authentication: AuthenticationConfig;
  authorization: AuthorizationConfig;
  encryption: EncryptionConfig;
  audit: AuditConfig;
  policies: PolicyConfig[];
}

/**
 * Authentication configuration
 */
export interface AuthenticationConfig {
  required: boolean;
  methods: string[];
  timeout: number;
  maxRetries: number;
  lockoutDuration?: number;
}

/**
 * Authorization configuration
 */
export interface AuthorizationConfig {
  enabled: boolean;
  defaultPolicy: 'allow' | 'deny';
  roles: RoleConfig[];
  permissions: PermissionConfig[];
}

/**
 * Role configuration
 */
export interface RoleConfig {
  name: string;
  description: string;
  permissions: string[];
  inherits?: string[];
}

/**
 * Permission configuration
 */
export interface PermissionConfig {
  name: string;
  description: string;
  actions: string[];
  resources: string[];
}

/**
 * Encryption configuration
 */
export interface EncryptionConfig {
  algorithm: string;
  keySize: number;
  keyDerivation: string;
  saltLength: number;
  iterations?: number;
}

/**
 * Audit configuration
 */
export interface AuditConfig {
  enabled: boolean;
  level: 'minimal' | 'standard' | 'detailed';
  events: string[];
  retention: number;
  destination: string;
  format: 'json' | 'text' | 'syslog';
}

/**
 * Policy configuration
 */
export interface PolicyConfig {
  name: string;
  description: string;
  rules: PolicyRule[];
  enabled: boolean;
}

/**
 * Policy rule
 */
export interface PolicyRule {
  action: string;
  resource: string;
  effect: 'allow' | 'deny';
  conditions?: Record<string, any>;
  priority: number;
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  enabled: boolean;
  metrics: MetricsConfig;
  healthChecks: HealthCheckConfig;
  alerting?: AlertingConfig;
}

/**
 * Metrics configuration
 */
export interface MetricsConfig {
  enabled: boolean;
  endpoint: string;
  interval: number;
  retention: number;
  labels?: Record<string, string>;
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  enabled: boolean;
  endpoint: string;
  interval: number;
  timeout: number;
  dependencies: DependencyCheck[];
}

/**
 * Dependency check configuration
 */
export interface DependencyCheck {
  name: string;
  type: string;
  target: string;
  timeout: number;
  critical: boolean;
}

/**
 * Alerting configuration
 */
export interface AlertingConfig {
  enabled: boolean;
  channels: AlertChannel[];
  rules: AlertRule[];
}

/**
 * Alert channel configuration
 */
export interface AlertChannel {
  name: string;
  type: string;
  configuration: Record<string, any>;
  enabled: boolean;
}

/**
 * Alert rule configuration
 */
export interface AlertRule {
  name: string;
  condition: string;
  threshold: number;
  duration: number;
  channels: string[];
  enabled: boolean;
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text' | 'pretty';
  output: LogOutput[];
  correlation: CorrelationConfig;
  masking: MaskingConfig;
}

/**
 * Log output configuration
 */
export interface LogOutput {
  type: 'console' | 'file' | 'syslog' | 'http';
  target?: string;
  level?: string;
  format?: string;
  options?: Record<string, any>;
}

/**
 * Correlation configuration
 */
export interface CorrelationConfig {
  enabled: boolean;
  header: string;
  generator: 'uuid' | 'nanoid' | 'custom';
  propagate: boolean;
}

/**
 * Masking configuration
 */
export interface MaskingConfig {
  enabled: boolean;
  fields: string[];
  replacement: string;
  showSecrets: boolean;
}

import { z } from 'zod';

/**
 * Transport configuration schema
 */
export const TransportConfigSchema = z.object({
  type: z.enum(['stdio', 'sse', 'http']),
  enabled: z.boolean(),
  options: z.record(z.any()),
  security: z
    .object({
      authentication: z.boolean(),
      encryption: z.boolean(),
      rateLimiting: z
        .object({
          enabled: z.boolean(),
          requests: z.number().positive(),
          window: z.number().positive(),
          burst: z.number().positive().optional(),
        })
        .optional(),
    })
    .optional(),
});

/**
 * TLS configuration schema
 */
export const TLSConfigSchema = z.object({
  cert: z.string().min(1),
  key: z.string().min(1),
  ca: z.string().optional(),
  minVersion: z.enum(['TLSv1.2', 'TLSv1.3']).optional(),
  maxVersion: z.enum(['TLSv1.2', 'TLSv1.3']).optional(),
  cipherSuites: z.array(z.string()).optional(),
  rejectUnauthorized: z.boolean().optional(),
});

/**
 * CORS configuration schema
 */
export const CORSConfigSchema = z.object({
  origin: z.union([z.string(), z.array(z.string()), z.boolean()]),
  methods: z.array(z.string()).optional(),
  allowedHeaders: z.array(z.string()).optional(),
  exposedHeaders: z.array(z.string()).optional(),
  credentials: z.boolean().optional(),
  maxAge: z.number().positive().optional(),
});

/**
 * Middleware configuration schema
 */
export const MiddlewareConfigSchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean(),
  options: z.record(z.any()),
  order: z.number().int().min(0),
});

/**
 * Server limits configuration schema
 */
export const ServerLimitsSchema = z.object({
  maxConnections: z.number().positive(),
  maxRequestSize: z.number().positive(),
  maxResponseSize: z.number().positive(),
  requestTimeout: z.number().positive(),
  keepAliveTimeout: z.number().positive(),
});

/**
 * Server configuration schema
 */
export const ServerConfigSchema = z.object({
  transports: z.array(TransportConfigSchema).min(1),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  tls: TLSConfigSchema.optional(),
  cors: CORSConfigSchema.optional(),
  middleware: z.array(MiddlewareConfigSchema).optional(),
  limits: ServerLimitsSchema.optional(),
});

/**
 * Client authentication configuration schema
 */
export const ClientAuthenticationSchema = z.object({
  type: z.string().min(1),
  credentials: z.record(z.string()),
  refreshToken: z.string().optional(),
  tokenEndpoint: z.string().url().optional(),
});

/**
 * Client connection configuration schema
 */
export const ClientConnectionConfigSchema = z.object({
  poolSize: z.number().positive(),
  keepAlive: z.boolean(),
  timeout: z.number().positive(),
  retryDelay: z.number().positive(),
});

/**
 * Client configuration schema
 */
export const ClientConfigSchema = z.object({
  defaultTransport: z.string().min(1),
  timeout: z.number().positive(),
  retries: z.number().int().min(0),
  authentication: ClientAuthenticationSchema.optional(),
  connections: ClientConnectionConfigSchema.optional(),
});

/**
 * Authentication configuration schema
 */
export const AuthConfigSchema = z.object({
  type: z.string().min(1),
  credentials: z.record(z.string()),
  headers: z.record(z.string()).optional(),
});

/**
 * Loader configuration schema
 */
export const LoaderConfigSchema = z.object({
  type: z.enum(['local', 'remote']),
  source: z.string().min(1),
  enabled: z.boolean(),
  options: z.record(z.any()),
  authentication: AuthConfigSchema.optional(),
});

/**
 * Registry configuration schema
 */
export const RegistryConfigSchema = z.object({
  autoRefresh: z.boolean(),
  refreshInterval: z.number().positive(),
  maxResources: z.number().positive(),
  enableWatching: z.boolean(),
});

/**
 * Validation configuration schema
 */
export const ValidationConfigSchema = z.object({
  strict: z.boolean(),
  schemas: z.record(z.any()),
  customValidators: z.array(z.string()).optional(),
});

/**
 * Persistence configuration schema
 */
export const PersistenceConfigSchema = z.object({
  enabled: z.boolean(),
  path: z.string().min(1),
  format: z.enum(['json', 'binary']),
  compression: z.boolean().optional(),
});

/**
 * Caching configuration schema
 */
export const CachingConfigSchema = z.object({
  enabled: z.boolean(),
  ttl: z.number().positive(),
  maxSize: z.number().positive(),
  strategy: z.enum(['lru', 'fifo', 'ttl']),
  persistence: PersistenceConfigSchema.optional(),
});

/**
 * Resources configuration schema
 */
export const ResourcesConfigSchema = z.object({
  loaders: z.array(LoaderConfigSchema),
  registry: RegistryConfigSchema,
  validation: ValidationConfigSchema,
  caching: CachingConfigSchema.optional(),
});

/**
 * Authentication configuration schema
 */
export const AuthenticationConfigSchema = z.object({
  required: z.boolean(),
  methods: z.array(z.string()),
  timeout: z.number().positive(),
  maxRetries: z.number().int().min(0),
  lockoutDuration: z.number().positive().optional(),
});

/**
 * Role configuration schema
 */
export const RoleConfigSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  permissions: z.array(z.string()),
  inherits: z.array(z.string()).optional(),
});

/**
 * Permission configuration schema
 */
export const PermissionConfigSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  actions: z.array(z.string()),
  resources: z.array(z.string()),
});

/**
 * Authorization configuration schema
 */
export const AuthorizationConfigSchema = z.object({
  enabled: z.boolean(),
  defaultPolicy: z.enum(['allow', 'deny']),
  roles: z.array(RoleConfigSchema),
  permissions: z.array(PermissionConfigSchema),
});

/**
 * Encryption configuration schema
 */
export const EncryptionConfigSchema = z.object({
  algorithm: z.string().min(1),
  keySize: z.number().positive(),
  keyDerivation: z.string().min(1),
  saltLength: z.number().positive(),
  iterations: z.number().positive().optional(),
});

/**
 * Audit configuration schema
 */
export const AuditConfigSchema = z.object({
  enabled: z.boolean(),
  level: z.enum(['minimal', 'standard', 'detailed']),
  events: z.array(z.string()),
  retention: z.number().positive(),
  destination: z.string().min(1),
  format: z.enum(['json', 'text', 'syslog']),
});

/**
 * Policy rule schema
 */
export const PolicyRuleSchema = z.object({
  action: z.string().min(1),
  resource: z.string().min(1),
  effect: z.enum(['allow', 'deny']),
  conditions: z.record(z.any()).optional(),
  priority: z.number().int().min(0),
});

/**
 * Policy configuration schema
 */
export const PolicyConfigSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  rules: z.array(PolicyRuleSchema),
  enabled: z.boolean(),
});

/**
 * Security configuration schema
 */
export const SecurityConfigSchema = z.object({
  authentication: AuthenticationConfigSchema,
  authorization: AuthorizationConfigSchema,
  encryption: EncryptionConfigSchema,
  audit: AuditConfigSchema,
  policies: z.array(PolicyConfigSchema),
});

/**
 * Metrics configuration schema
 */
export const MetricsConfigSchema = z.object({
  enabled: z.boolean(),
  endpoint: z.string().min(1),
  interval: z.number().positive(),
  retention: z.number().positive(),
  labels: z.record(z.string()).optional(),
});

/**
 * Dependency check configuration schema
 */
export const DependencyCheckSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  target: z.string().min(1),
  timeout: z.number().positive(),
  critical: z.boolean(),
});

/**
 * Health check configuration schema
 */
export const HealthCheckConfigSchema = z.object({
  enabled: z.boolean(),
  endpoint: z.string().min(1),
  interval: z.number().positive(),
  timeout: z.number().positive(),
  dependencies: z.array(DependencyCheckSchema),
});

/**
 * Alert channel configuration schema
 */
export const AlertChannelSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  configuration: z.record(z.any()),
  enabled: z.boolean(),
});

/**
 * Alert rule configuration schema
 */
export const AlertRuleSchema = z.object({
  name: z.string().min(1),
  condition: z.string().min(1),
  threshold: z.number(),
  duration: z.number().positive(),
  channels: z.array(z.string()),
  enabled: z.boolean(),
});

/**
 * Alerting configuration schema
 */
export const AlertingConfigSchema = z.object({
  enabled: z.boolean(),
  channels: z.array(AlertChannelSchema),
  rules: z.array(AlertRuleSchema),
});

/**
 * Monitoring configuration schema
 */
export const MonitoringConfigSchema = z.object({
  enabled: z.boolean(),
  metrics: MetricsConfigSchema,
  healthChecks: HealthCheckConfigSchema,
  alerting: AlertingConfigSchema.optional(),
});

/**
 * Log output configuration schema
 */
export const LogOutputSchema = z.object({
  type: z.enum(['console', 'file', 'syslog', 'http']),
  target: z.string().optional(),
  level: z.string().optional(),
  format: z.string().optional(),
  options: z.record(z.any()).optional(),
});

/**
 * Correlation configuration schema
 */
export const CorrelationConfigSchema = z.object({
  enabled: z.boolean(),
  header: z.string().min(1),
  generator: z.enum(['uuid', 'nanoid', 'custom']),
  propagate: z.boolean(),
});

/**
 * Masking configuration schema
 */
export const MaskingConfigSchema = z.object({
  enabled: z.boolean(),
  fields: z.array(z.string()),
  replacement: z.string(),
  showSecrets: z.boolean(),
});

/**
 * Logging configuration schema
 */
export const LoggingConfigSchema = z.object({
  level: z.enum(['trace', 'debug', 'info', 'warn', 'error']),
  format: z.enum(['json', 'text', 'pretty']),
  output: z.array(LogOutputSchema),
  correlation: CorrelationConfigSchema,
  masking: MaskingConfigSchema,
});

/**
 * Main MCPSC configuration schema
 */
export const MCPSCConfigSchema = z.object({
  server: ServerConfigSchema,
  client: ClientConfigSchema,
  resources: ResourcesConfigSchema,
  security: SecurityConfigSchema,
  monitoring: MonitoringConfigSchema,
  logging: LoggingConfigSchema,
});

/**
 * Partial configuration schema for merging
 */
export const PartialMCPSCConfigSchema = z.object({
  server: ServerConfigSchema.partial().optional(),
  client: ClientConfigSchema.partial().optional(),
  resources: ResourcesConfigSchema.partial().optional(),
  security: SecurityConfigSchema.partial().optional(),
  monitoring: MonitoringConfigSchema.partial().optional(),
  logging: LoggingConfigSchema.partial().optional(),
});

export type MCPSCConfigType = z.infer<typeof MCPSCConfigSchema>;
export type PartialMCPSCConfigType = z.infer<typeof PartialMCPSCConfigSchema>;

/**
 * Core models exports
 */

// Resource models
export * from '@core/models/resource';
export * from '@core/models/resource-validator';

// Connection models
export * from '@core/models/connection';

// MCP models - export specific types to avoid conflicts
export type { MCPMessage, MCPResponse, MCPError } from '@core/models/mcp';

// Configuration models - export specific types to avoid conflicts
export type {
  MCPSCConfig,
  ServerConfig,
  ClientConfig,
  ResourcesConfig,
  MonitoringConfig,
  LoggingConfig,
  TransportConfig,
  TLSConfig,
  CORSConfig,
  MiddlewareConfig,
  ServerLimits,
  ClientAuthentication,
  ClientConnectionConfig,
  LoaderConfig,
  RegistryConfig,
  ValidationConfig,
  MetricsConfig,
  DependencyCheck,
  AlertingConfig,
  AlertChannel,
  AlertRule,
  LogOutput,
  CorrelationConfig,
  MaskingConfig,
} from '@core/models/config';

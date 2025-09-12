import { Resource, ResourceType } from '@core/models/resource';

/**
 * Core resource loader interface
 */
export interface IResourceLoader {
  readonly source: string;
  readonly supportedTypes: ResourceType[];

  load(config: LoaderConfig): Promise<Resource[]>;
  validate(resource: Resource): ValidationResult;
  watch(callback: ResourceChangeCallback): void;
  refresh(): Promise<void>;
}

/**
 * Loader configuration
 */
export interface LoaderConfig {
  path?: string;
  url?: string;
  format?: 'json' | 'yaml' | 'js' | 'ts';
  recursive?: boolean;
  filter?: ResourceFilter;
  authentication?: AuthenticationConfig;
  caching?: CachingConfig;
  retryConfig?: RetryConfig;
  securityChecks?: SecurityChecks;
}

/**
 * Resource filter for selective loading
 */
export interface ResourceFilter {
  types?: ResourceType[];
  groups?: string[];
  tags?: string[];
  enabled?: boolean;
  pattern?: string;
}

/**
 * Authentication configuration for remote loaders
 */
export interface AuthenticationConfig {
  type: 'basic' | 'bearer' | 'apikey' | 'certificate';
  credentials: Record<string, string>;
  headers?: Record<string, string>;
}

/**
 * Caching configuration
 */
export interface CachingConfig {
  enabled: boolean;
  ttl: number;
  maxSize?: number;
  strategy?: 'lru' | 'fifo' | 'ttl';
}

/**
 * Retry configuration for network requests
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBase: number;
}

/**
 * Security checks configuration
 */
export interface SecurityChecks {
  allowLocalhost?: boolean;
  allowPrivateIPs?: boolean;
  maxResponseSize?: number;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
  metadata?: ValidationMetadata;
}

/**
 * Validation metadata
 */
export interface ValidationMetadata {
  schema?: string;
  version?: string;
  validatedAt: Date;
  validatedBy?: string;
}

/**
 * Resource change callback function type
 */
export type ResourceChangeCallback = (event: ResourceChangeEvent) => void;

/**
 * Resource change event
 */
export interface ResourceChangeEvent {
  type: 'added' | 'updated' | 'removed';
  resource: Resource;
  timestamp: Date;
  source: string;
  metadata?: Record<string, any>;
}

/**
 * Resource registry interface for centralized management
 */
export interface IResourceRegistry {
  add(resource: Resource): Promise<void>;
  remove(id: string): Promise<void>;
  update(id: string, updates: Partial<Resource>): Promise<void>;
  get(id: string): Promise<Resource | null>;
  list(filter?: ResourceFilter): Promise<Resource[]>;
  enable(id: string): Promise<void>;
  disable(id: string): Promise<void>;
  refresh(): Promise<void>;
  watch(callback: ResourceChangeCallback): void;
}

/**
 * Resource metadata interface
 */
export interface ResourceMetadata {
  description?: string;
  version?: string;
  owner?: string;
  environment?: string;
  region?: string;
  cost?: number;
  dependencies?: string[];
  healthCheck?: HealthCheckConfig;
  [key: string]: any;
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  enabled: boolean;
  interval: number;
  timeout: number;
  retries: number;
  endpoint?: string;
  method?: string;
  expectedStatus?: number;
}

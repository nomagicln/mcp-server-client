import { ResourceMetadata } from '@core/interfaces/resource';

/**
 * Resource type enumeration
 */
export enum ResourceType {
  SSH_HOST = 'ssh-host',
  HTTP_API = 'http-api',
  DATABASE = 'database',
  KUBERNETES = 'kubernetes',
}

/**
 * Core resource model
 */
export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  group?: string;
  enabled: boolean;
  metadata: ResourceMetadata;
  connection: ConnectionConfig;
  security: SecurityConfig;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Connection configuration for resources
 */
export interface ConnectionConfig {
  host?: string;
  port?: number;
  protocol?: string;
  path?: string;
  url?: string;
  timeout?: number;
  retries?: number;
  keepAlive?: boolean;
  poolSize?: number;
  [key: string]: any;
}

/**
 * Security configuration for resources
 */
export interface SecurityConfig {
  authentication?: AuthenticationMethod;
  encryption?: EncryptionConfig;
  authorization?: AuthorizationConfig;
  audit?: AuditConfig;
  restrictions?: SecurityRestriction[];
}

/**
 * Authentication method configuration
 */
export interface AuthenticationMethod {
  type: 'none' | 'password' | 'key' | 'certificate' | 'token' | 'oauth';
  credentials?: Record<string, string>;
  keyPath?: string;
  certificatePath?: string;
  tokenEndpoint?: string;
  scopes?: string[];
}

/**
 * Encryption configuration
 */
export interface EncryptionConfig {
  enabled: boolean;
  protocol?: string;
  cipherSuites?: string[];
  keyExchange?: string;
  verification?: 'strict' | 'relaxed' | 'none';
}

/**
 * Authorization configuration
 */
export interface AuthorizationConfig {
  enabled: boolean;
  roles?: string[];
  permissions?: string[];
  policies?: PolicyRule[];
}

/**
 * Policy rule for authorization
 */
export interface PolicyRule {
  action: string;
  resource: string;
  effect: 'allow' | 'deny';
  conditions?: Record<string, any>;
}

/**
 * Audit configuration
 */
export interface AuditConfig {
  enabled: boolean;
  level: 'minimal' | 'standard' | 'detailed';
  retention: number;
  destination?: string;
  format?: 'json' | 'text' | 'syslog';
}

/**
 * Security restriction
 */
export interface SecurityRestriction {
  type: 'ip' | 'time' | 'command' | 'resource';
  rule: string;
  description?: string;
}

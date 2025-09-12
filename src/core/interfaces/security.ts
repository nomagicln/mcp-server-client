/**
 * Security management interfaces for mcpsc
 */

/**
 * Core security manager interface
 */
export interface ISecurityManager {
  authenticate(method: string, credentials: any): Promise<AuthenticationResult>;
  authorize(
    context: SessionContext,
    action: string,
    resource?: string
  ): Promise<AuthorizationResult>;
  validateToken(token: string): Promise<TokenValidationResult>;
  refreshToken(token: string): Promise<TokenRefreshResult>;
  revokeToken(token: string): Promise<void>;
  enforcePolicy(
    policy: SecurityPolicy,
    context: SessionContext,
    action: string,
    resource?: string
  ): Promise<PolicyEnforcementResult>;
  auditEvent(event: SecurityAuditEvent): Promise<void>;
  encryptData(data: string, key?: string): Promise<string>;
  decryptData(encryptedData: string, key?: string): Promise<string>;
  hashPassword(password: string): Promise<string>;
  verifyPassword(password: string, hash: string): Promise<boolean>;
  generateSecureToken(length?: number): Promise<string>;
  validateSecurityContext(context: SessionContext): Promise<SecurityValidationResult>;
}

/**
 * Session manager interface
 */
export interface ISessionManager {
  createSession(context: SessionContext): Promise<Session>;
  getSession(sessionId: string): Promise<Session | null>;
  updateSession(sessionId: string, updates: Partial<Session>): Promise<void>;
  terminateSession(sessionId: string, reason?: string): Promise<void>;
  listSessions(filter?: SessionFilter): Promise<Session[]>;
  validateSession(sessionId: string): Promise<SessionValidationResult>;
  refreshSession(sessionId: string): Promise<Session>;
  cleanupExpiredSessions(): Promise<CleanupResult>;
  getSessionStatistics(): Promise<SessionStatistics>;
}

/**
 * Session context for security operations
 */
export interface SessionContext {
  userId: string;
  sessionId: string;
  permissions: string[];
  roles: string[];
  metadata: Record<string, any>;
  remoteAddress?: string;
  userAgent?: string;
  createdAt?: Date;
  lastActivity?: Date;
}

/**
 * Authentication result
 */
export interface AuthenticationResult {
  success: boolean;
  userId?: string;
  token?: string;
  refreshToken?: string;
  expiresAt?: Date;
  permissions?: string[];
  roles?: string[];
  metadata?: Record<string, any>;
  error?: string;
  attempts?: number;
  lockedUntil?: Date;
}

/**
 * Authorization result
 */
export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
  requiredPermissions?: string[];
  appliedPolicies?: string[];
  conditions?: Record<string, any>;
}

/**
 * Token validation result
 */
export interface TokenValidationResult {
  valid: boolean;
  userId?: string;
  permissions?: string[];
  roles?: string[];
  expiresAt?: Date;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Token refresh result
 */
export interface TokenRefreshResult {
  success: boolean;
  token?: string;
  refreshToken?: string;
  expiresAt?: Date;
  error?: string;
}

/**
 * Security policy definition
 */
export interface SecurityPolicy {
  id: string;
  name: string;
  description?: string;
  rules: PolicyRule[];
  enabled: boolean;
  priority: number;
  conditions?: PolicyCondition[];
  metadata?: Record<string, any>;
}

/**
 * Policy rule
 */
export interface PolicyRule {
  id: string;
  action: string;
  resource: string;
  effect: 'allow' | 'deny';
  conditions?: PolicyCondition[];
  priority: number;
}

/**
 * Policy condition
 */
export interface PolicyCondition {
  type: 'time' | 'ip' | 'role' | 'permission' | 'custom';
  operator: 'equals' | 'contains' | 'matches' | 'in' | 'not_in';
  value: any;
  metadata?: Record<string, any>;
}

/**
 * Policy enforcement result
 */
export interface PolicyEnforcementResult {
  allowed: boolean;
  violations: PolicyViolation[];
  appliedRules: string[];
  metadata?: Record<string, any>;
}

/**
 * Policy violation
 */
export interface PolicyViolation {
  ruleId: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

/**
 * Security audit event
 */
export interface SecurityAuditEvent {
  type: 'authentication' | 'authorization' | 'access' | 'modification' | 'error';
  userId?: string;
  sessionId?: string;
  action: string;
  resource?: string;
  timestamp: Date;
  success: boolean;
  error?: string;
  metadata: Record<string, any>;
  remoteAddress?: string;
  userAgent?: string;
}

/**
 * Security validation result
 */
export interface SecurityValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  recommendations?: string[];
}

/**
 * Session model
 */
export interface Session {
  id: string;
  userId: string;
  state: SessionState;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  metadata: Record<string, any>;
  permissions: string[];
  roles: string[];
  remoteAddress?: string;
  userAgent?: string;
  terminatedAt?: Date;
  terminationReason?: string;
}

/**
 * Session state enumeration
 */
export enum SessionState {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  EXPIRED = 'expired',
  TERMINATED = 'terminated',
}

/**
 * Session filter for listing sessions
 */
export interface SessionFilter {
  userId?: string;
  state?: SessionState;
  createdAfter?: Date;
  createdBefore?: Date;
  lastActivityAfter?: Date;
  lastActivityBefore?: Date;
  remoteAddress?: string;
  limit?: number;
  offset?: number;
}

/**
 * Session validation result
 */
export interface SessionValidationResult {
  valid: boolean;
  session?: Session;
  reason?: string;
  error?: string;
}

/**
 * Cleanup result for expired sessions
 */
export interface CleanupResult {
  cleaned: number;
  errors: number;
  details?: string[];
}

/**
 * Session statistics
 */
export interface SessionStatistics {
  total: number;
  active: number;
  suspended: number;
  expired: number;
  terminated: number;
  averageDuration: number;
  peakConcurrent: number;
  createdToday: number;
  terminatedToday: number;
}

/**
 * Authentication method configuration
 */
export interface AuthenticationMethod {
  type: 'password' | 'key' | 'certificate' | 'token' | 'oauth' | 'saml';
  enabled: boolean;
  configuration: Record<string, any>;
  priority: number;
  metadata?: Record<string, any>;
}

/**
 * Authorization provider interface
 */
export interface IAuthorizationProvider {
  name: string;
  authorize(
    context: SessionContext,
    action: string,
    resource?: string
  ): Promise<AuthorizationResult>;
  getPolicies(): Promise<SecurityPolicy[]>;
  validatePolicy(policy: SecurityPolicy): Promise<SecurityValidationResult>;
}

/**
 * Encryption provider interface
 */
export interface IEncryptionProvider {
  name: string;
  encrypt(data: string, key?: string): Promise<string>;
  decrypt(encryptedData: string, key?: string): Promise<string>;
  generateKey(): Promise<string>;
  validateKey(key: string): Promise<boolean>;
}

/**
 * Audit provider interface
 */
export interface IAuditProvider {
  name: string;
  logEvent(event: SecurityAuditEvent): Promise<void>;
  queryEvents(filter: AuditEventFilter): Promise<SecurityAuditEvent[]>;
  getStatistics(period: AuditPeriod): Promise<AuditStatistics>;
}

/**
 * Audit event filter
 */
export interface AuditEventFilter {
  type?: string;
  userId?: string;
  action?: string;
  resource?: string;
  success?: boolean;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Audit period for statistics
 */
export interface AuditPeriod {
  start: Date;
  end: Date;
  granularity: 'hour' | 'day' | 'week' | 'month';
}

/**
 * Audit statistics
 */
export interface AuditStatistics {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  eventsByType: Record<string, number>;
  eventsByUser: Record<string, number>;
  eventsByAction: Record<string, number>;
  timeline: AuditTimelineEntry[];
}

/**
 * Audit timeline entry
 */
export interface AuditTimelineEntry {
  timestamp: Date;
  count: number;
  successCount: number;
  failureCount: number;
}

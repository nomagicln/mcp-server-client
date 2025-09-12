/**
 * Core transport interface for MCP protocol communication
 */
export interface ITransport {
  readonly name: string;
  readonly supportedMethods: string[];

  start(config: TransportConfig): Promise<void>;
  stop(): Promise<void>;
  send(message: MCPMessage): Promise<MCPResponse>;
  onMessage(handler: MessageHandler): void;
  getHealthStatus(): HealthStatus;
}

/**
 * Transport configuration
 */
export interface TransportConfig {
  type: 'stdio' | 'sse' | 'http';
  options: Record<string, any>;
  host?: string;
  port?: number;
  tls?: TLSConfig;
  cors?: CORSConfig;
}

/**
 * TLS configuration for secure transports
 */
export interface TLSConfig {
  cert?: string;
  key?: string;
  ca?: string;
  minVersion?: string;
  cipherSuites?: string[];
  rejectUnauthorized?: boolean;
}

/**
 * CORS configuration for HTTP-based transports
 */
export interface CORSConfig {
  origin: string | string[] | boolean;
  methods?: string[];
  allowedHeaders?: string[];
  credentials?: boolean;
}

/**
 * MCP message structure following JSON-RPC 2.0
 */
export interface MCPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: any;
}

/**
 * MCP response structure following JSON-RPC 2.0
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
 * Message handler function type
 */
export type MessageHandler = (message: MCPMessage) => Promise<MCPResponse | void>;

/**
 * Health status for transport monitoring
 */
export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  details: Record<string, any>;
  uptime?: number;
  connections?: number;
}

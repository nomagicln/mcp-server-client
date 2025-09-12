import { Client as SSHClient, ConnectConfig } from 'ssh2';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  IConnector,
  ConnectorCapability,
  Connection,
  ConnectionStatus,
  TestOptions,
  TestResult,
  Command,
  ExecutionResult,
  ConnectionPool,
  CommandDefinition,
  SecurityContext,
} from '@core/interfaces/connector';
import { Resource } from '@core/models/resource';
import { MCPSCError, ErrorCategory, ErrorSeverity } from '@core/errors/base';
import { Logger } from '@infrastructure/logging/logger';
import { CorrelationManager } from '@infrastructure/logging/correlation';

/**
 * SSH connection wrapper
 */
interface SSHConnection extends Connection {
  client: SSHClient;
  jumpClient?: SSHClient;
  config: ConnectConfig;
  lastActivity: Date;
  activeStreams: Set<any>;
  activeSessions: Map<string, InteractiveSession>;
}

/**
 * Interactive session management
 */
interface InteractiveSession {
  id: string;
  stream: any;
  createdAt: Date;
  lastActivity: Date;
  timeout?: NodeJS.Timeout;
  buffer: string;
}

/**
 * Audit event for logging
 */
interface AuditEvent {
  type: 'command' | 'sftp' | 'session' | 'security';
  userId: string | undefined;
  sessionId?: string;
  action: string;
  resource?: string;
  success: boolean;
  timestamp: Date;
  metadata: Record<string, any>;
  correlationId: string | undefined;
}

/**
 * SSH configuration parsed from ~/.ssh/config
 */
interface SSHConfig {
  [host: string]: {
    hostname?: string;
    port?: number;
    user?: string;
    identityFile?: string;
    proxyJump?: string;
    [key: string]: any;
  };
}

/**
 * Connection pool for SSH connections
 */
class SSHConnectionPool {
  private connections = new Map<string, SSHConnection>();
  private maxSize = 10;
  private maxIdleTime = 300000; // 5 minutes
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired connections every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  get(key: string): SSHConnection | undefined {
    const connection = this.connections.get(key);
    if (connection) {
      connection.lastActivity = new Date();
      connection.lastUsed = new Date();
    }
    return connection;
  }

  set(key: string, connection: SSHConnection): void {
    if (this.connections.size >= this.maxSize) {
      this.evictOldest();
    }
    this.connections.set(key, connection);
  }

  delete(key: string): boolean {
    const connection = this.connections.get(key);
    if (connection) {
      this.closeConnection(connection);
      return this.connections.delete(key);
    }
    return false;
  }

  getStats(): ConnectionPool {
    const active = Array.from(this.connections.values()).filter(
      conn => conn.status === ConnectionStatus.CONNECTED
    ).length;

    return {
      size: this.connections.size,
      active,
      idle: this.connections.size - active,
      maxSize: this.maxSize,
    };
  }

  private cleanup(): void {
    const now = new Date();
    const expired: string[] = [];

    for (const [key, connection] of this.connections) {
      const idleTime = now.getTime() - connection.lastActivity.getTime();
      if (idleTime > this.maxIdleTime) {
        expired.push(key);
      }
    }

    expired.forEach(key => this.delete(key));
  }

  private evictOldest(): void {
    let oldestKey: string | undefined;
    let oldestTime = Date.now();

    for (const [key, connection] of this.connections) {
      if (connection.lastActivity.getTime() < oldestTime) {
        oldestTime = connection.lastActivity.getTime();
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  private closeConnection(connection: SSHConnection): void {
    try {
      // Close all active streams
      connection.activeStreams.forEach(stream => {
        if (stream && typeof stream.end === 'function') {
          stream.end();
        }
      });

      // Close jump client if exists
      if (connection.jumpClient) {
        connection.jumpClient.end();
      }

      // Close main client
      connection.client.removeAllListeners();
      connection.client.end();
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    for (const connection of this.connections.values()) {
      this.closeConnection(connection);
    }

    this.connections.clear();
  }
}

/**
 * SSH Connector implementation
 */
export class SSHConnector implements IConnector {
  readonly type = 'ssh';
  readonly supportedProtocols = ['ssh', 'sftp'];

  private connectionPool = new SSHConnectionPool();
  private sshConfig: SSHConfig | null = null;
  private auditLogger: Logger;

  readonly capabilities: ConnectorCapability[] = [
    {
      name: 'shell',
      description: 'Execute shell commands on remote host',
      parameters: [
        {
          name: 'command',
          type: 'string',
          required: true,
          description: 'Shell command to execute',
        },
        {
          name: 'timeout',
          type: 'number',
          required: false,
          description: 'Command timeout in milliseconds',
          default: 30000,
        },
      ],
      security: [
        {
          type: 'authentication',
          method: 'ssh-key',
          required: true,
          description: 'SSH key-based authentication',
        },
      ],
    },
    {
      name: 'sftp',
      description: 'File transfer operations via SFTP',
      parameters: [
        {
          name: 'operation',
          type: 'string',
          required: true,
          description: 'SFTP operation (readdir, readFile, writeFile, etc.)',
        },
        {
          name: 'path',
          type: 'string',
          required: true,
          description: 'Remote file or directory path',
        },
      ],
      security: [
        {
          type: 'authentication',
          method: 'ssh-key',
          required: true,
          description: 'SSH key-based authentication',
        },
      ],
    },
    {
      name: 'forward',
      description: 'Port forwarding capabilities',
      parameters: [
        {
          name: 'localPort',
          type: 'number',
          required: true,
          description: 'Local port for forwarding',
        },
        {
          name: 'remoteHost',
          type: 'string',
          required: true,
          description: 'Remote host to forward to',
        },
        {
          name: 'remotePort',
          type: 'number',
          required: true,
          description: 'Remote port to forward to',
        },
      ],
      security: [
        {
          type: 'authentication',
          method: 'ssh-key',
          required: true,
          description: 'SSH key-based authentication',
        },
      ],
    },
  ];

  async connect(resource: Resource): Promise<Connection> {
    const connectionKey = this.getConnectionKey(resource);

    // Check for existing connection
    const existingConnection = this.connectionPool.get(connectionKey);
    if (existingConnection && existingConnection.status === ConnectionStatus.CONNECTED) {
      return existingConnection;
    }

    const config = await this.buildSSHConfig(resource);
    const client = new SSHClient();

    const connection: SSHConnection = {
      id: `ssh-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      resourceId: resource.id,
      type: 'ssh',
      status: ConnectionStatus.CONNECTING,
      metadata: {
        host: config.host!,
        port: config.port!,
        protocol: 'ssh',
      },
      createdAt: new Date(),
      lastUsed: new Date(),
      client,
      config,
      lastActivity: new Date(),
      activeStreams: new Set(),
      activeSessions: new Map(),
    };

    try {
      // Handle jump host if configured
      if (resource.connection['jumpHost']) {
        await this.setupJumpHost(connection, resource);
      }

      await this.establishConnection(connection);

      connection.status = ConnectionStatus.CONNECTED;
      this.connectionPool.set(connectionKey, connection);

      return connection;
    } catch (error) {
      connection.status = ConnectionStatus.ERROR;
      throw new MCPSCError(
        2001,
        `Failed to connect to SSH host: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCategory.CONNECTION,
        ErrorSeverity.ERROR,
        { resourceId: resource.id, host: config.host }
      );
    }
  }

  async test(resource: Resource, options: TestOptions = {}): Promise<TestResult> {
    const startTime = Date.now();

    if (options.dryRun) {
      return {
        success: true,
        latency: 0,
        details: 'SSH connection test (dry-run mode)',
        metadata: {
          host: resource.connection.host,
          port: resource.connection.port || 22,
        },
      };
    }

    try {
      const config = await this.buildSSHConfig(resource);
      const client = new SSHClient();
      const timeout = options.timeout || 30000;

      const result = await Promise.race([
        new Promise<TestResult>((resolve, reject) => {
          client.on('ready', () => {
            const latency = Date.now() - startTime;
            client.end();
            resolve({
              success: true,
              latency,
              details: 'SSH connection successful',
              metadata: {
                host: config.host,
                port: config.port,
                authMethod: config.privateKey ? 'key' : 'password',
              },
            });
          });

          client.on('error', error => {
            client.end();
            reject(error);
          });

          client.connect(config);
        }),
        new Promise<TestResult>((_, reject) => {
          setTimeout(() => {
            client.end();
            reject(new Error(`Connection timeout after ${timeout}ms`));
          }, timeout);
        }),
      ]);

      return result;
    } catch (error) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'SSH connection test failed',
      };
    }
  }

  async disconnect(connection: Connection): Promise<void> {
    const sshConnection = connection as SSHConnection;

    // Close all active streams
    sshConnection.activeStreams.forEach(stream => {
      if (stream && typeof stream.end === 'function') {
        stream.end();
      }
    });

    // Close jump client if exists
    if (sshConnection.jumpClient) {
      sshConnection.jumpClient.end();
    }

    // Close main client
    sshConnection.client.removeAllListeners();
    sshConnection.client.end();

    // Remove from pool
    const connectionKey = `${connection.resourceId}-${connection.metadata.host}-${connection.metadata.port}`;
    this.connectionPool.delete(connectionKey);

    connection.status = ConnectionStatus.DISCONNECTED;
  }

  async execute(connection: Connection, command: Command): Promise<ExecutionResult> {
    const sshConnection = connection as SSHConnection;
    const startTime = Date.now();

    try {
      // Security validation
      if (command.securityContext) {
        const securityResult = await this.validateSecurity(command, command.securityContext);
        if (!securityResult.allowed) {
          await this.auditSecurityViolation(
            command,
            command.securityContext,
            securityResult.reason || 'Security violation'
          );
          return {
            success: false,
            error: {
              code: securityResult.code || 'SECURITY_VIOLATION',
              message: securityResult.reason || 'Security policy violation',
              recoverable: false,
            },
            metadata: {
              executionTime: Date.now() - startTime,
              command: command.type,
              securityViolation: true,
            },
          };
        }
      }

      let result: ExecutionResult;
      switch (command.type) {
        case 'exec':
          result = await this.executeShellCommand(sshConnection, command);
          break;
        case 'sftp':
          result = await this.executeSFTPCommand(sshConnection, command);
          break;
        case 'forward':
          result = await this.executePortForward(sshConnection, command);
          break;
        case 'shell':
          result = await this.executeInteractiveSession(sshConnection, command);
          break;
        default:
          throw new MCPSCError(
            6001,
            `Unsupported command type: ${command.type}`,
            ErrorCategory.EXECUTION,
            ErrorSeverity.ERROR,
            { commandType: command.type }
          );
      }

      // Audit logging
      if (command.securityContext?.auditRequired) {
        await this.auditExecution(command, command.securityContext, result);
      }

      return result;
    } catch (error) {
      const result = {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
          recoverable: false,
        },
        metadata: {
          executionTime: Date.now() - startTime,
          command: command.type,
        },
      };

      // Audit failed execution
      if (command.securityContext?.auditRequired) {
        await this.auditExecution(command, command.securityContext, result);
      }

      return result;
    }
  }

  getConnectionPool(): ConnectionPool {
    return this.connectionPool.getStats();
  }

  getSupportedCommands(): CommandDefinition[] {
    return [
      {
        name: 'exec',
        description: 'Execute shell command on remote host',
        parameters: [
          {
            name: 'command',
            type: 'string',
            required: true,
            description: 'Shell command to execute',
          },
          {
            name: 'environment',
            type: 'object',
            required: false,
            description: 'Environment variables to set',
          },
          {
            name: 'interactive',
            type: 'boolean',
            required: false,
            description: 'Enable interactive mode with PTY',
          },
          {
            name: 'input',
            type: 'string',
            required: false,
            description: 'Input to send to interactive command',
          },
        ],
        examples: [
          {
            description: 'List directory contents',
            parameters: { command: 'ls -la' },
            expectedOutput: 'Directory listing',
          },
          {
            description: 'Execute with environment variables',
            parameters: {
              command: 'echo $TEST_VAR',
              environment: { TEST_VAR: 'hello' },
            },
            expectedOutput: 'hello',
          },
        ],
      },
      {
        name: 'sftp',
        description: 'SFTP file operations',
        parameters: [
          {
            name: 'operation',
            type: 'string',
            required: true,
            description:
              'SFTP operation (readdir, readFile, writeFile, mkdir, rmdir, unlink, stat, rename)',
          },
          {
            name: 'path',
            type: 'string',
            required: true,
            description: 'Remote path',
          },
          {
            name: 'data',
            type: 'object',
            required: false,
            description: 'Data for write operations',
          },
          {
            name: 'newPath',
            type: 'string',
            required: false,
            description: 'New path for rename operation',
          },
        ],
        examples: [
          {
            description: 'List directory contents',
            parameters: { operation: 'readdir', path: '/home/user' },
            expectedOutput: 'Directory listing',
          },
          {
            description: 'Read file contents',
            parameters: { operation: 'readFile', path: '/home/user/file.txt' },
            expectedOutput: 'File contents',
          },
        ],
      },
      {
        name: 'shell',
        description: 'Interactive shell session management',
        parameters: [
          {
            name: 'sessionType',
            type: 'string',
            required: true,
            description: 'Session type (interactive, close)',
          },
          {
            name: 'commands',
            type: 'array',
            required: false,
            description: 'Commands to execute in session',
          },
          {
            name: 'sessionId',
            type: 'string',
            required: false,
            description: 'Session ID for close operation',
          },
        ],
        examples: [
          {
            description: 'Start interactive session',
            parameters: { sessionType: 'interactive' },
            expectedOutput: 'Session started',
          },
          {
            description: 'Execute commands in session',
            parameters: {
              sessionType: 'interactive',
              commands: ['ls -la', 'pwd'],
            },
            expectedOutput: 'Command output',
          },
        ],
      },
      {
        name: 'forward',
        description: 'Port forwarding',
        parameters: [
          {
            name: 'localPort',
            type: 'number',
            required: true,
            description: 'Local port',
          },
          {
            name: 'remoteHost',
            type: 'string',
            required: true,
            description: 'Remote host',
          },
          {
            name: 'remotePort',
            type: 'number',
            required: true,
            description: 'Remote port',
          },
        ],
      },
    ];
  }

  private getConnectionKey(resource: Resource): string {
    return `${resource.id}-${resource.connection.host}-${resource.connection.port || 22}`;
  }

  private async buildSSHConfig(resource: Resource): Promise<ConnectConfig> {
    const config: ConnectConfig = {
      host: resource.connection.host!,
      port: resource.connection.port || 22,
      readyTimeout: resource.connection.timeout || 30000,
    };

    // Apply SSH config if available
    const sshHostConfig = this.sshConfig?.[resource.connection.host!];
    if (sshHostConfig) {
      if (sshHostConfig.hostname) {
        config.host = sshHostConfig.hostname;
      }
      if (sshHostConfig.port) {
        config.port = sshHostConfig.port;
      }
      if (sshHostConfig.user) {
        config.username = sshHostConfig.user;
      }
    }

    // Apply authentication
    const auth = resource.security?.authentication;
    if (!auth) {
      throw new MCPSCError(
        2002,
        'No authentication method configured',
        ErrorCategory.CONFIGURATION,
        ErrorSeverity.ERROR,
        { resourceId: resource.id }
      );
    }

    switch (auth.type) {
      case 'key':
        await this.configureKeyAuth(config, auth);
        break;
      case 'password':
        this.configurePasswordAuth(config, auth);
        break;
      default:
        throw new MCPSCError(
          2003,
          `Unsupported authentication type: ${auth.type}`,
          ErrorCategory.CONFIGURATION,
          ErrorSeverity.ERROR,
          { authType: auth.type }
        );
    }

    return config;
  }

  private async configureKeyAuth(config: ConnectConfig, auth: any): Promise<void> {
    const keyPath = this.expandPath(auth.keyPath);

    if (!fs.existsSync(keyPath)) {
      throw new MCPSCError(
        2004,
        'Private key file not found',
        ErrorCategory.CONFIGURATION,
        ErrorSeverity.ERROR,
        { keyPath }
      );
    }

    try {
      config.privateKey = fs.readFileSync(keyPath);
      if (auth.credentials?.passphrase) {
        config.passphrase = auth.credentials.passphrase;
      }
    } catch (error) {
      throw new MCPSCError(
        2005,
        'Failed to read private key file',
        ErrorCategory.CONFIGURATION,
        ErrorSeverity.ERROR,
        { keyPath, error }
      );
    }
  }

  private configurePasswordAuth(config: ConnectConfig, auth: any): void {
    if (!auth.credentials?.username) {
      throw new MCPSCError(
        2006,
        'Username is required for password authentication',
        ErrorCategory.CONFIGURATION,
        ErrorSeverity.ERROR
      );
    }
    if (!auth.credentials?.password) {
      throw new MCPSCError(
        2007,
        'Password is required for password authentication',
        ErrorCategory.CONFIGURATION,
        ErrorSeverity.ERROR
      );
    }

    config.username = auth.credentials.username;
    config.password = auth.credentials.password;
  }

  private async setupJumpHost(connection: SSHConnection, resource: Resource): Promise<void> {
    const jumpConfig: ConnectConfig = {
      host: resource.connection['jumpHost'] as string,
      port: (resource.connection['jumpPort'] as number) || 22,
      username: resource.connection['jumpUser'] as string,
      readyTimeout: 30000,
    };

    // Use same auth method for jump host (could be made configurable)
    const auth = resource.security?.authentication;
    if (auth?.type === 'key') {
      await this.configureKeyAuth(jumpConfig, auth);
    }

    const jumpClient = new SSHClient();
    connection.jumpClient = jumpClient;

    return new Promise((resolve, reject) => {
      jumpClient.on('ready', () => {
        jumpClient.forwardOut(
          '127.0.0.1',
          0,
          connection.config.host!,
          connection.config.port!,
          (err, stream) => {
            if (err) {
              reject(err);
              return;
            }

            connection.config.sock = stream;
            resolve();
          }
        );
      });

      jumpClient.on('error', reject);
      jumpClient.connect(jumpConfig);
    });
  }

  private establishConnection(connection: SSHConnection): Promise<void> {
    return new Promise((resolve, reject) => {
      connection.client.on('ready', () => {
        resolve();
      });

      connection.client.on('error', error => {
        reject(error);
      });

      connection.client.connect(connection.config);
    });
  }

  private async executeShellCommand(
    connection: SSHConnection,
    command: Command
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    let cmd = command.parameters['command'] as string;
    const timeout = command.timeout || 30000;
    const environment = command.parameters['environment'] as Record<string, string> | undefined;
    const interactive = command.parameters['interactive'] as boolean | undefined;
    const input = command.parameters['input'] as string | undefined;

    // Apply environment variables
    if (environment) {
      const envVars = Object.entries(environment)
        .map(([key, value]) => `export ${key}=${value}`)
        .join(' && ');
      cmd = `${envVars} && ${cmd}`;
    }

    return new Promise(resolve => {
      const execOptions = interactive ? { pty: true } : {};

      connection.client.exec(cmd, execOptions, (err, stream) => {
        if (err) {
          resolve({
            success: false,
            error: {
              code: 'EXEC_FAILED',
              message: err.message,
              details: err,
              recoverable: false,
            },
            metadata: {
              executionTime: Date.now() - startTime,
            },
          });
          return;
        }

        connection.activeStreams.add(stream);

        let stdout = '';
        let stderr = '';
        let outputSize = 0;
        const maxOutputSize =
          command.securityContext?.resourceLimits?.maxOutputSize || 10 * 1024 * 1024; // 10MB default

        const timeoutHandle = setTimeout(() => {
          stream.end();
          resolve({
            success: false,
            error: {
              code: 'TIMEOUT',
              message: `Command timeout after ${timeout}ms`,
              recoverable: false,
            },
            metadata: {
              executionTime: Date.now() - startTime,
            },
          });
        }, timeout);

        // Handle input for interactive commands
        if (interactive && input) {
          stream.write(input);
        }

        stream.on('data', (data: Buffer) => {
          outputSize += data.length;
          if (outputSize > maxOutputSize) {
            stream.end();
            clearTimeout(timeoutHandle);
            connection.activeStreams.delete(stream);
            resolve({
              success: false,
              error: {
                code: 'OUTPUT_SIZE_EXCEEDED',
                message: `Output size exceeded limit of ${maxOutputSize} bytes`,
                recoverable: false,
              },
              metadata: {
                executionTime: Date.now() - startTime,
                outputSize,
              },
            });
            return;
          }
          stdout += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        stream.on('close', (code: number) => {
          clearTimeout(timeoutHandle);
          connection.activeStreams.delete(stream);

          const result: ExecutionResult = {
            success: code === 0,
            output: stdout,
            metadata: {
              executionTime: Date.now() - startTime,
              exitCode: code,
              outputSize,
            },
          };

          if (code !== 0) {
            result.error = {
              code: 'NON_ZERO_EXIT',
              message: stderr || `Command exited with code ${code}`,
              recoverable: false,
            };
          }

          resolve(result);
        });
      });
    });
  }

  private async executeSFTPCommand(
    connection: SSHConnection,
    command: Command
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const operation = command.parameters['operation'] as string;
    const remotePath = command.parameters['path'] as string;
    const data = command.parameters['data'] as Buffer | undefined;

    return new Promise(resolve => {
      connection.client.sftp((err, sftp) => {
        if (err) {
          resolve({
            success: false,
            error: {
              code: 'SFTP_FAILED',
              message: err.message,
              details: err,
              recoverable: false,
            },
            metadata: {
              executionTime: Date.now() - startTime,
            },
          });
          return;
        }

        const handleResult = (err: any, result?: any) => {
          sftp.end();
          if (err) {
            resolve({
              success: false,
              error: {
                code: `${operation.toUpperCase()}_FAILED`,
                message: err.message,
                recoverable: false,
              },
              metadata: {
                executionTime: Date.now() - startTime,
              },
            });
          } else {
            resolve({
              success: true,
              output: result,
              metadata: {
                executionTime: Date.now() - startTime,
                operation,
                path: remotePath,
              },
            });
          }
        };

        switch (operation) {
          case 'readdir':
            sftp.readdir(remotePath, handleResult);
            break;

          case 'readFile':
            sftp.readFile(remotePath, handleResult);
            break;

          case 'writeFile':
            if (!data) {
              sftp.end();
              resolve({
                success: false,
                error: {
                  code: 'MISSING_DATA',
                  message: 'Data parameter required for writeFile operation',
                  recoverable: false,
                },
                metadata: {
                  executionTime: Date.now() - startTime,
                },
              });
              return;
            }
            sftp.writeFile(remotePath, data, handleResult);
            break;

          case 'mkdir':
            sftp.mkdir(remotePath, handleResult);
            break;

          case 'rmdir':
            sftp.rmdir(remotePath, handleResult);
            break;

          case 'unlink':
            sftp.unlink(remotePath, handleResult);
            break;

          case 'stat':
            sftp.stat(remotePath, handleResult);
            break;

          case 'lstat':
            sftp.lstat(remotePath, handleResult);
            break;

          case 'rename': {
            const newPath = command.parameters['newPath'] as string;
            if (!newPath) {
              sftp.end();
              resolve({
                success: false,
                error: {
                  code: 'MISSING_NEW_PATH',
                  message: 'newPath parameter required for rename operation',
                  recoverable: false,
                },
                metadata: {
                  executionTime: Date.now() - startTime,
                },
              });
              return;
            }
            sftp.rename(remotePath, newPath, handleResult);
            break;
          }

          default:
            sftp.end();
            resolve({
              success: false,
              error: {
                code: 'UNSUPPORTED_OPERATION',
                message: `Unsupported SFTP operation: ${operation}`,
                recoverable: false,
              },
              metadata: {
                executionTime: Date.now() - startTime,
              },
            });
        }
      });
    });
  }

  private async executePortForward(
    connection: SSHConnection,
    command: Command
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const localPort = command.parameters['localPort'] as number;
    const remoteHost = command.parameters['remoteHost'] as string;
    const remotePort = command.parameters['remotePort'] as number;

    return new Promise(resolve => {
      connection.client.forwardOut(
        '127.0.0.1',
        localPort,
        remoteHost,
        remotePort,
        (err, stream) => {
          if (err) {
            resolve({
              success: false,
              error: {
                code: 'FORWARD_FAILED',
                message: err.message,
                details: err,
                recoverable: false,
              },
              metadata: {
                executionTime: Date.now() - startTime,
              },
            });
            return;
          }

          connection.activeStreams.add(stream);

          resolve({
            success: true,
            output: `Port forwarding established: ${localPort} -> ${remoteHost}:${remotePort}`,
            metadata: {
              executionTime: Date.now() - startTime,
              ['forwardingActive']: true,
              localPort,
              remoteHost,
              remotePort,
            },
          });
        }
      );
    });
  }

  private loadSSHConfig(): void {
    try {
      const configPath = path.join(os.homedir(), '.ssh', 'config');
      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf8');
        this.sshConfig = this.parseSSHConfig(configContent);
      }
    } catch (error) {
      // Ignore SSH config parsing errors
      this.sshConfig = null;
    }
  }

  private parseSSHConfig(content: string): SSHConfig {
    const config: SSHConfig = {};
    const lines = content.split('\n');
    let currentHost: string | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const [key, ...valueParts] = trimmed.split(/\s+/);
      const value = valueParts.join(' ');

      if (key && key.toLowerCase() === 'host') {
        currentHost = value;
        config[currentHost] = {};
      } else if (currentHost && key) {
        const lowerKey = key.toLowerCase();
        switch (lowerKey) {
          case 'hostname':
            config[currentHost]!.hostname = value;
            break;
          case 'port':
            config[currentHost]!.port = parseInt(value, 10);
            break;
          case 'user':
            config[currentHost]!.user = value;
            break;
          case 'identityfile':
            config[currentHost]!.identityFile = this.expandPath(value);
            break;
          case 'proxyjump':
            config[currentHost]!.proxyJump = value;
            break;
          default:
            config[currentHost]![lowerKey] = value;
        }
      }
    }

    return config;
  }

  private async executeInteractiveSession(
    connection: SSHConnection,
    command: Command
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const sessionType = command.parameters['sessionType'] as string;
    const timeout = command.timeout || 300000; // 5 minutes default for interactive sessions
    const commands = command.parameters['commands'] as string[] | undefined;

    if (sessionType === 'close') {
      // Close existing session
      const sessionId = command.parameters['sessionId'] as string;
      const session = connection.activeSessions.get(sessionId);
      if (session) {
        if (session.timeout) {
          clearTimeout(session.timeout);
        }
        session.stream.end();
        connection.activeSessions.delete(sessionId);
        return {
          success: true,
          output: 'Session closed',
          metadata: {
            executionTime: Date.now() - startTime,
            sessionId,
          },
        };
      } else {
        return {
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: `Session ${sessionId} not found`,
            recoverable: false,
          },
          metadata: {
            executionTime: Date.now() - startTime,
          },
        };
      }
    }

    return new Promise(resolve => {
      connection.client.shell((err, stream) => {
        if (err) {
          resolve({
            success: false,
            error: {
              code: 'SHELL_FAILED',
              message: err.message,
              details: err,
              recoverable: false,
            },
            metadata: {
              executionTime: Date.now() - startTime,
            },
          });
          return;
        }

        const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const session: InteractiveSession = {
          id: sessionId,
          stream,
          createdAt: new Date(),
          lastActivity: new Date(),
          buffer: '',
        };

        connection.activeStreams.add(stream);
        connection.activeSessions.set(sessionId, session);

        // Set up session timeout
        session.timeout = setTimeout(() => {
          stream.end();
          connection.activeStreams.delete(stream);
          connection.activeSessions.delete(sessionId);
          resolve({
            success: false,
            error: {
              code: 'SESSION_TIMEOUT',
              message: `Interactive session timeout after ${timeout}ms`,
              recoverable: false,
            },
            metadata: {
              executionTime: Date.now() - startTime,
              sessionId,
            },
          });
        }, timeout);

        stream.on('data', (data: Buffer) => {
          session.buffer += data.toString();
          session.lastActivity = new Date();
        });

        stream.on('close', () => {
          if (session.timeout) {
            clearTimeout(session.timeout);
          }
          connection.activeStreams.delete(stream);
          connection.activeSessions.delete(sessionId);
        });

        // Execute commands if provided
        if (commands && commands.length > 0) {
          commands.forEach(cmd => {
            stream.write(`${cmd}\n`);
          });
        }

        // Wait a bit for initial output
        setTimeout(() => {
          resolve({
            success: true,
            output: session.buffer,
            metadata: {
              executionTime: Date.now() - startTime,
              sessionId,
              sessionActive: true,
            },
          });
        }, 1000);
      });
    });
  }

  private async validateSecurity(
    command: Command,
    securityContext: SecurityContext
  ): Promise<{
    allowed: boolean;
    reason?: string;
    code?: string;
  }> {
    // Skip security validation for non-exec commands for now
    if (command.type !== 'exec') {
      return { allowed: true };
    }

    const cmd = command.parameters['command'] as string;

    // Check command whitelist
    if (securityContext.commandWhitelist && securityContext.commandWhitelist.length > 0) {
      const commandName = cmd.split(' ')[0];
      if (!securityContext.commandWhitelist.includes(commandName || '')) {
        return {
          allowed: false,
          reason: 'Command not in whitelist',
          code: 'COMMAND_BLOCKED',
        };
      }
    }

    // Check command blacklist
    if (securityContext.commandBlacklist && securityContext.commandBlacklist.length > 0) {
      const hasBlacklistedCommand = securityContext.commandBlacklist.some(blacklisted =>
        cmd.includes(blacklisted)
      );
      if (hasBlacklistedCommand) {
        return {
          allowed: false,
          reason: 'Command contains blacklisted terms',
          code: 'COMMAND_BLOCKED',
        };
      }
    }

    // Check permissions
    if (securityContext.permissions && securityContext.permissions.length > 0) {
      const requiredPermission = this.getRequiredPermission(command);
      if (requiredPermission && !securityContext.permissions.includes(requiredPermission)) {
        return {
          allowed: false,
          reason: 'Insufficient permissions',
          code: 'PERMISSION_DENIED',
        };
      }
    }

    // Check sandbox restrictions
    if (securityContext.restrictions) {
      const sandboxRestriction = securityContext.restrictions.find(r => r.startsWith('sandbox:'));
      if (sandboxRestriction && cmd.includes('cd ')) {
        const sandboxPath = sandboxRestriction.split(':')[1];
        const targetPath = cmd.match(/cd\s+([^\s]+)/)?.[1];
        if (targetPath && sandboxPath && !targetPath.startsWith(sandboxPath)) {
          return {
            allowed: false,
            reason: 'Command attempts to access path outside sandbox',
            code: 'SANDBOX_VIOLATION',
          };
        }
      }
    }

    // Check resource limits
    if (securityContext.resourceLimits) {
      const limits = securityContext.resourceLimits;
      if (limits.maxExecutionTime && command.timeout && command.timeout > limits.maxExecutionTime) {
        return {
          allowed: false,
          reason: 'Command timeout exceeds resource limits',
          code: 'RESOURCE_LIMIT_EXCEEDED',
        };
      }
    }

    return { allowed: true };
  }

  private getRequiredPermission(command: Command): string | null {
    const cmd = command.parameters['command'] as string;

    if (cmd.includes('/etc/') || cmd.includes('/root/')) {
      return 'read-system';
    }

    if (cmd.startsWith('sudo') || cmd.includes('rm ') || cmd.includes('chmod')) {
      return 'admin';
    }

    if (cmd.startsWith('cat') || cmd.startsWith('ls') || cmd.startsWith('find')) {
      return 'read';
    }

    return 'execute';
  }

  private async auditExecution(
    command: Command,
    securityContext: SecurityContext,
    result: ExecutionResult
  ): Promise<void> {
    const auditEvent: AuditEvent = {
      type: command.type === 'sftp' ? 'sftp' : 'command',
      userId: securityContext.userId,
      action:
        command.type === 'sftp' ? command.parameters['operation'] : command.parameters['command'],
      resource: command.type === 'sftp' ? command.parameters['path'] : undefined,
      success: result.success,
      timestamp: new Date(),
      metadata: {
        executionTime: result.metadata.executionTime,
        exitCode: result.metadata.exitCode,
        resourceId: securityContext.userId, // This should be connection.resourceId in real implementation
        commandType: command.type,
      },
      correlationId: CorrelationManager.getCorrelationId(),
    };

    if (result.success) {
      this.auditLogger.info(
        command.type === 'sftp' ? 'SFTP operation completed' : 'SSH command executed successfully',
        auditEvent
      );
    } else {
      this.auditLogger.warn(
        command.type === 'sftp' ? 'SFTP operation failed' : 'SSH command execution failed',
        {
          ...auditEvent,
          error: result.error?.message,
        }
      );
    }
  }

  private async auditSecurityViolation(
    command: Command,
    securityContext: SecurityContext,
    reason: string
  ): Promise<void> {
    const auditEvent: AuditEvent = {
      type: 'security',
      userId: securityContext.userId,
      action: command.parameters['command'] || command.type,
      success: false,
      timestamp: new Date(),
      metadata: {
        reason,
        commandType: command.type,
        securityViolation: true,
      },
      correlationId: CorrelationManager.getCorrelationId(),
    };

    this.auditLogger.error('SSH command blocked by security policy', auditEvent);
  }

  private expandPath(filePath: string): string {
    if (filePath.startsWith('~/')) {
      return path.join(os.homedir(), filePath.slice(2));
    }
    return filePath;
  }

  constructor(auditLogger?: Logger) {
    this.auditLogger =
      auditLogger ||
      new Logger({
        level: 'info' as any,
        component: 'ssh-connector',
      });
    this.loadSSHConfig();
  }
}

/**
 * SSH 命令执行工具
 *
 * 提供 SSH 远程命令执行功能，支持密码认证
 */

import { Client } from 'ssh2';
import { config } from '../config/index.js';
import { ErrorHandler } from '../utils/error-handler.js';
import { logger } from '../utils/logger.js';
import { SecurityValidator } from '../utils/security.js';

/**
 * SSH 工具类
 */
export class SshTool {
  constructor() {
    this.connections = new Map(); // 连接池
  }

  /**
   * 执行 SSH 命令
   */
  async execute(args) {
    try {
      // 参数验证
      this.validateArgs(args);

      const { host, port, username, password, command, timeout } =
        this.parseArgs(args);

      // 获取或创建连接
      const connectionKey = `${username}@${host}:${port}`;
      let connection = this.connections.get(connectionKey);

      if (!connection || !this.isConnectionValid(connection)) {
        connection = await this.createConnection(
          host,
          port,
          username,
          password,
        );
        this.connections.set(connectionKey, connection);

        // 设置连接清理定时器
        this.setupConnectionCleanup(connectionKey, connection);
      }

      // 执行命令
      const result = await this.executeCommand(connection, command, timeout);

      return this.formatResult(result);
    } catch (error) {
      return ErrorHandler.handle(error, {
        tool: 'ssh',
        host: args.host,
        username: args.username,
        command: args.command,
      });
    }
  }

  /**
   * 验证参数
   */
  validateArgs(args) {
    if (!args.host) {
      throw ErrorHandler.createMissingParameterError('host');
    }

    if (!args.username) {
      throw ErrorHandler.createMissingParameterError('username');
    }

    if (!args.password) {
      throw ErrorHandler.createMissingParameterError('password');
    }

    if (!args.command) {
      throw ErrorHandler.createMissingParameterError('command');
    }

    // 验证主机安全性
    SecurityValidator.validateSshHost(args.host);

    // 验证凭据
    SecurityValidator.validateCredentials(args.username, args.password);

    // 验证命令安全性
    SecurityValidator.validateSshCommand(args.command);

    // 验证超时时间
    if (args.timeout && (args.timeout < 1000 || args.timeout > 300000)) {
      throw ErrorHandler.createValidationError(
        'timeout',
        '超时时间必须在 1000-300000 毫秒之间',
      );
    }
  }

  /**
   * 解析参数
   */
  parseArgs(args) {
    const hostPattern = /^([^:]+)(?::(\d+))?$/;
    const match = args.host.match(hostPattern);

    return {
      host: match[1],
      port: match[2] ? parseInt(match[2], 10) : 22,
      username: args.username,
      password: args.password,
      command: args.command.trim(),
      timeout: args.timeout || config.ssh.timeout,
    };
  }

  /**
   * 创建 SSH 连接
   */
  async createConnection(host, port, username, password) {
    return new Promise((resolve, reject) => {
      const client = new Client();

      const timeout = setTimeout(() => {
        client.end();
        reject(new Error(`连接超时: ${config.ssh.readyTimeout}ms`));
      }, config.ssh.readyTimeout);

      client.on('ready', () => {
        clearTimeout(timeout);
        logger.debug('SSH 连接已建立', { host, port, username });
        resolve(client);
      });

      client.on('error', error => {
        clearTimeout(timeout);
        logger.error('SSH 连接失败', {
          host,
          port,
          username,
          error: error.message,
        });
        reject(new Error(`SSH 连接失败: ${error.message}`));
      });

      client.on('close', () => {
        logger.debug('SSH 连接已关闭', { host, port, username });
      });

      // 连接配置
      const connectionConfig = {
        host,
        port,
        username,
        password,
        readyTimeout: config.ssh.readyTimeout,
        keepaliveInterval: config.ssh.keepaliveInterval,
        keepaliveCountMax: 3,
        algorithms: {
          // 禁用不安全的算法
          kex: [
            'diffie-hellman-group14-sha256',
            'diffie-hellman-group16-sha256',
            'diffie-hellman-group18-sha256',
          ],
          cipher: [
            'aes128-gcm@openssh.com',
            'aes256-gcm@openssh.com',
            'aes128-ctr',
            'aes256-ctr',
          ],
          hmac: ['hmac-sha2-256', 'hmac-sha2-512'],
        },
      };

      logger.debug('正在连接 SSH 服务器', { host, port, username });
      client.connect(connectionConfig);
    });
  }

  /**
   * 检查连接是否有效
   */
  isConnectionValid(connection) {
    return (
      connection &&
      !connection.destroyed &&
      connection._sock &&
      connection._sock.writable
    );
  }

  /**
   * 设置连接清理定时器
   */
  setupConnectionCleanup(connectionKey, _connection) {
    // 5分钟后清理连接
    setTimeout(
      () => {
        if (this.connections.has(connectionKey)) {
          const conn = this.connections.get(connectionKey);
          if (conn && !conn.destroyed) {
            conn.end();
          }
          this.connections.delete(connectionKey);
          logger.debug('SSH 连接已清理', { connectionKey });
        }
      },
      5 * 60 * 1000,
    ); // 5分钟
  }

  /**
   * 执行命令
   */
  async executeCommand(connection, command, timeout) {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let exitCode = null;
      let stream = null;
      let timeoutId = null;

      logger.debug('正在执行 SSH 命令', { command });

      connection.exec(command, (error, execStream) => {
        stream = execStream;
        if (error) {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          reject(new Error(`命令执行失败: ${error.message}`));
          return;
        }

        // 设置超时
        timeoutId = setTimeout(() => {
          if (stream) {
            stream.destroy();
          }
          reject(new Error(`命令执行超时: ${timeout}ms`));
        }, timeout);

        // 处理标准输出
        stream.on('data', data => {
          stdout += data.toString();
        });

        // 处理标准错误
        stream.stderr.on('data', data => {
          stderr += data.toString();
        });

        // 处理命令完成
        stream.on('close', code => {
          clearTimeout(timeoutId);
          exitCode = code;

          logger.debug('SSH 命令执行完成', {
            command,
            exitCode,
            stdoutLength: stdout.length,
            stderrLength: stderr.length,
          });

          resolve({
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode,
          });
        });

        // 处理错误
        stream.on('error', error => {
          clearTimeout(timeoutId);
          logger.error('SSH 命令执行错误', { command, error: error.message });
          reject(new Error(`命令执行错误: ${error.message}`));
        });
      });
    });
  }

  /**
   * 格式化结果
   */
  formatResult(result) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  /**
   * 清理所有连接
   */
  cleanup() {
    for (const connection of this.connections.values()) {
      if (connection && !connection.destroyed) {
        connection.end();
      }
    }
    this.connections.clear();
    logger.info('SSH 连接池已清理');
  }
}

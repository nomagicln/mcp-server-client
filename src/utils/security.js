/**
 * 安全性工具
 *
 * 提供输入验证、内容过滤和安全检查功能
 */

import { config } from '../config/index.js';
import { ErrorHandler } from './error-handler.js';
import { logger } from './logger.js';

/**
 * 安全验证器类
 */
export class SecurityValidator {
  /**
   * 验证 URL 的安全性
   */
  static validateUrl(url) {
    try {
      const urlObj = new URL(url);

      // 检查协议
      const allowedProtocols = ['http:', 'https:'];
      if (!allowedProtocols.includes(urlObj.protocol)) {
        throw ErrorHandler.createSecurityError(
          `不支持的协议: ${urlObj.protocol}，仅允许 HTTP 和 HTTPS`,
        );
      }

      // 检查主机名
      const hostname = urlObj.hostname.toLowerCase();

      // 禁止本地地址（除非在配置中明确允许）
      const isLocalhost =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1';

      const isPrivateIP = this.isPrivateIP(hostname);

      if ((isLocalhost || isPrivateIP) && !config.security.allowLocalRequests) {
        throw ErrorHandler.createSecurityError('禁止访问本地和私有网络地址');
      }

      // 检查端口限制
      if (urlObj.port) {
        const port = parseInt(urlObj.port, 10);
        const restrictedPorts = [22, 23, 25, 53, 135, 139, 445, 993, 995];

        if (restrictedPorts.includes(port)) {
          throw ErrorHandler.createSecurityError(`禁止访问受限端口: ${port}`);
        }
      }

      return true;
    } catch (error) {
      if (error.name === 'McpError') {
        throw error;
      }
      throw ErrorHandler.createValidationError('url', '无效的 URL 格式');
    }
  }

  /**
   * 检查是否为私有 IP 地址
   */
  static isPrivateIP(hostname) {
    // IPv4 私有地址范围
    const privateRanges = [
      /^10\./, // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
      /^192\.168\./, // 192.168.0.0/16
      /^169\.254\./, // 链路本地地址
    ];

    return privateRanges.some(range => range.test(hostname));
  }

  /**
   * 验证 HTTP 请求头的安全性
   */
  static validateHeaders(headers) {
    if (!headers || typeof headers !== 'object') {
      return true;
    }

    const dangerousHeaders = [
      'x-real-ip',
      'x-forwarded-for',
      'x-forwarded-host',
      'x-forwarded-proto',
    ];

    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();

      // 检查危险头部
      if (dangerousHeaders.includes(lowerKey)) {
        logger.warn('检测到潜在危险的请求头', { header: key, value });
      }

      // 检查头部值长度
      if (typeof value === 'string' && value.length > 8192) {
        throw ErrorHandler.createSecurityError(
          `请求头 ${key} 的值过长 (最大 8192 字符)`,
        );
      }

      // 检查恶意字符
      if (this.containsMaliciousChars(value)) {
        throw ErrorHandler.createSecurityError(`请求头 ${key} 包含恶意字符`);
      }
    }

    return true;
  }

  /**
   * 验证请求体的安全性
   */
  static validateRequestBody(body, contentType = '') {
    if (!body) {
      return true;
    }

    // 检查大小限制
    const bodySize =
      typeof body === 'string'
        ? Buffer.byteLength(body, 'utf8')
        : JSON.stringify(body).length;

    if (bodySize > config.security.maxRequestSize) {
      throw ErrorHandler.createSecurityError(
        `请求体过大: ${bodySize} 字节 (最大 ${config.security.maxRequestSize} 字节)`,
      );
    }

    // 检查内容类型
    if (config.security.allowedContentTypes.length > 0) {
      const isAllowedType = config.security.allowedContentTypes.some(
        allowedType =>
          contentType.toLowerCase().includes(allowedType.toLowerCase()),
      );

      if (!isAllowedType && contentType) {
        throw ErrorHandler.createSecurityError(
          `不允许的内容类型: ${contentType}`,
        );
      }
    }

    // 检查恶意内容
    const bodyText = typeof body === 'string' ? body : JSON.stringify(body);
    if (this.containsMaliciousContent(bodyText)) {
      throw ErrorHandler.createSecurityError('请求体包含恶意内容');
    }

    return true;
  }

  /**
   * 验证 SSH 命令的安全性
   */
  static validateSshCommand(command) {
    if (!command || typeof command !== 'string') {
      throw ErrorHandler.createValidationError('command', '命令不能为空');
    }

    // 检查命令长度
    if (command.length > 10000) {
      throw ErrorHandler.createSecurityError(
        '命令长度超过限制 (最大 10000 字符)',
      );
    }

    // 检查危险命令模式
    const dangerousPatterns = [
      /rm\s+-rf\s+\/[^\/\s]*/i, // rm -rf /path
      /rm\s+-rf\s+\*/i, // rm -rf *
      /mkfs/i, // 格式化文件系统
      /dd\s+if=/i, // 磁盘复制
      /fdisk/i, // 磁盘分区
      /passwd/i, // 修改密码
      /sudo\s+su/i, // 提权
      /chmod\s+777/i, // 危险权限
      />\s*\/dev\/(null|zero)/i, // 重定向到设备文件
      /curl.*\|\s*sh/i, // 下载并执行脚本
      /wget.*\|\s*sh/i, // 下载并执行脚本
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        throw ErrorHandler.createSecurityError(
          `命令包含危险操作模式: ${pattern.source}`,
        );
      }
    }

    // 检查连续的管道和重定向
    const pipeCount = (command.match(/\|/g) || []).length;
    const redirectCount = (command.match(/[<>]/g) || []).length;

    if (pipeCount > 5) {
      throw ErrorHandler.createSecurityError('命令包含过多管道操作');
    }

    if (redirectCount > 3) {
      throw ErrorHandler.createSecurityError('命令包含过多重定向操作');
    }

    return true;
  }

  /**
   * 验证主机连接的安全性
   */
  static validateSshHost(host) {
    if (!host || typeof host !== 'string') {
      throw ErrorHandler.createValidationError('host', '主机地址不能为空');
    }

    // 解析主机和端口
    const hostPattern = /^([^:]+)(?::(\d+))?$/;
    const match = host.match(hostPattern);

    if (!match) {
      throw ErrorHandler.createValidationError(
        'host',
        '无效的主机格式，应为 host 或 host:port',
      );
    }

    const hostname = match[1];
    const port = match[2] ? parseInt(match[2], 10) : 22;

    // 检查主机名格式
    if (hostname.length > 253) {
      throw ErrorHandler.createValidationError(
        'host',
        '主机名过长 (最大 253 字符)',
      );
    }

    // 检查是否为本地地址
    const isLocalhost =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1';

    const isPrivateIP = this.isPrivateIP(hostname);

    if (
      (isLocalhost || isPrivateIP) &&
      !config.security.allowLocalConnections
    ) {
      throw ErrorHandler.createSecurityError('禁止连接到本地和私有网络地址');
    }

    // 检查端口范围
    if (port < 1 || port > 65535) {
      throw ErrorHandler.createValidationError(
        'host',
        `无效的端口号: ${port} (应在 1-65535 之间)`,
      );
    }

    return true;
  }

  /**
   * 检查是否包含恶意字符
   */
  static containsMaliciousChars(text) {
    if (typeof text !== 'string') {
      return false;
    }

    const maliciousPatterns = [
      /<script/i, // XSS 脚本
      /javascript:/i, // JavaScript 协议
      /vbscript:/i, // VBScript 协议
      /on\w+\s*=/i, // 事件处理器
      /\x00/, // NULL 字节
      /\x0d\x0a/, // CRLF 注入
    ];

    return maliciousPatterns.some(pattern => pattern.test(text));
  }

  /**
   * 检查是否包含恶意内容
   */
  static containsMaliciousContent(text) {
    if (typeof text !== 'string') {
      return false;
    }

    const maliciousPatterns = [
      /(?:union|select|insert|delete|update|drop|create|alter)\s/i, // SQL 注入
      /<iframe/i, // 嵌入框架
      /<object/i, // 对象嵌入
      /<embed/i, // 嵌入内容
      /eval\s*\(/i, // 代码执行
      /setTimeout\s*\(/i, // 延时执行
      /setInterval\s*\(/i, // 定时执行
    ];

    return maliciousPatterns.some(pattern => pattern.test(text));
  }

  /**
   * 清理和转义用户输入
   */
  static sanitizeInput(input) {
    if (typeof input !== 'string') {
      return input;
    }

    return input
      .replace(/[<>'"&]/g, char => {
        const escapeMap = {
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#x27;',
          '"': '&quot;',
          '&': '&amp;',
        };
        return escapeMap[char];
      })
      .replace(/\x00/g, '') // 移除 NULL 字节
      .trim(); // 移除首尾空白
  }

  /**
   * 验证凭据强度
   */
  static validateCredentials(username, password) {
    if (!username || typeof username !== 'string') {
      throw ErrorHandler.createValidationError('username', '用户名不能为空');
    }

    if (!password || typeof password !== 'string') {
      throw ErrorHandler.createValidationError('password', '密码不能为空');
    }

    // 检查用户名
    if (username.length < 1 || username.length > 64) {
      throw ErrorHandler.createValidationError(
        'username',
        '用户名长度应在 1-64 字符之间',
      );
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
      throw ErrorHandler.createValidationError(
        'username',
        '用户名只能包含字母、数字、点、下划线和短横线',
      );
    }

    // 检查密码长度（不检查复杂度，因为这可能是系统生成的密码）
    if (password.length < 1 || password.length > 128) {
      throw ErrorHandler.createValidationError(
        'password',
        '密码长度应在 1-128 字符之间',
      );
    }

    return true;
  }
}

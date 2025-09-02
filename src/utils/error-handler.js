/**
 * 统一错误处理工具
 *
 * 提供统一的错误分类、处理和响应格式化功能
 */

import { logger } from './logger.js';

/**
 * 错误类型枚举
 */
export const ErrorType = {
  // 网络相关错误
  NETWORK_ERROR: 'NETWORK_ERROR',
  CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',
  DNS_RESOLUTION_FAILED: 'DNS_RESOLUTION_FAILED',

  // 认证相关错误
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  AUTHORIZATION_FAILED: 'AUTHORIZATION_FAILED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',

  // 请求相关错误
  INVALID_REQUEST: 'INVALID_REQUEST',
  MISSING_PARAMETER: 'MISSING_PARAMETER',
  INVALID_PARAMETER: 'INVALID_PARAMETER',
  REQUEST_TOO_LARGE: 'REQUEST_TOO_LARGE',

  // 服务器相关错误
  SERVER_ERROR: 'SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  // 安全相关错误
  SECURITY_VIOLATION: 'SECURITY_VIOLATION',
  TLS_VERIFICATION_FAILED: 'TLS_VERIFICATION_FAILED',
  CONTENT_TYPE_BLOCKED: 'CONTENT_TYPE_BLOCKED',

  // 其他错误
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};

/**
 * 错误类
 */
export class McpError extends Error {
  constructor(type, message, originalError = null, details = {}) {
    super(message);
    this.name = 'McpError';
    this.type = type;
    this.originalError = originalError;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // 保持正确的堆栈跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, McpError);
    }
  }

  /**
   * 获取用户友好的错误信息
   */
  getUserMessage() {
    const messages = {
      [ErrorType.NETWORK_ERROR]: '网络连接失败，请检查网络连接',
      [ErrorType.CONNECTION_TIMEOUT]: '连接超时，请稍后重试',
      [ErrorType.DNS_RESOLUTION_FAILED]: '域名解析失败，请检查域名',
      [ErrorType.AUTHENTICATION_FAILED]: '认证失败，请检查凭据',
      [ErrorType.AUTHORIZATION_FAILED]: '权限不足，无法执行此操作',
      [ErrorType.INVALID_CREDENTIALS]: '无效的凭据信息',
      [ErrorType.INVALID_REQUEST]: '无效的请求格式',
      [ErrorType.MISSING_PARAMETER]: '缺少必需的参数',
      [ErrorType.INVALID_PARAMETER]: '参数格式或值无效',
      [ErrorType.REQUEST_TOO_LARGE]: '请求数据过大',
      [ErrorType.SERVER_ERROR]: '服务器内部错误',
      [ErrorType.SERVICE_UNAVAILABLE]: '服务暂时不可用',
      [ErrorType.INTERNAL_ERROR]: '系统内部错误',
      [ErrorType.SECURITY_VIOLATION]: '安全策略违规',
      [ErrorType.TLS_VERIFICATION_FAILED]: 'TLS 证书验证失败',
      [ErrorType.CONTENT_TYPE_BLOCKED]: '内容类型被安全策略阻止',
      [ErrorType.UNKNOWN_ERROR]: '未知错误，请联系管理员',
    };

    return messages[this.type] || this.message;
  }

  /**
   * 获取建议的解决方案
   */
  getSuggestions() {
    const suggestions = {
      [ErrorType.NETWORK_ERROR]: [
        '检查网络连接是否正常',
        '确认目标服务器是否可访问',
        '检查防火墙设置',
      ],
      [ErrorType.CONNECTION_TIMEOUT]: [
        '增加超时时间设置',
        '检查网络延迟情况',
        '确认目标服务器响应是否正常',
      ],
      [ErrorType.DNS_RESOLUTION_FAILED]: [
        '检查域名拼写是否正确',
        '确认 DNS 服务器配置',
        '尝试使用 IP 地址直接连接',
      ],
      [ErrorType.AUTHENTICATION_FAILED]: [
        '检查用户名和密码是否正确',
        '确认认证方式是否支持',
        '检查账户是否被锁定',
      ],
      [ErrorType.AUTHORIZATION_FAILED]: [
        '确认账户权限是否足够',
        '联系管理员获取必要权限',
        '检查账户状态是否正常',
      ],
      [ErrorType.INVALID_REQUEST]: [
        '检查请求格式是否符合规范',
        '确认所有必需字段都已填写',
        '查看 API 文档了解正确用法',
      ],
      [ErrorType.MISSING_PARAMETER]: [
        '检查所有必需参数是否已提供',
        '查看工具说明确认参数要求',
      ],
      [ErrorType.INVALID_PARAMETER]: [
        '检查参数格式和值是否正确',
        '查看工具文档了解参数规范',
      ],
      [ErrorType.SECURITY_VIOLATION]: [
        '检查请求是否符合安全策略',
        '避免使用敏感信息',
        '联系管理员了解安全限制',
      ],
      [ErrorType.TLS_VERIFICATION_FAILED]: [
        '检查服务器证书是否有效',
        '考虑启用跳过 TLS 验证（仅限测试环境）',
        '更新受信任的证书列表',
      ],
    };

    return suggestions[this.type] || ['请联系技术支持获取帮助'];
  }
}

/**
 * 错误处理器类
 */
export class ErrorHandler {
  /**
   * 处理错误并返回标准化的 MCP 响应
   */
  static handle(error, context = {}) {
    let mcpError;

    // 如果已经是 McpError，直接使用
    if (error instanceof McpError) {
      mcpError = error;
    } else {
      // 分类和转换错误
      mcpError = this.classifyAndConvert(error, context);
    }

    // 记录错误日志
    this.logError(mcpError, context);

    // 返回 MCP 格式的错误响应
    return {
      content: [
        {
          type: 'text',
          text: this.formatErrorResponse(mcpError),
        },
      ],
      isError: true,
    };
  }

  /**
   * 分类和转换错误
   */
  static classifyAndConvert(error, context) {
    const errorMessage = error.message || '未知错误';
    const lowerMessage = errorMessage.toLowerCase();

    // 网络相关错误
    if (
      lowerMessage.includes('timeout') ||
      lowerMessage.includes('timed out')
    ) {
      return new McpError(ErrorType.CONNECTION_TIMEOUT, '连接超时', error, {
        context,
      });
    }

    if (lowerMessage.includes('enotfound') || lowerMessage.includes('dns')) {
      return new McpError(
        ErrorType.DNS_RESOLUTION_FAILED,
        '域名解析失败',
        error,
        { context },
      );
    }

    if (
      lowerMessage.includes('econnrefused') ||
      lowerMessage.includes('connection refused')
    ) {
      return new McpError(ErrorType.NETWORK_ERROR, '连接被拒绝', error, {
        context,
      });
    }

    if (
      lowerMessage.includes('authentication failed') ||
      lowerMessage.includes('auth failed')
    ) {
      return new McpError(ErrorType.AUTHENTICATION_FAILED, '认证失败', error, {
        context,
      });
    }

    if (
      lowerMessage.includes('permission denied') ||
      lowerMessage.includes('access denied')
    ) {
      return new McpError(ErrorType.AUTHORIZATION_FAILED, '权限不足', error, {
        context,
      });
    }

    // HTTP 状态码相关错误
    if (error.response) {
      const status = error.response.status;
      if (status === 401 || status === 403) {
        return new McpError(
          ErrorType.AUTHENTICATION_FAILED,
          `HTTP ${status}: 认证失败`,
          error,
          { status, context },
        );
      }
      if (status === 404) {
        return new McpError(
          ErrorType.INVALID_REQUEST,
          `HTTP ${status}: 资源不存在`,
          error,
          { status, context },
        );
      }
      if (status >= 500) {
        return new McpError(
          ErrorType.SERVER_ERROR,
          `HTTP ${status}: 服务器错误`,
          error,
          { status, context },
        );
      }
      if (status >= 400) {
        return new McpError(
          ErrorType.INVALID_REQUEST,
          `HTTP ${status}: 请求错误`,
          error,
          { status, context },
        );
      }
    }

    // SSH 相关错误
    if (context.tool === 'ssh' || lowerMessage.includes('ssh')) {
      if (
        lowerMessage.includes('authentication') ||
        lowerMessage.includes('password')
      ) {
        return new McpError(
          ErrorType.AUTHENTICATION_FAILED,
          'SSH 认证失败',
          error,
          { context },
        );
      }
      if (
        lowerMessage.includes('connection') ||
        lowerMessage.includes('connect')
      ) {
        return new McpError(ErrorType.NETWORK_ERROR, 'SSH 连接失败', error, {
          context,
        });
      }
    }

    // 默认错误
    return new McpError(ErrorType.UNKNOWN_ERROR, errorMessage, error, {
      context,
    });
  }

  /**
   * 记录错误日志
   */
  static logError(mcpError, context) {
    const logData = {
      type: mcpError.type,
      message: mcpError.message,
      userMessage: mcpError.getUserMessage(),
      context,
      timestamp: mcpError.timestamp,
      suggestions: mcpError.getSuggestions(),
    };

    if (mcpError.originalError) {
      logData.originalError = {
        name: mcpError.originalError.name,
        message: mcpError.originalError.message,
        stack: mcpError.originalError.stack,
      };
    }

    logger.error('MCP 工具执行错误', logData);
  }

  /**
   * 格式化错误响应
   */
  static formatErrorResponse(mcpError) {
    const suggestions = mcpError.getSuggestions();

    return JSON.stringify(
      {
        error: {
          type: mcpError.type,
          message: mcpError.getUserMessage(),
          suggestions: suggestions.slice(0, 3), // 只显示前3个建议
          timestamp: mcpError.timestamp,
        },
        details: mcpError.details,
      },
      null,
      2,
    );
  }

  /**
   * 创建参数验证错误
   */
  static createValidationError(parameter, reason) {
    return new McpError(
      ErrorType.INVALID_PARAMETER,
      `参数 ${parameter} 无效: ${reason}`,
      null,
      { parameter, reason },
    );
  }

  /**
   * 创建缺失参数错误
   */
  static createMissingParameterError(parameter) {
    return new McpError(
      ErrorType.MISSING_PARAMETER,
      `缺少必需参数: ${parameter}`,
      null,
      { parameter },
    );
  }

  /**
   * 创建安全违规错误
   */
  static createSecurityError(reason) {
    return new McpError(
      ErrorType.SECURITY_VIOLATION,
      `安全策略违规: ${reason}`,
      null,
      { reason },
    );
  }
}

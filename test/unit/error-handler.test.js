/**
 * 错误处理器单元测试
 */

import { describe, expect, test } from '@jest/globals';
import {
  ErrorHandler,
  ErrorType,
  McpError,
} from '../../src/utils/error-handler.js';

describe('ErrorHandler', () => {
  describe('McpError', () => {
    test('应该正确创建 McpError 实例', () => {
      const error = new McpError(
        ErrorType.NETWORK_ERROR,
        '网络连接失败',
        new Error('Connection refused'),
        { url: 'https://example.com' },
      );

      expect(error.type).toBe(ErrorType.NETWORK_ERROR);
      expect(error.message).toBe('网络连接失败');
      expect(error.originalError.message).toBe('Connection refused');
      expect(error.details.url).toBe('https://example.com');
      expect(error.timestamp).toBeDefined();
    });

    test('应该返回正确的用户友好消息', () => {
      const error = new McpError(ErrorType.CONNECTION_TIMEOUT, '连接超时');
      expect(error.getUserMessage()).toBe('连接超时，请稍后重试');
    });

    test('应该返回正确的解决建议', () => {
      const error = new McpError(ErrorType.AUTHENTICATION_FAILED, '认证失败');
      const suggestions = error.getSuggestions();

      expect(suggestions).toContain('检查用户名和密码是否正确');
      expect(suggestions).toContain('确认认证方式是否支持');
    });
  });

  describe('classifyAndConvert', () => {
    test('应该正确分类超时错误', () => {
      const originalError = new Error('Connection timed out');
      const mcpError = ErrorHandler.classifyAndConvert(originalError, {
        tool: 'http',
      });

      expect(mcpError.type).toBe(ErrorType.CONNECTION_TIMEOUT);
      expect(mcpError.getUserMessage()).toBe('连接超时，请稍后重试');
    });

    test('应该正确分类 DNS 错误', () => {
      const originalError = new Error('getaddrinfo ENOTFOUND example.com');
      const mcpError = ErrorHandler.classifyAndConvert(originalError, {
        tool: 'http',
      });

      expect(mcpError.type).toBe(ErrorType.DNS_RESOLUTION_FAILED);
      expect(mcpError.getUserMessage()).toBe('域名解析失败，请检查域名');
    });

    test('应该正确分类连接拒绝错误', () => {
      const originalError = new Error('connect ECONNREFUSED 127.0.0.1:80');
      const mcpError = ErrorHandler.classifyAndConvert(originalError, {
        tool: 'http',
      });

      expect(mcpError.type).toBe(ErrorType.NETWORK_ERROR);
      expect(mcpError.getUserMessage()).toBe('网络连接失败，请检查网络连接');
    });

    test('应该正确分类 HTTP 状态错误', () => {
      const originalError = new Error('Request failed');
      originalError.response = { status: 401, statusText: 'Unauthorized' };

      const mcpError = ErrorHandler.classifyAndConvert(originalError, {
        tool: 'http',
      });

      expect(mcpError.type).toBe(ErrorType.AUTHENTICATION_FAILED);
      expect(mcpError.message).toContain('HTTP 401');
    });

    test('应该正确分类 SSH 认证错误', () => {
      const originalError = new Error('Authentication failed');
      const mcpError = ErrorHandler.classifyAndConvert(originalError, {
        tool: 'ssh',
      });

      expect(mcpError.type).toBe(ErrorType.AUTHENTICATION_FAILED);
      expect(mcpError.message).toBe('认证失败');
    });
  });

  describe('handle', () => {
    test('应该返回正确的 MCP 响应格式', () => {
      const originalError = new Error('Test error');
      const response = ErrorHandler.handle(originalError, { tool: 'test' });

      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('isError', true);
      expect(response.content).toHaveLength(1);
      expect(response.content[0]).toHaveProperty('type', 'text');
      expect(response.content[0]).toHaveProperty('text');
    });

    test('应该正确处理已有的 McpError', () => {
      const mcpError = new McpError(ErrorType.NETWORK_ERROR, '网络错误');
      const response = ErrorHandler.handle(mcpError, { tool: 'test' });

      expect(response.isError).toBe(true);
      const errorData = JSON.parse(response.content[0].text);
      expect(errorData.error.type).toBe(ErrorType.NETWORK_ERROR);
    });
  });

  describe('创建特定错误', () => {
    test('createValidationError 应该创建验证错误', () => {
      const error = ErrorHandler.createValidationError(
        'email',
        '无效的邮箱格式',
      );

      expect(error.type).toBe(ErrorType.INVALID_PARAMETER);
      expect(error.message).toContain('email');
      expect(error.message).toContain('无效的邮箱格式');
      expect(error.details.parameter).toBe('email');
    });

    test('createMissingParameterError 应该创建缺失参数错误', () => {
      const error = ErrorHandler.createMissingParameterError('username');

      expect(error.type).toBe(ErrorType.MISSING_PARAMETER);
      expect(error.message).toContain('username');
      expect(error.details.parameter).toBe('username');
    });

    test('createSecurityError 应该创建安全错误', () => {
      const error = ErrorHandler.createSecurityError('检测到恶意脚本');

      expect(error.type).toBe(ErrorType.SECURITY_VIOLATION);
      expect(error.message).toContain('检测到恶意脚本');
      expect(error.details.reason).toBe('检测到恶意脚本');
    });
  });

  describe('formatErrorResponse', () => {
    test('应该返回正确格式的错误响应', () => {
      const mcpError = new McpError(ErrorType.NETWORK_ERROR, '网络错误', null, {
        url: 'https://example.com',
      });

      const formatted = ErrorHandler.formatErrorResponse(mcpError);
      const errorData = JSON.parse(formatted);

      expect(errorData).toHaveProperty('error');
      expect(errorData).toHaveProperty('details');
      expect(errorData.error).toHaveProperty('type', ErrorType.NETWORK_ERROR);
      expect(errorData.error).toHaveProperty('message');
      expect(errorData.error).toHaveProperty('suggestions');
      expect(errorData.error).toHaveProperty('timestamp');
      expect(errorData.details.url).toBe('https://example.com');
    });

    test('建议数量应该限制在3个以内', () => {
      const mcpError = new McpError(
        ErrorType.AUTHENTICATION_FAILED,
        '认证失败',
      );
      const formatted = ErrorHandler.formatErrorResponse(mcpError);
      const errorData = JSON.parse(formatted);

      expect(errorData.error.suggestions.length).toBeLessThanOrEqual(3);
    });
  });
});

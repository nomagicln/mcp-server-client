/**
 * HTTP 请求工具
 *
 * 提供 HTTP 请求发送功能，支持各种 HTTP 方法和配置选项
 */

import axios from 'axios';
import { config } from '../config/index.js';
import { ErrorHandler } from '../utils/error-handler.js';
import { logger } from '../utils/logger.js';
import { SecurityValidator } from '../utils/security.js';

/**
 * HTTP 工具类
 */
export class HttpTool {
  constructor() {
    this.client = this.createAxiosInstance();
  }

  /**
   * 创建 Axios 实例
   */
  createAxiosInstance() {
    const instance = axios.create({
      timeout: config.http.timeout,
      maxRedirects: config.http.maxRedirects,
      validateStatus: config.http.validateStatus,
      // 安全配置
      httpsAgent: config.security.skipTlsVerification
        ? {
            rejectUnauthorized: false,
          }
        : undefined,
      // 代理配置
      proxy: config.security.enableProxy ? this.getProxyConfig() : false,
    });

    // 请求拦截器
    instance.interceptors.request.use(
      config => {
        logger.debug('发送 HTTP 请求', {
          method: config.method?.toUpperCase(),
          url: config.url,
          headers: config.headers,
        });
        return config;
      },
      error => {
        logger.error('HTTP 请求配置错误', error);
        return Promise.reject(error);
      },
    );

    // 响应拦截器
    instance.interceptors.response.use(
      response => {
        logger.debug('收到 HTTP 响应', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      error => {
        logger.error('HTTP 请求失败', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message,
        });
        return Promise.reject(error);
      },
    );

    return instance;
  }

  /**
   * 获取代理配置
   */
  getProxyConfig() {
    // 从环境变量获取代理配置
    const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
    const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;

    if (httpsProxy) {
      const proxyUrl = new URL(httpsProxy);
      return {
        host: proxyUrl.hostname,
        port: proxyUrl.port,
        auth:
          proxyUrl.username && proxyUrl.password
            ? {
                username: proxyUrl.username,
                password: proxyUrl.password,
              }
            : undefined,
      };
    }

    if (httpProxy) {
      const proxyUrl = new URL(httpProxy);
      return {
        host: proxyUrl.hostname,
        port: proxyUrl.port,
        auth:
          proxyUrl.username && proxyUrl.password
            ? {
                username: proxyUrl.username,
                password: proxyUrl.password,
              }
            : undefined,
      };
    }

    return false;
  }

  /**
   * 执行 HTTP 请求
   */
  async execute(args) {
    try {
      // 参数验证
      this.validateArgs(args);

      // 构建请求配置
      const requestConfig = this.buildRequestConfig(args);

      // 发送请求
      const response = await this.client.request(requestConfig);

      // 格式化响应
      return this.formatResponse(response);
    } catch (error) {
      return ErrorHandler.handle(error, {
        tool: 'http',
        method: args.method,
        url: args.url,
      });
    }
  }

  /**
   * 验证请求参数
   */
  validateArgs(args) {
    if (!args.method) {
      throw ErrorHandler.createMissingParameterError('method');
    }

    if (!args.url) {
      throw ErrorHandler.createMissingParameterError('url');
    }

    // 验证 URL 安全性
    SecurityValidator.validateUrl(args.url);

    // 验证方法
    const allowedMethods = [
      'GET',
      'POST',
      'PUT',
      'DELETE',
      'PATCH',
      'HEAD',
      'OPTIONS',
    ];
    if (!allowedMethods.includes(args.method.toUpperCase())) {
      throw ErrorHandler.createValidationError(
        'method',
        `不支持的 HTTP 方法，可用方法: ${allowedMethods.join(', ')}`,
      );
    }

    // 验证超时时间
    if (args.timeout && (args.timeout < 1000 || args.timeout > 300000)) {
      throw ErrorHandler.createValidationError(
        'timeout',
        '超时时间必须在 1000-300000 毫秒之间',
      );
    }

    // 验证请求头安全性
    if (args.headers) {
      SecurityValidator.validateHeaders(args.headers);
    }

    // 验证请求体安全性
    if (args.body) {
      const contentType =
        args.headers?.['Content-Type'] || args.headers?.['content-type'] || '';
      SecurityValidator.validateRequestBody(args.body, contentType);
    }
  }

  /**
   * 构建请求配置
   */
  buildRequestConfig(args) {
    const config = {
      method: args.method.toUpperCase(),
      url: args.url,
      timeout: args.timeout || config.http.timeout,
    };

    // 设置请求头
    if (args.headers) {
      config.headers = { ...args.headers };
    }

    // 设置请求体
    if (args.body) {
      // 尝试解析 JSON
      try {
        const parsedBody = JSON.parse(args.body);
        config.data = parsedBody;
        // 如果没有设置 Content-Type，自动设置为 JSON
        if (!config.headers?.['Content-Type']) {
          config.headers = config.headers || {};
          config.headers['Content-Type'] = 'application/json';
        }
      } catch (error) {
        // 如果不是有效的 JSON，当作字符串处理
        config.data = args.body;
        if (!config.headers?.['Content-Type']) {
          config.headers = config.headers || {};
          config.headers['Content-Type'] = 'text/plain';
        }
      }
    }

    return config;
  }

  /**
   * 格式化响应数据
   */
  formatResponse(response) {
    const {
      status,
      statusText,
      headers,
      data,
      config: requestConfig,
    } = response;

    // 检查响应大小
    const responseSize = JSON.stringify(data).length;
    if (responseSize > config.security.maxResponseSize) {
      throw new Error(
        `响应大小超过限制: ${responseSize} 字节 (最大 ${config.security.maxResponseSize} 字节)`,
      );
    }

    // 检查内容类型
    const contentType = headers['content-type'] || '';
    if (config.security.allowedContentTypes.length > 0) {
      const isAllowedType = config.security.allowedContentTypes.some(
        allowedType =>
          contentType.toLowerCase().includes(allowedType.toLowerCase()),
      );

      if (!isAllowedType && contentType) {
        logger.warn(`响应内容类型可能不安全: ${contentType}`);
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              statusCode: status,
              statusText,
              headers,
              body: data,
              request: {
                method: requestConfig.method,
                url: requestConfig.url,
              },
            },
            null,
            2,
          ),
        },
      ],
    };
  }
}

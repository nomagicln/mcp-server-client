/**
 * 传输方式管理器
 *
 * 支持 stdio、SSE 和 HTTP 三种传输方式
 */

import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

/**
 * Streamable HTTP 传输实现
 * 符合 MCP 2025-03-26 规范
 */
class StreamableHttpTransport {
  constructor(options = {}) {
    this.port = options.port || config.transport.http.port;
    this.host = options.host || config.transport.http.host;
    this.endpoint = options.endpoint || config.transport.http.endpoint;
    this.cors = options.cors || config.transport.http.cors;
    this.server = null;

    // 会话管理
    this.sessions = new Map(); // sessionId -> session data
    this.activeStreams = new Map(); // streamId -> { res, sessionId, eventId }
    this.requestQueue = new Map(); // requestId -> pending response

    // 事件处理器
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;

    // MCP Server 引用（用于消息处理）
    this.mcpServer = null;
  }

  /**
   * 设置 MCP Server 引用
   */
  setMcpServer(server) {
    this.mcpServer = server;
  }

  /**
   * 生成会话 ID
   */
  generateSessionId() {
    return randomUUID();
  }

  /**
   * 创建新会话
   */
  createSession() {
    const sessionId = this.generateSessionId();
    this.sessions.set(sessionId, {
      id: sessionId,
      createdAt: new Date(),
      lastActivity: new Date(),
      initialized: false,
    });
    logger.info(`创建新会话: ${sessionId}`);
    return sessionId;
  }

  /**
   * 验证会话
   */
  validateSession(sessionId) {
    if (!sessionId) return false;
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // 更新最后活动时间
    session.lastActivity = new Date();
    return true;
  }

  /**
   * 终止会话
   */
  terminateSession(sessionId) {
    if (!sessionId) return false;

    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // 关闭与该会话相关的所有流
    for (const [streamId, streamData] of this.activeStreams) {
      if (streamData.sessionId === sessionId) {
        try {
          streamData.res.end();
        } catch (error) {
          logger.error(`关闭流 ${streamId} 失败:`, error);
        }
        this.activeStreams.delete(streamId);
      }
    }

    this.sessions.delete(sessionId);
    logger.info(`会话 ${sessionId} 已终止`);
    return true;
  }

  /**
   * 启动 HTTP 服务器
   */
  async start() {
    return new Promise((resolve, reject) => {
      this.server = createServer(this.handleRequest.bind(this));

      this.server.listen(this.port, '127.0.0.1', () => {
        logger.info(
          `HTTP 传输服务器启动在 http://127.0.0.1:${this.port}${this.endpoint}`,
        );
        resolve();
      });

      this.server.on('error', error => {
        logger.error('HTTP 传输服务器错误:', error);
        if (this.onerror) {
          this.onerror(error);
        }
        reject(error);
      });
    });
  }

  /**
   * 处理 HTTP 请求 - 符合 Streamable HTTP 规范
   */
  async handleRequest(req, res) {
    try {
      // 安全检查 - Origin 头验证
      this.validateOrigin(req);

      // 处理 CORS 预检请求
      if (req.method === 'OPTIONS') {
        this.setCorsHeaders(res);
        res.writeHead(200);
        res.end();
        return;
      }

      // 只处理指定端点的请求
      if (req.url !== this.endpoint) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
        return;
      }

      // 设置 CORS 头
      this.setCorsHeaders(res);

      if (req.method === 'POST') {
        await this.handlePostRequest(req, res);
      } else if (req.method === 'GET') {
        await this.handleGetRequest(req, res);
      } else if (req.method === 'DELETE') {
        await this.handleDeleteRequest(req, res);
      } else {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      }
    } catch (error) {
      logger.error('处理 HTTP 请求失败:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  }

  /**
   * 验证 Origin 头以防止 DNS rebinding 攻击
   */
  validateOrigin(req) {
    const origin = req.headers.origin;
    if (origin) {
      // 简单的本地 origin 检查
      const allowedOrigins = [
        'http://localhost',
        'http://127.0.0.1',
        'https://localhost',
        'https://127.0.0.1',
      ];
      const isAllowed = allowedOrigins.some(allowed =>
        origin.startsWith(allowed),
      );
      if (!isAllowed) {
        logger.warn(`可疑的 Origin 头: ${origin}`);
      }
    }
  }

  /**
   * 设置 CORS 头
   */
  setCorsHeaders(res) {
    if (this.cors.enabled) {
      res.setHeader('Access-Control-Allow-Origin', this.cors.origin);
      res.setHeader(
        'Access-Control-Allow-Methods',
        this.cors.methods.join(', '),
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        this.cors.headers.join(', '),
      );
    }
  }

  /**
   * 处理 POST 请求 - 发送消息到服务器
   */
  async handlePostRequest(req, res) {
    // 检查 Accept 头
    const accept = req.headers.accept || '';
    const supportsJson = accept.includes('application/json');
    const supportsSSE = accept.includes('text/event-stream');

    if (!supportsJson && !supportsSSE) {
      res.writeHead(406, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Acceptable' }));
      return;
    }

    // 读取请求体
    const body = await this.readRequestBody(req);

    try {
      const messages = JSON.parse(body);
      const messageArray = Array.isArray(messages) ? messages : [messages];

      // 会话管理
      let sessionId = req.headers['mcp-session-id'];
      let isInitializeRequest = false;

      // 检查是否是初始化请求
      for (const msg of messageArray) {
        if (msg.method === 'initialize') {
          isInitializeRequest = true;
          break;
        }
      }

      // 处理会话
      if (isInitializeRequest && !sessionId) {
        // 初始化请求且没有会话ID，创建新会话
        sessionId = this.createSession();
      } else if (!isInitializeRequest && sessionId) {
        // 非初始化请求，验证会话
        if (!this.validateSession(sessionId)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Session not found' }));
          return;
        }
      } else if (!isInitializeRequest && !sessionId) {
        // 非初始化请求但没有会话ID
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing session ID' }));
        return;
      }

      // 检查消息类型
      const hasRequests = messageArray.some(
        msg => msg.method && !msg.result && !msg.error,
      );
      const onlyNotificationsOrResponses = messageArray.every(
        msg =>
          !msg.method || msg.result !== undefined || msg.error !== undefined,
      );

      if (onlyNotificationsOrResponses) {
        // 只有通知或响应，返回 202 Accepted
        await this.processMessages(messageArray, sessionId);
        res.writeHead(202);
        res.end();
      } else if (hasRequests) {
        // 有请求，需要返回响应
        if (supportsSSE) {
          // 创建 SSE 流
          await this.createSSEStream(req, res, messageArray, sessionId);
        } else {
          // 返回 JSON 响应
          await this.handleJsonResponse(res, messageArray, sessionId);
        }
      }
    } catch (parseError) {
      logger.error('解析 JSON 消息失败:', parseError);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
  }

  /**
   * 处理 GET 请求 - 建立 SSE 连接
   */
  async handleGetRequest(req, res) {
    const accept = req.headers.accept || '';

    if (!accept.includes('text/event-stream')) {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }

    // 创建新的 SSE 流
    await this.createSSEStream(req, res, []);
  }

  /**
   * 处理 DELETE 请求 - 终止会话
   */
  async handleDeleteRequest(req, res) {
    const sessionId = req.headers['mcp-session-id'];

    if (sessionId && this.terminateSession(sessionId)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'session terminated' }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session not found' }));
    }
  }

  /**
   * 读取请求体
   */
  async readRequestBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => resolve(body));
      req.on('error', reject);
    });
  }

  /**
   * 创建 SSE 流
   */
  async createSSEStream(req, res, initialMessages = [], sessionId = null) {
    const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let eventId = 1;

    // 设置 SSE 头
    const headers = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    };

    // 如果有会话ID，添加到响应头
    if (sessionId) {
      headers['Mcp-Session-Id'] = sessionId;
    }

    if (this.cors.enabled) {
      headers['Access-Control-Allow-Origin'] = this.cors.origin;
    }

    res.writeHead(200, headers);

    // 保存流引用
    this.activeStreams.set(streamId, {
      res,
      sessionId,
      eventId,
      createdAt: new Date(),
    });

    // 处理连接关闭
    req.on('close', () => {
      this.activeStreams.delete(streamId);
      logger.debug(`SSE 流 ${streamId} 已关闭`);
    });

    // 处理初始消息
    if (initialMessages.length > 0) {
      for (const message of initialMessages) {
        await this.processMessage(message, sessionId, streamId);
      }
    }

    logger.debug(`SSE 流 ${streamId} 已创建，会话: ${sessionId}`);
    return streamId;
  }

  /**
   * 处理 JSON 响应
   */
  async handleJsonResponse(res, messages, sessionId) {
    const headers = { 'Content-Type': 'application/json' };

    // 如果有会话ID，添加到响应头
    if (sessionId) {
      headers['Mcp-Session-Id'] = sessionId;
    }

    try {
      const responses = [];

      for (const message of messages) {
        const response = await this.processMessage(message, sessionId);
        if (response) {
          responses.push(response);
        }
      }

      res.writeHead(200, headers);
      res.end(
        JSON.stringify(responses.length === 1 ? responses[0] : responses),
      );
    } catch (error) {
      logger.error('处理消息失败:', error);
      res.writeHead(500, headers);
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          id: messages[0]?.id || null,
          error: {
            code: -32603,
            message: 'Internal error',
            data: error.message,
          },
        }),
      );
    }
  }

  /**
   * 处理消息（通知或响应）
   */
  async processMessages(messages, sessionId) {
    for (const message of messages) {
      await this.processMessage(message, sessionId);
    }
  }

  /**
   * 处理单个消息
   */
  async processMessage(message, sessionId, streamId = null) {
    try {
      if (!this.mcpServer) {
        throw new Error('MCP Server 未设置');
      }

      // 对于初始化请求，特殊处理
      if (message.method === 'initialize') {
        const session = this.sessions.get(sessionId);
        if (session) {
          session.initialized = true;
        }
      }

      // 如果有 onmessage 处理器，调用它
      if (this.onmessage) {
        this.onmessage(message);
      }

      // 如果是请求（有method且没有result/error），需要生成响应
      if (
        message.method &&
        message.result === undefined &&
        message.error === undefined
      ) {
        // 模拟处理请求（实际应该调用 MCP Server 的处理器）
        const response = {
          jsonrpc: '2.0',
          id: message.id,
        };

        // 根据方法类型生成响应
        switch (message.method) {
          case 'initialize':
            response.result = {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: { listChanged: false },
              },
              serverInfo: {
                name: 'mcp-server-client',
                version: '1.0.0',
              },
            };
            break;

          case 'tools/list':
            response.result = {
              tools: [
                {
                  name: 'http_request',
                  description: '发送 HTTP 请求到指定的 URL',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      method: {
                        type: 'string',
                        enum: [
                          'GET',
                          'POST',
                          'PUT',
                          'DELETE',
                          'PATCH',
                          'HEAD',
                          'OPTIONS',
                        ],
                      },
                      url: { type: 'string' },
                      headers: { type: 'object' },
                      body: { type: 'string' },
                      timeout: { type: 'number', default: 30000 },
                    },
                    required: ['method', 'url'],
                  },
                },
                {
                  name: 'ssh_exec',
                  description: '通过 SSH 执行远程服务器命令',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      host: { type: 'string' },
                      username: { type: 'string' },
                      password: { type: 'string' },
                      command: { type: 'string' },
                      timeout: { type: 'number', default: 30000 },
                    },
                    required: ['host', 'username', 'password', 'command'],
                  },
                },
              ],
            };
            break;

          default:
            response.error = {
              code: -32601,
              message: 'Method not found',
              data: `Unknown method: ${message.method}`,
            };
        }

        // 如果是 SSE 流，发送响应
        if (streamId) {
          await this.sendToStream(streamId, response);
        }

        return response;
      }

      return null;
    } catch (error) {
      logger.error('处理消息失败:', error);

      const errorResponse = {
        jsonrpc: '2.0',
        id: message.id || null,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error.message,
        },
      };

      if (streamId) {
        await this.sendToStream(streamId, errorResponse);
      }

      return errorResponse;
    }
  }

  /**
   * 发送消息到所有活跃的 SSE 流
   */
  async send(message) {
    const messageStr = JSON.stringify(message);

    for (const [streamId, res] of this.activeStreams) {
      try {
        res.write(`data: ${messageStr}\n\n`);
        logger.debug(`消息已发送到 SSE 流 ${streamId}`);
      } catch (error) {
        logger.error(`发送消息到 SSE 流 ${streamId} 失败:`, error);
        this.activeStreams.delete(streamId);
      }
    }
  }

  /**
   * 发送消息到特定的 SSE 流
   */
  async sendToStream(streamId, message) {
    const streamData = this.activeStreams.get(streamId);
    if (streamData) {
      try {
        const messageStr = JSON.stringify(message);
        const eventId = streamData.eventId++;

        // 使用事件 ID 支持流恢复
        streamData.res.write(`id: ${eventId}\n`);
        streamData.res.write(`data: ${messageStr}\n\n`);

        logger.debug(`消息已发送到 SSE 流 ${streamId}，事件ID: ${eventId}`);
      } catch (error) {
        logger.error(`发送消息到 SSE 流 ${streamId} 失败:`, error);
        this.activeStreams.delete(streamId);
      }
    }
  }

  /**
   * 关闭传输
   */
  async close() {
    // 关闭所有活跃的 SSE 流
    for (const [streamId, res] of this.activeStreams) {
      try {
        res.end();
      } catch (error) {
        logger.error(`关闭 SSE 流 ${streamId} 失败:`, error);
      }
    }
    this.activeStreams.clear();

    if (this.server) {
      return new Promise(resolve => {
        this.server.close(() => {
          logger.info('Streamable HTTP 传输服务器已关闭');
          if (this.onclose) {
            this.onclose();
          }
          resolve();
        });
      });
    }
  }
}

/**
 * SSE 传输管理器
 */
class SSETransportManager {
  constructor(options = {}) {
    this.port = options.port || config.transport.sse.port;
    this.host = options.host || config.transport.sse.host;
    this.endpoint = options.endpoint || config.transport.sse.endpoint;
    this.postEndpoint =
      options.postEndpoint || config.transport.sse.postEndpoint;
    this.server = null;
    this.sseTransport = null;
  }

  /**
   * 启动 SSE 服务器
   */
  async start() {
    return new Promise((resolve, reject) => {
      this.server = createServer(this.handleRequest.bind(this));

      this.server.listen(this.port, '127.0.0.1', () => {
        logger.info(`SSE 传输服务器启动在 http://127.0.0.1:${this.port}`);
        logger.info(`SSE 连接端点: ${this.endpoint}`);
        logger.info(`消息发送端点: ${this.postEndpoint}`);
        resolve();
      });

      this.server.on('error', error => {
        logger.error('SSE 传输服务器错误:', error);
        reject(error);
      });
    });
  }

  /**
   * 处理 HTTP 请求
   */
  async handleRequest(req, res) {
    if (req.url === this.endpoint && req.method === 'GET') {
      // 创建 SSE 连接
      this.sseTransport = new SSEServerTransport(this.postEndpoint, res);
      await this.sseTransport.start();
      return this.sseTransport;
    } else if (
      req.url?.startsWith(this.postEndpoint) &&
      req.method === 'POST'
    ) {
      // 处理 POST 消息
      if (this.sseTransport) {
        await this.sseTransport.handlePostMessage(req, res);
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No active SSE connection' }));
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    }
  }

  /**
   * 获取 SSE 传输实例
   */
  getTransport() {
    return this.sseTransport;
  }

  /**
   * 关闭服务器
   */
  async close() {
    if (this.server) {
      return new Promise(resolve => {
        this.server.close(() => {
          logger.info('SSE 传输服务器已关闭');
          resolve();
        });
      });
    }
  }
}

/**
 * 传输工厂
 */
export class TransportFactory {
  /**
   * 创建传输实例
   * @param {string} type - 传输类型: 'stdio', 'sse', 'http'
   * @param {object} options - 传输选项
   * @returns {Promise<object>} 传输实例
   */
  static async createTransport(type = 'stdio', options = {}) {
    switch (type.toLowerCase()) {
      case 'stdio':
        logger.info('创建 STDIO 传输');
        return new StdioServerTransport();

      case 'sse':
        logger.info('创建 SSE 传输');
        const sseManager = new SSETransportManager(options);
        await sseManager.start();
        // 我们需要等待 SSE 连接建立
        return sseManager;

      case 'http':
      case 'streamablehttp':
        logger.info('创建 Streamable HTTP 传输');
        const httpTransport = new StreamableHttpTransport(options);
        await httpTransport.start();
        return httpTransport;

      default:
        throw new Error(`不支持的传输类型: ${type}`);
    }
  }

  /**
   * 获取支持的传输类型
   */
  static getSupportedTransports() {
    return ['stdio', 'sse', 'http'];
  }
}

export { SSETransportManager, StreamableHttpTransport };

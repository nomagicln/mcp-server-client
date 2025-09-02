#!/usr/bin/env node

/**
 * MCP Server Client - 主入口文件
 *
 * 提供 HTTP 请求和 SSH 命令执行功能的 MCP Server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import * as mcpTypes from '@modelcontextprotocol/sdk/types.js';

// 导入工具
import { HttpTool } from './tools/http.js';
import { SshTool } from './tools/ssh.js';

// 导入配置和传输
import { config } from './config/index.js';
import { TransportFactory } from './transports/index.js';

// 导入工具函数
import { logger } from './utils/logger.js';

/**
 * 服务器类
 */
class McpServerClient {
  constructor(transportType = null) {
    this.server = null;
    this.tools = {};
    this.transport = null;
    this.transportType = transportType || config.transport.default;
    this.setupTools();
  }

  /**
   * 初始化工具
   */
  setupTools() {
    this.tools.http = new HttpTool();
    this.tools.ssh = new SshTool();
  }

  /**
   * 启动服务器
   */
  async start() {
    try {
      logger.info('正在启动 MCP Server Client...');
      logger.info(`使用传输方式: ${this.transportType}`);

      // 创建服务器实例
      this.server = new Server({
        name: 'mcp-server-client',
        version: '1.0.0',
      });

      // 注册工具
      await this.registerTools();

      // 设置请求处理器
      this.setupHandlers();

      // 创建传输层
      await this.createTransport();

      logger.info('MCP Server Client 已启动并准备就绪');
      logger.info('支持的工具: http_request, ssh_exec');
      logger.info(`传输方式: ${this.transportType}`);

      // 根据传输类型显示不同的连接信息
      this.displayConnectionInfo();
    } catch (error) {
      logger.error('服务器启动失败:', error);
      console.error('详细错误信息:', error.message);
      console.error('错误堆栈:', error.stack);
      process.exit(1);
    }
  }

  /**
   * 注册工具到服务器
   */
  async registerTools() {
    try {
      // 注册工具列表处理器
      this.server.setRequestHandler(
        mcpTypes.ListToolsRequestSchema,
        async () => {
          logger.debug('处理工具列表请求');
          return {
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
                      description: 'HTTP 请求方法',
                    },
                    url: {
                      type: 'string',
                      description: '请求 URL',
                    },
                    headers: {
                      type: 'object',
                      description: '请求头对象',
                      additionalProperties: {
                        type: 'string',
                      },
                    },
                    body: {
                      type: 'string',
                      description: '请求体内容 (JSON 字符串或纯文本)',
                    },
                    timeout: {
                      type: 'number',
                      description: '请求超时时间 (毫秒)',
                      default: 30000,
                    },
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
                    host: {
                      type: 'string',
                      description: '目标服务器地址 (格式: host:port)',
                    },
                    username: {
                      type: 'string',
                      description: 'SSH 用户名',
                    },
                    password: {
                      type: 'string',
                      description: 'SSH 密码',
                    },
                    command: {
                      type: 'string',
                      description: '要执行的命令',
                    },
                    timeout: {
                      type: 'number',
                      description: '命令执行超时时间 (毫秒)',
                      default: 30000,
                    },
                  },
                  required: ['host', 'username', 'password', 'command'],
                },
              },
            ],
          };
        },
      );

      // 注册工具调用处理器
      this.server.setRequestHandler(
        mcpTypes.CallToolRequestSchema,
        this.handleToolCall.bind(this),
      );

      logger.info('工具注册完成');
    } catch (error) {
      logger.error('工具注册失败:', error);
      throw error;
    }
  }

  /**
   * 设置请求处理器
   */
  setupHandlers() {
    // 处理服务器信息请求
    this.server.setRequestHandler(
      mcpTypes.InitializeRequestSchema,
      async request => {
        return {
          protocolVersion: request.params.protocolVersion,
          capabilities: {
            tools: {
              listChanged: false,
            },
          },
          serverInfo: {
            name: 'mcp-server-client',
            version: '1.0.0',
          },
        };
      },
    );
  }

  /**
   * 处理工具调用
   */
  async handleToolCall(request) {
    const { name, arguments: args } = request.params;

    try {
      logger.info(`执行工具: ${name}`, { args });

      let result;

      switch (name) {
        case 'http_request':
          result = await this.tools.http.execute(args);
          break;

        case 'ssh_exec':
          result = await this.tools.ssh.execute(args);
          break;

        default:
          throw new Error(`未知工具: ${name}`);
      }

      logger.info(`工具执行成功: ${name}`);
      return result;
    } catch (error) {
      logger.error(`工具执行失败: ${name}`, error);

      return {
        content: [
          {
            type: 'text',
            text: `执行失败: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * 创建传输层
   */
  async createTransport() {
    try {
      // 根据传输类型获取配置
      const transportConfig = config.transport[this.transportType] || {};

      // 创建传输实例
      const transportInstance = await TransportFactory.createTransport(
        this.transportType,
        transportConfig,
      );

      // 特殊处理不同的传输类型
      if (this.transportType === 'sse') {
        // SSE 需要等待连接建立
        logger.info('等待 SSE 连接建立...');
        // 这里我们先设置传输管理器，实际的传输会在连接时创建
        this.transport = transportInstance;
      } else if (this.transportType === 'http') {
        // HTTP 传输需要设置 MCP Server 引用
        this.transport = transportInstance;
        if (typeof transportInstance.setMcpServer === 'function') {
          transportInstance.setMcpServer(this.server);
        }
        // HTTP 传输不需要传统的 connect，它通过 HTTP 请求工作
      } else {
        // stdio 传输
        this.transport = transportInstance;
        // 连接服务器
        await this.server.connect(transportInstance);
      }
    } catch (error) {
      logger.error('创建传输层失败:', error);
      throw error;
    }
  }

  /**
   * 显示连接信息
   */
  displayConnectionInfo() {
    const transportConfig = config.transport[this.transportType];

    switch (this.transportType) {
      case 'stdio':
        console.log('✅ STDIO 传输已启动');
        console.log('📝 服务器通过标准输入输出进行通信');
        break;

      case 'sse':
        console.log('✅ SSE 传输已启动');
        console.log(
          `🌐 SSE 连接端点: http://${transportConfig.host}:${transportConfig.port}${transportConfig.endpoint}`,
        );
        console.log(
          `📮 消息发送端点: http://${transportConfig.host}:${transportConfig.port}${transportConfig.postEndpoint}`,
        );
        break;

      case 'http':
        console.log('✅ HTTP 传输已启动');
        console.log(
          `🌐 HTTP 端点: http://${transportConfig.host}:${transportConfig.port}${transportConfig.endpoint}`,
        );
        console.log('📝 客户端可通过 POST 请求发送消息');
        break;

      default:
        console.log(`✅ ${this.transportType} 传输已启动`);
    }
  }

  /**
   * 停止服务器
   */
  async stop() {
    try {
      // 清理 SSH 连接
      if (this.tools.ssh && typeof this.tools.ssh.cleanup === 'function') {
        this.tools.ssh.cleanup();
      }

      // 关闭传输
      if (this.transport && typeof this.transport.close === 'function') {
        await this.transport.close();
      }

      // 关闭 MCP 服务器
      if (this.server) {
        await this.server.close();
      }

      logger.info('MCP Server Client 已停止');
    } catch (error) {
      logger.error('停止服务器时发生错误:', error);
    }
  }
}

// 解析命令行参数获取传输类型
const getTransportFromArgs = () => {
  const args = process.argv.slice(2);
  const transportIndex = args.findIndex(
    arg => arg === '--transport' || arg === '-t',
  );

  if (transportIndex !== -1 && args[transportIndex + 1]) {
    return args[transportIndex + 1];
  }

  // 检查环境变量
  return process.env.MCP_TRANSPORT || config.transport.default;
};

// 创建服务器实例
const transportType = getTransportFromArgs();
const server = new McpServerClient(transportType);

// 处理进程信号
process.on('SIGINT', async () => {
  logger.info('收到 SIGINT 信号，正在关闭服务器...');
  await server.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('收到 SIGTERM 信号，正在关闭服务器...');
  await server.stop();
  process.exit(0);
});

// 处理未捕获的异常
process.on('uncaughtException', error => {
  logger.error('未捕获的异常:', error);
  server.stop().finally(() => {
    process.exit(1);
  });
});

process.on('unhandledRejection', (reason, _promise) => {
  logger.error('未处理的 Promise 拒绝:', reason);
  server.stop().finally(() => {
    process.exit(1);
  });
});

// 启动服务器
server.start().catch(error => {
  logger.error('服务器启动过程中发生错误:', error);
  process.exit(1);
});

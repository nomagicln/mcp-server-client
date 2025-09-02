/**
 * 配置文件
 */

export const config = {
  // HTTP 配置
  http: {
    timeout: 30000, // 默认超时时间 (毫秒)
    maxRedirects: 5, // 最大重定向次数
    retryAttempts: 3, // 重试次数
    retryDelay: 1000, // 重试延迟 (毫秒)
    validateStatus: status => status >= 200 && status < 400, // 状态码验证
  },

  // SSH 配置
  ssh: {
    timeout: 30000, // 默认超时时间 (毫秒)
    keepaliveInterval: 10000, // 保活间隔 (毫秒)
    readyTimeout: 20000, // 连接就绪超时 (毫秒)
    maxConnections: 10, // 最大连接数
  },

  // 安全配置
  security: {
    skipTlsVerification: false, // 是否跳过 TLS 验证
    allowedContentTypes: [
      'application/json',
      'application/xml',
      'text/plain',
      'text/html',
      'text/xml',
      'application/x-www-form-urlencoded',
    ],
    maxResponseSize: 10 * 1024 * 1024, // 最大响应大小 (10MB)
    maxRequestSize: 5 * 1024 * 1024, // 最大请求大小 (5MB)
    enableProxy: true, // 是否启用代理支持
    allowLocalRequests: false, // 是否允许本地和私有网络请求
    allowLocalConnections: false, // 是否允许本地和私有网络 SSH 连接
    rateLimitWindow: 60 * 1000, // 速率限制窗口 (毫秒)
    rateLimitMaxRequests: 100, // 速率限制最大请求数
  },

  // 传输配置
  transport: {
    // 默认传输方式: stdio, sse, http
    default: process.env.MCP_TRANSPORT || 'stdio',

    // stdio 配置
    stdio: {
      // stdio 无需额外配置
    },

    // SSE 配置
    sse: {
      port: parseInt(process.env.MCP_SSE_PORT) || 3001,
      host: process.env.MCP_SSE_HOST || 'localhost',
      endpoint: process.env.MCP_SSE_ENDPOINT || '/sse',
      postEndpoint: process.env.MCP_SSE_POST_ENDPOINT || '/message',
    },

    // HTTP 配置
    http: {
      port: parseInt(process.env.MCP_HTTP_PORT) || 3002,
      host: process.env.MCP_HTTP_HOST || 'localhost',
      endpoint: process.env.MCP_HTTP_ENDPOINT || '/mcp',
      cors: {
        enabled: true,
        origin: '*',
        methods: ['GET', 'POST', 'OPTIONS'],
        headers: ['Content-Type', 'Authorization'],
      },
    },
  },

  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'json',
    timestamp: true,
  },
};

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
    // 可配置算法（默认关闭）。开启后会将 algorithms 传入 ssh2。
    algorithms: {
      enabled: process.env.MCP_SSH_ALGORITHMS_ENABLED === '1' || false,
      // 连接失败若疑似算法问题时，是否回退为 ssh2 默认算法重试一次
      fallbackOnError:
        process.env.MCP_SSH_ALGORITHMS_FALLBACK !== '0' /* 默认开启 */,
      // 逗号分隔字符串解析为数组的工具
      _parse(list) {
        return String(list || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
      },
      // 各类算法列表可通过环境变量覆盖
      kex: (() => {
        const v = process.env.MCP_SSH_KEX_ALGORITHMS;
        return v
          ? v
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)
          : [
              'curve25519-sha256',
              'curve25519-sha256@libssh.org',
              'ecdh-sha2-nistp256',
              'ecdh-sha2-nistp384',
              'ecdh-sha2-nistp521',
              'diffie-hellman-group-exchange-sha256',
              'diffie-hellman-group14-sha1',
            ];
      })(),
      cipher: (() => {
        const v = process.env.MCP_SSH_CIPHER_ALGORITHMS;
        return v
          ? v
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)
          : [
              'aes128-gcm@openssh.com',
              'aes256-gcm@openssh.com',
              'aes128-ctr',
              'aes256-ctr',
            ];
      })(),
      hmac: (() => {
        const v = process.env.MCP_SSH_HMAC_ALGORITHMS;
        return v
          ? v
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)
          : ['hmac-sha2-256', 'hmac-sha2-512'];
      })(),
      serverHostKey: (() => {
        const v = process.env.MCP_SSH_HOSTKEY_ALGORITHMS;
        return v
          ? v
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)
          : undefined;
      })(),
    },
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

    // 自定义安全校验器（可选）
    customValidators: {
      enabled: process.env.MCP_SECURITY_VALIDATORS_ENABLED === '1' || false,
      // 可为相对路径或绝对路径；相对路径相对于进程工作目录
      path: process.env.MCP_SECURITY_VALIDATORS || '',
      // 组合策略：append(默认，先内置后自定义) | prepend(先自定义后内置) | override(仅自定义)
      mergeStrategy: process.env.MCP_SECURITY_VALIDATORS_STRATEGY || 'append',
    },
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

// 简单深合并（数组与原子类型直接覆盖；对象递归）
function deepMerge(target, source) {
  if (!source || typeof source !== 'object') {
    return target;
  }
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = target[key];
    if (
      sv &&
      typeof sv === 'object' &&
      !Array.isArray(sv) &&
      tv &&
      typeof tv === 'object' &&
      !Array.isArray(tv)
    ) {
      deepMerge(tv, sv);
    } else {
      target[key] = sv;
    }
  }
  return target;
}

// 重新应用环境变量覆盖，确保 ENV 优先级不被文件配置覆盖
function reapplyEnvOverrides(cfg) {
  // 日志
  if (process.env.LOG_LEVEL) {
    cfg.logging.level = process.env.LOG_LEVEL;
  }

  // 传输
  if (process.env.MCP_TRANSPORT) {
    cfg.transport.default = process.env.MCP_TRANSPORT;
  }

  // SSE
  if (process.env.MCP_SSE_PORT) {
    cfg.transport.sse.port =
      parseInt(process.env.MCP_SSE_PORT) || cfg.transport.sse.port;
  }
  if (process.env.MCP_SSE_HOST) {
    cfg.transport.sse.host = process.env.MCP_SSE_HOST;
  }
  if (process.env.MCP_SSE_ENDPOINT) {
    cfg.transport.sse.endpoint = process.env.MCP_SSE_ENDPOINT;
  }
  if (process.env.MCP_SSE_POST_ENDPOINT) {
    cfg.transport.sse.postEndpoint = process.env.MCP_SSE_POST_ENDPOINT;
  }

  // HTTP
  if (process.env.MCP_HTTP_PORT) {
    cfg.transport.http.port =
      parseInt(process.env.MCP_HTTP_PORT) || cfg.transport.http.port;
  }
  if (process.env.MCP_HTTP_HOST) {
    cfg.transport.http.host = process.env.MCP_HTTP_HOST;
  }
  if (process.env.MCP_HTTP_ENDPOINT) {
    cfg.transport.http.endpoint = process.env.MCP_HTTP_ENDPOINT;
  }

  // SSH 算法开关
  if ('MCP_SSH_ALGORITHMS_ENABLED' in process.env) {
    cfg.ssh.algorithms.enabled =
      process.env.MCP_SSH_ALGORITHMS_ENABLED === '1' || false;
  }
  if ('MCP_SSH_ALGORITHMS_FALLBACK' in process.env) {
    cfg.ssh.algorithms.fallbackOnError =
      process.env.MCP_SSH_ALGORITHMS_FALLBACK !== '0';
  }
  if (process.env.MCP_SSH_KEX_ALGORITHMS) {
    cfg.ssh.algorithms.kex = process.env.MCP_SSH_KEX_ALGORITHMS.split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }
  if (process.env.MCP_SSH_CIPHER_ALGORITHMS) {
    cfg.ssh.algorithms.cipher = process.env.MCP_SSH_CIPHER_ALGORITHMS.split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }
  if (process.env.MCP_SSH_HMAC_ALGORITHMS) {
    cfg.ssh.algorithms.hmac = process.env.MCP_SSH_HMAC_ALGORITHMS.split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }
  if (process.env.MCP_SSH_HOSTKEY_ALGORITHMS) {
    cfg.ssh.algorithms.serverHostKey =
      process.env.MCP_SSH_HOSTKEY_ALGORITHMS.split(',')
        .map(s => s.trim())
        .filter(Boolean);
  }

  // 自定义校验器
  if ('MCP_SECURITY_VALIDATORS_ENABLED' in process.env) {
    cfg.security.customValidators.enabled =
      process.env.MCP_SECURITY_VALIDATORS_ENABLED === '1' || false;
  }
  if (process.env.MCP_SECURITY_VALIDATORS) {
    cfg.security.customValidators.path = process.env.MCP_SECURITY_VALIDATORS;
  }
  if (process.env.MCP_SECURITY_VALIDATORS_STRATEGY) {
    cfg.security.customValidators.mergeStrategy =
      process.env.MCP_SECURITY_VALIDATORS_STRATEGY;
  }
}

// 将文件配置应用到运行时配置（保持 ENV 优先）
export function applyLoadedConfig(fileConfig) {
  if (fileConfig && typeof fileConfig === 'object') {
    deepMerge(config, fileConfig);
    reapplyEnvOverrides(config);
  }
}

// 获取当前配置（便于将来切换实现）
export function getConfig() {
  return config;
}

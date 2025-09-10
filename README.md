# MCP Server Client

一个基于 Node.js 的 Model Context Protocol (MCP) 服务器，提供 HTTP 请求发送和 SSH 命令执行功能。

## 功能特性

### 🌐 HTTP 请求工具 (`http_request`)

- **多种 HTTP 方法支持**：GET、POST、PUT、DELETE、PATCH、HEAD、OPTIONS
- **完整的请求配置**：自定义请求头、请求体、超时设置
- **安全验证**：URL 安全检查、请求头验证、内容大小限制
- **代理支持**：支持 HTTP/HTTPS 代理配置
- **TLS 配置**：可选择跳过 TLS 验证（开发环境）

### 🔧 SSH 命令执行工具 (`ssh_exec`)

- **安全连接**：密码认证、连接池管理
- **命令执行**：捕获标准输出、错误输出和退出码
- **安全防护**：危险命令检测、命令长度限制
- **超时控制**：连接超时和命令执行超时
- **连接优化**：自动连接清理和重用
- **算法可配置**：支持自定义 KEX/Cipher/HMAC/HostKey 算法清单与失败回退

### 🚀 多种传输方式支持

- **STDIO 传输**：标准输入输出，适合本地进程调用（默认）
- **SSE 传输**：Server-Sent Events，支持 Web 客户端实时通信
- **HTTP 传输**：RESTful HTTP 接口，支持传统 Web 应用集成

### 🛡️ 安全特性

- **输入验证**：严格的参数验证和清洗
- **私网保护**：阻止访问本地和私有网络地址
- **恶意内容检测**：SQL 注入、XSS 脚本检测
- **危险命令拦截**：防止执行破坏性系统命令
- **大小限制**：请求体和响应体大小控制
- **自定义安全校验器（可插拔）**：支持用户提供脚本扩展/覆盖默认校验（append/prepend/override）

### 📊 错误处理

- **统一错误分类**：网络错误、认证错误、验证错误等
- **用户友好消息**：中文错误信息和解决建议
- **详细日志记录**：结构化日志便于调试和监控
- **优雅降级**：错误恢复和连接重试机制

## 快速开始

### 使用 Makefile（推荐）

```bash
# 查看所有可用命令
make help

# 安装依赖
make install

# 启动开发模式
make dev

# 启动生产模式
make start

# 运行测试
make test

# 构建并运行 Docker 容器
make build-and-run

# 使用不同传输方式启动
make start TRANSPORT=stdio   # STDIO 传输（默认）
make start TRANSPORT=sse     # SSE 传输
make start TRANSPORT=http    # HTTP 传输
```

### 使用 npm 命令

```bash
# 安装依赖
npm install

# 启动服务器
npm start

# 开发模式
npm run dev
```

### 全局安装（推荐）

将 MCP Server Client 安装为全局命令，可以在任何位置使用：

```bash
# 方式1: 使用 Makefile（推荐）
make install-global

# 方式2: 使用 npm
npm install -g .

# 使用全局命令启动服务器
mcp-server-client start

# 或使用简化命令
mcpsc start

# 使用不同传输方式
mcp-server-client start --transport stdio   # STDIO 传输
mcp-server-client start --transport sse     # SSE 传输  
mcp-server-client start --transport http    # HTTP 传输

# 简化写法
mcpsc start -t sse                          # SSE 传输

# 查看版本信息
mcp-server-client version

# 查看支持的传输方式
mcp-server-client list-transports

# 查看帮助
mcp-server-client help
```

#### 开发模式全局链接

在开发过程中，可以创建全局链接，代码更改会立即生效：

```bash
# 创建开发链接
make link-global

# 移除开发链接
make unlink-global

# 卸载全局安装
make uninstall-global
```

## 配置说明

服务器配置位于 `src/config/index.js`，并支持从外部文件加载与热更新：

### 配置加载优先级

1) 启动参数 `--config <path>` 指定的配置文件
2) 环境变量 `MCP_CONFIG` 指定的配置文件
3) 默认搜索位置（依次查找以下目录中的文件，先找到先用）：

- 当前工作目录（CWD）
- 用户配置目录：`~/.config/mcp-server-client`
- 系统配置目录：`/etc/mcp-server-client`

支持的文件名（按优先级从上到下，无强制先后，仅第一个被找到的会被使用）：

- `mcp.config.json`
- `mcp.config.js`
- `mcp.config.mjs`
- `mcp.config.cjs`

JS 配置文件需默认导出配置对象（ESM/CJS 均支持）。JSON 文件需为有效的 JSON 对象。

### 启用配置热更新（可选）

两种方式任选其一：

- 设置环境变量：`MCP_WATCH_CONFIG=1`
- CLI 参数：在 `start` 命令后添加 `-w` 或 `--watch-config`

当检测到配置文件变更，将尝试解析与校验：

- 成功：应用新配置并继续运行
- 失败：保留上一次有效配置并记录警告

示例：

```bash
# 使用指定配置并开启热更新
mcp-server-client start --config ./mcp.config.js -w

# 或使用环境变量
MCP_CONFIG=./mcp.config.json MCP_WATCH_CONFIG=1 mcp-server-client start
```

```javascript
export const config = {
  // HTTP 配置
  http: {
    timeout: 30000,        // 请求超时 (毫秒)
    maxRedirects: 5,       // 最大重定向次数
    retryAttempts: 3,      // 重试次数
    retryDelay: 1000,      // 重试延迟 (毫秒)
  },
  
  // SSH 配置
  ssh: {
    timeout: 30000,        // 命令执行超时 (毫秒)
    connectionTimeout: 10000, // 连接超时 (毫秒)
    maxConnections: 10,    // 最大连接数
  },
  
  // 传输配置
  transport: {
    default: 'stdio',              // 默认传输方式
    
    // SSE 配置
    sse: {
      port: 3001,                  // SSE 服务端口
      host: 'localhost',           // 监听地址
      endpoint: '/sse',            // SSE 连接端点
      postEndpoint: '/message',    // 消息发送端点
    },
    
    // HTTP 配置  
    http: {
      port: 3002,                  // HTTP 服务端口
      host: 'localhost',           // 监听地址
      endpoint: '/mcp',            // HTTP 端点
    },
  },

  // 安全配置
  security: {
    skipTlsVerification: false,    // 跳过 TLS 验证
    enableProxy: true,             // 启用代理支持
    allowLocalRequests: false,     // 允许本地网络请求
    allowLocalConnections: false,  // 允许本地 SSH 连接
    maxResponseSize: 10 * 1024 * 1024, // 最大响应大小 (10MB)
    maxRequestSize: 5 * 1024 * 1024,   // 最大请求大小 (5MB)
    allowedContentTypes: [         // 允许的内容类型
      'application/json',
      'application/xml',
      'text/plain',
      'text/html'
    ]
  }
};
```

## MCP 传输方式详解

### STDIO 传输

STDIO 传输通过标准输入输出进行通信，适合本地进程调用：

```bash
# 启动 STDIO 服务器
mcp-server-client start --transport stdio

# 或使用环境变量
MCP_TRANSPORT=stdio mcp-server-client start
```

### SSE 传输

SSE（Server-Sent Events）传输支持 Web 客户端实时通信：

```bash
# 启动 SSE 服务器
mcp-server-client start --transport sse

# 自定义端口
MCP_SSE_PORT=3005 mcp-server-client start -t sse

# 客户端连接到 SSE 端点
# GET http://localhost:3001/sse

# 客户端发送消息到 POST 端点  
# POST http://localhost:3001/message?sessionId=<session_id>
```

### HTTP 传输

HTTP 传输提供 RESTful 接口，支持传统 Web 应用：

```bash
# 启动 HTTP 服务器
mcp-server-client start --transport http

# 自定义端口
MCP_HTTP_PORT=3006 mcp-server-client start -t http

# 客户端发送请求
# POST http://localhost:3002/mcp
```

## MCP 工具使用

### HTTP 请求工具

```json
{
  "method": "tools/call",
  "params": {
    "name": "http_request",
    "arguments": {
      "method": "GET",
      "url": "https://api.example.com/data",
      "headers": {
        "Authorization": "Bearer your-token",
        "Content-Type": "application/json"
      },
      "body": "{\"key\": \"value\"}",
      "timeout": 30000
    }
  }
}
```

**参数说明：**

- `method` (必需)：HTTP 方法
- `url` (必需)：请求 URL
- `headers` (可选)：请求头对象
- `body` (可选)：请求体内容
- `timeout` (可选)：超时时间，默认 30000 毫秒

### SSH 命令执行工具

```json
{
  "method": "tools/call",
  "params": {
    "name": "ssh_exec",
    "arguments": {
      "host": "example.com:22",
      "username": "admin",
      "password": "your-password",
      "command": "ls -la /home",
      "timeout": 30000
    }
  }
}
```

**参数说明：**

- `host` (必需)：服务器地址，格式 `host:port`
- `username` (必需)：SSH 用户名
- `password` (必需)：SSH 密码
- `command` (必需)：要执行的命令
- `timeout` (可选)：超时时间，默认 30000 毫秒

## 开发指南

### 项目结构

```text
src/
├── config/           # 配置文件
│   └── index.js
├── tools/            # MCP 工具实现
│   ├── http.js       # HTTP 请求工具
│   └── ssh.js        # SSH 命令工具
├── utils/            # 工具函数
│   ├── error-handler.js  # 错误处理
│   ├── logger.js         # 日志记录
│   └── security.js       # 安全验证
└── index.js          # 服务器入口

test/
├── unit/             # 单元测试
│   ├── error-handler.test.js
│   └── security.test.js
└── integration/      # 集成测试
    └── mcp-server.test.js
```

### 运行测试

```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration
```

### 代码规范

```bash
# 检查代码规范
npm run lint

# 自动修复代码规范
npm run lint:fix

# 格式化代码
npm run format
```

## 环境变量

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `LOG_LEVEL` | 日志级别 | `info` |
| `HTTP_PROXY` | HTTP 代理地址 | - |
| `HTTPS_PROXY` | HTTPS 代理地址 | - |
| `MCP_TRANSPORT` | 默认传输方式 | `stdio` |
| `MCP_SSE_PORT` | SSE 服务端口 | `3001` |
| `MCP_SSE_HOST` | SSE 监听地址 | `localhost` |
| `MCP_HTTP_PORT` | HTTP 服务端口 | `3002` |
| `MCP_HTTP_HOST` | HTTP 监听地址 | `localhost` |
| `MCP_CONFIG` | 外部配置文件路径（覆盖默认搜索） | - |
| `MCP_WATCH_CONFIG` | 启用配置热更新（`1` 表示启用） | `0` |
| `MCP_SECURITY_VALIDATORS_ENABLED` | 启用自定义安全校验器（`1` 表示启用） | `false` |
| `MCP_SECURITY_VALIDATORS` | 自定义校验器脚本路径（相对 `process.cwd()` 或绝对路径） | - |
| `MCP_SECURITY_VALIDATORS_STRATEGY` | 组合策略：`append`（默认）/`prepend`/`override` | `append` |
| `MCP_SSH_ALGORITHMS_ENABLED` | 启用 SSH 算法自定义（`1` 启用） | `false` |
| `MCP_SSH_ALGORITHMS_FALLBACK` | 自定义算法失败时是否回退默认算法（`0` 关闭） | `true` |
| `MCP_SSH_KEX_ALGORITHMS` | 逗号分隔的 KEX 列表 | 见下文默认 |
| `MCP_SSH_CIPHER_ALGORITHMS` | 逗号分隔的 Cipher 列表 | 见下文默认 |
| `MCP_SSH_HMAC_ALGORITHMS` | 逗号分隔的 HMAC 列表 | 见下文默认 |
| `MCP_SSH_HOSTKEY_ALGORITHMS` | 逗号分隔的 HostKey 列表 | 未设置则沿用 ssh2 默认 |

### SSH 算法配置

当目标主机对算法有特殊要求时，可以启用自定义算法清单：

```bash
export MCP_SSH_ALGORITHMS_ENABLED=1
export MCP_SSH_ALGORITHMS_FALLBACK=1   # 遇到算法不匹配时自动回退为 ssh2 默认算法并重试

# 可按需覆盖，未设置则使用项目内置的安全兼容默认值
export MCP_SSH_KEX_ALGORITHMS="curve25519-sha256,curve25519-sha256@libssh.org,ecdh-sha2-nistp256,ecdh-sha2-nistp384,ecdh-sha2-nistp521,diffie-hellman-group-exchange-sha256,diffie-hellman-group14-sha1"
export MCP_SSH_CIPHER_ALGORITHMS="aes128-gcm@openssh.com,aes256-gcm@openssh.com,aes128-ctr,aes256-ctr"
export MCP_SSH_HMAC_ALGORITHMS="hmac-sha2-256,hmac-sha2-512"
# 如目标要求特定 HostKey 算法，可设置如下（示例）：
export MCP_SSH_HOSTKEY_ALGORITHMS="ssh-ed25519,ecdsa-sha2-nistp256,rsa-sha2-512"
```

内置的默认算法（当未显式配置但仍启用自定义时）为：

- KEX: `curve25519-sha256`、`curve25519-sha256@libssh.org`、`ecdh-sha2-nistp256`、`ecdh-sha2-nistp384`、`ecdh-sha2-nistp521`、`diffie-hellman-group-exchange-sha256`、`diffie-hellman-group14-sha1`
- Cipher: `aes128-gcm@openssh.com`、`aes256-gcm@openssh.com`、`aes128-ctr`、`aes256-ctr`
- HMAC: `hmac-sha2-256`、`hmac-sha2-512`

注意：某些组合在旧环境上不被支持，建议保留回退（MCP_SSH_ALGORITHMS_FALLBACK=1）。

## 自定义安全校验器（可插拔）

当默认安全策略过于严格或需要补充企业特定规则时，可通过自定义脚本扩展/覆盖 `SecurityValidator` 的各类校验。

- 支持的钩子（任选实现，未实现的沿用内置）：
  - `validateUrl`, `validateHeaders`, `validateRequestBody`, `validateSshCommand`, `validateSshHost`, `containsMaliciousChars`, `containsMaliciousContent`, `sanitizeInput`, `isPrivateIP`
- 组合策略：
  - `append`（默认）：先执行内置，再执行自定义
  - `prepend`：先执行自定义，再执行内置
  - `override`：仅执行自定义
- 返回/抛错约定：
  - 返回 `true` 表示放行，返回 `false` 表示“已处理且无需后续”（会跳过后续同名校验）
  - 抛出错误（推荐使用 `ErrorHandler.createSecurityError`）表示阻断

启用方式（环境变量示例）：

```bash
export MCP_SECURITY_VALIDATORS_ENABLED=1
export MCP_SECURITY_VALIDATORS=./validators/security.custom.js
export MCP_SECURITY_VALIDATORS_STRATEGY=append
```

自定义脚本示例（仅支持 CommonJS 模块）：

```js
// validators/security.custom.js (CJS)
module.exports = {
  // 放宽示例：允许 http://localhost 的 URL
  validateUrl(url) {
    if (url.startsWith('http://localhost')) return true;
    // 未处理则交由后续（append）或内置（prepend）继续
    return true;
  },

  // 也可实现 validateHeaders / validateRequestBody 等其他钩子
};
```

注意事项：

- 仅支持 CommonJS 输出（`module.exports = { ... }`）；ESM 暂不支持
- 相对路径以 `process.cwd()` 为基准解析
- 任何加载失败将回退到内置校验并输出告警日志

## 部署建议

### 全局安装部署

对于生产环境，推荐使用全局安装的方式：

```bash
# 1. 克隆仓库
git clone https://github.com/nomagicln/mcp-server-client.git
cd mcp-server-client

# 2. 安装依赖
npm install

# 3. 全局安装
make install-global

# 4. 在任何位置启动服务器
mcp-server-client start
```

**优势：**

- 可以在任何目录启动服务器
- 简化的命令行界面
- 自动处理进程信号和错误

### 生产环境配置

1. **设置适当的日志级别**：

   ```bash
   export LOG_LEVEL=warn
   ```

2. **启用安全特性**：

   ```javascript
   security: {
     skipTlsVerification: false,
     allowLocalRequests: false,
     allowLocalConnections: false
   }
   ```

3. **配置代理（如需要）**：

   ```bash
   export HTTP_PROXY=http://proxy.company.com:8080
   export HTTPS_PROXY=http://proxy.company.com:8080
   ```

### 使用 PM2 部署

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start src/index.js --name mcp-server-client

# 查看状态
pm2 status

# 查看日志
pm2 logs mcp-server-client
```

### Docker 部署

项目提供了完整的 Docker 支持，包括 Dockerfile 和 Makefile。

#### 使用 Makefile 快速部署

```bash
# 构建 Docker 镜像
make docker-build

# 运行容器（交互模式）
make docker-run

# 后台运行容器
make docker-run-daemon

# 查看容器日志
make docker-logs

# 停止容器
make docker-stop

# 查看所有可用命令
make help
```

#### 手动 Docker 操作

```bash
# 构建镜像
docker build -t mcp-server-client:1.0.0 .

# 运行容器
docker run --rm -it --name mcp-server-client mcp-server-client:1.0.0

# 后台运行
docker run -d --name mcp-server-client --restart unless-stopped mcp-server-client:1.0.0
```

## 安全注意事项

1. **网络访问控制**：
   - 默认阻止访问本地和私有网络
   - 限制访问受限端口（如 SSH、SMTP 等）

2. **命令执行安全**：
   - 检测危险命令模式
   - 限制命令长度和复杂度
   - 阻止特权提升操作

3. **输入验证**：
   - 严格验证所有用户输入
   - 过滤恶意字符和脚本
   - 限制请求大小

4. **凭据管理**：
   - 不在日志中记录敏感信息
   - 建议使用密钥认证替代密码
   - 定期轮换访问凭据

## 故障排除

### 常见问题

1. **服务器启动失败**：

   ```bash
   # 检查端口是否被占用
   lsof -i :3000
   
   # 查看详细错误日志
   DEBUG=* npm start
   ```

2. **HTTP 请求失败**：
   - 检查目标 URL 是否可访问
   - 验证代理配置是否正确
   - 确认 TLS 证书是否有效

3. **SSH 连接问题**：
   - 验证主机地址和端口
   - 检查用户名密码是否正确
   - 确认目标服务器 SSH 服务正常

### 日志分析

服务器使用结构化 JSON 日志：

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "info",
  "message": "HTTP 请求成功",
  "url": "https://api.example.com",
  "method": "GET",
  "statusCode": 200,
  "responseTime": 150
}
```

### 性能监控

建议监控以下指标：

- 请求响应时间
- 错误率
- 内存使用率
- SSH 连接池状态

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 贡献指南

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/new-feature`
3. 提交更改：`git commit -am 'Add new feature'`
4. 推送分支：`git push origin feature/new-feature`
5. 创建 Pull Request

## 支持

如果您遇到问题或有建议，请：

1. 查看 [故障排除](#故障排除) 部分
2. 搜索已有的 [Issues](https://github.com/your-repo/issues)
3. 创建新的 Issue 描述问题

---

**版本**：1.0.0  
**作者**：Fang Zhiheng  
**更新时间**：2024年

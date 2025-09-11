# Data Model: MCP Server 资源管理数据模型

**Date**: 2025-09-11  
**Feature**: 002-mcp-server-api  
**Phase**: 1 - Design & Contracts  
**Spec Reference**: [spec.md](./spec.md)

## Core Entities

### Resource (Base Entity)

通用资源实体，作为所有具体资源类型的基类。

**Properties**:

- `id` (string, required): 资源唯一标识符，在同一 loader 范围内唯一
- `type` (string, required): 资源类型，枚举值：`"host"` | `"api"`
- `name` (string, required): 资源显示名称
- `description` (string, optional): 资源描述信息
- `labels` (object, optional): 键值对标签，用于分类和过滤
- `capabilities` (string[], required): 资源声明的能力列表
- `auth` (AuthenticationProfile, required): 认证配置
- `metadata` (object, optional): 扩展元数据

**Validation Rules**:

- `id` 必须符合资源标识符规范（字母数字、连字符、下划线）
- `type` 与 `capabilities` 必须一致（host 类型必须包含 ssh.* 能力）
- `capabilities` 至少包含一个有效能力

**Example**:

```yaml
id: "web-server-01"
type: "host"
name: "Production Web Server"
description: "Main web server in production environment"
labels:
  environment: "production"
  role: "web"
  zone: "us-east-1"
capabilities:
  - "ssh.exec"
  - "ssh.file-transfer"
auth:
  methods: ["ssh-key"]
  credentialRef: "env://SSH_PRIVATE_KEY"
metadata:
  owner: "devops-team"
  created: "2025-09-11"
```

### HostResource (Specialized Resource)

主机资源实体，继承 Resource，添加 SSH 连接特定属性。

**Additional Properties**:

- `connection` (object, required): 连接配置
  - `hostname` (string, required): 主机名或 IP 地址
  - `port` (number, optional): SSH 端口，默认 22
  - `username` (string, required): SSH 用户名
- `sshConfig` (object, optional): SSH 特定配置
  - `algorithms` (object, optional): 算法偏好（使用系统默认）
  - `keepaliveInterval` (number, optional): 保活间隔毫秒数
  - `readyTimeout` (number, optional): 连接就绪超时

**Valid Capabilities**:

- `ssh.exec`: 可执行远程命令
- `ssh.file-transfer`: 可传输文件（可选）
- `ssh.port-forward`: 可端口转发（可选）

**Example**:

```yaml
id: "db-server-01"
type: "host"
name: "Database Server"
capabilities:
  - "ssh.exec"
connection:
  hostname: "db1.internal.company.com"
  port: 22
  username: "admin"
auth:
  methods: ["ssh-key"]
  algorithms: {} # 使用系统默认
  credentialRef: "file:///etc/ssh/keys/db-admin.key"
```

### ApiResource (Specialized Resource)

API 端点资源实体，继承 Resource，添加 HTTP 服务特定属性。

**Additional Properties**:

- `endpoints` (object, required): 端点配置
  - `baseUrl` (string, required): 基础 URL
  - `defaultHeaders` (object, optional): 默认请求头
  - `defaultQuery` (object, optional): 默认查询参数
- `httpConfig` (object, optional): HTTP 特定配置
  - `timeout` (number, optional): 请求超时毫秒数
  - `maxRetries` (number, optional): 最大重试次数
  - `validateStatus` (function, optional): 状态码验证函数

**Valid Capabilities**:

- `http.request`: 可发起 HTTP 请求
- `http.webhook`: 可接收 webhook（可选）
- `http.upload`: 可上传文件（可选）

**Security Capabilities** (Optional):

- `http.methods.allowed`: 允许的 HTTP 方法列表，如 `["GET", "POST"]`
- `http.headers.allowed`: 允许的请求头白名单
- `http.response.maxSize`: 响应体最大大小限制

**Example**:

```yaml
id: "user-api-v1"
type: "api"
name: "User Management API"
capabilities:
  - "http.request"
  - "http.methods.allowed"
endpoints:
  baseUrl: "https://api.company.com/v1"
  defaultHeaders:
    "User-Agent": "mcp-server-client/1.1.0"
    "Accept": "application/json"
auth:
  methods: ["token"]
  credentialRef: "env://API_TOKEN"
metadata:
  "http.methods.allowed": ["GET", "POST", "PUT", "DELETE"]
  "http.response.maxSize": 5242880  # 5MB
```

### ResourceIdentifier

资源标识符实体，提供统一的资源寻址方案。

**Structure**: `{resource_type}://{loader_type}/{loader_id}/{resource_id}`

**Components**:

- `resourceType` (string): 资源类型，`"host"` | `"api"`
- `loaderType` (string): 加载器类型，`"local"` | `"remote"`
- `loaderId` (string): 加载器实例标识，如 `"default"`, `"catalog"`
- `resourceId` (string): 资源唯一标识

**Examples**:

- `host://local/default/web-server-01`
- `api://remote/catalog/user-api-v1`
- `host://local/development/test-server-03`

**Validation Rules**:

- 必须符合 URI 格式
- 各组件不得包含保留字符（/, :, ?, #）
- resourceType 必须为已知类型
- loaderType 必须为已知加载器类型

### AuthenticationProfile

认证配置实体，支持多种认证方式的统一管理。

**Properties**:

- `methods` (string[], required): 支持的认证方法列表
- `credentialRef` (string, required): 凭据引用
- `algorithms` (object, optional): 算法配置（使用系统默认）
- `scopes` (string[], optional): 权限范围（适用于 Token 认证）

**Supported Methods**:

**For Host Resources**:

- `ssh-key`: SSH 私钥认证
- `password`: 用户名密码认证
- `agent`: SSH Agent 转发认证

**For API Resources**:

- `none`: 无认证
- `token`: Token/Bearer 认证
- `basic`: HTTP Basic 认证
- `mtls`: 双向 TLS 认证

**Credential Reference Formats**:

- `env://VARIABLE_NAME`: 环境变量引用
- `file:///path/to/credential`: 文件路径引用
- `vault://path/to/secret`: 密钥库引用（预留）

**Examples**:

```yaml
# SSH Key 认证
auth:
  methods: ["ssh-key"]
  credentialRef: "file:///home/user/.ssh/id_ed25519"

# Token 认证
auth:
  methods: ["token"]
  credentialRef: "env://API_TOKEN"
  scopes: ["read", "write"]

# Basic 认证
auth:
  methods: ["basic"]
  credentialRef: "env://BASIC_AUTH_CREDENTIALS"  # format: "username:password"
```

## Derived Entities

### ResourceLoader (Interface)

抽象资源加载器接口，定义加载器的标准行为。

**Properties**:

- `loaderType` (string): 加载器类型标识
- `loaderId` (string): 加载器实例标识
- `config` (object): 加载器配置

**Methods**:

- `loadResources()`: 加载资源列表
- `reloadResources()`: 重新加载资源
- `validateResource(resource)`: 验证资源有效性

### LocalFileLoader (Implementation)

本地文件加载器实现，从本地 YAML/JSON 文件加载资源。

**Configuration**:

```yaml
loaderType: "local"
loaderId: "default"
config:
  searchPaths:
    - "./resources/"
    - "~/.mcp/resources/"
    - "/etc/mcp/resources/"
  filePatterns:
    - "*.resources.yaml"
    - "*.resources.yml"
    - "*.resources.json"
  watchForChanges: true
  debounceMs: 200
```

### RemoteApiLoader (Implementation)

远程 API 加载器实现，从远程资源目录服务加载资源。

**Configuration**:

```yaml
loaderType: "remote"
loaderId: "catalog"
config:
  endpoint: "https://catalog.company.com/api/resources"
  auth:
    methods: ["token"]
    credentialRef: "env://CATALOG_API_TOKEN"
  syncInterval: 300000  # 5 minutes
  timeout: 10000
  retryAttempts: 3
```

### ResourceRegistry

资源注册表，管理已加载资源的索引和查找。

**Properties**:

- `resources` (Map<string, Resource>): 资源索引（按完整标识符）
- `loaders` (Map<string, ResourceLoader>): 加载器索引

**Methods**:

- `registerResource(identifier, resource)`: 注册资源
- `resolveResource(identifier)`: 解析资源
- `listResources(filter?)`: 列出资源
- `reloadFromLoader(loaderKey)`: 从指定加载器重新加载

## Relationships

```text
ResourceIdentifier --references--> Resource
                 |
                 +--> HostResource
                 |
                 +--> ApiResource

Resource --contains--> AuthenticationProfile

ResourceRegistry --manages--> Resource
                |
                +-indexes--> ResourceLoader
                |
                +--> LocalFileLoader
                |
                +--> RemoteApiLoader

Resource --validates-via--> CapabilityValidator
```

## Validation Schema

### Resource Base Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "type", "name", "capabilities", "auth"],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^[a-zA-Z0-9._-]+$",
      "minLength": 1,
      "maxLength": 64
    },
    "type": {
      "type": "string",
      "enum": ["host", "api"]
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 128
    },
    "description": {
      "type": "string",
      "maxLength": 512
    },
    "labels": {
      "type": "object",
      "additionalProperties": {
        "type": "string"
      }
    },
    "capabilities": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "minItems": 1,
      "uniqueItems": true
    },
    "auth": {
      "$ref": "#/definitions/AuthenticationProfile"
    },
    "metadata": {
      "type": "object"
    }
  }
}
```

## State Transitions

资源在系统中的状态变化：

1. **Unloaded** → **Loading**: 开始从 loader 加载
2. **Loading** → **Loaded**: 成功加载并验证
3. **Loading** → **Failed**: 加载或验证失败
4. **Loaded** → **Reloading**: 触发重新加载
5. **Loaded** → **Active**: 首次被工具调用
6. **Active** → **Error**: 调用过程中出错
7. **Error** → **Active**: 错误恢复

每个状态转换都会产生相应的审计日志和可观测事件。

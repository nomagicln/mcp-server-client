# 快速入门：MCP Server 资源管理

**Feature**: 002-mcp-server-api  
**目标**: 验证资源管理功能的端到端用户场景  
**估计时间**: 15-20 分钟

## 前置条件

- Node.js 18+
- 已安装并配置的 MCP Server Client
- 可访问的 SSH 主机（用于测试主机资源）
- 可访问的 HTTP API（用于测试 API 资源）

## 场景1：本地文件资源管理

### 步骤1：创建本地资源配置文件

创建 `./resources/hosts.yaml`：

```yaml
# 主机资源定义
- id: "dev-server"
  type: "host"
  name: "Development Server"
  description: "开发环境服务器"
  labels:
    environment: "development"
    role: "web"
  capabilities:
    - "ssh.exec"
  connection:
    hostname: "dev.example.com"
    port: 22
    username: "developer"
  auth:
    methods: ["ssh-key"]
    credentialRef: "file://~/.ssh/id_rsa"

- id: "prod-db"
  type: "host" 
  name: "Production Database"
  labels:
    environment: "production"
    role: "database"
  capabilities:
    - "ssh.exec"
  connection:
    hostname: "db.prod.example.com"
    username: "dbadmin"
  auth:
    methods: ["ssh-key"]
    credentialRef: "env://PROD_DB_SSH_KEY"
```

创建 `./resources/apis.yaml`：

```yaml
# API 资源定义
- id: "user-service"
  type: "api"
  name: "User Management API"
  description: "用户管理微服务"
  labels:
    service: "user"
    version: "v2"
  capabilities:
    - "http.request"
    - "http.methods.allowed"
  endpoints:
    baseUrl: "https://api.example.com/v2/users"
    defaultHeaders:
      "Content-Type": "application/json"
      "User-Agent": "mcp-server-client/1.1.0"
  auth:
    methods: ["token"]
    credentialRef: "env://USER_API_TOKEN"
  metadata:
    "http.methods.allowed": ["GET", "POST", "PUT"]
    "http.response.maxSize": 1048576  # 1MB

- id: "notification-api"
  type: "api"
  name: "Notification Service"
  capabilities:
    - "http.request"
  endpoints:
    baseUrl: "https://notifications.example.com"
  auth:
    methods: ["basic"]
    credentialRef: "env://NOTIFICATION_BASIC_AUTH"
```

### 步骤2：配置环境变量

```bash
export USER_API_TOKEN="your-api-token-here"
export NOTIFICATION_BASIC_AUTH="username:password"
export PROD_DB_SSH_KEY="$(cat ~/.ssh/prod_db_key)"
```

### 步骤3：启动 MCP Server 并验证资源加载

```bash
# 启动服务器
mcp-server-client --transport stdio

# 在另一个终端，列出已加载的资源
mcp-server-client --list-resources

# 预期输出应包含：
# host://local/default/dev-server
# host://local/default/prod-db  
# api://local/default/user-service
# api://local/default/notification-api
```

### 步骤4：测试通过资源标识调用工具

**SSH 执行测试**：

```bash
# 传统方式（向后兼容）
mcp-server-client ssh_exec --host dev.example.com --username developer --key ~/.ssh/id_rsa --command "uname -a"

# 新的资源标识方式
mcp-server-client ssh_exec --resource "host://local/default/dev-server" --command "uname -a"

# 预期：两种方式都应该成功执行，输出系统信息
```

**HTTP 请求测试**：

```bash
# 传统方式
mcp-server-client http_request --url "https://api.example.com/v2/users" --method GET --headers '{"Authorization":"Bearer your-token"}'

# 新的资源标识方式
mcp-server-client http_request --resource "api://local/default/user-service" --path "/" --method GET

# 预期：获取用户列表或适当的API响应
```

## 场景2：远程资源目录

### 步骤1：配置远程资源加载器

在配置文件中添加远程加载器：

```yaml
# config/resources.yaml
loaders:
  - loaderType: "remote"
    loaderId: "company-catalog"
    config:
      endpoint: "https://catalog.company.com/api/resources"
      auth:
        methods: ["token"]
        credentialRef: "env://CATALOG_API_TOKEN"
      syncInterval: 300000  # 5分钟同步一次
      timeout: 10000
```

### 步骤2：设置目录API令牌

```bash
export CATALOG_API_TOKEN="your-catalog-token"
```

### 步骤3：重新加载配置并验证远程资源

```bash
# 重新加载资源配置
mcp-server-client --reload-resources

# 列出所有资源（包括远程）
mcp-server-client --list-resources --filter type=api

# 预期：应该看到来自远程目录的API资源
# 如：api://remote/company-catalog/prod-analytics-api
```

### 步骤4：测试远程资源调用

```bash
# 调用远程加载的API资源
mcp-server-client http_request --resource "api://remote/company-catalog/analytics-api" --path "/metrics" --method GET

# 预期：从企业API目录中的分析服务获取指标数据
```

## 场景3：能力验证与错误处理

### 步骤1：测试能力检查

```bash
# 尝试对只有http.request能力的资源执行SSH命令（应该失败）
mcp-server-client ssh_exec --resource "api://local/default/user-service" --command "ls"

# 预期错误：
# ERROR: Resource 'api://local/default/user-service' does not declare capability 'ssh.exec'
```

### 步骤2：测试HTTP方法限制

```bash
# 尝试不被允许的HTTP方法（基于metadata中的http.methods.allowed）
mcp-server-client http_request --resource "api://local/default/user-service" --method DELETE --path "/test"

# 预期错误：
# ERROR: HTTP method 'DELETE' not allowed for resource 'api://local/default/user-service'
```

### 步骤3：测试凭据引用错误

```bash
# 临时移除或修改环境变量
unset USER_API_TOKEN

# 尝试调用需要token的资源
mcp-server-client http_request --resource "api://local/default/user-service" --path "/" --method GET

# 预期错误：
# ERROR: Failed to resolve credential reference 'env://USER_API_TOKEN': Environment variable not found
```

## 场景4：资源热更新

### 步骤1：修改本地资源文件

编辑 `./resources/hosts.yaml`，添加新主机：

```yaml
- id: "staging-server"
  type: "host"
  name: "Staging Server"
  labels:
    environment: "staging"
  capabilities:
    - "ssh.exec"
  connection:
    hostname: "staging.example.com"
    username: "deploy"
  auth:
    methods: ["ssh-key"]
    credentialRef: "file://~/.ssh/staging_key"
```

### 步骤2：验证热更新

```bash
# 等待几秒钟让文件监听器检测到变化
sleep 3

# 检查新资源是否已加载
mcp-server-client --list-resources --filter labels.environment=staging

# 预期：应该看到新的staging-server资源
# host://local/default/staging-server
```

### 步骤3：测试新资源

```bash
# 立即使用新添加的资源
mcp-server-client ssh_exec --resource "host://local/default/staging-server" --command "hostname"

# 预期：成功连接到staging服务器并返回主机名
```

## 验收标准

完成所有场景后，验证以下功能：

### ✅ 资源加载与管理

- [ ] 本地YAML/JSON文件成功加载
- [ ] 远程API目录成功同步
- [ ] 资源列表包含所有预期资源
- [ ] 资源标识符格式正确

### ✅ 工具适配与兼容性

- [ ] ssh_exec支持资源标识调用
- [ ] http_request支持资源标识调用
- [ ] 传统直连模式仍然工作
- [ ] 错误消息清晰明确

### ✅ 安全与权限

- [ ] 能力检查正确拒绝未授权操作
- [ ] 凭据引用系统工作正常
- [ ] 敏感信息不出现在日志中
- [ ] HTTP方法/头部白名单生效

### ✅ 实时性与可靠性

- [ ] 文件变化能触发热更新
- [ ] 网络错误有适当重试
- [ ] 配置错误有明确提示
- [ ] 资源冲突处理正确

### ✅ 可观测性

- [ ] 资源加载事件有日志
- [ ] 工具调用有审计记录
- [ ] 性能指标可观测
- [ ] 错误上下文充分

## 故障排除

### 常见问题

**Q: 资源加载失败**
A: 检查文件路径、YAML语法、权限和网络连接

**Q: 凭据引用失败**  
A: 验证环境变量设置、文件路径存在性和权限

**Q: 能力验证失败**
A: 检查resource.capabilities数组是否包含所需能力

**Q: 远程同步失败**
A: 验证网络连接、API端点和认证令牌

### 调试命令

```bash
# 详细日志模式
LOG_LEVEL=debug mcp-server-client --transport stdio

# 检查特定资源
mcp-server-client --describe-resource "host://local/default/dev-server"

# 验证配置
mcp-server-client --validate-config

# 测试连接
mcp-server-client --test-resource "api://local/default/user-service"
```

---

**🎉 恭喜！** 你已经成功完成了MCP Server资源管理功能的快速入门。现在可以开始在生产环境中使用这些功能了。

# **MCP Server 需求分析文档**

## 1. 背景与目标

MCP（Model Context Protocol）提供了统一的接口规范，使得 AI 模型能够与外部服务进行交互。
本项目的目标是实现一个基于 **Node.js** 的 MCP Server，提供以下能力：

* 支持 **HTTP 请求发送**：调用外部 REST API 或 Web 服务。
* 支持 **SSH 命令执行**：远程连接到节点并执行命令。

该 MCP Server 将作为 AI 助手的插件，帮助用户在上下文中直接调用网络服务和远程命令执行功能。

---

## 2. 功能需求

### 2.1 HTTP 请求功能

* **输入参数**：

  * `method`: HTTP 请求方法（GET、POST、PUT、DELETE 等）
  * `url`: 请求地址（含协议、主机、端口、路径）
  * `headers`: 可选，请求头对象
  * `body`: 可选，请求体（字符串或 JSON）

* **输出结果**：

  * `statusCode`: 响应状态码
  * `headers`: 响应头
  * `body`: 响应体（文本或 JSON）

### 2.2 SSH 远程命令执行功能

* **输入参数**：

  * `host`: 目标 IP + 端口
  * `username`: 用户名
  * `password`: 密码（初版仅支持密码，后续可支持 key 文件）
  * `command`: 待执行命令字符串

* **输出结果**：

  * `stdout`: 命令标准输出
  * `stderr`: 命令标准错误
  * `exitCode`: 命令退出码

### 2.3 错误处理

* HTTP/SSH 调用失败时返回详细错误信息，包括：

  * 错误类型（网络错误、认证失败、超时等）
  * 错误描述
  * 建议（如：检查地址、检查凭证）

---

## 3. 接口设计（MCP Resource & Tool）

### 3.1 工具（Tools）

定义两个工具：

1. `http_request`

   * 描述：发送 HTTP 请求
   * 参数：`method`、`url`、`headers`、`body`
   * 返回：响应内容

2. `ssh_exec`

   * 描述：通过 SSH 执行远程命令
   * 参数：`host`、`username`、`password`、`command`
   * 返回：命令执行结果

### 3.2 资源（Resources）

* 无需长久持有的资源（stateless），功能以 **Tool** 为主。

---

## 4. 非功能需求

* **安全性**

  * 可配置是否跳过tls验证
  * 可配置是否支持环境代理
  * 可配置 http 请求仅接受的内容类型

* **性能**

  * 单次 HTTP 请求或 SSH 命令执行应在可接受时间内返回（默认超时 30s）。

* **可扩展性**

  * 后续可增加：

    * 文件上传/下载（SCP）
    * 支持 API 鉴权配置

---

## 5. 技术架构

* **语言与框架**：Node.js (≥18)，使用官方 MCP SDK。
* **依赖库**：

  * HTTP：`axios`
  * SSH：`ssh2` 库

* **目录结构**：

  ```
  mcp-server/
  ├── index.js         # 入口文件
  ├── tools/
  │   ├── http.js      # HTTP 请求工具
  │   └── ssh.js       # SSH 工具
  ├── package.json
  └── README.md
  ```

---

## 6. 示例调用

### 6.1 HTTP 请求

```json
{
  "tool": "http_request",
  "parameters": {
    "method": "GET",
    "url": "https://api.example.com/data",
    "headers": {
      "Authorization": "Bearer token"
    }
  }
}
```

返回：

```json
{
  "statusCode": 200,
  "headers": {
    "content-type": "application/json"
  },
  "body": "{...}"
}
```

### 6.2 SSH 执行

```json
{
  "tool": "ssh_exec",
  "parameters": {
    "host": "192.168.1.10:22",
    "username": "root",
    "password": "123456",
    "command": "ls -al /home"
  }
}
```

返回：

```json
{
  "stdout": "total 8\ndrwxr-xr-x 2 root root 4096 Sep  2 22:00 .\n...",
  "stderr": "",
  "exitCode": 0
}
```

# Feature Specification: MCP Server：主机资源与 API 端点资源（可本地/远程加载与能力声明）

**Feature Branch**: `002-mcp-server-api`  
**Created**: 2025-09-11  
**Status**: Draft  
**Input**: User description: "给 MCP Server 添加主机资源和 API 端点资源\n1. 这两个资源可以通过本地文件或者远程 API 加载，即需要有 ResourceLoader 的接口定义以及两种 Loader 实现\n2. 需要定义数据文件格式和接口调用、实现规范\n3. 允许主机、API 端点资源声明其能力，比如可以执行的命令、认证的算法、认证的方式等\n4. 现有的 http_request 和 ssh_exec 需要改造，适配传入资源标识，比如 ssh_exec 传入资源标识加上执行的命令就可以执行，而无需输入用户名密码"

## Execution Flow (main)

```
1. Parse user description from Input
   → If empty: ERROR "No feature description provided"
2. Extract key concepts from description
   → Identify: actors, actions, data, constraints
3. For each unclear aspect:
   → Mark with [NEEDS CLARIFICATION: specific question]
4. Fill User Scenarios & Testing section
   → If no clear user flow: ERROR "Cannot determine user scenarios"
5. Generate Functional Requirements
   → Each requirement must be testable
   → Mark ambiguous requirements
6. Identify Key Entities (if data involved)
7. Run Review Checklist
   → If any [NEEDS CLARIFICATION]: WARN "Spec has uncertainties"
   → If implementation details found: ERROR "Remove tech details"
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines

- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

### Section Requirements

- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

### For AI Generation

When creating this spec from a user prompt:

1. **Mark all ambiguities**: Use [NEEDS CLARIFICATION: specific question] for any assumption you'd need to make
2. **Don't guess**: If the prompt doesn't specify something (e.g., "login system" without auth method), mark it
3. **Think like a tester**: Every vague requirement should fail the "testable and unambiguous" checklist item
4. **Common underspecified areas**:
   - User types and permissions
   - Data retention/deletion policies  
   - Performance targets and scale
   - Error handling behaviors
   - Integration requirements
   - Security/compliance needs

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story

作为平台使用者，我可以在一个统一的“资源目录”中管理两类资源：主机资源与 API 端点资源。系统支持从本地数据文件或远程目录服务加载这些资源；每个资源可声明自身能力（如可执行的操作与认证方式）。当我调用 ssh_exec 或 http_request 等操作时，只需提供“资源标识 + 动作参数”，系统会自动根据该资源的能力与认证策略完成调用，无需我手动输入用户名、密码或令牌。

### Acceptance Scenarios

1. 资源本地加载
   - Given 已在本地数据文件中定义了一个主机资源 `host-001`（声明能力含“ssh.exec”，并配置或引用可用的认证方式），且资源已成功被系统加载
   - When 我调用 `ssh_exec` 并只传入资源标识（如 `host://local/default/host-001`）与要执行的命令（如 `uname -a`）
   - Then 系统使用该主机资源声明的认证方式自动完成连接与执行，返回命令结果；调用过程中不要求我输入用户名或密码

2. 资源远程加载
   - Given 已配置远程资源目录服务，并成功拉取到一个 API 端点资源 `api-001`（声明能力含“http.request”，并配置或引用其认证方式）
   - When 我调用 `http_request` 并只传入资源标识（如 `api://remote/catalog/api-001`）与请求参数（如 `GET /status`）
   - Then 系统依据资源能力与认证策略完成请求并返回响应体与状态码

3. 能力校验与拒绝
   - Given 资源 `host-002` 未声明“ssh.exec”能力
   - When 我尝试用 `ssh_exec` 对 `host-002` 执行命令
   - Then 系统应明确拒绝并返回错误，指明该资源未声明所需能力

4. 标识解析与回退兼容
   - Given 历史脚本仍直接使用 `ssh_exec(user, host, ...)` 或 `http_request(url, headers, ...)`
   - When 我传入传统参数而非资源标识
   - Then 系统应保持兼容并成功执行；当传入资源标识时，系统以资源驱动模式执行

### Edge Cases

- 本地数据文件缺失、格式非法或不满足数据契约时应给出可定位的校验错误
- 远程目录服务不可达、认证失败、超时或响应格式不合规时应有明确错误与重试/回退策略
- 资源标识不存在、重复或不唯一时应拒绝并给出提示
- 资源未声明所需能力或能力声明与实际配置冲突（例如缺少必要的认证资料）时应拒绝
- 调用时的敏感信息（密钥、令牌）不得出现在日志与错误消息中（需脱敏）
- 并发/批量加载、网络抖动、临时 5xx 响应等情形下应具备幂等与容错策略

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001（资源类型）**：系统必须支持两类资源：主机资源（Host）与 API 端点资源（API Endpoint），每个资源具备唯一标识、基本元数据与能力声明。
- **FR-002（加载方式与合并策略）**：系统必须支持通过“本地数据文件加载”与“远程目录服务加载”两种方式获取资源清单；加载方式可共存并合并资源列表。合并冲突优先级可由外部配置参数指定；默认远程优先级更高。
- **FR-003（数据格式契约）**：资源数据必须遵循统一的数据契约（见“Key Entities”）；必须支持 YAML；同时支持 JSON。
- **FR-004（远程目录接口契约）**：当通过远程服务加载资源时，系统必须对响应结果进行契约校验；需显式处理 200/4xx/5xx 状态、超时与分页场景；需支持认证（Token/Bearer、Basic、mTLS）；不支持 OAuth2；对 401/403 须清晰报错。
- **FR-005（能力声明）**：资源必须可声明其能力，包含：
  - 主机资源：至少 `ssh.exec`；可选能力可引用“安全能力”范畴，例如允许的算法集合、允许的文件传输、会话复用等。
  - API 资源：至少 `http.request`；可选能力可引用“安全能力”范畴，例如允许的 HTTP 方法（如允许 GET/POST）、允许的 HTTP 头（白名单）、响应大小上限等。
- **FR-006（认证方式与算法声明）**：资源可声明可用的认证方式与算法集合；采用系统“默认算法集合”（无需在规格中枚举）；不支持 OAuth2；
  - 主机资源支持：用户名/密码、SSH Key、Agent 转发。
  - API 资源支持：无认证、静态 Token/Bearer、Basic、mTLS。
- **FR-007（凭据引用）**：资源定义中不得包含明文凭据；凭据以“引用”的方式指向受管密钥存储或环境注入；系统调用时根据引用拉取；日志需脱敏。
- **FR-008（操作改造：ssh_exec/http_request）**：
  - `ssh_exec` 与 `http_request` 必须支持传入“资源标识”模式；当传入资源标识时，系统依据资源能力与认证策略自动完成连接/请求，无需显式传入用户名/密码/令牌。
  - 必须保持对“传统直连模式”的向后兼容；当同时提供直连参数与资源标识时，其优先级可由外部配置参数指定。
- **FR-009（资源标识规范）**：资源标识采用统一 URI 方案：`{resource_type}://{loader_type}/{loader_id}/{resource_id}`，例如：
  - `host://local/default/host-001`
  - `api://remote/catalog/api-001`
  标识需在全系统范围内唯一且可解析到具体资源记录。
- **FR-010（校验与错误可观测性）**：加载阶段必须执行数据契约校验；运行阶段对缺失能力、缺少凭据、认证失败、连接失败、请求失败等提供结构化错误与可观测信息（不泄露敏感数据）。
- **FR-011（性能与可靠性）**：远程超时与重试策略可由外部配置指定；对临时性错误可回退到最后一次成功的资源快照；支持批量加载与增量更新。
- **FR-012（配置与更新）**：支持本地文件热更新；支持远程目录定时同步与手动刷新；更新后需执行契约校验并安全落盘。
- **FR-013（合规与审计）**：对资源的加载、更新与调用需记录审计事件（含“谁在何时对哪个资源执行了什么动作”，不含敏感凭据）。

### Key Entities *(include if feature involves data)*

- **Resource（通用）**：
  - 字段：`id`（唯一）、`type`（host|api）、`name`、`description?`、`labels?`（键值对）、`capabilities`（字符串数组）、`auth`（认证配置引用集合）、`endpoints|connection`（见下）、`metadata?`
  - 约束：`id` 在同一命名域内唯一；`type` 与 `capabilities` 需一致性检查

- **HostResource**（主机资源）：
  - 连接信息：`hostname`/`address`、`port?`（默认 22）
  - 能力：至少可声明 `ssh.exec`；可选能力可使用安全能力（算法白名单、文件传输、命令白名单等）。
  - 认证：`methods`（`ssh-key`、`password`、`agent`），`algorithms`（采用系统默认算法集合）。
  - 凭据引用：`credentialRef`（如“ssh-key://...”、“secret://...”）

- **ApiResource**（API 端点资源）：
  - 端点：`baseUrl`，可选 `headersTemplate?`、`defaultQuery?`
  - 能力：至少可声明 `http.request`；可选能力如允许的 HTTP 方法、允许的 HTTP 头白名单、响应大小上限等。
  - 认证：`methods`（`none`、`token`、`basic`、`mtls`）；不支持 `oauth2`。
  - 凭据引用：`credentialRef`（如“secret://token/xxx”、“vault://path”）

- **ResourceIdentifier**（资源标识）：
  - 形态：`{resource_type}://{loader_type}/{loader_id}/{resource_id}`
  - 需求：可双向解析（标识→资源记录）；系统内全局唯一

- **ResourceLoader**（抽象装载器）：
  - 责任：提供“列举资源”“增量/全量加载”“校验数据契约”“去重/合并策略钩子”
  - 变体：`LocalFileLoader`（读取本地 YAML/JSON 文件集合）、`RemoteApiLoader`（调用远程目录服务）
  - 属性：`loader_type`（local|remote）、`loader_id`（配置项名称或实例 ID）
  - 错误：区分“输入不合规”（校验错误）与“外部不可达/失败”（IO/网络错误）

- **AuthenticationProfile**（认证配置轮廓）：
  - 字段：`methods`、`algorithms`（采用系统默认集合）、`credentialRef`、`scopes?`（如适用；不涉及 oauth2）
  - 约束：不得包含明文密钥/口令；仅允许引用

---

## Review & Acceptance Checklist

GATE: Automated checks run during main() execution

### Content Quality

- [ ] No implementation details (languages, frameworks, APIs)
- [ ] Focused on user value and business needs
- [ ] Written for non-technical stakeholders
- [ ] All mandatory sections completed

### Requirement Completeness

- [ ] No [NEEDS CLARIFICATION] markers remain
- [ ] Requirements are testable and unambiguous  
- [ ] Success criteria are measurable
- [ ] Scope is clearly bounded
- [ ] Dependencies and assumptions identified

---

## Execution Status

Updated by main() during processing

- [ ] User description parsed
- [ ] Key concepts extracted
- [ ] Ambiguities marked
- [ ] User scenarios defined
- [ ] Requirements generated
- [ ] Entities identified
- [ ] Review checklist passed

---

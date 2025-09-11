# Implementation Plan: MCP Server：主机资源与 API 端点资源（可本地/远程加载与能力声明）

**Branch**: `002-mcp-server-api` | **Date**: 2025-09-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/Users/fangzhiheng/Projects/github.com/nomagicln/mcp-s**Phase Status**:

- [x] Phase 0: Research complete (/plan command)
- [ ] Phase 1: Design complete (/plan command)
- [ ] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [ ] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documentedecs/002-mcp-server-api/spec.md`

## Execution Flow (/plan command scope)

```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, or `GEMINI.md` for Gemini CLI).
6. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
8. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:

- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

该功能为 MCP Server 添加统一资源管理能力：支持主机资源与 API 端点资源的本地/远程加载，每个资源可声明能力与认证方式，现有 ssh_exec/http_request 工具改造为可通过资源标识调用，无需手动传入凭据。技术方案基于现有 Node.js/ESM 项目架构，新增 ResourceLoader 抽象接口、LocalFileLoader/RemoteApiLoader 实现、资源注册表、工具适配层等组件。

## Technical Context

**Language/Version**: Node.js 18+ (ESM)  
**Primary Dependencies**: @modelcontextprotocol/sdk, axios, ssh2, chokidar（现有）；新增 yaml（解析 YAML）  
**Storage**: 本地文件（YAML/JSON）+ 远程 API 调用  
**Testing**: Jest（已配置，单元+集成测试）  
**Target Platform**: macOS/Linux（现有平台）  
**Project Type**: single（沿用现有 src/* 结构）  
**Performance Goals**: 资源加载 < 100ms，远程同步 < 5s，热更新响应 < 50ms  
**Constraints**: 兼容现有 MCP 工具调用，不破坏向后兼容性；凭据不得明文存储/日志；优先级与超时可配置  
**Scale/Scope**: 支持数百个资源定义，批量加载，多 loader 并发

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:

- Projects: 1 (单一项目，沿用现有结构)
- Using framework directly? ✅ (直接使用 @modelcontextprotocol/sdk, axios, ssh2)
- Single data model? ✅ (统一 Resource 模型，变体 HostResource/ApiResource)
- Avoiding patterns? ✅ (无 Repository/UoW，直接基于文件系统和网络调用)

**Architecture**:

- EVERY feature as library? ✅ (新增资源管理库：src/resources/)
- Libraries listed:
  - resource-loader: 抽象接口与具体实现（Local/Remote）
  - resource-registry: 资源注册表与标识解析
  - resource-capabilities: 能力声明与校验
  - tool-adapters: 现有工具的资源适配层
- CLI per library: ✅ (扩展现有 mcp-server-client CLI，添加 --list-resources, --reload-resources)
- Library docs: ✅ (将生成 llms.txt 格式文档)

**Testing (NON-NEGOTIABLE)**:

- RED-GREEN-Refactor cycle enforced? ✅ (先写失败测试，再实现)
- Git commits show tests before implementation? ✅ (严格遵循)
- Order: Contract→Integration→E2E→Unit strictly followed? ✅
- Real dependencies used? ✅ (真实文件系统、网络调用，测试用临时文件)
- Integration tests for: ✅ (新 ResourceLoader 库、工具适配合约变更、资源标识解析)
- FORBIDDEN: Implementation before test, skipping RED phase

**Observability**:

- Structured logging included? ✅ (扩展现有 logger，增加资源加载/调用事件)
- Frontend logs → backend? N/A (单体架构)
- Error context sufficient? ✅ (资源加载失败、能力校验失败、凭据解析失败等)

**Versioning**:

- Version number assigned? ✅ (1.1.0 - MINOR版本，新增功能)
- BUILD increments on every change? ✅
- Breaking changes handled? ✅ (向后兼容，传统 ssh_exec/http_request 调用方式保持可用)

## Project Structure

### Documentation (this feature)

```text
specs/002-mcp-server-api/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)

```text
# Option 1: Single project (DEFAULT)
src/
├── resources/           # 新增：资源管理模块
│   ├── index.js         # 主导出
│   ├── loader/          # 资源装载器
│   │   ├── index.js     # 抽象接口
│   │   ├── local.js     # LocalFileLoader
│   │   └── remote.js    # RemoteApiLoader
│   ├── registry/        # 资源注册表
│   │   ├── index.js     # ResourceRegistry
│   │   └── identifier.js # 资源标识解析
│   ├── capabilities/    # 能力管理
│   │   ├── index.js     # 能力声明与校验
│   │   └── security.js  # 安全能力定义
│   └── adapters/        # 工具适配层
│       ├── http.js      # HTTP 工具适配
│       └── ssh.js       # SSH 工具适配
├── models/              # 现有（扩展）
├── services/            # 现有
├── tools/               # 现有（改造）
│   ├── http.js          # 扩展支持资源标识
│   └── ssh.js           # 扩展支持资源标识
├── config/              # 现有（扩展）
├── utils/               # 现有
└── index.js             # 现有（集成资源管理）

test/
├── resources/           # 新增：资源管理测试
│   ├── loader/
│   ├── registry/
│   ├── capabilities/
│   └── adapters/
├── contract/            # 扩展：资源相关合约测试
├── integration/         # 扩展：端到端资源流程测试
└── unit/                # 现有
```

**Structure Decision**: Option 1（沿用现有单一项目结构，在 src/ 下新增 resources/ 模块）

## Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:

   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts

*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `/scripts/update-agent-context.sh [claude|gemini|copilot]` for your AI assistant
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach

*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:

- Load `/templates/tasks-template.md` as base structure
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- 每个 contract → contract test task [P]：为每个JSON schema创建失败的合约测试
- 每个 entity → model creation task [P]：基于data-model.md创建实体类和验证器
- 每个 user story → integration test task：从quickstart.md提取场景创建端到端测试
- 每个工具适配 → backward compatibility test + implementation task：确保新旧API共存
- 现有工具改造 → 渐进式重构 task：逐步添加资源标识支持

**Ordering Strategy**:

- TDD order: Tests before implementation (严格RED-GREEN-Refactor)
- Dependency order:
  1. 基础模型与接口定义 [P]：Resource, ResourceIdentifier, AuthenticationProfile
  2. ResourceLoader 抽象与实现 [P]：LocalFileLoader, RemoteApiLoader  
  3. ResourceRegistry 实现：资源注册表与标识解析
  4. 能力管理与校验 [P]：CapabilityValidator, SecurityCapabilities
  5. 工具适配层实现：ssh/http工具的资源模式支持
  6. 配置系统扩展：resources配置段，优先级与超时策略
  7. 端到端集成与验证：quickstart场景自动化测试
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 32-38 numbered, ordered tasks in tasks.md

**Key Task Categories**:

- Setup & Dependencies (2-3 tasks): YAML库，配置扩展
- Contract Tests (8-10 tasks): 为每个API合约创建失败测试
- Model Implementation (6-8 tasks): 实体类，验证器，标识符解析
- Loader Implementation (4-6 tasks): 本地/远程加载器，注册表
- Tool Adaptation (6-8 tasks): SSH/HTTP工具资源模式，向后兼容
- Integration Tests (4-6 tasks): 端到端场景，性能验证
- Documentation (2-3 tasks): 更新README，生成API文档

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation

*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |

## Progress Tracking

*This checklist is updated during execution flow*

**Phase Status**:

- [ ] Phase 0: Research complete (/plan command)
- [ ] Phase 1: Design complete (/plan command)
- [ ] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [ ] Initial Constitution Check: PASS
- [ ] Post-Design Constitution Check: PASS
- [ ] All NEEDS CLARIFICATION resolved
- [ ] Complexity deviations documented

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*

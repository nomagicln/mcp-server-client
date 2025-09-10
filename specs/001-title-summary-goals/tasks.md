# Tasks: 从指定/默认位置加载配置 + 实时监听热刷新

Input: 设计文档位于 /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/specs/001-title-summary-goals/
Prerequisites: plan.md (required); research.md, data-model.md, contracts/ 均未提供（本次跳过）

## Execution Flow (main)

1. 读取 plan.md，提取技术栈与结构（Node.js ESM、Jest、计划引入 chokidar）
2. 生成任务分类：Setup → Tests → Core → Integration → Polish
3. 按规则排序：测试优先（TDD），同文件顺序执行，不同文件标记 [P]
4. 编号任务 T001…，写入绝对文件路径与依赖说明
5. 提供可并行执行示例与可直接运行的命令

## Format: [ID] [P?] Description

- [P]: 可并行（不同文件、无直接依赖）
- 每条任务包含需要编辑/创建的绝对路径

## Path Conventions (Single project)

- 源码: /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/src/
- 测试: /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/test/
- Feature 文档: /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/specs/001-title-summary-goals/

---

## Phase 3.1: Setup

- [ ] T001 更新依赖与脚本
  - 目标: 在 package.json 中新增依赖 chokidar，并确保 Jest/ESM 配置保持可用
  - 文件:
    - /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/package.json
  - 验收: 安装成功、test 命令可运行
  - 命令示例:
    - npm install chokidar --save
    - npm run test -- --version

- [ ] T002 初始化配置搜索路径与常量模块 [P]
  - 目标: 新建路径常量与默认搜索顺序（CWD → 用户级 → 系统级）
  - 文件(新增):
    - /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/src/config/paths.js
  - 内容要点: 导出 getDefaultSearchPaths()，返回按优先级排序的候选列表，包含扩展名 .json/.js/.mjs/.cjs

- [ ] T003 规划日志键与格式 [P]
  - 目标: 定义与配置加载相关的日志键（source、path、duration、success、reason）
  - 文件:
    - /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/src/utils/logger.js
  - 验收: logger 可记录上述字段且不破坏现有日志

## Phase 3.2: Tests First (TDD) — 必须先失败再实现

- [ ] T004 [P] 集成测试: 默认搜索顺序加载首个有效配置
  - 文件(新增): /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/test/integration/config-loading.default-search.test.js
  - 场景: 未显式提供路径时，从默认顺序找到首个有效配置并加载；断言返回的 source=DEFAULT、path=绝对路径
  - 命令: npm run test:integration -- /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/test/integration/config-loading.default-search.test.js

- [ ] T005 [P] 集成测试: CLI 指定路径优先
  - 文件(新增): /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/test/integration/config-loading.cli-priority.test.js
  - 场景: 通过 --config 指定文件，优先加载；当文件不存在时给出清晰错误（含绝对路径）；可选回退策略测试

- [ ] T006 [P] 集成测试: 环境变量路径优先级次于 CLI
  - 文件(新增): /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/test/integration/config-loading.env-priority.test.js
  - 场景: MCP_CONFIG 指定文件时优先级低于 CLI 高于默认；断言最终路径与来源

- [ ] T007 [P] 集成测试: 非法配置与回退/失败路径
  - 文件(新增): /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/test/integration/config-loading.invalid-and-fallback.test.js
  - 场景: 指定文件解析失败（格式错误/空文件）→ 输出包含路径与原因；回退开启则继续搜索并成功；关闭则失败退出（模拟 CI）

- [ ] T008 [P] 集成测试: 权限/目录路径/缺失等边界
  - 文件(新增): /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/test/integration/config-loading.edge-cases.test.js
  - 场景: 指向目录、权限不足、所有默认位置缺失，均输出明确提示与建议，CI 环境下立即失败

- [ ] T009 [P] 集成测试: 热监听与平滑回退
  - 文件(新增): /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/test/integration/config-watching.hot-reload.test.js
  - 场景: 修改已加载的配置文件 → 触发验证与平滑切换；若失败则回退到上次有效配置并告警

## Phase 3.3: Core Implementation（仅在上述测试均为失败状态后开始）

- [ ] T010 [P] 实现配置解析与加载器（优先级/来源）
  - 文件(新增): /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/src/config/loader.js
  - 要点: 支持 JSON 与 JS 导出两种格式；实现 resolveConfig({cliPath, envPath, defaultPaths, allowFallback}) → {config, meta:{source,path}}

- [ ] T011 [P] 文件格式解析器
  - 文件(新增): /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/src/config/parse.js
  - 要点: 按扩展名路由解析；.json 使用 fs+JSON.parse；.js/.mjs 动态 import；.cjs 使用 createRequire；返回 {object, errors[]}

- [ ] T012 [P] 配置校验器
  - 文件(新增): /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/src/config/validate.js
  - 要点: 校验关键段落结构/类型（http/ssh/security/transport/logging）；返回 {isValid, errors[], warnings[]}

- [ ] T013 合并策略（默认 → 文件 → 环境变量覆盖）
  - 文件: /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/src/config/index.js
  - 要点: 保持现有 ENV 优先级；提供 applyLoadedConfig(baseConfig, fileConfig) 并确保不改变公共 API；必要时导出 getConfig()

- [ ] T014 将 --config 与 MCP_CONFIG 集成到启动流程
  - 文件: /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/src/index.js
  - 要点: 解析 --config；在启动前调用 loader，记录最终 source/path；失败行为在本地与 CI 区分

## Phase 3.4: Integration

- [ ] T015 [P] 引入 chokidar 并实现文件热监听
  - 文件(新增): /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/src/config/watcher.js
  - 要点: 监听当前生效文件与默认搜索列表；抖动去抖 ≥200ms；失败回退并写警告日志

- [ ] T016 结构化日志与错误上下文
  - 文件: /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/src/utils/logger.js
  - 要点: 日志字段包含 source/path/duration/reason；错误日志包含解析栈与建议

- [ ] T017 CLI 帮助与 README 更新
  - 文件:
    - /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/bin/mcp-server-client
    - /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/README.md
  - 要点: 新增 --config 说明、ENV 示例、默认搜索顺序与示例配置

- [ ] T018 CI 行为与退出码策略
  - 文件: /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/src/index.js
  - 要点: 检测 CI=true 时遇错直接非零退出并打印最小必要信息；本地环境打印详细指引

## Phase 3.5: Polish

- [ ] T019 [P] 单元测试: parse/validate/merge
  - 文件(新增): /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/test/unit/config-parse.test.js
  - 文件(新增): /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/test/unit/config-validate.test.js
  - 文件(新增): /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/test/unit/config-merge.test.js

- [ ] T020 性能验证（监听+解析 < 50ms 常规场景）
  - 文件(新增): /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/test/integration/config-performance.test.js

- [ ] T021 [P] 示例与文档更新
  - 文件: /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/specs/001-title-summary-goals/quickstart.md
  - 要点: 添加快速验证步骤与失败/回退演示

- [ ] T022 清理重复与小重构
  - 文件: 受影响源文件（config/*, src/index.js, logger）
  - 要点: 去重、提取共用工具、补充注释

- [ ] T023 运行全量检查
  - 命令: make check 以及 npm run format:check

## Dependencies

- 测试 (T004–T009) 必须在实现 (T010–T018) 之前
- T002 → T010（依赖默认路径常量）
- T011/T012 → T010（解析与校验供加载器使用）
- T013 → T014（合并策略就绪再接入启动）
- T015 依赖 T010/T013（需已能加载配置）
- 实现 (T010–T018) 完成后再进行 Polish (T019–T023)

## Parallel Example（可直接运行的命令）

以下四个测试任务可并行，因为它们是不同测试文件：

- Task: "T004 默认搜索顺序加载首个有效配置"
  - 命令: npm run test:integration -- /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/test/integration/config-loading.default-search.test.js
- Task: "T005 CLI 指定路径优先"
  - 命令: npm run test:integration -- /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/test/integration/config-loading.cli-priority.test.js
- Task: "T006 环境变量路径优先级次于 CLI"
  - 命令: npm run test:integration -- /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/test/integration/config-loading.env-priority.test.js
- Task: "T007 非法配置与回退/失败路径"
  - 命令: npm run test:integration -- /Users/fangzhiheng/Projects/github.com/nomagicln/mcp-server-client/test/integration/config-loading.invalid-and-fallback.test.js

另一组可并行（不同源文件）：

- Task: "T011 文件格式解析器"
- Task: "T012 配置校验器"
- Task: "T002 路径常量模块"

## Task Generation Rules（已应用）

- 合同文件: 无 contracts/，跳过合同测试生成
- 数据模型: 无 data-model.md，跳过模型任务生成
- 用户故事: 来自 spec.md 的 Acceptance Scenarios → 生成集成测试 [P]
- 不同文件标记 [P]；同文件顺序执行（未标 [P]）
- 任务包含明确绝对路径

## Validation Checklist

- [x] 所有用户场景均有对应测试（T004–T009）
- [x] 测试先于实现排列
- [x] 并行任务互不修改同一文件
- [x] 每个任务指定了明确文件路径

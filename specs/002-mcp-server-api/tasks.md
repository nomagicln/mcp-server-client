# Tasks: MCP Server：主机资源与 API 端点资源（可本地/远程加载与能力声明）

**Input**: Design documents from `/specs/002-mcp-server-api/`  
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/, quickstart.md

## Execution Flow (main)

```
1. Load plan.md from feature directory
   → Tech stack: Node.js 18+ (ESM), @modelcontextprotocol/sdk, axios, ssh2, chokidar, yaml
   → Structure: Single project (src/), existing structure
2. Load design documents:
   → data-model.md: 4 entities (Resource, HostResource, ApiResource, ResourceIdentifier)
   → contracts/: 4 API contracts (resource-loader, resource-registry, tool-adapters, resource)
   → quickstart.md: 4 integration scenarios
3. Generate tasks by category:
   → Setup: dependencies, project structure
   → Tests: contract tests, integration tests (TDD)
   → Core: models, loaders, registry, adapters
   → Integration: tool adaptation, configuration
   → Polish: unit tests, documentation
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (RED-GREEN-Refactor)
5. Dependencies: Setup → Contract Tests → Models → Services → Adapters → Integration → Polish
```

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `test/` at repository root
- Paths assume existing structure from workspace analysis

## Phase 3.1: Setup

- [ ] T001 Install yaml dependency for YAML resource file parsing
  - **File**: `package.json`
  - **Command**: `npm install yaml`
  - **Verify**: Import yaml in Node.js works

- [ ] T002 Create resources module directory structure
  - **Files**: `src/resources/index.js`, `src/resources/loaders/`, `src/resources/registry/`, `src/resources/adapters/`
  - **Dependencies**: None (setup only)

## Phase 3.2: Contract Tests (TDD - RED Phase)

- [ ] T003 [P] Create ResourceLoader contract test (MUST FAIL)
  - **File**: `test/unit/resource-loader.contract.test.js`
  - **Contract**: `contracts/resource-loader.json`
  - **Test**: loadResources, validateResource, getCapabilities methods
  - **Expected**: All tests FAIL (implementation not exists)

- [ ] T004 [P] Create ResourceRegistry contract test (MUST FAIL)
  - **File**: `test/unit/resource-registry.contract.test.js`
  - **Contract**: `contracts/resource-registry.json`
  - **Test**: registerResource, resolveIdentifier, listResources methods
  - **Expected**: All tests FAIL (implementation not exists)

- [ ] T005 [P] Create ToolAdapters contract test (MUST FAIL)
  - **File**: `test/unit/tool-adapters.contract.test.js`
  - **Contract**: `contracts/tool-adapters.json`
  - **Test**: adaptSshTool, adaptHttpTool, resolveCredentials methods
  - **Expected**: All tests FAIL (implementation not exists)

- [ ] T006 [P] Create Resource schema contract test (MUST FAIL)
  - **File**: `test/unit/resource.contract.test.js`
  - **Contract**: `contracts/resource.json`
  - **Test**: Resource, HostResource, ApiResource validation
  - **Expected**: All tests FAIL (models not exist)

## Phase 3.3: Integration Tests (TDD - RED Phase)

- [ ] T007 [P] Create local file resource loading integration test (MUST FAIL)
  - **File**: `test/integration/local-resource-loading.test.js`
  - **Scenario**: quickstart.md 场景1 - 本地文件资源管理
  - **Test**: Load hosts.yaml, validate schema, register resources
  - **Expected**: FAIL (LocalFileLoader not implemented)

- [ ] T008 [P] Create remote resource directory integration test (MUST FAIL)
  - **File**: `test/integration/remote-resource-loading.test.js`
  - **Scenario**: quickstart.md 场景2 - 远程资源目录
  - **Test**: HTTP fetch, parse JSON/YAML, cache management
  - **Expected**: FAIL (RemoteApiLoader not implemented)

- [ ] T009 [P] Create capability validation integration test (MUST FAIL)
  - **File**: `test/integration/capability-validation.test.js`
  - **Scenario**: quickstart.md 场景3 - 能力验证与错误处理
  - **Test**: Validate capabilities, authentication checks, error handling
  - **Expected**: FAIL (CapabilityValidator not implemented)

- [ ] T010 [P] Create resource hot reload integration test (MUST FAIL)
  - **File**: `test/integration/resource-hot-reload.test.js`
  - **Scenario**: quickstart.md 场景4 - 资源热更新
  - **Test**: File watching, automatic reload, event notifications
  - **Expected**: FAIL (hot reload not implemented)

## Phase 3.4: Core Models (TDD - GREEN Phase)

- [ ] T011 [P] Implement Resource base model
  - **File**: `src/resources/models/Resource.js`
  - **Input**: `data-model.md` Resource entity definition
  - **Goal**: Make T006 Resource schema tests PASS
  - **Validation**: id, type, name, capabilities, auth validation

- [ ] T012 [P] Implement HostResource model
  - **File**: `src/resources/models/HostResource.js`
  - **Input**: `data-model.md` HostResource definition
  - **Goal**: Make T006 HostResource schema tests PASS
  - **Extends**: Resource with ssh-specific capabilities

- [ ] T013 [P] Implement ApiResource model
  - **File**: `src/resources/models/ApiResource.js`
  - **Input**: `data-model.md` ApiResource definition
  - **Goal**: Make T006 ApiResource schema tests PASS
  - **Extends**: Resource with http-specific capabilities

- [ ] T014 [P] Implement ResourceIdentifier model
  - **File**: `src/resources/models/ResourceIdentifier.js`
  - **Input**: `data-model.md` ResourceIdentifier definition
  - **Goal**: Parse URI scheme {resource_type}://{loader_type}/{loader_id}/{resource_id}
  - **Methods**: parse, toString, validate

- [ ] T015 [P] Implement AuthenticationProfile model
  - **File**: `src/resources/models/AuthenticationProfile.js`
  - **Input**: `data-model.md` AuthenticationProfile definition
  - **Goal**: Support ssh-key, password, bearer-token auth methods
  - **Security**: Credential reference resolution (env://, file://)

## Phase 3.5: Core Services

- [ ] T016 Implement ResourceLoader abstract base class
  - **File**: `src/resources/loaders/ResourceLoader.js`
  - **Goal**: Make T003 contract tests PASS
  - **Methods**: loadResources, validateResource, getCapabilities (abstract)
  - **Dependencies**: T011-T015 (models)

- [ ] T017 Implement LocalFileLoader
  - **File**: `src/resources/loaders/LocalFileLoader.js`
  - **Goal**: Make T007 integration test PASS
  - **Methods**: Load YAML/JSON files, watch for changes
  - **Dependencies**: T016 (ResourceLoader), yaml package
  - **Features**: File watching, path resolution, schema validation

- [ ] T018 Implement RemoteApiLoader
  - **File**: `src/resources/loaders/RemoteApiLoader.js`
  - **Goal**: Make T008 integration test PASS
  - **Methods**: HTTP fetch, cache management, retry logic
  - **Dependencies**: T016 (ResourceLoader), axios
  - **Features**: HTTP auth, cache TTL, connection pooling

- [ ] T019 Implement ResourceRegistry
  - **File**: `src/resources/registry/ResourceRegistry.js`
  - **Goal**: Make T004 contract tests PASS
  - **Methods**: registerResource, resolveIdentifier, listResources
  - **Dependencies**: T014 (ResourceIdentifier), T016 (ResourceLoader)
  - **Features**: Resource lookup, conflict resolution, batch operations

## Phase 3.6: Capability Management

- [ ] T020 [P] Implement CapabilityValidator
  - **File**: `src/resources/capabilities/CapabilityValidator.js`
  - **Goal**: Make T009 integration test PASS
  - **Methods**: validateCapability, checkPermissions, auditAccess
  - **Dependencies**: T011-T013 (models)
  - **Features**: Capability definitions, security checks

- [ ] T021 [P] Implement SecurityCapabilities definitions
  - **File**: `src/resources/capabilities/SecurityCapabilities.js`
  - **Goal**: Define ssh.*, http.*, file.* capability hierarchies
  - **Methods**: Define capability trees, inheritance rules
  - **Dependencies**: T020 (CapabilityValidator)

## Phase 3.7: Tool Adaptation

- [ ] T022 Implement SSH tool adapter
  - **File**: `src/resources/adapters/SshToolAdapter.js`
  - **Goal**: Make ssh_exec work with resource identifiers
  - **Methods**: adaptSshTool, resolveCredentials, executeCommand
  - **Dependencies**: T019 (ResourceRegistry), existing ssh.js
  - **Backward Compatibility**: Support both resource ID and direct credentials

- [ ] T023 Implement HTTP tool adapter
  - **File**: `src/resources/adapters/HttpToolAdapter.js`
  - **Goal**: Make http_request work with resource identifiers
  - **Methods**: adaptHttpTool, resolveCredentials, makeRequest
  - **Dependencies**: T019 (ResourceRegistry), existing http.js
  - **Backward Compatibility**: Support both resource ID and direct URL/auth

- [ ] T024 Update ssh_exec tool integration
  - **File**: `src/tools/ssh.js`
  - **Goal**: Make T005 ToolAdapters contract tests PASS
  - **Changes**: Add resource identifier parameter support
  - **Dependencies**: T022 (SshToolAdapter)
  - **Compatibility**: Maintain existing API, add resource mode

- [ ] T025 Update http_request tool integration
  - **File**: `src/tools/http.js`
  - **Goal**: Make T005 ToolAdapters contract tests PASS
  - **Changes**: Add resource identifier parameter support
  - **Dependencies**: T023 (HttpToolAdapter)
  - **Compatibility**: Maintain existing API, add resource mode

## Phase 3.8: Configuration Extension

- [ ] T026 Extend configuration system for resources
  - **File**: `src/config/parse.js`
  - **Goal**: Support resources section in config files
  - **Changes**: Add resources schema, validation, defaults
  - **Dependencies**: T017-T018 (loaders)
  - **Features**: Loader configuration, priority settings, timeouts

- [ ] T027 Implement resource configuration validation
  - **File**: `src/config/validate.js`
  - **Goal**: Validate resources section schema
  - **Changes**: Add resources validation rules
  - **Dependencies**: T026 (config parsing)
  - **Validation**: Loader configs, path resolution, auth references

## Phase 3.9: Hot Reload System

- [ ] T028 Implement resource file watcher
  - **File**: `src/resources/watchers/ResourceWatcher.js`
  - **Goal**: Make T010 hot reload integration test PASS
  - **Methods**: watchFiles, notifyChanges, batchUpdates
  - **Dependencies**: T017 (LocalFileLoader), chokidar
  - **Features**: Debounced updates, error recovery, event emission

- [ ] T029 Integrate resource watcher with registry
  - **File**: `src/resources/registry/ResourceRegistry.js` (extend)
  - **Goal**: Auto-reload resources on file changes
  - **Changes**: Add watcher integration, reload methods
  - **Dependencies**: T028 (ResourceWatcher), T019 (existing registry)
  - **Features**: Selective reload, dependency tracking

## Phase 3.10: CLI Extension

- [ ] T030 Add resource management CLI commands
  - **File**: `bin/mcp-server-client` (extend)
  - **Goal**: Add --list-resources, --reload-resources flags
  - **Changes**: New command handlers, resource operations
  - **Dependencies**: T019 (ResourceRegistry)
  - **Commands**: list, reload, validate, test-connection

## Phase 3.11: Integration Validation

- [ ] T031 Run all integration tests end-to-end
  - **Files**: All `test/integration/*resource*.test.js`
  - **Goal**: Verify all quickstart scenarios work
  - **Dependencies**: T007-T010, T017-T029 (all implementations)
  - **Validation**: Local loading, remote loading, capabilities, hot reload

- [ ] T032 Backward compatibility testing
  - **Files**: `test/integration/backward-compatibility.test.js`
  - **Goal**: Ensure existing tools still work without resources
  - **Tests**: Direct ssh_exec, direct http_request calls
  - **Dependencies**: T024-T025 (tool updates)

## Phase 3.12: Documentation & Polish

- [ ] T033 [P] Create API documentation
  - **File**: `docs/resources-api.md`
  - **Content**: ResourceLoader API, configuration examples, troubleshooting
  - **Dependencies**: All implementations complete
  - **Format**: Markdown with code examples

- [ ] T034 [P] Update main README with resources feature
  - **File**: `README.md`
  - **Changes**: Add resources section, quick start examples
  - **Dependencies**: T033 (API docs)
  - **Examples**: Basic resource configuration, tool usage

- [ ] T035 [P] Add unit tests for edge cases
  - **Files**: `test/unit/*-edge-cases.test.js`
  - **Goal**: Cover error conditions, edge cases, performance
  - **Dependencies**: All implementations
  - **Coverage**: Malformed configs, network failures, auth errors

## Parallel Execution Examples

### Phase 3.2-3.3 (Setup Tests - All Parallel)

```bash
# All contract and integration tests can run in parallel (different files)
npm test test/unit/resource-loader.contract.test.js &
npm test test/unit/resource-registry.contract.test.js &
npm test test/unit/tool-adapters.contract.test.js &
npm test test/unit/resource.contract.test.js &
npm test test/integration/local-resource-loading.test.js &
npm test test/integration/remote-resource-loading.test.js &
npm test test/integration/capability-validation.test.js &
npm test test/integration/resource-hot-reload.test.js &
wait
```

### Phase 3.4 (Models - All Parallel)

```bash
# All model files are independent
npx copilot implement T011 &  # Resource.js
npx copilot implement T012 &  # HostResource.js
npx copilot implement T013 &  # ApiResource.js
npx copilot implement T014 &  # ResourceIdentifier.js
npx copilot implement T015 &  # AuthenticationProfile.js
wait
```

### Phase 3.6 (Capabilities - Parallel)

```bash
# Capability files are independent
npx copilot implement T020 &  # CapabilityValidator.js
npx copilot implement T021 &  # SecurityCapabilities.js
wait
```

### Phase 3.12 (Documentation - All Parallel)

```bash
# Documentation tasks are independent
npx copilot implement T033 &  # API docs
npx copilot implement T034 &  # README update
npx copilot implement T035 &  # Unit tests
wait
```

## Dependencies Graph

```
T001,T002 (Setup)
    ↓
T003,T004,T005,T006 (Contract Tests) [P]
    ↓
T007,T008,T009,T010 (Integration Tests) [P]
    ↓
T011,T012,T013,T014,T015 (Models) [P]
    ↓
T016 → T017,T018 (Loaders)
    ↓
T019 (Registry)
    ↓
T020,T021 (Capabilities) [P]
    ↓
T022,T023 (Adapters) [P]
    ↓
T024,T025 (Tool Updates)
    ↓
T026,T027 (Config)
    ↓
T028,T029 (Hot Reload)
    ↓
T030 (CLI)
    ↓
T031,T032 (Validation)
    ↓
T033,T034,T035 (Polish) [P]
```

## Task Validation Checklist

- [x] All 4 contracts have failing tests (T003-T006)
- [x] All 4 quickstart scenarios have integration tests (T007-T010)
- [x] All 5 data model entities have implementations (T011-T015)
- [x] ResourceLoader pattern implemented (T016-T018)
- [x] Tool adaptation with backward compatibility (T022-T025)
- [x] Configuration system extended (T026-T027)
- [x] Hot reload functionality (T028-T029)
- [x] CLI commands added (T030)
- [x] End-to-end validation (T031-T032)
- [x] Documentation and polish (T033-T035)

**Total Tasks**: 35  
**Parallel Tasks**: 17 marked [P]  
**Sequential Tasks**: 18 with dependencies  
**Estimated Effort**: 3-4 weeks for full implementation

## Success Criteria

1. **RED Phase**: All contract tests (T003-T006) and integration tests (T007-T010) FAIL initially
2. **GREEN Phase**: All tests PASS after implementation tasks
3. **REFACTOR Phase**: Code quality, performance, documentation complete
4. **Backward Compatibility**: Existing ssh_exec/http_request tools work unchanged
5. **End-to-End**: All quickstart scenarios executable without errors
6. **Performance**: Resource loading < 100ms, hot reload < 50ms per plan.md goals

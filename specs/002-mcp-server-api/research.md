# Research: MCP Server 资源管理技术调研

**Date**: 2025-09-11  
**Feature**: 002-mcp-server-api  
**Phase**: 0 - Outline & Research

## Research Tasks Completed

### Task 1: YAML 解析库选择与最佳实践

**Decision**: 使用 `yaml` 包（而非 js-yaml）  
**Rationale**:

- `yaml` 包更现代，支持 YAML 1.2 规范，且体积较小
- 更好的 TypeScript 支持和错误处理
- 与现有 Node.js ESM 模块系统集成更顺畅
- 性能优于 js-yaml，内存占用更低

**Alternatives considered**:

- `js-yaml`: 历史悠久但较重，仍使用 YAML 1.1
- `@apidevtools/yaml`: 功能丰富但过于复杂
- 原生 JSON.parse: 不支持 YAML 格式要求

### Task 2: HTTP 客户端认证策略最佳实践

**Decision**: 基于现有 axios 扩展认证拦截器  
**Rationale**:

- 已有 axios 依赖，无需引入新库
- 拦截器模式便于统一管理认证头
- 支持 Token/Bearer/Basic/mTLS 的标准实现
- 与现有 HttpTool 集成成本最低

**Alternatives considered**:

- 切换到 fetch: 会破坏现有代码
- 使用 node-fetch: 额外依赖且功能重复
- 自实现 HTTP 客户端: 过度工程化

**Implementation Pattern**:

```javascript
// 认证拦截器注册
axios.interceptors.request.use(async (config) => {
  const auth = await resolveAuthentication(config.resourceRef);
  return applyAuthHeaders(config, auth);
});
```

### Task 3: 资源标识 URI 方案实现细节

**Decision**: 采用 `{resource_type}://{loader_type}/{loader_id}/{resource_id}` 格式  
**Rationale**:

- 明确区分资源类型（host/api）与加载来源
- loader_type + loader_id 支持多实例配置（如多个远程目录）
- 符合标准 URI 语法，便于解析和校验
- 可扩展性强，支持未来新资源类型

**Alternatives considered**:

- 简单的 `type://id` 格式: 无法区分加载来源
- 分层路径如 `/resources/host/local/id`: 不符合 URI 标准
- UUID 标识: 不便于人工识别和调试

**Implementation Pattern**:

```javascript
class ResourceIdentifier {
  static parse(uri) {
    const match = uri.match(/^([^:]+):\/\/([^/]+)\/([^/]+)\/(.+)$/);
    return {
      resourceType: match[1],  // host|api
      loaderType: match[2],    // local|remote
      loaderId: match[3],      // default|catalog|etc
      resourceId: match[4]     // host-001|api-001
    };
  }
}
```

### Task 4: 凭据引用系统设计

**Decision**: 分层凭据引用系统：env:// → file:// → vault://  
**Rationale**:

- env:// 引用环境变量，适合容器部署
- file:// 引用本地文件，适合开发环境
- vault:// 预留密钥管理系统集成
- 统一 credentialRef 字段，运行时解析

**Alternatives considered**:

- 仅支持环境变量: 灵活性不足
- 内联密钥配置: 安全风险
- 集成特定密钥系统: 依赖过重

**Implementation Pattern**:

```javascript
// 凭据引用解析器
async function resolveCredential(credentialRef) {
  if (credentialRef.startsWith('env://')) {
    return process.env[credentialRef.slice(6)];
  }
  if (credentialRef.startsWith('file://')) {
    return await readSecureFile(credentialRef.slice(7));
  }
  throw new Error(`Unsupported credential reference: ${credentialRef}`);
}
```

### Task 5: 配置化优先级与超时重试机制

**Decision**: 使用配置对象控制合并策略和网络策略  
**Rationale**:

- 扩展现有 config 系统，保持一致性
- 支持运行时动态调整，便于调试
- 默认值合理，高级用户可自定义
- 与现有 HTTP/SSH 超时配置保持统一

**Configuration Schema**:

```javascript
const resourceConfig = {
  mergeStrategy: {
    conflictResolution: 'remote-priority', // 'local-priority' | 'remote-priority' | 'error'
    allowDuplicateIds: false
  },
  network: {
    timeout: 5000,      // 远程加载超时
    retryAttempts: 3,   // 重试次数
    retryDelay: 1000,   // 重试延迟
    backoffMultiplier: 2 // 指数退避
  },
  hotReload: {
    enabled: true,
    debounceMs: 200    // 防抖延迟
  }
};
```

### Task 6: 向后兼容策略

**Decision**: 渐进式增强，保持现有 API 签名不变  
**Rationale**:

- 现有调用方式继续有效，降低迁移成本
- 新增可选参数支持资源标识
- 通过参数检测自动路由到新旧逻辑
- 保持错误消息和日志格式一致性

**Implementation Pattern**:

```javascript
// SSH 工具兼容性封装
async function ssh_exec(...args) {
  // 检测调用模式
  if (args.length === 1 && args[0].startsWith('host://')) {
    // 新模式：资源标识调用
    return await executeViaResource(args[0], args[1]);
  } else {
    // 旧模式：直接参数调用
    return await executeDirect(...args);
  }
}
```

## Technical Decisions Summary

| Component | Technology | Justification |
|-----------|------------|---------------|
| YAML Parser | `yaml` npm package | Modern, lightweight, YAML 1.2 support |
| Authentication | axios interceptors | Reuse existing, proven pattern |
| URI Scheme | `type://loader/id/resource` | Clear hierarchy, extensible |
| Credentials | Reference-based (env://, file://) | Security, flexibility |
| Configuration | Extend existing config system | Consistency, reuse |
| Compatibility | Progressive enhancement | Zero breaking changes |

## Architecture Implications

1. **Module Structure**: 新增 `src/resources/` 模块，包含 loader, registry, capabilities, adapters 子模块
2. **Dependency Changes**: 新增 `yaml` 依赖，更新 package.json
3. **Configuration Extension**: 扩展现有配置系统，新增 resources 配置段
4. **Testing Strategy**: 契约测试优先，真实文件系统和网络调用
5. **Performance Considerations**: 资源加载缓存，配置化超时与重试

## Phase 1 Readiness

所有技术未知项已解决，可进入 Phase 1 设计阶段：

- ✅ YAML 解析技术栈确定
- ✅ HTTP 认证集成方案明确  
- ✅ URI 方案与解析逻辑设计完成
- ✅ 凭据安全引用机制确定
- ✅ 配置系统扩展方案明确
- ✅ 向后兼容策略验证完成

**Next Phase**: Phase 1 - 数据模型设计、合约定义、快速入门文档生成

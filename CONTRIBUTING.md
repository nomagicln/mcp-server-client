# 贡献指南

感谢您对 MCP Server Client 项目的兴趣！我们欢迎各种形式的贡献，包括但不限于：

- 🐛 报告 bug
- 💡 提出新功能建议
- 📝 改进文档
- 🔧 提交代码修复
- ✨ 实现新功能

## 🚀 快速开始

### 开发环境设置

1. **Fork 项目**

   ```bash
   git clone https://github.com/YOUR_USERNAME/mcp-server-client.git
   cd mcp-server-client
   ```

2. **安装依赖**

   ```bash
   npm install
   ```

3. **创建特性分支**

   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **启动开发模式**

   ```bash
   npm run dev
   ```

### 代码规范

项目采用严格的代码规范，请确保：

1. **ESLint 检查通过**

   ```bash
   npm run lint
   ```

2. **代码格式化**

   ```bash
   npm run format
   ```

3. **测试通过**

   ```bash
   npm test
   ```

## 📝 提交规范

### 提交信息格式

请遵循 [Conventional Commits](https://conventionalcommits.org/) 规范：

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### 类型说明

- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式调整 (不影响功能)
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建工具或辅助功能更新

### 示例

```bash
git commit -m "feat: add SSH key authentication support"
git commit -m "fix: resolve connection timeout issue"
git commit -m "docs: update API documentation"
```

## 🧪 测试

### 编写测试

1. **单元测试**: 位于 `test/unit/` 目录
2. **集成测试**: 位于 `test/integration/` 目录

测试文件命名规范：

- 单元测试: `*.test.js`
- 集成测试: `*.spec.js`

### 运行测试

```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 生成覆盖率报告
npm run test:coverage
```

## 📋 开发流程

### 1. 选择任务

- 查看 [GitHub Issues](https://github.com/nomagicln/mcp-server-client/issues)
- 选择适合您的任务
- 如果没有合适任务，可以创建新 Issue

### 2. 创建分支

```bash
git checkout -b feature/your-feature-name
# 或
git checkout -b fix/issue-number
```

### 3. 开发实现

- 遵循现有的代码结构和命名规范
- 为新功能编写测试
- 更新相关文档
- 确保所有测试通过

### 4. 提交更改

```bash
# 添加文件
git add .

# 提交 (请使用规范的提交信息)
git commit -m "feat: add new feature description"

# 推送到您的分支
git push origin feature/your-feature-name
```

### 5. 创建 Pull Request

1. 访问您的 GitHub 仓库
2. 点击 "Compare & pull request"
3. 填写 PR 描述，包括：
   - 实现的功能
   - 相关的 Issue 编号
   - 测试说明
   - 任何重要的实现细节

## 🏗️ 项目结构

```
src/
├── tools/           # MCP 工具实现
│   ├── http.js      # HTTP 请求工具
│   └── ssh.js       # SSH 命令执行工具
├── utils/           # 工具函数
├── config/          # 配置管理
└── index.js         # 应用入口

test/
├── unit/            # 单元测试
└── integration/     # 集成测试
```

## 🔧 代码规范

### JavaScript 规范

- 使用 ES6+ 语法
- 使用 `const` 和 `let` 替代 `var`
- 使用箭头函数
- 使用模板字符串
- 使用解构赋值
- 使用 async/await 处理异步操作

### 错误处理

- 使用 try/catch 处理同步错误
- 使用 Promise 的 .catch() 处理异步错误
- 为用户提供清晰的错误信息
- 记录详细的错误日志

### 安全性考虑

- 验证所有输入参数
- 避免敏感信息泄露
- 使用安全的默认配置
- 提供安全配置选项

## 📚 文档

### 更新文档

- README.md: 项目主要说明
- API 文档: 工具使用说明
- 配置文档: 配置选项说明

### 文档规范

- 使用 Markdown 格式
- 提供清晰的示例
- 保持文档与代码同步

## 🤝 行为准则

我们致力于维护一个开放和包容的社区。请：

- ✅ 尊重他人观点
- ✅ 提供建设性反馈
- ✅ 接受善意批评
- ✅ 关注项目目标
- ❌ 避免攻击性言论
- ❌ 不要发布不当内容

## 📞 获取帮助

如果您需要帮助：

1. 查看现有文档
2. 搜索相关 Issue
3. 在 Issue 中提问
4. 联系维护者

## 🎉 致谢

感谢所有贡献者的辛勤工作！您的贡献让这个项目变得更好。

---

**最后更新**: 2024-12-19

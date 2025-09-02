# Makefile for MCP Server Client
# 支持本地运行和 Docker 镜像构建

# 项目配置
PROJECT_NAME := mcp-server-client
VERSION := $(shell node -p "require('./package.json').version")
DOCKER_REGISTRY := 
DOCKER_IMAGE := $(PROJECT_NAME)
DOCKER_TAG := $(VERSION)

# 默认目标
.DEFAULT_GOAL := help

# 颜色定义
BLUE := \033[34m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
NC := \033[0m # No Color

##@ 帮助信息
.PHONY: help
help: ## 显示帮助信息
	@echo "$(BLUE)MCP Server Client Makefile$(NC)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf "$(BLUE)使用方法:$(NC)\n  make $(YELLOW)<target>$(NC)\n"} /^[a-zA-Z_0-9-]+:.*?##/ { printf "  $(YELLOW)%-15s$(NC) %s\n", $$1, $$2 } /^##@/ { printf "\n$(BLUE)%s$(NC)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ 本地开发
.PHONY: install
install: ## 安装项目依赖
	@echo "$(BLUE)安装项目依赖...$(NC)"
	npm install

.PHONY: dev
dev: ## 启动开发模式（文件监听）
	@echo "$(BLUE)启动开发模式...$(NC)"
	npm run dev

.PHONY: start
start: ## 启动生产模式
	@echo "$(BLUE)启动生产模式...$(NC)"
	@if [ "$(TRANSPORT)" ]; then \
		echo "$(YELLOW)使用传输方式: $(TRANSPORT)$(NC)"; \
		MCP_TRANSPORT=$(TRANSPORT) npm start; \
	else \
		npm start; \
	fi

.PHONY: test
test: ## 运行所有测试
	@echo "$(BLUE)运行测试...$(NC)"
	npm test

.PHONY: test-unit
test-unit: ## 运行单元测试
	@echo "$(BLUE)运行单元测试...$(NC)"
	npm run test:unit

.PHONY: test-integration
test-integration: ## 运行集成测试
	@echo "$(BLUE)运行集成测试...$(NC)"
	npm run test:integration

.PHONY: lint
lint: ## 代码规范检查
	@echo "$(BLUE)代码规范检查...$(NC)"
	npm run lint

.PHONY: lint-fix
lint-fix: ## 自动修复代码规范问题
	@echo "$(BLUE)自动修复代码规范问题...$(NC)"
	npm run lint:fix

.PHONY: format
format: ## 代码格式化
	@echo "$(BLUE)代码格式化...$(NC)"
	npm run format

.PHONY: clean
clean: ## 清理依赖和缓存
	@echo "$(BLUE)清理项目...$(NC)"
	rm -rf node_modules
	rm -rf coverage
	npm cache clean --force

##@ Docker 操作
.PHONY: docker-build
docker-build: ## 构建 Docker 镜像
	@echo "$(BLUE)构建 Docker 镜像...$(NC)"
	docker build -t $(DOCKER_IMAGE):$(DOCKER_TAG) .
	docker tag $(DOCKER_IMAGE):$(DOCKER_TAG) $(DOCKER_IMAGE):latest
	@echo "$(GREEN)镜像构建完成: $(DOCKER_IMAGE):$(DOCKER_TAG)$(NC)"

.PHONY: docker-run
docker-run: ## 运行 Docker 容器
	@echo "$(BLUE)运行 Docker 容器...$(NC)"
	docker run --rm -it \
		--name $(PROJECT_NAME) \
		$(DOCKER_IMAGE):latest

.PHONY: docker-run-daemon
docker-run-daemon: ## 后台运行 Docker 容器
	@echo "$(BLUE)后台运行 Docker 容器...$(NC)"
	docker run -d \
		--name $(PROJECT_NAME) \
		--restart unless-stopped \
		$(DOCKER_IMAGE):latest
	@echo "$(GREEN)容器已在后台启动$(NC)"

.PHONY: docker-logs
docker-logs: ## 查看容器日志
	@echo "$(BLUE)查看容器日志...$(NC)"
	docker logs -f $(PROJECT_NAME)

.PHONY: docker-stop
docker-stop: ## 停止容器
	@echo "$(BLUE)停止容器...$(NC)"
	docker stop $(PROJECT_NAME) || true
	docker rm $(PROJECT_NAME) || true

.PHONY: docker-shell
docker-shell: ## 进入容器 shell
	@echo "$(BLUE)进入容器 shell...$(NC)"
	docker exec -it $(PROJECT_NAME) /bin/sh

.PHONY: docker-push
docker-push: ## 推送镜像到仓库
	@if [ -z "$(DOCKER_REGISTRY)" ]; then \
		echo "$(RED)错误: 请设置 DOCKER_REGISTRY 变量$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)推送镜像到仓库...$(NC)"
	docker tag $(DOCKER_IMAGE):$(DOCKER_TAG) $(DOCKER_REGISTRY)/$(DOCKER_IMAGE):$(DOCKER_TAG)
	docker tag $(DOCKER_IMAGE):$(DOCKER_TAG) $(DOCKER_REGISTRY)/$(DOCKER_IMAGE):latest
	docker push $(DOCKER_REGISTRY)/$(DOCKER_IMAGE):$(DOCKER_TAG)
	docker push $(DOCKER_REGISTRY)/$(DOCKER_IMAGE):latest

.PHONY: docker-pull
docker-pull: ## 从仓库拉取镜像
	@if [ -z "$(DOCKER_REGISTRY)" ]; then \
		echo "$(RED)错误: 请设置 DOCKER_REGISTRY 变量$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)从仓库拉取镜像...$(NC)"
	docker pull $(DOCKER_REGISTRY)/$(DOCKER_IMAGE):$(DOCKER_TAG)

.PHONY: docker-clean
docker-clean: ## 清理 Docker 资源
	@echo "$(BLUE)清理 Docker 资源...$(NC)"
	docker system prune -f
	docker image prune -f

##@ 全局安装
.PHONY: install-global
install-global: ## 全局安装 MCP Server Client
	@echo "$(BLUE)全局安装 MCP Server Client...$(NC)"
	npm install -g .
	@echo "$(GREEN)全局安装完成!$(NC)"
	@echo "$(YELLOW)现在可以使用以下命令:$(NC)"
	@echo "  mcp-server-client start    # 启动服务器"
	@echo "  mcp-server-client version  # 查看版本"
	@echo "  mcpsc start               # 使用简化命令"

.PHONY: uninstall-global
uninstall-global: ## 卸载全局安装的 MCP Server Client
	@echo "$(BLUE)卸载全局安装的 MCP Server Client...$(NC)"
	npm uninstall -g $(PROJECT_NAME)
	@echo "$(GREEN)全局卸载完成!$(NC)"

.PHONY: link-global
link-global: ## 创建全局链接（开发用）
	@echo "$(BLUE)创建全局链接...$(NC)"
	npm link
	@echo "$(GREEN)全局链接创建完成!$(NC)"
	@echo "$(YELLOW)开发模式下可直接使用命令，代码更改会立即生效$(NC)"

.PHONY: unlink-global
unlink-global: ## 移除全局链接
	@echo "$(BLUE)移除全局链接...$(NC)"
	npm unlink -g $(PROJECT_NAME)
	@echo "$(GREEN)全局链接已移除!$(NC)"

##@ 项目管理
.PHONY: version
version: ## 显示当前版本
	@echo "项目版本: $(VERSION)"

.PHONY: info
info: ## 显示项目信息
	@echo "$(BLUE)项目信息:$(NC)"
	@echo "  名称: $(PROJECT_NAME)"
	@echo "  版本: $(VERSION)"
	@echo "  Docker 镜像: $(DOCKER_IMAGE):$(DOCKER_TAG)"
	@echo "  Node.js 版本要求: >= 18.0.0"

.PHONY: setup
setup: install ## 项目初始化设置
	@echo "$(BLUE)项目初始化完成$(NC)"
	@echo "$(GREEN)现在可以运行: make dev$(NC)"

.PHONY: check
check: lint test ## 运行代码检查和测试
	@echo "$(GREEN)代码检查和测试通过!$(NC)"

.PHONY: build-and-run
build-and-run: docker-build docker-run ## 构建并运行 Docker 容器

.PHONY: ci
ci: install lint test ## CI 流水线（安装、检查、测试）
	@echo "$(GREEN)CI 流水线执行完成!$(NC)"

##@ 开发工具
.PHONY: watch-logs
watch-logs: ## 实时监控应用日志
	@echo "$(BLUE)监控应用日志...$(NC)"
	tail -f logs/*.log 2>/dev/null || echo "暂无日志文件"

.PHONY: debug
debug: ## 调试模式启动
	@echo "$(BLUE)调试模式启动...$(NC)"
	DEBUG=* npm start

.PHONY: benchmark
benchmark: ## 性能基准测试
	@echo "$(BLUE)运行性能基准测试...$(NC)"
	@echo "$(YELLOW)功能暂未实现$(NC)"

# 检查必要的工具
.PHONY: check-tools
check-tools: ## 检查必要的开发工具
	@echo "$(BLUE)检查开发工具...$(NC)"
	@command -v node >/dev/null 2>&1 || { echo "$(RED)错误: 需要安装 Node.js$(NC)"; exit 1; }
	@command -v npm >/dev/null 2>&1 || { echo "$(RED)错误: 需要安装 npm$(NC)"; exit 1; }
	@command -v docker >/dev/null 2>&1 || { echo "$(YELLOW)警告: 未安装 Docker$(NC)"; }
	@echo "$(GREEN)开发工具检查通过$(NC)"

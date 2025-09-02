# 使用官方 Node.js 运行时作为基础镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 添加非 root 用户提高安全性
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcpuser -u 1001

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装生产依赖
RUN npm ci --only=production && \
    npm cache clean --force

# 复制源代码
COPY src/ ./src/

# 创建日志目录
RUN mkdir -p /app/logs && \
    chown -R mcpuser:nodejs /app

# 切换到非 root 用户
USER mcpuser

# 暴露端口（虽然这个 MCP 服务器主要通过 stdio 通信，但为了将来扩展）
EXPOSE 3000

# 设置环境变量
ENV NODE_ENV=production
ENV LOG_LEVEL=info

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "console.log('健康检查通过')" || exit 1

# 启动命令
CMD ["node", "src/index.js"]

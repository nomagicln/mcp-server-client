/**
 * 日志工具
 */

import { config } from '../config/index.js';

/**
 * 简单的控制台日志记录器
 */
class Logger {
  constructor() {
    this.level = this.parseLevel(config.logging.level);
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
    };
  }

  /**
   * 解析日志级别
   */
  parseLevel(level) {
    const levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
    };
    return levels[level.toLowerCase()] || 2; // 默认 info
  }

  /**
   * 格式化日志消息
   */
  formatMessage(level, message, meta = {}) {
    const timestamp = config.logging.timestamp
      ? new Date().toISOString()
      : null;

    if (config.logging.format === 'json') {
      return JSON.stringify({
        timestamp,
        level,
        message,
        ...meta,
      });
    } else {
      let formatted = `[${level.toUpperCase()}]`;
      if (timestamp) {
        formatted += ` ${timestamp}`;
      }
      formatted += ` ${message}`;

      if (Object.keys(meta).length > 0) {
        formatted += ` ${JSON.stringify(meta)}`;
      }

      return formatted;
    }
  }

  /**
   * 检查是否应该记录此级别的日志
   */
  shouldLog(level) {
    return this.levels[level] <= this.level;
  }

  /**
   * 错误日志
   */
  error(message, meta = {}) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, meta));
    }
  }

  /**
   * 警告日志
   */
  warn(message, meta = {}) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, meta));
    }
  }

  /**
   * 信息日志
   */
  info(message, meta = {}) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, meta));
    }
  }

  /**
   * 调试日志
   */
  debug(message, meta = {}) {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, meta));
    }
  }
}

// 创建全局日志实例
export const logger = new Logger();

import { existsSync, statSync } from 'fs';
import { homedir } from 'os';
import { join, resolve } from 'path';

const DEFAULT_BASENAMES = [
  'mcp.config.json',
  'mcp.config.js',
  'mcp.config.mjs',
  'mcp.config.cjs',
  // 可按需扩展：yaml/yml/ts 等
];

/**
 * 返回默认搜索路径（按优先级从高到低）
 * CWD → 用户级 → 系统级
 */
export function getDefaultSearchPaths(cwd = process.cwd()) {
  const userDir = join(homedir(), '.config', 'mcp-server-client');
  const systemDir = '/etc/mcp-server-client';

  const dirs = [cwd, userDir, systemDir];

  const candidates = [];
  for (const dir of dirs) {
    for (const base of DEFAULT_BASENAMES) {
      candidates.push(resolve(dir, base));
    }
  }
  return candidates;
}

export function isFilePath(p) {
  try {
    return existsSync(p) && statSync(p).isFile();
  } catch {
    return false;
  }
}

export function toAbsolute(p, base = process.cwd()) {
  try {
    return resolve(base, p);
  } catch {
    return p;
  }
}

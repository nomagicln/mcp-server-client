import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { parseConfigFile } from './parse.js';
import { getDefaultSearchPaths, isFilePath, toAbsolute } from './paths.js';
import { validateConfig } from './validate.js';

/**
 * 解析优先级并加载配置
 * @param {Object} opts
 * @param {string|undefined} opts.cliPath --config 指定
 * @param {string|undefined} opts.envPath MCP_CONFIG 指定
 * @param {string[]|undefined} opts.defaultPaths 默认搜索路径
 * @param {boolean} opts.allowFallback 当 cli/env 指定失败时是否回退至默认搜索
 * @returns {Promise<{config: any, meta: {source: 'CLI'|'ENV'|'DEFAULT'|null, path: string|null}}>}
 */
export async function resolveConfig(opts = {}) {
  const {
    cliPath,
    envPath = process.env.MCP_CONFIG,
    defaultPaths = getDefaultSearchPaths(),
    allowFallback = true,
  } = opts;

  const started = performance.now();
  const meta = { source: null, path: null };

  // 1) CLI 优先
  if (cliPath) {
    const abs = toAbsolute(cliPath);
    const res = await tryLoad(abs);
    if (res.ok) {
      meta.source = 'CLI';
      meta.path = abs;
      return done(res.config, meta, started);
    }
    if (!allowFallback) {
      throw errorWithContext('CLI', abs, res.reason);
    }
  }

  // 2) ENV 次之
  if (!meta.path && envPath) {
    const abs = toAbsolute(envPath);
    const res = await tryLoad(abs);
    if (res.ok) {
      meta.source = 'ENV';
      meta.path = abs;
      return done(res.config, meta, started);
    }
    if (!allowFallback) {
      throw errorWithContext('ENV', abs, res.reason);
    }
  }

  // 3) 默认搜索
  for (const p of defaultPaths) {
    const res = await tryLoad(p, true);
    if (res.ok) {
      meta.source = 'DEFAULT';
      meta.path = p;
      return done(res.config, meta, started);
    }
  }

  throw new Error('No valid configuration found in default search locations');
}

function done(config, meta, started) {
  const duration = Math.round(performance.now() - started);
  return { config, meta: { ...meta, duration } };
}

async function tryLoad(absPath, ignoreMissing = false) {
  try {
    if (!isFilePath(absPath)) {
      // 存在但不是文件，或不存在
      if (ignoreMissing) {
        return { ok: false, reason: 'not-a-file-or-missing' };
      }
      await access(absPath, constants.R_OK);
      return { ok: false, reason: 'not-a-file' };
    }
    // 读取并解析
    const { object, errors } = await parseConfigFile(absPath);
    if (!object) {
      return { ok: false, reason: `parse-failed: ${errors.join('; ')}` };
    }

    const { isValid, errors: vErrors } = validateConfig(object);
    if (!isValid) {
      return { ok: false, reason: `validate-failed: ${vErrors.join('; ')}` };
    }

    return { ok: true, config: object };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

function errorWithContext(source, abs, reason) {
  const err = new Error(
    `Config load failed for ${source} path ${abs}: ${reason}`,
  );
  err.source = source;
  err.path = abs;
  err.reason = reason;
  return err;
}

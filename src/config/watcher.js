import chokidar from 'chokidar';
import { dirname } from 'node:path';
import { resolveConfig } from './loader.js';
import { getDefaultSearchPaths } from './paths.js';

/**
 * 启动配置文件监听并在变更时尝试重新加载
 *
 * @param {Object} opts
 * @param {string|undefined} opts.cliPath
 * @param {string|undefined} opts.envPath
 * @param {string[]|undefined} opts.defaultPaths
 * @param {number} [opts.debounceMs=250]
 * @param {(conf: any, meta: any) => void} opts.onApply 成功加载后应用配置
 * @param {(err: Error) => void} [opts.onError] 失败时回调
 * @returns {{close: () => Promise<void>}}
 */
export async function startConfigWatcher(opts) {
  const {
    cliPath,
    envPath,
    defaultPaths = getDefaultSearchPaths(),
    debounceMs = 250,
    onApply,
    onError,
    watchOptions,
  } = opts || {};

  if (typeof onApply !== 'function') {
    throw new Error('onApply is required');
  }

  // 先做一次初次解析并应用
  let last = await resolveConfig({
    cliPath,
    envPath,
    defaultPaths,
    allowFallback: true,
  });
  onApply(last.config, last.meta);

  // 监听生效文件与默认候选路径
  const watchSet = new Set(defaultPaths);
  if (last.meta?.path) {
    watchSet.add(last.meta.path);
  }

  // 同时监听这些文件的父目录，以增强在不同平台上的变更捕获
  for (const p of Array.from(watchSet)) {
    try {
      watchSet.add(dirname(p));
    } catch {}
  }

  let timer = null;
  const scheduleReload = () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(async () => {
      try {
        const next = await resolveConfig({
          cliPath,
          envPath,
          defaultPaths,
          allowFallback: true,
        });
        // 仅当有效配置解析成功时才应用（失败则保持原配置，相当于回退）
        last = next;
        onApply(next.config, next.meta);
      } catch (e) {
        if (onError) {
          onError(e);
        }
      }
    }, debounceMs);
  };

  const isTest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID;
  const baseOptions = {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: Math.max(debounceMs, 200),
      pollInterval: 50,
    },
    usePolling: Boolean(isTest),
    interval: 100,
  };

  const watcher = chokidar.watch(Array.from(watchSet), {
    ...baseOptions,
    ...(watchOptions || {}),
  });

  watcher.on('add', scheduleReload);
  watcher.on('change', scheduleReload);
  watcher.on('unlink', scheduleReload);

  // 等待 watcher 就绪，确保后续变更不会被错过
  await new Promise(resolve => watcher.on('ready', resolve));

  return {
    close: async () => {
      if (timer) {
        clearTimeout(timer);
      }
      await watcher.close();
    },
  };
}

import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getDefaultSearchPaths } from '../../src/config/paths.js';
import { startConfigWatcher } from '../../src/config/watcher.js';

// 验证：当配置文件变更时，能够热更新并调用 onApply；若无效则保持回退状态

describe('配置热监听与热刷新', () => {
  test('当有效配置变更时触发 onApply，解析失败时不覆盖', async () => {
    const tempBase = await mkdtemp(join(tmpdir(), 'mcpsc-'));
    const cfgPath = join(tempBase, 'mcp.config.json');

    // 默认搜索首个候选指向 tempBase
    const realCwd = process.cwd;
    process.cwd = () => tempBase;

    // 初始有效配置
    await writeFile(
      cfgPath,
      JSON.stringify({ logging: { level: 'warn' } }, null, 2),
      'utf-8',
    );

    const applied = [];
    const watcher = await startConfigWatcher({
      defaultPaths: getDefaultSearchPaths(tempBase),
      onApply: (_conf, meta) => applied.push(meta.path),
    });

    // 修改为另一个有效配置，并等待 onApply 至少增加一次
    await writeFile(
      cfgPath,
      JSON.stringify({ logging: { level: 'error' } }, null, 2),
      'utf-8',
    );
    await waitUntil(() => applied.length >= 2, 3000, 100);

    // 写入无效 JSON，应该触发错误，但不覆盖上次成功配置
    await writeFile(cfgPath, '{ invalid json', 'utf-8');
    // 等待一小段时间，确保若触发则会被忽略
    await new Promise(r => setTimeout(r, 400));

    await watcher.close();
    process.cwd = realCwd;

    expect(applied.length).toBeGreaterThanOrEqual(2);
    expect(applied[0]).toBe(cfgPath);
  });
});

async function waitUntil(predicate, timeoutMs = 2000, intervalMs = 50) {
  const started = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (predicate()) return;
    if (Date.now() - started > timeoutMs) throw new Error('waitUntil timeout');
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

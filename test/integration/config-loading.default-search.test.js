import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveConfig } from '../../src/config/loader.js';

// 该测试验证：未提供 CLI/ENV 时，能按默认顺序加载首个有效配置

describe('配置加载 - 默认搜索顺序', () => {
  test('当未显式提供路径时，应从默认搜索路径找到首个有效配置并加载', async () => {
    // 在临时目录创建一个有效的 JSON 配置文件，模拟 CWD 情况优先命中
    const tempBase = await mkdtemp(join(tmpdir(), 'mcpsc-'));
    const cfgPath = join(tempBase, 'mcp.config.json');
    await writeFile(
      cfgPath,
      JSON.stringify({ logging: { level: 'error' } }, null, 2),
      'utf-8',
    );

    // 暂时将 process.cwd() 替换为 tempBase 以影响默认搜索
    const realCwd = process.cwd;
    process.cwd = () => tempBase;

    try {
      const { meta } = await resolveConfig({ allowFallback: true });
      expect(meta.source).toBe('DEFAULT');
      expect(meta.path).toBe(cfgPath);
    } finally {
      // 恢复 cwd
      process.cwd = realCwd;
    }
  });
});

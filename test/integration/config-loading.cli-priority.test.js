import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveConfig } from '../../src/config/loader.js';

describe('配置加载 - CLI 优先', () => {
  test('通过 --config 指定路径应优先加载', async () => {
    const tempBase = await mkdtemp(join(tmpdir(), 'mcpsc-'));
    const cfgPath = join(tempBase, 'explicit.config.json');
    await writeFile(
      cfgPath,
      JSON.stringify({ logging: { level: 'warn' } }, null, 2),
      'utf-8',
    );

    const { meta } = await resolveConfig({
      cliPath: cfgPath,
      allowFallback: false,
    });
    expect(meta.source).toBe('CLI');
    expect(meta.path).toBe(cfgPath);
  });
});

import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveConfig } from '../../src/config/loader.js';

describe('配置加载 - ENV 优先级次于 CLI 高于默认', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV };
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('MCP_CONFIG 指定应在未提供 CLI 时生效', async () => {
    const tempBase = await mkdtemp(join(tmpdir(), 'mcpsc-'));
    const cfgPath = join(tempBase, 'env.config.json');
    await writeFile(
      cfgPath,
      JSON.stringify({ logging: { level: 'error' } }, null, 2),
      'utf-8',
    );

    process.env.MCP_CONFIG = cfgPath;

    const { meta } = await resolveConfig({ allowFallback: true });
    expect(meta.source).toBe('ENV');
    expect(meta.path).toBe(cfgPath);
  });
});

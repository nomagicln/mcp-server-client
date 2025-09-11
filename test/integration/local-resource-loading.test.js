/**
 * Integration Test: 本地文件资源加载（RED）
 */
import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import LocalFileLoader from '../../src/resources/loaders/LocalFileLoader.js';

describe('Integration: 本地文件资源加载', () => {
  it('应能加载 YAML 资源定义并返回资源列表', async () => {
    // Arrange: 在临时目录创建资源文件
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-resources-'));
    const filePath = path.join(tmpDir, 'hosts.yaml');
    const yamlContent = `
- id: "dev-server"
  type: "host"
  name: "Development Server"
  capabilities:
    - "ssh.exec"
`;
    await fs.writeFile(filePath, yamlContent, 'utf8');

    const loader = new LocalFileLoader({ files: [filePath] });

    // Act
    const result = await loader.loadResources();

    // Assert
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(Array.isArray(result.resources)).toBe(true);
    expect(result.resources[0].id).toBe('dev-server');
  });
});

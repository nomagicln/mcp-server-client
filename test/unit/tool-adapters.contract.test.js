/**
 * ToolAdapters 合约测试（RED）
 */

import { describe, expect, it } from '@jest/globals';

// 待实现：适配器导出路径
import HttpToolAdapter from '../../src/resources/adapters/HttpToolAdapter.js';
import SshToolAdapter from '../../src/resources/adapters/SshToolAdapter.js';

describe('Contract: ToolAdapters', () => {
  it('应当导出 SSH/HTTP 适配器类', () => {
    expect(SshToolAdapter).toBeDefined();
    expect(HttpToolAdapter).toBeDefined();
    expect(typeof SshToolAdapter).toBe('function');
    expect(typeof HttpToolAdapter).toBe('function');
  });

  it('应当定义核心方法', () => {
    const sshProto = SshToolAdapter.prototype;
    const httpProto = HttpToolAdapter.prototype;

    expect(typeof sshProto.adaptSshTool).toBe('function');
    expect(typeof sshProto.resolveCredentials).toBe('function');
    expect(typeof sshProto.executeCommand).toBe('function');

    expect(typeof httpProto.adaptHttpTool).toBe('function');
    expect(typeof httpProto.resolveCredentials).toBe('function');
    expect(typeof httpProto.makeRequest).toBe('function');
  });
});

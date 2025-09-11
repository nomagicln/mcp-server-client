/**
 * ResourceRegistry 合约测试（RED）
 */

import { describe, expect, it } from '@jest/globals';

// 待实现：注册表路径
import ResourceRegistry from '../../src/resources/registry/ResourceRegistry.js';

describe('Contract: ResourceRegistry', () => {
  it('应当导出默认类', () => {
    expect(ResourceRegistry).toBeDefined();
    expect(typeof ResourceRegistry).toBe('function');
  });

  it('应当定义方法：registerResource, resolveIdentifier, listResources', () => {
    const proto = ResourceRegistry.prototype;
    expect(typeof proto.registerResource).toBe('function');
    expect(typeof proto.resolveIdentifier).toBe('function');
    expect(typeof proto.listResources).toBe('function');
  });
});

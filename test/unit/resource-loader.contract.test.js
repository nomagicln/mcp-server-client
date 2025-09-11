/**
 * ResourceLoader 合约测试（RED）
 */

import { describe, expect, it } from '@jest/globals';

// 待实现：抽象基类路径（先指向预期位置）
import ResourceLoader from '../../src/resources/loaders/ResourceLoader.js';

describe('Contract: ResourceLoader', () => {
  it('应当导出默认类', () => {
    expect(ResourceLoader).toBeDefined();
    expect(typeof ResourceLoader).toBe('function');
  });

  it('应当定义抽象方法：loadResources, validateResource, getCapabilities', () => {
    const proto = ResourceLoader.prototype;
    expect(typeof proto.loadResources).toBe('function');
    expect(typeof proto.validateResource).toBe('function');
    expect(typeof proto.getCapabilities).toBe('function');
  });

  it('直接实例化应抛出错误（抽象类）', () => {
    expect(() => new ResourceLoader()).toThrow();
  });
});

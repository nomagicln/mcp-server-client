/**
 * Resource schema/model 合约测试（RED）
 */

import { describe, expect, it } from '@jest/globals';

import ApiResource from '../../src/resources/models/ApiResource.js';
import AuthenticationProfile from '../../src/resources/models/AuthenticationProfile.js';
import HostResource from '../../src/resources/models/HostResource.js';
import Resource from '../../src/resources/models/Resource.js';
import ResourceIdentifier from '../../src/resources/models/ResourceIdentifier.js';

describe('Contract: Resource models', () => {
  it('应当导出基本模型类', () => {
    expect(Resource).toBeDefined();
    expect(HostResource).toBeDefined();
    expect(ApiResource).toBeDefined();
    expect(ResourceIdentifier).toBeDefined();
    expect(AuthenticationProfile).toBeDefined();
  });

  it('ResourceIdentifier 应当支持标准URI解析', () => {
    const s = 'host://local/default/web-01';
    // 预期：parse 方法存在
    expect(typeof ResourceIdentifier.parse).toBe('function');
    const id = ResourceIdentifier.parse(s);
    expect(id.resourceType).toBe('host');
    expect(id.loaderType).toBe('local');
    expect(id.loaderId).toBe('default');
    expect(id.resourceId).toBe('web-01');
  });
});

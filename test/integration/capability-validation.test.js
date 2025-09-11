/**
 * Integration Test: 能力验证与错误处理（RED）
 */
import { describe, expect, it } from '@jest/globals';

import CapabilityValidator from '../../src/resources/capabilities/CapabilityValidator.js';

describe('Integration: 能力验证与错误处理', () => {
  it('缺少必要能力应报错', () => {
    const validator = new CapabilityValidator();
    expect(() =>
      validator.validateCapability({ capabilities: [] }, 'ssh.exec'),
    ).toThrow();
  });
});

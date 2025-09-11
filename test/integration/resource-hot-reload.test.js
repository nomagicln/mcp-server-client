/**
 * Integration Test: 资源热更新（RED）
 */
import { describe, expect, it } from '@jest/globals';

import ResourceWatcher from '../../src/resources/watchers/ResourceWatcher.js';

describe('Integration: 资源热更新', () => {
  it('资源文件变化应触发重新加载事件', () => {
    const watcher = new ResourceWatcher();
    expect(typeof watcher.watchFiles).toBe('function');
  });
});

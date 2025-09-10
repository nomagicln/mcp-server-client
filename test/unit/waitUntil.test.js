import { waitUntil } from '../utils/waitUntil.js';

describe('waitUntil', () => {
  test('resolves when sync predicate becomes true', async () => {
    let flag = false;
    setTimeout(() => {
      flag = true;
    }, 30);
    await waitUntil(() => flag, 500, 10);
  });

  test('resolves when async predicate becomes true', async () => {
    let flag = false;
    setTimeout(() => {
      flag = true;
    }, 30);
    await waitUntil(async () => flag, 500, 10);
  });

  test('throws on timeout', async () => {
    const start = Date.now();
    await expect(waitUntil(() => false, 80, 10)).rejects.toThrow(
      'waitUntil timeout',
    );
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(80);
  });
});

export async function waitUntil(predicate, timeoutMs = 2000, intervalMs = 50) {
  const started = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      if (await predicate()) return;
    } catch (e) {
      // 如果 predicate 抛错，继续重试直到超时
    }
    if (Date.now() - started > timeoutMs) throw new Error('waitUntil timeout');
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

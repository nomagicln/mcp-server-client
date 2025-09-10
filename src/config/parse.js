import { createRequire } from 'module';

/**
 * 解析配置文件，按扩展名路由
 * 返回 { object, errors: string[] }
 */
export async function parseConfigFile(absPath) {
  const errors = [];
  try {
    if (absPath.endsWith('.json')) {
      const text = await import('node:fs/promises').then(m =>
        m.readFile(absPath, 'utf-8'),
      );
      try {
        const obj = JSON.parse(text);
        return { object: obj, errors };
      } catch (e) {
        errors.push(`JSON parse error: ${e.message}`);
        return { object: null, errors };
      }
    }

    if (absPath.endsWith('.mjs') || absPath.endsWith('.js')) {
      try {
        const mod = await import(absPath);
        const obj = mod.default ?? mod.config ?? mod;
        return { object: obj, errors };
      } catch (e) {
        errors.push(`ESM import error: ${e.message}`);
        return { object: null, errors };
      }
    }

    if (absPath.endsWith('.cjs')) {
      try {
        const req = createRequire(import.meta.url);
        const mod = req(absPath);
        const obj = mod.default ?? mod.config ?? mod;
        return { object: obj, errors };
      } catch (e) {
        errors.push(`CJS require error: ${e.message}`);
        return { object: null, errors };
      }
    }

    errors.push('Unsupported file extension');
    return { object: null, errors };
  } catch (e) {
    errors.push(e.message);
    return { object: null, errors };
  }
}

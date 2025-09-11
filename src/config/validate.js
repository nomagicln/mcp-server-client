/**
 * 对加载的配置进行轻量校验
 * 返回 { isValid, errors: string[], warnings: string[] }
 */
export function validateConfig(obj) {
  const errors = [];
  const warnings = [];

  if (!obj || typeof obj !== 'object') {
    errors.push('Config must be an object');
    return { isValid: false, errors, warnings };
  }

  // 可根据现有 config 结构做关键字段校验
  // http
  if (obj.http && typeof obj.http !== 'object') {
    errors.push('http must be object');
  }
  // ssh
  if (obj.ssh && typeof obj.ssh !== 'object') {
    errors.push('ssh must be object');
  }
  // security
  if (obj.security && typeof obj.security !== 'object') {
    errors.push('security must be object');
  }
  // transport
  if (obj.transport && typeof obj.transport !== 'object') {
    errors.push('transport must be object');
  }
  // resources
  if (obj.resources !== undefined) {
    if (typeof obj.resources !== 'object') {
      errors.push('resources must be object');
    } else {
      const { loaders } = obj.resources;
      if (loaders !== undefined) {
        if (!Array.isArray(loaders)) {
          errors.push('resources.loaders must be array');
        } else {
          for (const [idx, loader] of loaders.entries()) {
            if (!loader || typeof loader !== 'object') {
              errors.push(`resources.loaders[${idx}] must be object`);
              continue;
            }
            if (!['local', 'remote'].includes(loader.type)) {
              errors.push(
                `resources.loaders[${idx}].type must be 'local' or 'remote'`,
              );
            }
            if (typeof loader.id !== 'string' || !loader.id) {
              errors.push(
                `resources.loaders[${idx}].id must be non-empty string`,
              );
            }
            if (loader.type === 'local') {
              if (!Array.isArray(loader.files) || loader.files.length === 0) {
                errors.push(
                  `resources.loaders[${idx}].files must be non-empty array for local loader`,
                );
              }
            }
            if (loader.type === 'remote') {
              if (typeof loader.baseUrl !== 'string' || !loader.baseUrl) {
                errors.push(
                  `resources.loaders[${idx}].baseUrl must be non-empty string for remote loader`,
                );
              }
            }
          }
        }
      }
    }
  }
  // logging
  if (obj.logging && typeof obj.logging !== 'object') {
    errors.push('logging must be object');
  }

  return { isValid: errors.length === 0, errors, warnings };
}

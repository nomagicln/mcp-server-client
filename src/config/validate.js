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
  // logging
  if (obj.logging && typeof obj.logging !== 'object') {
    errors.push('logging must be object');
  }

  return { isValid: errors.length === 0, errors, warnings };
}

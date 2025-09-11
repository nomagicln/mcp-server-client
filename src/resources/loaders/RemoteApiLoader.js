import axios from 'axios';
import { parse as parseYaml } from 'yaml';
import { resolveCredential } from '../utils/credentials.js';

export default class RemoteApiLoader {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl;
    this.headers = options.headers || {};
    this.auth = options.auth || null; // e.g. { bearerCredentialRef: 'env://TOKEN' }
    this.timeoutMs = options.timeoutMs || 10_000;
    this.retryAttempts = Math.max(1, options.retryAttempts || 2);
    this.retryDelayMs = Math.max(0, options.retryDelayMs || 500);
    // 简易缓存（按实例 & baseUrl 维度）
    this._etag = null;
    this._cachedResources = null;
  }

  async loadResources() {
    if (!this.baseUrl) {
      throw new Error('RemoteApiLoader requires baseUrl');
    }

    const headers = { ...this.headers };

    // Support bearer token via credentialRef
    if (this.auth && this.auth.bearerCredentialRef) {
      const token = await resolveCredential(this.auth.bearerCredentialRef);
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    if (this._etag) {
      headers['If-None-Match'] = this._etag;
    }

    let lastError = null;
    for (let attempt = 1; attempt <= this.retryAttempts; attempt += 1) {
      try {
        const resp = await axios.get(this.baseUrl, {
          headers,
          timeout: this.timeoutMs,
          // Accept common formats
          responseType: 'text',
          transformResponse: [(data, _headers) => data],
          validateStatus: () => true, // 我们自己判定状态码
        });

        // 304: 使用缓存
        if (resp.status === 304 && this._cachedResources) {
          return {
            success: true,
            resources: this._cachedResources,
            errors: [],
          };
        }

        if (resp.status < 200 || resp.status >= 300) {
          lastError = new Error(
            `Request failed with status code ${resp.status}`,
          );
          // 重试条件：5xx 或网络抖动
          const retriable = resp.status >= 500 && resp.status < 600;
          if (retriable && attempt < this.retryAttempts) {
            await sleep(this.retryDelayMs);
            continue;
          }
          // 非重试或最后一次，按错误返回
          return {
            success: false,
            resources: [],
            errors: [{ message: lastError.message, status: resp.status }],
          };
        }

        const payload = resp.data;
        let parsed;
        if (typeof payload === 'string') {
          // Try JSON first, then YAML
          try {
            parsed = JSON.parse(payload);
          } catch (e) {
            try {
              parsed = parseYaml(payload);
            } catch (e2) {
              throw new Error('Failed to parse remote resources payload');
            }
          }
        } else {
          parsed = payload;
        }

        let resources = [];
        if (Array.isArray(parsed)) {
          resources = parsed;
        } else if (parsed && Array.isArray(parsed.resources)) {
          resources = parsed.resources;
        } else if (parsed && Array.isArray(parsed.items)) {
          resources = parsed.items;
        } else if (parsed) {
          // Single resource object
          resources = [parsed];
        }

        // 缓存 ETag 与资源
        const etag = resp.headers?.etag || resp.headers?.ETag;
        if (etag) {
          this._etag = etag;
        }
        this._cachedResources = resources;

        return { success: true, resources, errors: [] };
      } catch (err) {
        lastError = err;
        // 网络错误重试
        if (attempt < this.retryAttempts) {
          await sleep(this.retryDelayMs);
          continue;
        }
        return {
          success: false,
          resources: [],
          errors: [
            {
              message: err.message,
            },
          ],
        };
      }
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

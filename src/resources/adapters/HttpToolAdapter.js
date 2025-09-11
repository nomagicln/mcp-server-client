// Adapter to enable http tool to work with resource identifiers
import { HttpTool } from '../../tools/http.js';
import { resolveCredential } from '../utils/credentials.js';

export default class HttpToolAdapter {
  constructor(registry) {
    this.registry = registry;
    this.http = new HttpTool();
  }

  // Wrap HttpTool.execute to accept resource identifier input
  adaptHttpTool() {
    return async args => {
      if (args.resource) {
        const resolved = this.registry.resolveIdentifier(args.resource);
        if (!resolved.found) {
          throw new Error(`Resource not found: ${args.resource}`);
        }
        const resource = resolved.resource;
        // Capability check
        const caps = Array.isArray(resource?.capabilities)
          ? resource.capabilities
          : [];
        if (!caps.includes('http.request')) {
          throw new Error('Resource does not allow http.request capability');
        }
        // Build full URL from resource endpoints.baseUrl + args.path
        const baseUrl = resource?.endpoints?.baseUrl;
        const path = args.path || '';
        const url = new URL(path, baseUrl).toString();
        const headers = {
          ...(resource?.endpoints?.defaultHeaders || {}),
          ...(args.headers || {}),
        };
        const token = await this.resolveCredentials(resource);
        if (token) {
          headers.Authorization = headers.Authorization || `Bearer ${token}`;
        }
        const merged = {
          ...args,
          url,
          headers,
          method: args.method || 'GET',
        };
        return this.http.execute(merged);
      }
      // Fallback to direct mode
      return this.http.execute(args);
    };
  }

  async resolveCredentials(resource) {
    const ref = resource?.auth?.credentialRef;
    if (!ref) {
      return null;
    }
    return resolveCredential(ref);
  }

  async makeRequest(resource, request) {
    const fn = this.adaptHttpTool();
    return fn({ ...request, resource });
  }
}

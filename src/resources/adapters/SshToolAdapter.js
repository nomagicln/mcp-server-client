// Adapter to enable ssh tool to work with resource identifiers
import { SshTool } from '../../tools/ssh.js';
import { resolveCredential } from '../utils/credentials.js';

export default class SshToolAdapter {
  constructor(registry) {
    this.registry = registry;
    this.ssh = new SshTool();
  }

  // Wrap SshTool.execute to accept resource identifier input
  adaptSshTool() {
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
        if (!caps.includes('ssh.exec')) {
          throw new Error('Resource does not allow ssh.exec capability');
        }
        const host = resource?.connection?.hostname;
        const port = resource?.connection?.port || 22;
        const username = resource?.connection?.username;
        const password = await this.resolveCredentials(resource);
        const merged = {
          ...args,
          host: `${host}:${port}`,
          username,
          password,
        };
        return this.ssh.execute(merged);
      }
      // Fallback to direct mode
      return this.ssh.execute(args);
    };
  }

  async resolveCredentials(resource) {
    const ref = resource?.auth?.credentialRef;
    if (!ref) {
      return null;
    }
    return resolveCredential(ref);
  }

  async executeCommand(resource, command) {
    const fn = this.adaptSshTool();
    return fn({ resource, command });
  }
}

// Resource Registry for managing resources and resolving identifiers
import ResourceIdentifier from '../models/ResourceIdentifier.js';

export default class ResourceRegistry {
  constructor() {
    // Map<string, any> where key is identifier string
    this._resources = new Map();
  }

  // Register a resource into the registry
  registerResource(identifier, resource, options = {}) {
    const { overwrite = false } = options;
    if (!identifier || typeof identifier !== 'string') {
      return {
        success: false,
        error: {
          code: 'INVALID_IDENTIFIER',
          message: 'Identifier must be a string',
        },
      };
    }
    try {
      ResourceIdentifier.parse(identifier);
    } catch (e) {
      return {
        success: false,
        error: { code: 'INVALID_IDENTIFIER', message: e.message },
      };
    }

    if (!overwrite && this._resources.has(identifier)) {
      return {
        success: false,
        error: { code: 'DUPLICATE_ID', message: 'Resource already exists' },
      };
    }

    this._resources.set(identifier, resource);
    return { success: true };
  }

  // Resolve a resource by identifier (e.g., host://local/default/id)
  resolveIdentifier(identifier) {
    if (!identifier || typeof identifier !== 'string') {
      return {
        found: false,
        error: {
          code: 'INVALID_IDENTIFIER',
          message: 'Identifier must be a string',
        },
      };
    }
    try {
      ResourceIdentifier.parse(identifier);
    } catch (e) {
      return {
        found: false,
        error: { code: 'INVALID_IDENTIFIER', message: e.message },
      };
    }

    if (!this._resources.has(identifier)) {
      return {
        found: false,
        error: { code: 'NOT_FOUND', message: 'Resource not found' },
      };
    }
    return { found: true, resource: this._resources.get(identifier) };
  }

  // List all resources with optional filtering and pagination
  listResources(options = {}) {
    const { filter = {}, pagination = {} } = options;
    const { type, loaderType, capabilities, labels } = filter;
    const limit = Math.max(1, Math.min(1000, pagination.limit || 100));
    const offset = Math.max(0, pagination.offset || 0);

    const entries = [];
    for (const [identifier, resource] of this._resources.entries()) {
      let include = true;
      try {
        const parts = ResourceIdentifier.parse(identifier);
        if (type && parts.resourceType !== type) {
          include = false;
        }
        if (loaderType && parts.loaderType !== loaderType) {
          include = false;
        }
      } catch (_) {
        include = false;
      }

      if (include && capabilities && capabilities.length) {
        const caps = resource?.capabilities || [];
        for (const cap of capabilities) {
          if (!caps.includes(cap)) {
            include = false;
            break;
          }
        }
      }

      if (include && labels && Object.keys(labels).length) {
        const rlabels = resource?.labels || {};
        for (const [k, v] of Object.entries(labels)) {
          if (rlabels[k] !== v) {
            include = false;
            break;
          }
        }
      }

      if (include) {
        entries.push({ identifier, resource });
      }
    }

    const total = entries.length;
    const paged = entries.slice(offset, offset + limit);
    return { resources: paged, total, filtered: paged.length };
  }
}

import { Resource, ResourceType, ConnectionConfig, SecurityConfig } from '@core/models/resource';
import { ValidationResult } from '@core/interfaces/resource';
import { MCPSCError, ErrorCategory, ErrorSeverity } from '@core/errors/base';

/**
 * Resource validator for data model validation and lifecycle management
 */
export class ResourceValidator {
  /**
   * Validate a resource against all validation rules
   */
  validate(resource: Resource): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic field validation
    this.validateBasicFields(resource, errors);

    // Type-specific validation
    this.validateTypeSpecific(resource, errors);

    // Connection configuration validation
    this.validateConnection(resource.connection, resource.type, errors);

    // Security configuration validation
    if (resource.security) {
      this.validateSecurity(resource.security, errors, warnings);
    }

    // Metadata validation
    if (resource.metadata) {
      this.validateMetadata(resource.metadata, errors, warnings);
    }

    // Generate warnings
    this.generateWarnings(resource, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        schema: 'mcpsc-resource-v1',
        version: '1.0.0',
        validatedAt: new Date(),
        validatedBy: 'ResourceValidator',
      },
    };
  }

  /**
   * Create a new resource with proper defaults and timestamps
   */
  createResource(
    partial: Partial<Resource> & { id: string; name: string; type: ResourceType }
  ): Resource {
    const now = new Date();

    const resource: Resource = {
      id: partial.id,
      name: partial.name,
      type: partial.type,
      enabled: partial.enabled ?? true,
      metadata: partial.metadata ?? {},
      connection: partial.connection ?? {},
      security: partial.security ?? {},
      tags: partial.tags ?? [],
      createdAt: now,
      updatedAt: now,
    };

    // Only set group if it's provided
    if (partial.group !== undefined) {
      resource.group = partial.group;
    }

    // Validate the created resource
    const validation = this.validate(resource);
    if (!validation.valid) {
      throw new MCPSCError(
        3001,
        `Invalid resource: ${validation.errors.join(', ')}`,
        ErrorCategory.RESOURCE,
        ErrorSeverity.ERROR,
        { resourceId: resource.id, validationErrors: validation.errors }
      );
    }

    return resource;
  }

  /**
   * Update an existing resource with validation
   */
  updateResource(resource: Resource, updates: Partial<Resource>): Resource {
    const now = new Date();

    const updatedResource: Resource = {
      ...resource,
      ...updates,
      // Merge nested objects
      metadata: updates.metadata
        ? { ...resource.metadata, ...updates.metadata }
        : resource.metadata,
      connection: updates.connection
        ? { ...resource.connection, ...updates.connection }
        : resource.connection,
      security: updates.security
        ? this.mergeSecurity(resource.security, updates.security)
        : resource.security,
      tags: updates.tags ?? resource.tags,
      // Preserve creation time, update modification time
      createdAt: resource.createdAt,
      updatedAt: now,
    };

    // Validate the updated resource
    const validation = this.validate(updatedResource);
    if (!validation.valid) {
      throw new MCPSCError(
        3001,
        `Invalid resource update: ${validation.errors.join(', ')}`,
        ErrorCategory.RESOURCE,
        ErrorSeverity.ERROR,
        { resourceId: updatedResource.id, validationErrors: validation.errors }
      );
    }

    return updatedResource;
  }

  private validateBasicFields(resource: Resource, errors: string[]): void {
    // ID validation
    if (!resource.id || resource.id.trim() === '') {
      errors.push('Resource ID is required');
    } else if (!/^[a-zA-Z0-9-]+$/.test(resource.id)) {
      errors.push('Resource ID must contain only alphanumeric characters and hyphens');
    }

    // Name validation
    if (!resource.name || resource.name.trim() === '') {
      errors.push('Resource name is required');
    } else if (resource.name.length > 255) {
      errors.push('Resource name must be between 1 and 255 characters');
    }

    // Type validation
    if (!Object.values(ResourceType).includes(resource.type)) {
      errors.push('Invalid resource type');
    }

    // Group validation
    if (resource.group && !/^[a-zA-Z0-9-_]+$/.test(resource.group)) {
      errors.push('Group name must contain only alphanumeric characters, hyphens, and underscores');
    }

    // Tags validation
    if (resource.tags) {
      for (const tag of resource.tags) {
        if (!/^[a-zA-Z0-9-_]+$/.test(tag)) {
          errors.push('Tags must contain only alphanumeric characters, hyphens, and underscores');
          break;
        }
      }
    }
  }

  private validateTypeSpecific(resource: Resource, errors: string[]): void {
    switch (resource.type) {
      case ResourceType.SSH_HOST:
        if (!resource.connection.host || resource.connection.host.trim() === '') {
          errors.push('SSH resources must have a host specified');
        }
        break;

      case ResourceType.HTTP_API:
        if (!resource.connection.url && !resource.connection.host) {
          errors.push('HTTP resources must have a URL specified');
        }
        break;

      case ResourceType.DATABASE:
        if (!resource.connection.host) {
          errors.push('Database resources must have a host specified');
        }
        break;

      case ResourceType.KUBERNETES:
        if (!resource.connection.url && !resource.connection.host) {
          errors.push('Kubernetes resources must have a cluster endpoint specified');
        }
        break;
    }
  }

  private validateConnection(
    connection: ConnectionConfig,
    _type: ResourceType,
    errors: string[]
  ): void {
    // Port validation
    if (connection.port !== undefined) {
      if (connection.port < 1 || connection.port > 65535) {
        errors.push('Port must be between 1 and 65535');
      }
    }

    // Timeout validation
    if (connection.timeout !== undefined) {
      if (connection.timeout <= 0) {
        errors.push('Timeout must be a positive number');
      }
    }

    // Retries validation
    if (connection.retries !== undefined) {
      if (connection.retries < 0) {
        errors.push('Retries must be a non-negative number');
      }
    }

    // Pool size validation
    if (connection.poolSize !== undefined) {
      if (connection.poolSize <= 0) {
        errors.push('Pool size must be a positive number');
      }
    }
  }

  private validateSecurity(security: SecurityConfig, errors: string[], _warnings: string[]): void {
    // Authentication validation
    if (security.authentication) {
      const validAuthTypes = ['none', 'password', 'key', 'certificate', 'token', 'oauth'];
      if (!validAuthTypes.includes(security.authentication.type)) {
        errors.push('Invalid authentication type');
      }

      // Type-specific validation
      if (security.authentication.type === 'key' && !security.authentication.keyPath) {
        errors.push('Key authentication requires keyPath');
      }

      if (
        security.authentication.type === 'certificate' &&
        !security.authentication.certificatePath
      ) {
        errors.push('Certificate authentication requires certificatePath');
      }

      if (security.authentication.type === 'token' && !security.authentication.tokenEndpoint) {
        errors.push('Token authentication requires tokenEndpoint');
      }
    }

    // Encryption validation
    if (security.encryption) {
      const validProtocols = ['ssh2', 'tls', 'ssl', 'https'];
      if (security.encryption.protocol && !validProtocols.includes(security.encryption.protocol)) {
        errors.push('Invalid encryption protocol');
      }
    }

    // Authorization validation
    if (security.authorization?.policies) {
      for (const policy of security.authorization.policies) {
        if (!policy.action || policy.action.trim() === '') {
          errors.push('Policy action is required');
        }
        if (!policy.resource || policy.resource.trim() === '') {
          errors.push('Policy resource is required');
        }
        if (!['allow', 'deny'].includes(policy.effect)) {
          errors.push('Policy effect must be "allow" or "deny"');
        }
      }
    }

    // Audit validation
    if (security.audit) {
      if (security.audit.retention !== undefined && security.audit.retention <= 0) {
        errors.push('Audit retention must be a positive number');
      }
    }

    // Security restrictions validation
    if (security.restrictions) {
      for (const restriction of security.restrictions) {
        const validTypes = ['ip', 'time', 'command', 'resource'];
        if (!validTypes.includes(restriction.type)) {
          errors.push('Invalid security restriction type');
        }
        if (!restriction.rule || restriction.rule.trim() === '') {
          errors.push('Security restriction rule is required');
        }
      }
    }
  }

  private validateMetadata(metadata: any, errors: string[], _warnings: string[]): void {
    // Health check validation
    if (metadata.healthCheck) {
      if (metadata.healthCheck.interval !== undefined && metadata.healthCheck.interval <= 0) {
        errors.push('Health check interval must be positive');
      }
      if (metadata.healthCheck.timeout !== undefined && metadata.healthCheck.timeout <= 0) {
        errors.push('Health check timeout must be positive');
      }
      if (metadata.healthCheck.retries !== undefined && metadata.healthCheck.retries < 0) {
        errors.push('Health check retries must be non-negative');
      }
    }

    // Dependencies validation
    if (metadata.dependencies) {
      for (const dep of metadata.dependencies) {
        if (!dep || dep.trim() === '') {
          errors.push('Dependency ID cannot be empty');
        }
      }
    }

    // Cost validation
    if (metadata.cost !== undefined && metadata.cost < 0) {
      errors.push('Cost must be a non-negative number');
    }
  }

  private generateWarnings(resource: Resource, warnings: string[]): void {
    // Missing description warning
    if (!resource.metadata?.description || resource.metadata.description.trim() === '') {
      warnings.push('Resource description is recommended');
    }

    // Disabled health checks warning
    if (resource.metadata?.healthCheck?.enabled === false) {
      warnings.push('Health checks are recommended for production resources');
    }

    // Weak authentication warning
    if (resource.security?.authentication?.type === 'none') {
      warnings.push('Authentication is recommended for security');
    }

    // Missing encryption warning
    if (!resource.security?.encryption?.enabled) {
      warnings.push('Encryption is recommended for secure connections');
    }

    // Missing audit warning
    if (!resource.security?.audit?.enabled) {
      warnings.push('Audit logging is recommended for compliance');
    }
  }

  private mergeSecurity(existing: SecurityConfig, updates: SecurityConfig): SecurityConfig {
    const result: SecurityConfig = {};

    if (updates.authentication !== undefined) {
      result.authentication = updates.authentication;
    } else if (existing.authentication !== undefined) {
      result.authentication = existing.authentication;
    }

    if (updates.encryption !== undefined) {
      result.encryption = existing.encryption
        ? { ...existing.encryption, ...updates.encryption }
        : updates.encryption;
    } else if (existing.encryption !== undefined) {
      result.encryption = existing.encryption;
    }

    if (updates.authorization !== undefined) {
      result.authorization = existing.authorization
        ? { ...existing.authorization, ...updates.authorization }
        : updates.authorization;
    } else if (existing.authorization !== undefined) {
      result.authorization = existing.authorization;
    }

    if (updates.audit !== undefined) {
      result.audit = existing.audit ? { ...existing.audit, ...updates.audit } : updates.audit;
    } else if (existing.audit !== undefined) {
      result.audit = existing.audit;
    }

    if (updates.restrictions !== undefined) {
      result.restrictions = updates.restrictions;
    } else if (existing.restrictions !== undefined) {
      result.restrictions = existing.restrictions;
    }

    return result;
  }
}

import { Resource, ResourceType } from '@core/models/resource';
import { ResourceValidator } from '@core/models/resource-validator';

describe('Resource Data Model', () => {
  let validResource: Resource;
  let validator: ResourceValidator;

  beforeEach(() => {
    validator = new ResourceValidator();
    validResource = {
      id: 'test-resource-1',
      name: 'Test SSH Host',
      type: ResourceType.SSH_HOST,
      group: 'development',
      enabled: true,
      metadata: {
        description: 'Test SSH host for development',
        version: '1.0.0',
        owner: 'dev-team',
        environment: 'development',
        region: 'us-east-1',
        cost: 100,
        dependencies: [],
        healthCheck: {
          enabled: true,
          interval: 30000,
          timeout: 5000,
          retries: 3,
          endpoint: '/health',
          method: 'GET',
          expectedStatus: 200,
        },
      },
      connection: {
        host: 'dev.example.com',
        port: 22,
        protocol: 'ssh',
        timeout: 30000,
        retries: 3,
        keepAlive: true,
        poolSize: 5,
      },
      security: {
        authentication: {
          type: 'key',
          keyPath: '/path/to/key',
        },
        encryption: {
          enabled: true,
          protocol: 'ssh2',
          cipherSuites: ['aes256-ctr'],
          keyExchange: 'ecdh-sha2-nistp256',
          verification: 'strict',
        },
        authorization: {
          enabled: true,
          roles: ['developer', 'admin'],
          permissions: ['read', 'write', 'execute'],
          policies: [
            {
              action: 'execute',
              resource: 'shell',
              effect: 'allow',
              conditions: { time: 'business-hours' },
            },
          ],
        },
        audit: {
          enabled: true,
          level: 'detailed',
          retention: 90,
          destination: '/var/log/mcpsc/audit.log',
          format: 'json',
        },
        restrictions: [
          {
            type: 'ip',
            rule: '192.168.1.0/24',
            description: 'Allow only internal network',
          },
        ],
      },
      tags: ['development', 'ssh', 'linux'],
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    };
  });

  describe('Resource Validation', () => {
    it('should validate a complete valid resource', () => {
      const result = validator.validate(validResource);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require id field', () => {
      const invalidResource = { ...validResource, id: '' };
      const result = validator.validate(invalidResource);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Resource ID is required');
    });

    it('should require name field', () => {
      const invalidResource = { ...validResource, name: '' };
      const result = validator.validate(invalidResource);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Resource name is required');
    });

    it('should validate resource type', () => {
      const invalidResource = { ...validResource, type: 'invalid-type' as ResourceType };
      const result = validator.validate(invalidResource);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid resource type');
    });

    it('should validate id format (alphanumeric with hyphens)', () => {
      const invalidResource = { ...validResource, id: 'invalid id with spaces!' };
      const result = validator.validate(invalidResource);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Resource ID must contain only alphanumeric characters and hyphens'
      );
    });

    it('should validate name length', () => {
      const invalidResource = { ...validResource, name: 'a'.repeat(256) };
      const result = validator.validate(invalidResource);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Resource name must be between 1 and 255 characters');
    });

    it('should validate group name format', () => {
      const invalidResource = { ...validResource, group: 'invalid group!' };
      const result = validator.validate(invalidResource);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Group name must contain only alphanumeric characters, hyphens, and underscores'
      );
    });

    it('should validate tags format', () => {
      const invalidResource = { ...validResource, tags: ['valid-tag', 'invalid tag!'] };
      const result = validator.validate(invalidResource);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Tags must contain only alphanumeric characters, hyphens, and underscores'
      );
    });

    it('should validate connection configuration for SSH resources', () => {
      const invalidResource = {
        ...validResource,
        connection: { ...validResource.connection, host: '' },
      };
      const result = validator.validate(invalidResource);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('SSH resources must have a host specified');
    });

    it('should validate connection configuration for HTTP resources', () => {
      const httpResource = {
        ...validResource,
        type: ResourceType.HTTP_API,
        connection: { protocol: 'http' },
      };
      const result = validator.validate(httpResource);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('HTTP resources must have a URL specified');
    });

    it('should validate port ranges', () => {
      const invalidResource = {
        ...validResource,
        connection: { ...validResource.connection, port: 70000 },
      };
      const result = validator.validate(invalidResource);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Port must be between 1 and 65535');
    });

    it('should validate timeout values', () => {
      const invalidResource = {
        ...validResource,
        connection: { ...validResource.connection, timeout: -1 },
      };
      const result = validator.validate(invalidResource);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Timeout must be a positive number');
    });

    it('should validate retry values', () => {
      const invalidResource = {
        ...validResource,
        connection: { ...validResource.connection, retries: -1 },
      };
      const result = validator.validate(invalidResource);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Retries must be a non-negative number');
    });
  });

  describe('Security Configuration Validation', () => {
    it('should validate authentication method types', () => {
      const invalidResource = {
        ...validResource,
        security: {
          ...validResource.security,
          authentication: {
            type: 'invalid-auth' as any,
          },
        },
      } as Resource;
      const result = validator.validate(invalidResource);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid authentication type');
    });

    it('should require key path for key authentication', () => {
      const invalidResource = {
        ...validResource,
        security: {
          ...validResource.security,
          authentication: {
            type: 'key' as any,
          },
        },
      } as Resource;
      const result = validator.validate(invalidResource);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Key authentication requires keyPath');
    });

    it('should validate encryption protocol', () => {
      const invalidResource = {
        ...validResource,
        security: {
          ...validResource.security,
          encryption: {
            enabled: true,
            protocol: 'invalid-protocol',
          },
        },
      };
      const result = validator.validate(invalidResource);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid encryption protocol');
    });

    it('should validate audit retention period', () => {
      const invalidResource: Resource = {
        ...validResource,
        security: {
          ...validResource.security,
          audit: {
            enabled: true,
            level: 'standard' as any,
            retention: -1,
          },
        },
      };
      const result = validator.validate(invalidResource);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Audit retention must be a positive number');
    });

    it('should validate policy rules', () => {
      const invalidResource: Resource = {
        ...validResource,
        security: {
          ...validResource.security,
          authorization: {
            enabled: true,
            policies: [
              {
                action: '',
                resource: 'shell',
                effect: 'allow' as any,
              },
            ],
          },
        },
      };
      const result = validator.validate(invalidResource);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Policy action is required');
    });

    it('should validate security restriction types', () => {
      const invalidResource = {
        ...validResource,
        security: {
          ...validResource.security,
          restrictions: [
            {
              type: 'invalid-type' as any,
              rule: 'some-rule',
            },
          ],
        },
      };
      const result = validator.validate(invalidResource);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid security restriction type');
    });
  });

  describe('Metadata Validation', () => {
    it('should validate health check configuration', () => {
      const invalidResource = {
        ...validResource,
        metadata: {
          ...validResource.metadata,
          healthCheck: {
            enabled: true,
            interval: -1,
            timeout: 5000,
            retries: 3,
          },
        },
      };
      const result = validator.validate(invalidResource);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Health check interval must be positive');
    });

    it('should validate dependency references', () => {
      const invalidResource = {
        ...validResource,
        metadata: {
          ...validResource.metadata,
          dependencies: [''],
        },
      };
      const result = validator.validate(invalidResource);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Dependency ID cannot be empty');
    });

    it('should validate cost values', () => {
      const invalidResource = {
        ...validResource,
        metadata: {
          ...validResource.metadata,
          cost: -100,
        },
      };
      const result = validator.validate(invalidResource);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Cost must be a non-negative number');
    });
  });

  describe('Resource Lifecycle', () => {
    it('should create resource with current timestamps', () => {
      const now = new Date();
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

      const resource = validator.createResource({
        id: 'new-resource',
        name: 'New Resource',
        type: ResourceType.SSH_HOST,
        connection: { host: 'example.com' },
      });

      expect(resource.createdAt.getTime()).toEqual(now.getTime());
      expect(resource.updatedAt.getTime()).toEqual(now.getTime());
      expect(resource.enabled).toBe(true);
      expect(resource.tags).toEqual([]);
    });

    it('should update resource with new timestamp', () => {
      const now = new Date();
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

      const updatedResource = validator.updateResource(validResource, {
        name: 'Updated Name',
      });

      expect(updatedResource.name).toBe('Updated Name');
      expect(updatedResource.updatedAt).toEqual(now);
      expect(updatedResource.createdAt).toEqual(validResource.createdAt);
    });

    it('should merge metadata when updating', () => {
      const updatedResource = validator.updateResource(validResource, {
        metadata: {
          description: 'Updated description',
          newField: 'new value',
        },
      });

      expect(updatedResource.metadata.description).toBe('Updated description');
      expect(updatedResource.metadata.version).toBe(validResource.metadata.version);
      expect((updatedResource.metadata as any).newField).toBe('new value');
    });

    it('should merge connection config when updating', () => {
      const updatedResource = validator.updateResource(validResource, {
        connection: {
          port: 2222,
          newOption: 'new value',
        },
      });

      expect(updatedResource.connection.port).toBe(2222);
      expect(updatedResource.connection.host).toBe(validResource.connection.host);
      expect((updatedResource.connection as any).newOption).toBe('new value');
    });

    it('should merge security config when updating', () => {
      const updatedResource = validator.updateResource(validResource, {
        security: {
          authentication: {
            type: 'password',
            credentials: { username: 'user', password: 'pass' },
          },
        },
      });

      expect(updatedResource.security.authentication?.type).toBe('password');
      expect(updatedResource.security.encryption).toEqual(validResource.security.encryption);
    });

    it('should validate updates before applying', () => {
      expect(() => {
        validator.updateResource(validResource, {
          id: 'invalid id!',
        });
      }).toThrow('Resource ID must contain only alphanumeric characters and hyphens');
    });
  });

  describe('Resource Type Specific Validation', () => {
    it('should validate SSH host requirements', () => {
      const sshResource = {
        ...validResource,
        type: ResourceType.SSH_HOST,
        connection: {
          protocol: 'ssh',
        },
      };
      const result = validator.validate(sshResource);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('SSH resources must have a host specified');
    });

    it('should validate HTTP API requirements', () => {
      const httpResource = {
        ...validResource,
        type: ResourceType.HTTP_API,
        connection: {
          protocol: 'http',
        },
      };
      const result = validator.validate(httpResource);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('HTTP resources must have a URL specified');
    });

    it('should validate database requirements', () => {
      const dbResource = {
        ...validResource,
        type: ResourceType.DATABASE,
        connection: {
          protocol: 'postgresql',
        },
      };
      const result = validator.validate(dbResource);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Database resources must have a host specified');
    });

    it('should validate Kubernetes requirements', () => {
      const k8sResource = {
        ...validResource,
        type: ResourceType.KUBERNETES,
        connection: {
          protocol: 'kubernetes',
        },
      };
      const result = validator.validate(k8sResource);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Kubernetes resources must have a cluster endpoint specified'
      );
    });
  });

  describe('Warning Generation', () => {
    it('should generate warning for missing description', () => {
      const resourceWithoutDesc: Resource = {
        ...validResource,
        metadata: {
          ...validResource.metadata,
          description: '', // Empty string instead of undefined
        },
      };
      const result = validator.validate(resourceWithoutDesc);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Resource description is recommended');
    });

    it('should generate warning for disabled health checks', () => {
      const resourceWithoutHealthCheck = {
        ...validResource,
        metadata: {
          ...validResource.metadata,
          healthCheck: {
            enabled: false,
            interval: 30000,
            timeout: 5000,
            retries: 3,
          },
        },
      };
      const result = validator.validate(resourceWithoutHealthCheck);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Health checks are recommended for production resources');
    });

    it('should generate warning for weak authentication', () => {
      const resourceWithWeakAuth: Resource = {
        ...validResource,
        security: {
          ...validResource.security,
          authentication: {
            type: 'none' as any,
          },
        },
      };
      const result = validator.validate(resourceWithWeakAuth);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Authentication is recommended for security');
    });
  });
});

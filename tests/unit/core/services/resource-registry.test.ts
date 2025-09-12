import { ResourceRegistry } from '@core/services/resource-registry';
import { Resource, ResourceType } from '@core/models/resource';
import { ResourceFilter, ResourceChangeEvent } from '@core/interfaces/resource';
import { MCPSCError } from '@core/errors/base';

describe('ResourceRegistry', () => {
  let registry: ResourceRegistry;
  let mockResource: Resource;

  beforeEach(() => {
    registry = new ResourceRegistry();
    mockResource = {
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
      },
      connection: {
        host: 'dev.example.com',
        port: 22,
        protocol: 'ssh',
      },
      security: {
        authentication: {
          type: 'key',
          keyPath: '/path/to/key',
        },
        encryption: {
          enabled: true,
          protocol: 'ssh2',
        },
        authorization: {
          enabled: false,
        },
        audit: {
          enabled: true,
          level: 'standard',
          retention: 30,
        },
      },
      tags: ['development', 'ssh', 'linux'],
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    };
  });

  describe('add', () => {
    it('should add a new resource successfully', async () => {
      await registry.add(mockResource);

      const retrieved = await registry.get(mockResource.id);
      expect(retrieved).toMatchObject({
        ...mockResource,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should throw error when adding resource with duplicate id', async () => {
      await registry.add(mockResource);

      await expect(registry.add(mockResource)).rejects.toThrow(MCPSCError);
    });

    it('should validate resource before adding', async () => {
      const invalidResource = { ...mockResource, id: '' };

      await expect(registry.add(invalidResource)).rejects.toThrow(MCPSCError);
    });

    it('should update timestamps when adding resource', async () => {
      const now = new Date();
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

      await registry.add(mockResource);

      const retrieved = await registry.get(mockResource.id);
      expect(retrieved?.createdAt).toEqual(now);
      expect(retrieved?.updatedAt).toEqual(now);
    });

    it('should trigger change event when resource is added', async () => {
      const changeCallback = jest.fn();
      registry.watch(changeCallback);

      await registry.add(mockResource);

      expect(changeCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'added',
          resource: expect.objectContaining({
            ...mockResource,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          }),
          timestamp: expect.any(Date),
          source: 'ResourceRegistry',
        })
      );
    });
  });

  describe('remove', () => {
    beforeEach(async () => {
      await registry.add(mockResource);
    });

    it('should remove existing resource successfully', async () => {
      await registry.remove(mockResource.id);

      const retrieved = await registry.get(mockResource.id);
      expect(retrieved).toBeNull();
    });

    it('should throw error when removing non-existent resource', async () => {
      await expect(registry.remove('non-existent')).rejects.toThrow(MCPSCError);
    });

    it('should trigger change event when resource is removed', async () => {
      const changeCallback = jest.fn();
      registry.watch(changeCallback);

      await registry.remove(mockResource.id);

      expect(changeCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'removed',
          resource: expect.objectContaining({
            id: mockResource.id,
            name: mockResource.name,
            type: mockResource.type,
          }),
          timestamp: expect.any(Date),
          source: 'ResourceRegistry',
        })
      );
    });
  });

  describe('update', () => {
    beforeEach(async () => {
      await registry.add(mockResource);
    });

    it('should update existing resource successfully', async () => {
      const updates = {
        name: 'Updated SSH Host',
        enabled: false,
        tags: ['updated', 'ssh'],
      };

      await registry.update(mockResource.id, updates);

      const retrieved = await registry.get(mockResource.id);
      expect(retrieved?.name).toBe(updates.name);
      expect(retrieved?.enabled).toBe(updates.enabled);
      expect(retrieved?.tags).toEqual(updates.tags);
    });

    it('should update timestamp when resource is updated', async () => {
      const now = new Date();
      jest.spyOn(Date, 'now').mockReturnValue(now.getTime());

      await registry.update(mockResource.id, { name: 'Updated' });

      const retrieved = await registry.get(mockResource.id);
      expect(retrieved?.updatedAt).toEqual(now);
    });

    it('should throw error when updating non-existent resource', async () => {
      await expect(registry.update('non-existent', { name: 'Updated' })).rejects.toThrow(
        MCPSCError
      );
    });

    it('should validate updates before applying', async () => {
      const invalidUpdates = { type: 'invalid-type' as ResourceType };

      await expect(registry.update(mockResource.id, invalidUpdates)).rejects.toThrow(MCPSCError);
    });

    it('should trigger change event when resource is updated', async () => {
      const changeCallback = jest.fn();
      registry.watch(changeCallback);

      await registry.update(mockResource.id, { name: 'Updated' });

      expect(changeCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'updated',
        })
      );
    });
  });

  describe('get', () => {
    beforeEach(async () => {
      await registry.add(mockResource);
    });

    it('should retrieve existing resource by id', async () => {
      const retrieved = await registry.get(mockResource.id);
      expect(retrieved).toMatchObject({
        ...mockResource,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should return null for non-existent resource', async () => {
      const retrieved = await registry.get('non-existent');
      expect(retrieved).toBeNull();
    });
  });

  describe('list', () => {
    let httpResource: Resource;
    let disabledResource: Resource;

    beforeEach(async () => {
      httpResource = {
        ...mockResource,
        id: 'http-resource-1',
        name: 'Test HTTP API',
        type: ResourceType.HTTP_API,
        group: 'production',
        tags: ['production', 'api', 'rest'],
      };

      disabledResource = {
        ...mockResource,
        id: 'disabled-resource-1',
        name: 'Disabled Resource',
        enabled: false,
        group: 'staging',
        tags: ['staging', 'disabled'],
      };

      await registry.add(mockResource);
      await registry.add(httpResource);
      await registry.add(disabledResource);
    });

    it('should list all resources when no filter provided', async () => {
      const resources = await registry.list();
      expect(resources).toHaveLength(3);
    });

    it('should filter resources by type', async () => {
      const filter: ResourceFilter = { types: [ResourceType.SSH_HOST] };
      const resources = await registry.list(filter);

      expect(resources).toHaveLength(2);
      expect(resources.every(r => r.type === ResourceType.SSH_HOST)).toBe(true);
    });

    it('should filter resources by group', async () => {
      const filter: ResourceFilter = { groups: ['development'] };
      const resources = await registry.list(filter);

      expect(resources).toHaveLength(1);
      expect(resources[0]?.group).toBe('development');
    });

    it('should filter resources by enabled status', async () => {
      const filter: ResourceFilter = { enabled: true };
      const resources = await registry.list(filter);

      expect(resources).toHaveLength(2);
      expect(resources.every(r => r.enabled)).toBe(true);
    });

    it('should filter resources by tags', async () => {
      const filter: ResourceFilter = { tags: ['production'] };
      const resources = await registry.list(filter);

      expect(resources).toHaveLength(1);
      expect(resources[0]?.tags).toContain('production');
    });

    it('should filter resources by name pattern', async () => {
      const filter: ResourceFilter = { pattern: 'Test.*SSH' };
      const resources = await registry.list(filter);

      expect(resources).toHaveLength(1);
      expect(resources[0]?.name).toMatch(/Test.*SSH/);
    });

    it('should apply multiple filters simultaneously', async () => {
      const filter: ResourceFilter = {
        types: [ResourceType.SSH_HOST],
        enabled: true,
        groups: ['development'],
      };
      const resources = await registry.list(filter);

      expect(resources).toHaveLength(1);
      expect(resources[0]?.id).toBe(mockResource.id);
    });
  });

  describe('enable/disable', () => {
    beforeEach(async () => {
      await registry.add(mockResource);
    });

    it('should enable disabled resource', async () => {
      await registry.disable(mockResource.id);
      await registry.enable(mockResource.id);

      const retrieved = await registry.get(mockResource.id);
      expect(retrieved?.enabled).toBe(true);
    });

    it('should disable enabled resource', async () => {
      await registry.disable(mockResource.id);

      const retrieved = await registry.get(mockResource.id);
      expect(retrieved?.enabled).toBe(false);
    });

    it('should throw error when enabling non-existent resource', async () => {
      await expect(registry.enable('non-existent')).rejects.toThrow(MCPSCError);
    });

    it('should throw error when disabling non-existent resource', async () => {
      await expect(registry.disable('non-existent')).rejects.toThrow(MCPSCError);
    });

    it('should trigger change event when resource is enabled', async () => {
      await registry.disable(mockResource.id);

      const changeCallback = jest.fn();
      registry.watch(changeCallback);

      await registry.enable(mockResource.id);

      expect(changeCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'updated',
        })
      );
    });
  });

  describe('watch', () => {
    it('should register multiple change callbacks', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      registry.watch(callback1);
      registry.watch(callback2);

      await registry.add(mockResource);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should provide correct event data in callbacks', async () => {
      const changeCallback = jest.fn();
      registry.watch(changeCallback);

      await registry.add(mockResource);

      const event: ResourceChangeEvent = changeCallback.mock.calls[0][0];
      expect(event.type).toBe('added');
      expect(event.resource).toMatchObject({
        ...mockResource,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.source).toBe('ResourceRegistry');
    });
  });

  describe('refresh', () => {
    it('should refresh all resources successfully', async () => {
      await registry.add(mockResource);

      await expect(registry.refresh()).resolves.not.toThrow();
    });

    it('should trigger change events for refreshed resources', async () => {
      await registry.add(mockResource);

      const changeCallback = jest.fn();
      registry.watch(changeCallback);

      await registry.refresh();

      // Should trigger updated event for existing resource
      expect(changeCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'updated',
        })
      );
    });
  });

  describe('dependency resolution', () => {
    let dependentResource: Resource;

    beforeEach(async () => {
      dependentResource = {
        ...mockResource,
        id: 'dependent-resource',
        name: 'Dependent Resource',
        metadata: {
          ...mockResource.metadata,
          dependencies: [mockResource.id],
        },
      };

      await registry.add(mockResource);
      await registry.add(dependentResource);
    });

    it('should resolve resource dependencies', async () => {
      const dependencies = await registry.getDependencies(dependentResource.id);

      expect(dependencies).toHaveLength(1);
      expect(dependencies[0]?.id).toBe(mockResource.id);
    });

    it('should find resources that depend on a given resource', async () => {
      const dependents = await registry.getDependents(mockResource.id);

      expect(dependents).toHaveLength(1);
      expect(dependents[0]?.id).toBe(dependentResource.id);
    });

    it('should prevent removal of resource with dependents', async () => {
      await expect(registry.remove(mockResource.id)).rejects.toThrow(MCPSCError);
    });

    it('should allow removal of resource with dependents when forced', async () => {
      await expect(registry.remove(mockResource.id, { force: true })).resolves.not.toThrow();
    });
  });
});

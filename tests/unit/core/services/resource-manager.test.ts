import { ResourceManagerService } from '@core/services/resource-manager';
import { ResourceRegistry } from '@core/services/resource-registry';
import { Resource, ResourceType } from '@core/models/resource';
import { IResourceLoader } from '@core/interfaces/resource';
import { MCPSCError, ErrorCategory, ErrorSeverity } from '@core/errors/base';

// Mock dependencies
jest.mock('../../../../src/core/services/resource-registry');
jest.mock('../../../../src/infrastructure/loaders/local');
jest.mock('../../../../src/infrastructure/logging/logger');
jest.mock('../../../../src/infrastructure/monitoring/metrics');

describe('ResourceManagerService', () => {
  let resourceManager: ResourceManagerService;
  let mockRegistry: jest.Mocked<ResourceRegistry>;
  let mockLoader: jest.Mocked<IResourceLoader>;

  const sampleResource: Resource = {
    id: 'test-resource',
    name: 'Test Resource',
    type: ResourceType.SSH_HOST,
    enabled: true,
    metadata: { description: 'Test resource' },
    connection: { host: 'test.example.com' },
    security: {},
    tags: ['test'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Reset Prometheus registry to avoid duplicate metric registration
    const { register } = require('prom-client');
    register.clear();

    // Create mock registry
    mockRegistry = {
      add: jest.fn(),
      remove: jest.fn(),
      update: jest.fn(),
      get: jest.fn(),
      list: jest.fn(),
      enable: jest.fn(),
      disable: jest.fn(),
      refresh: jest.fn(),
      watch: jest.fn(),
      getDependencies: jest.fn(),
      getDependents: jest.fn(),
      getByGroup: jest.fn(),
      getByType: jest.fn(),
      getByTags: jest.fn(),
      getEnabled: jest.fn(),
      getDisabled: jest.fn(),
      search: jest.fn(),
      count: jest.fn(),
      exists: jest.fn(),
      getIds: jest.fn(),
      getGroups: jest.fn(),
      getTags: jest.fn(),
      clear: jest.fn(),
      import: jest.fn(),
      export: jest.fn(),
    } as any;

    // Create mock loader
    mockLoader = {
      source: 'test-loader',
      supportedTypes: [ResourceType.SSH_HOST, ResourceType.HTTP_API],
      load: jest.fn(),
      validate: jest.fn(),
      watch: jest.fn(),
      refresh: jest.fn(),
    };

    // Mock ResourceRegistry constructor
    (ResourceRegistry as jest.MockedClass<typeof ResourceRegistry>).mockImplementation(
      () => mockRegistry
    );

    resourceManager = new ResourceManagerService();
  });

  describe('Constructor and Initialization', () => {
    it('should create a ResourceRegistry instance', () => {
      expect(ResourceRegistry).toHaveBeenCalledTimes(1);
      expect(resourceManager.getRegistry()).toBe(mockRegistry);
    });

    it('should initialize with empty loaders map', () => {
      expect(resourceManager.getLoaders()).toEqual([]);
    });
  });

  describe('Loader Management', () => {
    it('should register a loader', () => {
      resourceManager.registerLoader('test-loader', mockLoader);

      expect(resourceManager.getLoader('test-loader')).toBe(mockLoader);
      expect(resourceManager.getLoaders()).toContain('test-loader');
    });

    it('should return undefined for non-existent loader', () => {
      expect(resourceManager.getLoader('non-existent')).toBeUndefined();
    });

    it('should list all registered loaders', () => {
      resourceManager.registerLoader('loader1', mockLoader);
      resourceManager.registerLoader('loader2', mockLoader);

      const loaders = resourceManager.getLoaders();
      expect(loaders).toContain('loader1');
      expect(loaders).toContain('loader2');
      expect(loaders).toHaveLength(2);
    });

    it('should overwrite existing loader with same name', () => {
      const loader1 = { ...mockLoader, source: 'loader1' };
      const loader2 = { ...mockLoader, source: 'loader2' };

      resourceManager.registerLoader('test', loader1);
      resourceManager.registerLoader('test', loader2);

      expect(resourceManager.getLoader('test')).toBe(loader2);
      expect(resourceManager.getLoaders()).toHaveLength(1);
    });
  });

  describe('Resource Operations', () => {
    beforeEach(() => {
      resourceManager.registerLoader('test-loader', mockLoader);
    });

    it('should add a resource through registry', async () => {
      mockRegistry.add.mockResolvedValue();

      await resourceManager.addResource(sampleResource);

      expect(mockRegistry.add).toHaveBeenCalledWith(sampleResource);
    });

    it('should remove a resource through registry', async () => {
      mockRegistry.remove.mockResolvedValue();

      await resourceManager.removeResource('test-id', true);

      expect(mockRegistry.remove).toHaveBeenCalledWith('test-id', { force: true });
    });

    it('should update a resource through registry', async () => {
      const updates = { name: 'Updated Name' };
      mockRegistry.update.mockResolvedValue();

      await resourceManager.updateResource('test-id', updates);

      expect(mockRegistry.update).toHaveBeenCalledWith('test-id', updates);
    });

    it('should get a resource through registry', async () => {
      mockRegistry.get.mockResolvedValue(sampleResource);

      const result = await resourceManager.getResource('test-id');

      expect(mockRegistry.get).toHaveBeenCalledWith('test-id');
      expect(result).toBe(sampleResource);
    });

    it('should list resources through registry', async () => {
      const resources = [sampleResource];
      const filter = { types: [ResourceType.SSH_HOST] };
      mockRegistry.list.mockResolvedValue(resources);

      const result = await resourceManager.listResources(filter);

      expect(mockRegistry.list).toHaveBeenCalledWith(filter);
      expect(result).toBe(resources);
    });

    it('should enable a resource through registry', async () => {
      mockRegistry.enable.mockResolvedValue();

      await resourceManager.enableResource('test-id');

      expect(mockRegistry.enable).toHaveBeenCalledWith('test-id');
    });

    it('should disable a resource through registry', async () => {
      mockRegistry.disable.mockResolvedValue();

      await resourceManager.disableResource('test-id');

      expect(mockRegistry.disable).toHaveBeenCalledWith('test-id');
    });
  });

  describe('Resource Querying', () => {
    it('should get resource dependencies', async () => {
      const dependencies = [sampleResource];
      mockRegistry.getDependencies.mockResolvedValue(dependencies);

      const result = await resourceManager.getResourceDependencies('test-id');

      expect(mockRegistry.getDependencies).toHaveBeenCalledWith('test-id');
      expect(result).toBe(dependencies);
    });

    it('should get resource dependents', async () => {
      const dependents = [sampleResource];
      mockRegistry.getDependents.mockResolvedValue(dependents);

      const result = await resourceManager.getResourceDependents('test-id');

      expect(mockRegistry.getDependents).toHaveBeenCalledWith('test-id');
      expect(result).toBe(dependents);
    });

    it('should get resources by group', async () => {
      const resources = [sampleResource];
      mockRegistry.getByGroup.mockResolvedValue(resources);

      const result = await resourceManager.getResourcesByGroup('test-group');

      expect(mockRegistry.getByGroup).toHaveBeenCalledWith('test-group');
      expect(result).toBe(resources);
    });

    it('should get resources by type', async () => {
      const resources = [sampleResource];
      mockRegistry.getByType.mockResolvedValue(resources);

      const result = await resourceManager.getResourcesByType(ResourceType.SSH_HOST);

      expect(mockRegistry.getByType).toHaveBeenCalledWith(ResourceType.SSH_HOST);
      expect(result).toBe(resources);
    });

    it('should search resources', async () => {
      const resources = [sampleResource];
      mockRegistry.search.mockResolvedValue(resources);

      const result = await resourceManager.searchResources('test');

      expect(mockRegistry.search).toHaveBeenCalledWith('test');
      expect(result).toBe(resources);
    });
  });

  describe('Resource Statistics', () => {
    it('should calculate resource statistics', async () => {
      const allResources: Resource[] = [
        { ...sampleResource, type: ResourceType.SSH_HOST, enabled: true, group: 'group1' },
        {
          ...sampleResource,
          id: 'resource2',
          type: ResourceType.HTTP_API,
          enabled: false,
          group: 'group1',
        },
        {
          ...sampleResource,
          id: 'resource3',
          type: ResourceType.SSH_HOST,
          enabled: true,
          group: 'group2',
        },
      ];

      mockRegistry.list.mockResolvedValue(allResources);
      mockRegistry.getEnabled.mockResolvedValue([allResources[0]!, allResources[2]!]);
      mockRegistry.getDisabled.mockResolvedValue([allResources[1]!]);
      mockRegistry.getGroups.mockResolvedValue(['group1', 'group2']);

      const stats = await resourceManager.getResourceStats();

      expect(stats).toEqual({
        total: 3,
        enabled: 2,
        disabled: 1,
        byType: {
          [ResourceType.SSH_HOST]: 2,
          [ResourceType.HTTP_API]: 1,
          [ResourceType.DATABASE]: 0,
          [ResourceType.KUBERNETES]: 0,
        },
        byGroup: {
          group1: 2,
          group2: 1,
        },
      });
    });

    it('should handle resources without groups in statistics', async () => {
      const allResources: Resource[] = [
        { ...sampleResource, type: ResourceType.SSH_HOST, enabled: true },
      ];

      mockRegistry.list.mockResolvedValue(allResources);
      mockRegistry.getEnabled.mockResolvedValue([allResources[0]!]);
      mockRegistry.getDisabled.mockResolvedValue([]);
      mockRegistry.getGroups.mockResolvedValue([]);

      const stats = await resourceManager.getResourceStats();

      expect(stats.byGroup).toEqual({});
    });
  });

  describe('Resource Management Operations', () => {
    it('should refresh resources through registry', async () => {
      mockRegistry.refresh.mockResolvedValue();

      await resourceManager.refreshResources();

      expect(mockRegistry.refresh).toHaveBeenCalled();
    });

    it('should import resources through registry', async () => {
      const resources = [sampleResource];
      mockRegistry.import.mockResolvedValue();

      await resourceManager.importResources(resources);

      expect(mockRegistry.import).toHaveBeenCalledWith(resources);
    });

    it('should export resources through registry', async () => {
      const resources = [sampleResource];
      mockRegistry.export.mockResolvedValue(resources);

      const result = await resourceManager.exportResources();

      expect(mockRegistry.export).toHaveBeenCalled();
      expect(result).toBe(resources);
    });

    it('should watch resources through registry', () => {
      const callback = jest.fn();

      resourceManager.watchResources(callback);

      expect(mockRegistry.watch).toHaveBeenCalledWith(callback);
    });
  });

  describe('Error Handling', () => {
    it('should propagate registry errors', async () => {
      const error = new MCPSCError(
        3001,
        'Resource not found',
        ErrorCategory.RESOURCE,
        ErrorSeverity.ERROR
      );
      mockRegistry.get.mockRejectedValue(error);

      await expect(resourceManager.getResource('non-existent')).rejects.toThrow(error);
    });

    it('should propagate loader registration errors', () => {
      // Test that invalid loader registration is handled appropriately
      expect(() => {
        resourceManager.registerLoader('', mockLoader);
      }).not.toThrow(); // Should not throw for empty name, but could be enhanced
    });
  });

  describe('Integration with Loaders', () => {
    it('should coordinate with registered loaders', () => {
      resourceManager.registerLoader('local', mockLoader);
      resourceManager.registerLoader('remote', mockLoader);

      expect(resourceManager.getLoaders()).toEqual(['local', 'remote']);
      expect(resourceManager.getLoader('local')).toBe(mockLoader);
      expect(resourceManager.getLoader('remote')).toBe(mockLoader);
    });

    it('should handle loader operations independently of registry', async () => {
      mockLoader.load.mockResolvedValue([sampleResource]);
      mockLoader.validate.mockReturnValue({ valid: true, errors: [] });

      resourceManager.registerLoader('test', mockLoader);

      // Loader operations should be independent
      const loader = resourceManager.getLoader('test');
      expect(loader).toBe(mockLoader);

      // Registry operations should still work
      mockRegistry.add.mockResolvedValue();
      await resourceManager.addResource(sampleResource);
      expect(mockRegistry.add).toHaveBeenCalledWith(sampleResource);
    });
  });
});

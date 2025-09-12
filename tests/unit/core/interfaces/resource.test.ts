import {
  IResourceLoader,
  LoaderConfig,
  ValidationResult,
  ResourceChangeCallback,
} from '@core/interfaces/resource';
import { Resource, ResourceType } from '@core/models/resource';

describe('IResourceLoader Interface Contract', () => {
  let mockLoader: IResourceLoader;

  beforeEach(() => {
    mockLoader = {
      source: 'local',
      supportedTypes: [ResourceType.SSH_HOST, ResourceType.HTTP_API],
      load: jest.fn(),
      validate: jest.fn(),
      watch: jest.fn(),
      refresh: jest.fn().mockResolvedValue(undefined),
    };
  });

  describe('Loader Properties', () => {
    it('should have source property', () => {
      expect(mockLoader.source).toBeDefined();
      expect(typeof mockLoader.source).toBe('string');
    });

    it('should have supportedTypes array', () => {
      expect(mockLoader.supportedTypes).toBeDefined();
      expect(Array.isArray(mockLoader.supportedTypes)).toBe(true);
    });
  });

  describe('Resource Loading', () => {
    it('should load resources with configuration', async () => {
      const config: LoaderConfig = {
        path: '/path/to/resources',
        format: 'json',
        recursive: true,
      };

      const expectedResources: Resource[] = [
        {
          id: 'resource-1',
          name: 'Test SSH Host',
          type: ResourceType.SSH_HOST,
          group: 'production',
          enabled: true,
          metadata: {},
          connection: {
            host: 'example.com',
            port: 22,
            username: 'user',
          },
          security: {},
          tags: ['production', 'web'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (mockLoader.load as jest.Mock).mockResolvedValue(expectedResources);

      const resources = await mockLoader.load(config);
      expect(resources).toEqual(expectedResources);
      expect(mockLoader.load).toHaveBeenCalledWith(config);
    });

    it('should validate resources', () => {
      const resource: Resource = {
        id: 'resource-1',
        name: 'Test Resource',
        type: ResourceType.SSH_HOST,
        group: 'test',
        enabled: true,
        metadata: {},
        connection: {},
        security: {},
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const expectedResult: ValidationResult = {
        valid: true,
        errors: [],
      };

      (mockLoader.validate as jest.Mock).mockReturnValue(expectedResult);

      const result = mockLoader.validate(resource);
      expect(result).toEqual(expectedResult);
      expect(mockLoader.validate).toHaveBeenCalledWith(resource);
    });

    it('should handle validation errors', () => {
      const invalidResource: Resource = {
        id: '',
        name: '',
        type: ResourceType.SSH_HOST,
        group: 'test',
        enabled: true,
        metadata: {},
        connection: {},
        security: {},
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const expectedResult: ValidationResult = {
        valid: false,
        errors: ['Resource ID is required', 'Resource name is required'],
      };

      (mockLoader.validate as jest.Mock).mockReturnValue(expectedResult);

      const result = mockLoader.validate(invalidResource);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Resource Watching', () => {
    it('should watch for resource changes', () => {
      const callback: ResourceChangeCallback = jest.fn();
      mockLoader.watch(callback);
      expect(mockLoader.watch).toHaveBeenCalledWith(callback);
    });

    it('should refresh resources', async () => {
      await expect(mockLoader.refresh()).resolves.toBeUndefined();
      expect(mockLoader.refresh).toHaveBeenCalled();
    });
  });
});

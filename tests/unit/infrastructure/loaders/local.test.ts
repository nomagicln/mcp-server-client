import { LocalResourceLoader } from '@infrastructure/loaders/local';
import { ResourceType } from '@core/models/resource';
import { LoaderConfig } from '@core/interfaces/resource';
import * as fs from 'fs/promises';
import { watch } from 'chokidar';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('chokidar');
jest.mock('js-yaml');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockWatch = watch as jest.MockedFunction<typeof watch>;

describe('LocalResourceLoader', () => {
  let loader: LocalResourceLoader;
  let mockWatcher: any;

  beforeEach(() => {
    jest.clearAllMocks();
    loader = new LocalResourceLoader();

    // Mock chokidar watcher
    mockWatcher = {
      on: jest.fn().mockReturnThis(),
      close: jest.fn().mockResolvedValue(undefined),
      add: jest.fn().mockReturnThis(),
      unwatch: jest.fn().mockReturnThis(),
    };
    mockWatch.mockReturnValue(mockWatcher);
  });

  describe('File System Scanning', () => {
    it('should scan directory for resource files', async () => {
      const config: LoaderConfig = {
        path: '/test/resources',
        recursive: true,
      };

      // Mock initial stat call for directory
      mockFs.stat
        .mockResolvedValueOnce({ isDirectory: () => true, isFile: () => false } as any)
        .mockResolvedValue({ isDirectory: () => false, isFile: () => true } as any);

      // Mock directory structure
      mockFs.readdir
        .mockResolvedValueOnce([
          { name: 'ssh-hosts.json', isDirectory: () => false, isFile: () => true } as any,
          { name: 'api-endpoints.yaml', isDirectory: () => false, isFile: () => true } as any,
          { name: 'subdirectory', isDirectory: () => true, isFile: () => false } as any,
        ])
        .mockResolvedValueOnce([
          { name: 'database.ts', isDirectory: () => false, isFile: () => true } as any,
        ]);

      // Mock js-yaml for YAML parsing
      const yaml = require('js-yaml');
      yaml.load = jest.fn().mockReturnValueOnce({
        id: 'api-1',
        name: 'Test API',
        type: 'http-api',
        enabled: true,
      });

      // Mock file contents
      mockFs.readFile
        .mockResolvedValueOnce(
          JSON.stringify({
            id: 'ssh-1',
            name: 'Test SSH Host',
            type: 'ssh-host',
            enabled: true,
            connection: { host: 'test.example.com', port: 22 },
          })
        )
        .mockResolvedValueOnce('id: api-1\nname: Test API\ntype: http-api\nenabled: true')
        .mockResolvedValueOnce(
          'export default { id: "db-1", name: "Test DB", type: "database", enabled: true }'
        );

      const resources = await loader.load(config);

      expect(mockFs.readdir).toHaveBeenCalledWith('/test/resources', { withFileTypes: true });
      expect(resources).toHaveLength(3);
      expect(resources[0]?.id).toBe('ssh-1');
      expect(resources[1]?.id).toBe('api-1');
      expect(resources[2]?.id).toBe('db-1');
    });

    it('should handle non-recursive scanning', async () => {
      const config: LoaderConfig = {
        path: '/test/resources',
        recursive: false,
      };

      // Mock initial stat call for directory
      mockFs.stat
        .mockResolvedValueOnce({ isDirectory: () => true, isFile: () => false } as any)
        .mockResolvedValue({ isDirectory: () => false, isFile: () => true } as any);

      mockFs.readdir.mockResolvedValueOnce([
        { name: 'ssh-hosts.json', isDirectory: () => false, isFile: () => true } as any,
        { name: 'subdirectory', isDirectory: () => true, isFile: () => false } as any,
      ]);

      mockFs.readFile.mockResolvedValueOnce(
        JSON.stringify({
          id: 'ssh-1',
          name: 'Test SSH Host',
          type: 'ssh-host',
          enabled: true,
        })
      );

      const resources = await loader.load(config);

      expect(mockFs.readdir).toHaveBeenCalledTimes(1);
      expect(resources).toHaveLength(1);
    });

    it('should handle empty directories', async () => {
      const config: LoaderConfig = {
        path: '/empty/directory',
      };

      mockFs.stat.mockResolvedValueOnce({ isDirectory: () => true, isFile: () => false } as any);
      mockFs.readdir.mockResolvedValueOnce([]);

      const resources = await loader.load(config);

      expect(resources).toHaveLength(0);
    });

    it('should handle file system errors gracefully', async () => {
      const config: LoaderConfig = {
        path: '/nonexistent/path',
      };

      mockFs.stat.mockRejectedValueOnce(new Error('ENOENT: no such file or directory'));

      await expect(loader.load(config)).rejects.toThrow('ENOENT: no such file or directory');
    });

    it('should filter files by supported extensions', async () => {
      const config: LoaderConfig = {
        path: '/test/resources',
      };

      // Mock initial stat call for directory
      mockFs.stat.mockResolvedValueOnce({ isDirectory: () => true, isFile: () => false } as any);

      mockFs.readdir.mockResolvedValueOnce([
        { name: 'resource.json', isDirectory: () => false, isFile: () => true } as any,
        { name: 'resource.yaml', isDirectory: () => false, isFile: () => true } as any,
        { name: 'resource.txt', isDirectory: () => false, isFile: () => true } as any,
        { name: 'resource.js', isDirectory: () => false, isFile: () => true } as any,
        { name: 'resource.ts', isDirectory: () => false, isFile: () => true } as any,
      ]);

      // Mock js-yaml for YAML parsing
      const yaml = require('js-yaml');
      yaml.load = jest.fn().mockReturnValue({
        id: 'test-yaml',
        name: 'Test YAML Resource',
        type: 'ssh-host',
        enabled: true,
      });

      // Mock file contents for different formats
      mockFs.readFile
        .mockResolvedValueOnce(
          JSON.stringify({
            id: 'test-json',
            name: 'Test JSON Resource',
            type: 'ssh-host',
            enabled: true,
          })
        )
        .mockResolvedValueOnce(
          'id: test-yaml\nname: Test YAML Resource\ntype: ssh-host\nenabled: true'
        )
        .mockResolvedValueOnce(
          'module.exports = { id: "test-js", name: "Test JS Resource", type: "ssh-host", enabled: true }'
        )
        .mockResolvedValueOnce(
          'export default { id: "test-ts", name: "Test TS Resource", type: "ssh-host", enabled: true }'
        );

      const resources = await loader.load(config);

      // Should only process .json, .yaml, .js, .ts files (not .txt)
      expect(mockFs.readFile).toHaveBeenCalledTimes(4);
      expect(resources).toHaveLength(4);
    });
  });

  describe('File Format Support', () => {
    it('should parse JSON files correctly', async () => {
      const config: LoaderConfig = {
        path: '/test/resources/ssh-host.json',
      };

      const resourceData = {
        id: 'ssh-1',
        name: 'Production SSH Server',
        type: 'ssh-host',
        enabled: true,
        group: 'production',
        metadata: {
          description: 'Main production server',
          environment: 'production',
        },
        connection: {
          host: 'prod.example.com',
          port: 22,
          protocol: 'ssh',
        },
        security: {
          authentication: {
            type: 'key',
            keyPath: '~/.ssh/id_rsa',
          },
        },
        tags: ['production', 'critical'],
      };

      mockFs.stat.mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true } as any);
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(resourceData));

      const resources = await loader.load(config);

      expect(resources).toHaveLength(1);
      expect(resources[0]).toMatchObject(resourceData);
      expect(resources[0]?.type).toBe(ResourceType.SSH_HOST);
    });

    it('should parse YAML files correctly', async () => {
      const config: LoaderConfig = {
        path: '/test/resources/api.yaml',
      };

      const yamlContent = `
id: api-1
name: REST API Endpoint
type: http-api
enabled: true
group: apis
metadata:
  description: Main REST API
  version: v1.0.0
connection:
  url: https://api.example.com
  timeout: 30000
security:
  authentication:
    type: token
    credentials:
      token: \${API_TOKEN}
tags:
  - api
  - rest
`;

      const expectedResource = {
        id: 'api-1',
        name: 'REST API Endpoint',
        type: 'http-api',
        enabled: true,
        group: 'apis',
        metadata: {
          description: 'Main REST API',
          version: 'v1.0.0',
        },
        connection: {
          url: 'https://api.example.com',
          timeout: 30000,
        },
        security: {
          authentication: {
            type: 'token',
            credentials: {
              token: '${API_TOKEN}',
            },
          },
        },
        tags: ['api', 'rest'],
      };

      mockFs.stat.mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true } as any);
      mockFs.readFile.mockResolvedValueOnce(yamlContent);

      // Mock js-yaml
      const yaml = require('js-yaml');
      yaml.load = jest.fn().mockReturnValueOnce(expectedResource);

      const resources = await loader.load(config);

      expect(resources).toHaveLength(1);
      expect(resources[0]).toMatchObject(expectedResource);
      expect(yaml.load).toHaveBeenCalledWith(yamlContent);
    });

    it('should parse JavaScript files correctly', async () => {
      const config: LoaderConfig = {
        path: '/test/resources/database.js',
      };

      const jsContent = `
module.exports = {
  id: 'db-1',
  name: 'PostgreSQL Database',
  type: 'database',
  enabled: true,
  connection: {
    host: 'localhost',
    port: 5432,
    protocol: 'postgresql'
  }
};
`;

      mockFs.stat.mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true } as any);
      mockFs.readFile.mockResolvedValueOnce(jsContent);

      const resources = await loader.load(config);

      expect(resources).toHaveLength(1);
      expect(resources[0]?.id).toBe('db-1');
      expect(resources[0]?.type).toBe(ResourceType.DATABASE);
    });

    it('should parse TypeScript files correctly', async () => {
      const config: LoaderConfig = {
        path: '/test/resources/k8s.ts',
      };

      const tsContent = `
export default {
  id: 'k8s-1',
  name: 'Kubernetes Cluster',
  type: 'kubernetes',
  enabled: true,
  connection: {
    url: 'https://k8s.example.com',
    protocol: 'https'
  }
};
`;

      mockFs.stat.mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true } as any);
      mockFs.readFile.mockResolvedValueOnce(tsContent);

      const resources = await loader.load(config);

      expect(resources).toHaveLength(1);
      expect(resources[0]?.id).toBe('k8s-1');
      expect(resources[0]?.type).toBe(ResourceType.KUBERNETES);
    });

    it('should handle malformed JSON files', async () => {
      const config: LoaderConfig = {
        path: '/test/resources/invalid.json',
      };

      mockFs.stat.mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true } as any);
      mockFs.readFile.mockResolvedValueOnce('{ invalid json }');

      await expect(loader.load(config)).rejects.toThrow();
    });

    it('should handle malformed YAML files', async () => {
      const config: LoaderConfig = {
        path: '/test/resources/invalid.yaml',
      };

      mockFs.stat.mockResolvedValue({ isDirectory: () => false, isFile: () => true } as any);
      mockFs.readFile.mockResolvedValueOnce('invalid: yaml: content: [');

      const yaml = require('js-yaml');
      yaml.load = jest.fn().mockImplementation(() => {
        throw new Error('Invalid YAML');
      });

      await expect(loader.load(config)).rejects.toThrow('Invalid YAML');
    });
  });

  describe('File Watching', () => {
    it('should set up file watcher for dynamic updates', async () => {
      const callback = jest.fn();
      const config: LoaderConfig = {
        path: '/test/resources',
      };

      // Mock directory structure for initial load
      mockFs.stat.mockResolvedValueOnce({ isDirectory: () => true, isFile: () => false } as any);
      mockFs.readdir.mockResolvedValueOnce([]);

      // Load first to set the current path
      await loader.load(config);

      loader.watch(callback);

      expect(mockWatch).toHaveBeenCalledWith('/test/resources', {
        ignored: /node_modules/,
        persistent: true,
        ignoreInitial: true,
      });
      expect(mockWatcher.on).toHaveBeenCalledWith('add', expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith('change', expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith('unlink', expect.any(Function));
    });

    it('should trigger callback on file addition', async () => {
      const callback = jest.fn();
      let addHandler: Function;

      mockWatcher.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'add') {
          addHandler = handler;
        }
        return mockWatcher;
      });

      // Setup initial load
      const config: LoaderConfig = { path: '/test/resources' };
      mockFs.readdir.mockResolvedValueOnce([]);
      mockFs.stat.mockResolvedValue({ isDirectory: () => true, isFile: () => false } as any);
      await loader.load(config);

      mockFs.readFile.mockResolvedValueOnce(
        JSON.stringify({
          id: 'new-resource',
          name: 'New Resource',
          type: 'ssh-host',
          enabled: true,
        })
      );

      loader.watch(callback);

      // Simulate file addition
      await addHandler!('/test/resources/new-resource.json');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'added',
          resource: expect.objectContaining({
            id: 'new-resource',
          }),
        })
      );
    });

    it('should trigger callback on file change', async () => {
      const callback = jest.fn();
      let changeHandler: Function;

      mockWatcher.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'change') {
          changeHandler = handler;
        }
        return mockWatcher;
      });

      // Setup initial load
      const config: LoaderConfig = { path: '/test/resources' };
      mockFs.readdir.mockResolvedValueOnce([]);
      mockFs.stat.mockResolvedValue({ isDirectory: () => true, isFile: () => false } as any);
      await loader.load(config);

      mockFs.readFile.mockResolvedValueOnce(
        JSON.stringify({
          id: 'updated-resource',
          name: 'Updated Resource',
          type: 'ssh-host',
          enabled: false,
        })
      );

      loader.watch(callback);

      // Simulate file change
      await changeHandler!('/test/resources/updated-resource.json');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'updated',
          resource: expect.objectContaining({
            id: 'updated-resource',
            enabled: false,
          }),
        })
      );
    });

    it('should trigger callback on file removal', async () => {
      const callback = jest.fn();
      let unlinkHandler: Function;

      mockWatcher.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'unlink') {
          unlinkHandler = handler;
        }
        return mockWatcher;
      });

      // Setup initial load
      const config: LoaderConfig = { path: '/test/resources' };
      mockFs.readdir.mockResolvedValueOnce([]);
      mockFs.stat.mockResolvedValue({ isDirectory: () => true, isFile: () => false } as any);
      await loader.load(config);

      loader.watch(callback);

      // Simulate file removal
      await unlinkHandler!('/test/resources/removed-resource.json');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'removed',
          resource: expect.objectContaining({
            id: expect.stringContaining('removed-resource'),
          }),
        })
      );
    });

    it('should handle watcher errors gracefully', async () => {
      const callback = jest.fn();
      let errorHandler: Function;

      mockWatcher.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'error') {
          errorHandler = handler;
        }
        return mockWatcher;
      });

      // Setup initial load
      const config: LoaderConfig = { path: '/test/resources' };
      mockFs.readdir.mockResolvedValueOnce([]);
      mockFs.stat.mockResolvedValue({ isDirectory: () => true, isFile: () => false } as any);
      await loader.load(config);

      loader.watch(callback);

      // Simulate watcher error
      const error = new Error('Watcher error');
      errorHandler!(error);

      // Should not crash the application
      expect(mockWatcher.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('Resource Validation', () => {
    it('should validate resource schema', () => {
      const validResource = {
        id: 'valid-resource',
        name: 'Valid Resource',
        type: ResourceType.SSH_HOST,
        enabled: true,
        metadata: {},
        connection: { host: 'example.com' },
        security: {},
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = loader.validate(validResource);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const invalidResource = {
        name: 'Invalid Resource',
        type: ResourceType.SSH_HOST,
        enabled: true,
      } as any;

      const result = loader.validate(invalidResource);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: id');
    });

    it('should detect invalid resource type', () => {
      const invalidResource = {
        id: 'invalid-type',
        name: 'Invalid Type Resource',
        type: 'invalid-type' as any,
        enabled: true,
        metadata: {},
        connection: {},
        security: {},
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = loader.validate(invalidResource);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid resource type: invalid-type');
    });

    it('should validate SSH host specific fields', () => {
      const sshResource = {
        id: 'ssh-resource',
        name: 'SSH Resource',
        type: ResourceType.SSH_HOST,
        enabled: true,
        metadata: {},
        connection: {}, // Missing host
        security: {},
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = loader.validate(sshResource);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('SSH host requires connection.host');
    });

    it('should validate HTTP API specific fields', () => {
      const apiResource = {
        id: 'api-resource',
        name: 'API Resource',
        type: ResourceType.HTTP_API,
        enabled: true,
        metadata: {},
        connection: {}, // Missing url
        security: {},
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = loader.validate(apiResource);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('HTTP API requires connection.url');
    });
  });

  describe('Refresh Functionality', () => {
    it('should refresh resources from configured path', async () => {
      const config: LoaderConfig = {
        path: '/test/resources',
      };

      // Mock initial stat call for directory
      mockFs.stat.mockResolvedValue({ isDirectory: () => true, isFile: () => false } as any);

      // Set up initial load
      mockFs.readdir.mockResolvedValue([
        { name: 'resource.json', isDirectory: () => false, isFile: () => true } as any,
      ]);
      mockFs.readFile.mockResolvedValue(
        JSON.stringify({
          id: 'resource-1',
          name: 'Test Resource',
          type: 'ssh-host',
          enabled: true,
        })
      );

      await loader.load(config);
      await loader.refresh();

      expect(mockFs.readdir).toHaveBeenCalledTimes(2);
    });
  });
});

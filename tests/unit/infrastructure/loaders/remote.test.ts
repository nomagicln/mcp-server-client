import { RemoteResourceLoader } from '@infrastructure/loaders/remote';
import { ResourceType } from '@core/models/resource';
import { MockAgent, setGlobalDispatcher } from 'undici';

describe('RemoteResourceLoader', () => {
  let loader: RemoteResourceLoader;
  let mockAgent: MockAgent;

  beforeEach(() => {
    loader = new RemoteResourceLoader();
    mockAgent = new MockAgent();
    setGlobalDispatcher(mockAgent);
  });

  afterEach(async () => {
    await mockAgent.close();
  });

  describe('Basic Properties', () => {
    it('should have correct source identifier', () => {
      expect(loader.source).toBe('remote');
    });

    it('should support all resource types', () => {
      expect(loader.supportedTypes).toEqual([
        ResourceType.SSH_HOST,
        ResourceType.HTTP_API,
        ResourceType.DATABASE,
        ResourceType.KUBERNETES,
      ]);
    });
  });

  describe('Resource Loading', () => {
    it('should load resources from remote URL with JSON response', async () => {
      const mockPool = mockAgent.get('https://api.example.com');
      const mockResource = {
        id: 'test-resource',
        name: 'Test Resource',
        type: ResourceType.SSH_HOST,
        enabled: true,
        metadata: {},
        connection: { host: 'test.example.com' },
        security: {},
        tags: [],
      };

      mockPool
        .intercept({
          path: '/resources',
          method: 'GET',
        })
        .reply(200, [mockResource], {
          headers: { 'content-type': 'application/json' },
        });

      const resources = await loader.load({
        url: 'https://api.example.com/resources',
      });

      expect(resources).toHaveLength(1);
      expect(resources[0]?.id).toBe('test-resource');
      expect(resources[0]?.name).toBe('Test Resource');
      expect(resources[0]?.type).toBe(ResourceType.SSH_HOST);
    });

    it('should load resources from remote URL with YAML response', async () => {
      const mockPool = mockAgent.get('https://api.example.com');
      const yamlContent = `
- id: yaml-resource
  name: YAML Resource
  type: http-api
  enabled: true
  metadata: {}
  connection:
    url: https://api.test.com
  security: {}
  tags: []
`;

      mockPool
        .intercept({
          path: '/resources.yaml',
          method: 'GET',
        })
        .reply(200, yamlContent, {
          headers: { 'content-type': 'application/yaml' },
        });

      const resources = await loader.load({
        url: 'https://api.example.com/resources.yaml',
        format: 'yaml',
      });

      expect(resources).toHaveLength(1);
      expect(resources[0]?.id).toBe('yaml-resource');
      expect(resources[0]?.type).toBe(ResourceType.HTTP_API);
    });

    it('should throw error when URL is not provided', async () => {
      await expect(loader.load({})).rejects.toThrow('URL is required for remote resource loader');
    });

    it('should handle network errors gracefully', async () => {
      const mockPool = mockAgent.get('https://api.example.com');

      mockPool
        .intercept({
          path: '/resources',
          method: 'GET',
        })
        .replyWithError(new Error('Network error'));

      await expect(
        loader.load({
          url: 'https://api.example.com/resources',
        })
      ).rejects.toThrow('Failed to fetch resources from https://api.example.com/resources');
    });

    it('should handle invalid JSON responses', async () => {
      const mockPool = mockAgent.get('https://api.example.com');

      mockPool
        .intercept({
          path: '/resources',
          method: 'GET',
        })
        .reply(200, 'invalid json', {
          headers: { 'content-type': 'application/json' },
        });

      await expect(
        loader.load({
          url: 'https://api.example.com/resources',
          retryConfig: {
            maxRetries: 0, // Disable retries for this test
            baseDelay: 100,
            maxDelay: 1000,
            exponentialBase: 2,
          },
        })
      ).rejects.toThrow('Failed to parse response from https://api.example.com/resources');
    });
  });

  describe('Authentication Methods', () => {
    it('should support Basic Auth authentication', async () => {
      const mockPool = mockAgent.get('https://api.example.com');
      const mockResource = {
        id: 'auth-resource',
        name: 'Auth Resource',
        type: ResourceType.SSH_HOST,
        enabled: true,
        metadata: {},
        connection: {},
        security: {},
        tags: [],
      };

      mockPool
        .intercept({
          path: '/resources',
          method: 'GET',
          headers: {
            authorization: 'Basic dXNlcjpwYXNz', // base64 of 'user:pass'
          },
        })
        .reply(200, [mockResource]);

      const resources = await loader.load({
        url: 'https://api.example.com/resources',
        authentication: {
          type: 'basic',
          credentials: {
            username: 'user',
            password: 'pass',
          },
        },
      });

      expect(resources).toHaveLength(1);
      expect(resources[0]?.id).toBe('auth-resource');
    });

    it('should support Bearer Token authentication', async () => {
      const mockPool = mockAgent.get('https://api.example.com');
      const mockResource = {
        id: 'token-resource',
        name: 'Token Resource',
        type: ResourceType.HTTP_API,
        enabled: true,
        metadata: {},
        connection: {},
        security: {},
        tags: [],
      };

      mockPool
        .intercept({
          path: '/resources',
          method: 'GET',
          headers: {
            authorization: 'Bearer secret-token',
          },
        })
        .reply(200, [mockResource]);

      const resources = await loader.load({
        url: 'https://api.example.com/resources',
        authentication: {
          type: 'bearer',
          credentials: {
            token: 'secret-token',
          },
        },
      });

      expect(resources).toHaveLength(1);
      expect(resources[0]?.id).toBe('token-resource');
    });

    it('should support API Key authentication in header', async () => {
      const mockPool = mockAgent.get('https://api.example.com');
      const mockResource = {
        id: 'apikey-resource',
        name: 'API Key Resource',
        type: ResourceType.DATABASE,
        enabled: true,
        metadata: {},
        connection: {},
        security: {},
        tags: [],
      };

      mockPool
        .intercept({
          path: '/resources',
          method: 'GET',
          headers: {
            'x-api-key': 'api-key-123',
          },
        })
        .reply(200, [mockResource]);

      const resources = await loader.load({
        url: 'https://api.example.com/resources',
        authentication: {
          type: 'apikey',
          credentials: {
            key: 'api-key-123',
          },
          headers: {
            'X-API-Key': 'api-key-123',
          },
        },
      });

      expect(resources).toHaveLength(1);
      expect(resources[0]?.id).toBe('apikey-resource');
    });

    it('should support custom headers', async () => {
      const mockPool = mockAgent.get('https://api.example.com');
      const mockResource = {
        id: 'custom-header-resource',
        name: 'Custom Header Resource',
        type: ResourceType.KUBERNETES,
        enabled: true,
        metadata: {},
        connection: {},
        security: {},
        tags: [],
      };

      mockPool
        .intercept({
          path: '/resources',
          method: 'GET',
          headers: {
            'x-custom-header': 'custom-value',
            'x-tenant-id': 'tenant-123',
          },
        })
        .reply(200, [mockResource]);

      const resources = await loader.load({
        url: 'https://api.example.com/resources',
        authentication: {
          type: 'apikey',
          credentials: {},
          headers: {
            'X-Custom-Header': 'custom-value',
            'X-Tenant-ID': 'tenant-123',
          },
        },
      });

      expect(resources).toHaveLength(1);
      expect(resources[0]?.id).toBe('custom-header-resource');
    });
  });

  describe('Caching Mechanism', () => {
    beforeEach(() => {
      // Reset any existing cache
      loader.clearCache();
    });

    it('should cache responses with configurable TTL', async () => {
      const mockPool = mockAgent.get('https://api.example.com');
      const mockResource = {
        id: 'cached-resource',
        name: 'Cached Resource',
        type: ResourceType.SSH_HOST,
        enabled: true,
        metadata: {},
        connection: {},
        security: {},
        tags: [],
      };

      // First request
      mockPool
        .intercept({
          path: '/resources',
          method: 'GET',
        })
        .reply(200, [mockResource]);

      const resources1 = await loader.load({
        url: 'https://api.example.com/resources',
        caching: {
          enabled: true,
          ttl: 5000, // 5 seconds
        },
      });

      // Second request should use cache (no network call)
      const resources2 = await loader.load({
        url: 'https://api.example.com/resources',
        caching: {
          enabled: true,
          ttl: 5000,
        },
      });

      expect(resources1).toEqual(resources2);
      expect(resources1).toHaveLength(1);
      expect(resources1[0]?.id).toBe('cached-resource');
    });

    it('should respect cache TTL and refetch after expiration', async () => {
      const mockPool = mockAgent.get('https://api.example.com');
      const mockResource1 = {
        id: 'resource-v1',
        name: 'Resource V1',
        type: ResourceType.SSH_HOST,
        enabled: true,
        metadata: {},
        connection: {},
        security: {},
        tags: [],
      };
      const mockResource2 = {
        id: 'resource-v2',
        name: 'Resource V2',
        type: ResourceType.SSH_HOST,
        enabled: true,
        metadata: {},
        connection: {},
        security: {},
        tags: [],
      };

      // First request
      mockPool
        .intercept({
          path: '/resources',
          method: 'GET',
        })
        .reply(200, [mockResource1]);

      const resources1 = await loader.load({
        url: 'https://api.example.com/resources',
        caching: {
          enabled: true,
          ttl: 100, // 100ms
        },
      });

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Second request after cache expiration
      mockPool
        .intercept({
          path: '/resources',
          method: 'GET',
        })
        .reply(200, [mockResource2]);

      const resources2 = await loader.load({
        url: 'https://api.example.com/resources',
        caching: {
          enabled: true,
          ttl: 100,
        },
      });

      expect(resources1[0]?.id).toBe('resource-v1');
      expect(resources2[0]?.id).toBe('resource-v2');
    });

    it('should bypass cache when caching is disabled', async () => {
      const mockPool = mockAgent.get('https://api.example.com');
      const mockResource1 = {
        id: 'resource-no-cache-1',
        name: 'Resource No Cache 1',
        type: ResourceType.SSH_HOST,
        enabled: true,
        metadata: {},
        connection: {},
        security: {},
        tags: [],
      };
      const mockResource2 = {
        id: 'resource-no-cache-2',
        name: 'Resource No Cache 2',
        type: ResourceType.SSH_HOST,
        enabled: true,
        metadata: {},
        connection: {},
        security: {},
        tags: [],
      };

      // First request
      mockPool
        .intercept({
          path: '/resources',
          method: 'GET',
        })
        .reply(200, [mockResource1]);

      const resources1 = await loader.load({
        url: 'https://api.example.com/resources',
        caching: {
          enabled: false,
          ttl: 5000,
        },
      });

      // Second request should make new network call
      mockPool
        .intercept({
          path: '/resources',
          method: 'GET',
        })
        .reply(200, [mockResource2]);

      const resources2 = await loader.load({
        url: 'https://api.example.com/resources',
        caching: {
          enabled: false,
          ttl: 5000,
        },
      });

      expect(resources1[0]?.id).toBe('resource-no-cache-1');
      expect(resources2[0]?.id).toBe('resource-no-cache-2');
    });
  });

  describe('Retry Logic with Exponential Backoff', () => {
    it('should retry failed requests with exponential backoff', async () => {
      const mockPool = mockAgent.get('https://api.example.com');
      const mockResource = {
        id: 'retry-resource',
        name: 'Retry Resource',
        type: ResourceType.SSH_HOST,
        enabled: true,
        metadata: {},
        connection: {},
        security: {},
        tags: [],
      };

      // First two requests fail
      mockPool
        .intercept({
          path: '/resources',
          method: 'GET',
        })
        .reply(500, 'Internal Server Error');

      mockPool
        .intercept({
          path: '/resources',
          method: 'GET',
        })
        .reply(500, 'Internal Server Error');

      // Third request succeeds
      mockPool
        .intercept({
          path: '/resources',
          method: 'GET',
        })
        .reply(200, [mockResource]);

      const startTime = Date.now();
      const resources = await loader.load({
        url: 'https://api.example.com/resources',
        retryConfig: {
          maxRetries: 3,
          baseDelay: 100,
          maxDelay: 1000,
          exponentialBase: 2,
        },
      });
      const endTime = Date.now();

      expect(resources).toHaveLength(1);
      expect(resources[0]?.id).toBe('retry-resource');
      // Should have taken at least 100ms (first retry) + 200ms (second retry)
      expect(endTime - startTime).toBeGreaterThan(250);
    });

    it('should fail after max retries exceeded', async () => {
      const mockPool = mockAgent.get('https://api.example.com');

      // All requests fail
      for (let i = 0; i < 4; i++) {
        mockPool
          .intercept({
            path: '/resources',
            method: 'GET',
          })
          .reply(500, 'Internal Server Error');
      }

      await expect(
        loader.load({
          url: 'https://api.example.com/resources',
          retryConfig: {
            maxRetries: 3,
            baseDelay: 50,
            maxDelay: 1000,
            exponentialBase: 2,
          },
        })
      ).rejects.toThrow(
        'Failed to fetch resources from https://api.example.com/resources after 3 retries'
      );
    });

    it('should respect max delay in exponential backoff', async () => {
      const mockPool = mockAgent.get('https://api.example.com');
      const mockResource = {
        id: 'max-delay-resource',
        name: 'Max Delay Resource',
        type: ResourceType.SSH_HOST,
        enabled: true,
        metadata: {},
        connection: {},
        security: {},
        tags: [],
      };

      // First request fails
      mockPool
        .intercept({
          path: '/resources',
          method: 'GET',
        })
        .reply(500, 'Internal Server Error');

      // Second request succeeds
      mockPool
        .intercept({
          path: '/resources',
          method: 'GET',
        })
        .reply(200, [mockResource]);

      const startTime = Date.now();
      const resources = await loader.load({
        url: 'https://api.example.com/resources',
        retryConfig: {
          maxRetries: 2,
          baseDelay: 1000,
          maxDelay: 200, // Max delay is less than base delay
          exponentialBase: 2,
        },
      });
      const endTime = Date.now();

      expect(resources).toHaveLength(1);
      // Should respect maxDelay of 200ms instead of baseDelay of 1000ms
      expect(endTime - startTime).toBeLessThan(500);
      expect(endTime - startTime).toBeGreaterThan(150);
    });

    it('should handle different HTTP error codes appropriately', async () => {
      const mockPool = mockAgent.get('https://api.example.com');

      // 404 should not be retried
      mockPool
        .intercept({
          path: '/resources',
          method: 'GET',
        })
        .reply(404, 'Not Found');

      await expect(
        loader.load({
          url: 'https://api.example.com/resources',
          retryConfig: {
            maxRetries: 3,
            baseDelay: 100,
            maxDelay: 1000,
            exponentialBase: 2,
          },
        })
      ).rejects.toThrow('Response status code 404');
    });
  });

  describe('URL Validation and Security Checks', () => {
    it('should validate URL format', async () => {
      await expect(
        loader.load({
          url: 'invalid-url',
        })
      ).rejects.toThrow('Invalid URL format: invalid-url');
    });

    it('should reject non-HTTPS URLs in production mode', async () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';

      try {
        await expect(
          loader.load({
            url: 'http://api.example.com/resources',
          })
        ).rejects.toThrow('HTTPS is required in production mode');
      } finally {
        process.env['NODE_ENV'] = originalEnv;
      }
    });

    it('should allow HTTP URLs in development mode', async () => {
      const originalEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'development';

      try {
        const mockPool = mockAgent.get('http://api.example.com');
        mockPool
          .intercept({
            path: '/resources',
            method: 'GET',
          })
          .reply(200, []);

        const resources = await loader.load({
          url: 'http://api.example.com/resources',
        });

        expect(resources).toEqual([]);
      } finally {
        process.env['NODE_ENV'] = originalEnv;
      }
    });

    it('should reject URLs with suspicious patterns', async () => {
      const suspiciousUrls = [
        'https://localhost/resources',
        'https://127.0.0.1/resources',
        'https://10.0.0.1/resources',
        'https://192.168.1.1/resources',
      ];

      for (const url of suspiciousUrls) {
        await expect(
          loader.load({
            url,
            securityChecks: {
              allowLocalhost: false,
              allowPrivateIPs: false,
            },
          })
        ).rejects.toThrow(`URL not allowed by security policy: ${url}`);
      }
    });

    it('should allow localhost and private IPs when security checks are disabled', async () => {
      const mockPool = mockAgent.get('https://localhost');
      mockPool
        .intercept({
          path: '/resources',
          method: 'GET',
        })
        .reply(200, []);

      const resources = await loader.load({
        url: 'https://localhost/resources',
        securityChecks: {
          allowLocalhost: true,
          allowPrivateIPs: true,
        },
      });

      expect(resources).toEqual([]);
    });

    it('should validate response size limits', async () => {
      const mockPool = mockAgent.get('https://api.example.com');
      const largeResponse = 'x'.repeat(10 * 1024 * 1024); // 10MB

      mockPool
        .intercept({
          path: '/resources',
          method: 'GET',
        })
        .reply(200, largeResponse, {
          headers: { 'content-length': (10 * 1024 * 1024).toString() },
        });

      await expect(
        loader.load({
          url: 'https://api.example.com/resources',
          securityChecks: {
            maxResponseSize: 1024 * 1024, // 1MB limit
          },
          retryConfig: {
            maxRetries: 0, // Disable retries for this test
            baseDelay: 100,
            maxDelay: 1000,
            exponentialBase: 2,
          },
        })
      ).rejects.toThrow('Response size exceeds maximum allowed size');
    });
  });

  describe('Resource Validation', () => {
    it('should validate loaded resources', () => {
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

    it('should detect invalid resources', () => {
      const invalidResource = {
        id: '',
        name: '',
        type: 'invalid-type' as ResourceType,
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
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('Missing required field: id');
      expect(result.errors).toContain('Missing required field: name');
    });
  });

  describe('Watch and Refresh', () => {
    it('should support watch functionality (no-op for remote loader)', () => {
      const callback = jest.fn();
      expect(() => loader.watch(callback)).not.toThrow();
    });

    it('should support refresh functionality', async () => {
      const mockPool = mockAgent.get('https://api.example.com');

      // Mock for initial load
      mockPool
        .intercept({
          path: '/resources',
          method: 'GET',
        })
        .reply(200, []);

      // Mock for refresh call
      mockPool
        .intercept({
          path: '/resources',
          method: 'GET',
        })
        .reply(200, []);

      // First load to set current URL
      await loader.load({
        url: 'https://api.example.com/resources',
      });

      // Refresh should work
      await expect(loader.refresh()).resolves.not.toThrow();
    });

    it('should throw error when refresh is called without prior load', async () => {
      await expect(loader.refresh()).rejects.toThrow(
        'No URL configured for refresh. Call load() first.'
      );
    });
  });
});

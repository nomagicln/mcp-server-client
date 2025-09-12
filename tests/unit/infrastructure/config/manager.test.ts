import { ConfigurationManager } from '@infrastructure/config/manager';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs module
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock path module
jest.mock('path');
const mockPath = path as jest.Mocked<typeof path>;

describe('ConfigurationManager', () => {
  let configManager: ConfigurationManager;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    configManager = new ConfigurationManager();
    originalEnv = { ...process.env };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('loadFromFile', () => {
    it('should load valid JSON configuration', async () => {
      const jsonConfig = {
        server: {
          host: 'localhost',
          port: 3000,
          transports: [{ type: 'stdio', enabled: true, options: {} }],
        },
        client: { defaultTransport: 'stdio', timeout: 5000, retries: 3 },
        resources: {
          loaders: [],
          registry: {
            autoRefresh: false,
            refreshInterval: 60000,
            maxResources: 1000,
            enableWatching: false,
          },
          validation: { strict: true, schemas: {} },
        },
        security: {
          authentication: { required: false, methods: [], timeout: 30000, maxRetries: 3 },
          authorization: { enabled: false, defaultPolicy: 'deny', roles: [], permissions: [] },
          encryption: {
            algorithm: 'aes-256-gcm',
            keySize: 256,
            keyDerivation: 'pbkdf2',
            saltLength: 32,
          },
          audit: {
            enabled: false,
            level: 'standard',
            events: [],
            retention: 30,
            destination: 'file',
            format: 'json',
          },
          policies: [],
        },
        monitoring: {
          enabled: false,
          metrics: { enabled: false, endpoint: '/metrics', interval: 60000, retention: 86400 },
          healthChecks: {
            enabled: false,
            endpoint: '/health',
            interval: 30000,
            timeout: 5000,
            dependencies: [],
          },
        },
        logging: {
          level: 'info',
          format: 'json',
          output: [{ type: 'console' }],
          correlation: {
            enabled: true,
            header: 'x-correlation-id',
            generator: 'uuid',
            propagate: true,
          },
          masking: {
            enabled: true,
            fields: ['password', 'token', 'key'],
            replacement: '***',
            showSecrets: false,
          },
        },
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(jsonConfig));
      mockPath.extname.mockReturnValue('.json');

      const result = await configManager.loadFromFile('/path/to/config.json');

      expect(result).toEqual(jsonConfig);
      expect(mockFs.readFile).toHaveBeenCalledWith('/path/to/config.json', 'utf-8');
    });

    it('should handle JSON with comments', async () => {
      const jsonWithComments = `{
        // Server configuration
        "server": {
          "host": "localhost", // Default host
          "port": 3000,
          "transports": [{ "type": "stdio", "enabled": true, "options": {} }]
        },
        /* Client configuration */
        "client": { "defaultTransport": "stdio", "timeout": 5000, "retries": 3 },
        "resources": { "loaders": [], "registry": { "autoRefresh": false, "refreshInterval": 60000, "maxResources": 1000, "enableWatching": false }, "validation": { "strict": true, "schemas": {} } },
        "security": { "authentication": { "required": false, "methods": [], "timeout": 30000, "maxRetries": 3 }, "authorization": { "enabled": false, "defaultPolicy": "deny", "roles": [], "permissions": [] }, "encryption": { "algorithm": "aes-256-gcm", "keySize": 256, "keyDerivation": "pbkdf2", "saltLength": 32 }, "audit": { "enabled": false, "level": "standard", "events": [], "retention": 30, "destination": "file", "format": "json" }, "policies": [] },
        "monitoring": { "enabled": false, "metrics": { "enabled": false, "endpoint": "/metrics", "interval": 60000, "retention": 86400 }, "healthChecks": { "enabled": false, "endpoint": "/health", "interval": 30000, "timeout": 5000, "dependencies": [] } },
        "logging": { "level": "info", "format": "json", "output": [{ "type": "console" }], "correlation": { "enabled": true, "header": "x-correlation-id", "generator": "uuid", "propagate": true }, "masking": { "enabled": true, "fields": ["password", "token", "key"], "replacement": "***", "showSecrets": false } }
      }`;

      mockFs.readFile.mockResolvedValue(jsonWithComments);
      mockPath.extname.mockReturnValue('.json');

      const result = await configManager.loadFromFile('/path/to/config.json');

      expect(result.server.host).toBe('localhost');
      expect(result.server.port).toBe(3000);
    });

    it('should throw error for invalid JSON', async () => {
      const invalidJson = '{ "server": { "host": "localhost", "port": }';

      mockFs.readFile.mockResolvedValue(invalidJson);
      mockPath.extname.mockReturnValue('.json');

      await expect(configManager.loadFromFile('/path/to/config.json')).rejects.toThrow(
        'Invalid JSON configuration'
      );
    });

    it('should throw error when configuration file does not exist', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      await expect(configManager.loadFromFile('/path/to/nonexistent.json')).rejects.toThrow(
        'Configuration file not found'
      );
    });

    it('should throw error for unsupported file format', async () => {
      mockFs.readFile.mockResolvedValue('some content');
      mockPath.extname.mockReturnValue('.xml');

      await expect(configManager.loadFromFile('/path/to/config.xml')).rejects.toThrow(
        'Unsupported configuration format: .xml'
      );
    });
  });

  describe('injectEnvironmentVariables', () => {
    it('should inject environment variables with MCPSC_ prefix', async () => {
      process.env['MCPSC_SERVER_HOST'] = 'env-host';
      process.env['MCPSC_SERVER_PORT'] = '4000';
      process.env['MCPSC_CLIENT_TIMEOUT'] = '10000';

      const baseConfig = {
        server: {
          host: 'localhost',
          port: 3000,
          transports: [{ type: 'stdio', enabled: true, options: {} }],
        },
        client: { defaultTransport: 'stdio', timeout: 5000, retries: 3 },
        resources: {
          loaders: [],
          registry: {
            autoRefresh: false,
            refreshInterval: 60000,
            maxResources: 1000,
            enableWatching: false,
          },
          validation: { strict: true, schemas: {} },
        },
        security: {
          authentication: { required: false, methods: [], timeout: 30000, maxRetries: 3 },
          authorization: { enabled: false, defaultPolicy: 'deny', roles: [], permissions: [] },
          encryption: {
            algorithm: 'aes-256-gcm',
            keySize: 256,
            keyDerivation: 'pbkdf2',
            saltLength: 32,
          },
          audit: {
            enabled: false,
            level: 'standard',
            events: [],
            retention: 30,
            destination: 'file',
            format: 'json',
          },
          policies: [],
        },
        monitoring: {
          enabled: false,
          metrics: { enabled: false, endpoint: '/metrics', interval: 60000, retention: 86400 },
          healthChecks: {
            enabled: false,
            endpoint: '/health',
            interval: 30000,
            timeout: 5000,
            dependencies: [],
          },
        },
        logging: {
          level: 'info',
          format: 'json',
          output: [{ type: 'console' }],
          correlation: {
            enabled: true,
            header: 'x-correlation-id',
            generator: 'uuid',
            propagate: true,
          },
          masking: {
            enabled: true,
            fields: ['password', 'token', 'key'],
            replacement: '***',
            showSecrets: false,
          },
        },
      };

      const result = await configManager.injectEnvironmentVariables(baseConfig);

      expect(result.server.host).toBe('env-host');
      expect(result.server.port).toBe(4000);
      expect(result.client.timeout).toBe(10000);
    });

    it('should handle boolean environment variables', async () => {
      process.env['MCPSC_MONITORING_ENABLED'] = 'true';
      process.env['MCPSC_SECURITY_AUTHENTICATION_REQUIRED'] = 'false';

      const baseConfig = {
        server: {
          host: 'localhost',
          port: 3000,
          transports: [{ type: 'stdio', enabled: true, options: {} }],
        },
        client: { defaultTransport: 'stdio', timeout: 5000, retries: 3 },
        resources: {
          loaders: [],
          registry: {
            autoRefresh: false,
            refreshInterval: 60000,
            maxResources: 1000,
            enableWatching: false,
          },
          validation: { strict: true, schemas: {} },
        },
        security: {
          authentication: { required: true, methods: [], timeout: 30000, maxRetries: 3 },
          authorization: { enabled: false, defaultPolicy: 'deny', roles: [], permissions: [] },
          encryption: {
            algorithm: 'aes-256-gcm',
            keySize: 256,
            keyDerivation: 'pbkdf2',
            saltLength: 32,
          },
          audit: {
            enabled: false,
            level: 'standard',
            events: [],
            retention: 30,
            destination: 'file',
            format: 'json',
          },
          policies: [],
        },
        monitoring: {
          enabled: false,
          metrics: { enabled: false, endpoint: '/metrics', interval: 60000, retention: 86400 },
          healthChecks: {
            enabled: false,
            endpoint: '/health',
            interval: 30000,
            timeout: 5000,
            dependencies: [],
          },
        },
        logging: {
          level: 'info',
          format: 'json',
          output: [{ type: 'console' }],
          correlation: {
            enabled: true,
            header: 'x-correlation-id',
            generator: 'uuid',
            propagate: true,
          },
          masking: {
            enabled: true,
            fields: ['password', 'token', 'key'],
            replacement: '***',
            showSecrets: false,
          },
        },
      };

      const result = await configManager.injectEnvironmentVariables(baseConfig);

      expect(result.monitoring.enabled).toBe(true);
      expect(result.security.authentication.required).toBe(false);
    });

    it('should handle ${ENV_VAR} injection in string values', async () => {
      process.env['API_KEY'] = 'key456';

      const baseConfig = {
        server: {
          host: 'localhost',
          port: 3000,
          transports: [{ type: 'stdio', enabled: true, options: {} }],
        },
        client: { defaultTransport: 'stdio', timeout: 5000, retries: 3 },
        resources: {
          loaders: [
            {
              type: 'remote' as const,
              source: 'https://api.example.com/resources',
              enabled: true,
              options: {},
              authentication: {
                type: 'bearer',
                credentials: {
                  token: '${API_KEY}',
                },
              },
            },
          ],
          registry: {
            autoRefresh: false,
            refreshInterval: 60000,
            maxResources: 1000,
            enableWatching: false,
          },
          validation: { strict: true, schemas: {} },
        },
        security: {
          authentication: { required: false, methods: [], timeout: 30000, maxRetries: 3 },
          authorization: { enabled: false, defaultPolicy: 'deny', roles: [], permissions: [] },
          encryption: {
            algorithm: 'aes-256-gcm',
            keySize: 256,
            keyDerivation: 'pbkdf2',
            saltLength: 32,
          },
          audit: {
            enabled: false,
            level: 'standard',
            events: [],
            retention: 30,
            destination: 'file',
            format: 'json',
          },
          policies: [],
        },
        monitoring: {
          enabled: false,
          metrics: { enabled: false, endpoint: '/metrics', interval: 60000, retention: 86400 },
          healthChecks: {
            enabled: false,
            endpoint: '/health',
            interval: 30000,
            timeout: 5000,
            dependencies: [],
          },
        },
        logging: {
          level: 'info',
          format: 'json',
          output: [{ type: 'console' }],
          correlation: {
            enabled: true,
            header: 'x-correlation-id',
            generator: 'uuid',
            propagate: true,
          },
          masking: {
            enabled: true,
            fields: ['password', 'token', 'key'],
            replacement: '***',
            showSecrets: false,
          },
        },
      };

      const result = await configManager.injectEnvironmentVariables(baseConfig);

      expect(result.resources.loaders[0].authentication?.credentials.token).toBe('key456');
    });

    it('should handle missing environment variables gracefully', async () => {
      const baseConfig = {
        server: {
          host: '${MISSING_VAR}',
          port: 3000,
          transports: [{ type: 'stdio', enabled: true, options: {} }],
        },
        client: { defaultTransport: 'stdio', timeout: 5000, retries: 3 },
        resources: {
          loaders: [],
          registry: {
            autoRefresh: false,
            refreshInterval: 60000,
            maxResources: 1000,
            enableWatching: false,
          },
          validation: { strict: true, schemas: {} },
        },
        security: {
          authentication: { required: false, methods: [], timeout: 30000, maxRetries: 3 },
          authorization: { enabled: false, defaultPolicy: 'deny', roles: [], permissions: [] },
          encryption: {
            algorithm: 'aes-256-gcm',
            keySize: 256,
            keyDerivation: 'pbkdf2',
            saltLength: 32,
          },
          audit: {
            enabled: false,
            level: 'standard',
            events: [],
            retention: 30,
            destination: 'file',
            format: 'json',
          },
          policies: [],
        },
        monitoring: {
          enabled: false,
          metrics: { enabled: false, endpoint: '/metrics', interval: 60000, retention: 86400 },
          healthChecks: {
            enabled: false,
            endpoint: '/health',
            interval: 30000,
            timeout: 5000,
            dependencies: [],
          },
        },
        logging: {
          level: 'info',
          format: 'json',
          output: [{ type: 'console' }],
          correlation: {
            enabled: true,
            header: 'x-correlation-id',
            generator: 'uuid',
            propagate: true,
          },
          masking: {
            enabled: true,
            fields: ['password', 'token', 'key'],
            replacement: '***',
            showSecrets: false,
          },
        },
      };

      await expect(configManager.injectEnvironmentVariables(baseConfig)).rejects.toThrow(
        'Environment variable MISSING_VAR is not defined'
      );
    });
  });

  describe('mergeConfigurations', () => {
    it('should merge configurations with priority handling', async () => {
      const baseConfig = {
        server: {
          host: 'localhost',
          port: 3000,
          transports: [{ type: 'stdio', enabled: true, options: {} }],
        },
        client: { defaultTransport: 'stdio', timeout: 5000, retries: 3 },
      };

      const override = {
        server: {
          host: 'override-host',
          port: 4000,
        },
        client: {
          timeout: 8000,
        },
      };

      const result = await configManager.mergeConfigurations(baseConfig, override);

      expect(result.server.host).toBe('override-host');
      expect(result.server.port).toBe(4000);
      expect(result.client.timeout).toBe(8000);
      expect(result.client.retries).toBe(3); // Should keep base value
    });

    it('should handle deep merging of nested objects', async () => {
      const baseConfig = {
        server: {
          host: 'localhost',
          port: 3000,
          tls: {
            cert: 'base-cert.pem',
            key: 'base-key.pem',
          },
        },
      };

      const override = {
        server: {
          tls: {
            cert: 'override-cert.pem',
          },
        },
      };

      const result = await configManager.mergeConfigurations(baseConfig, override);

      expect(result.server.tls.cert).toBe('override-cert.pem');
      expect(result.server.tls.key).toBe('base-key.pem'); // Should keep base value
      expect(result.server.host).toBe('localhost'); // Should keep base value
    });
  });

  describe('getDefaultConfig', () => {
    it('should return default configuration', async () => {
      const result = await configManager.getDefaultConfig();

      expect(result.server.host).toBe('localhost');
      expect(result.server.port).toBe(3000);
      expect(result.client.timeout).toBe(5000);
      expect(result.logging.level).toBe('info');
    });
  });

  describe('loadConfiguration', () => {
    it('should load, validate, and merge configuration from multiple sources', async () => {
      // Setup environment variables
      process.env['MCPSC_SERVER_HOST'] = 'env-host';
      process.env['MCPSC_MONITORING_ENABLED'] = 'true';

      // Mock file configuration
      const fileConfig = {
        server: {
          host: 'file-host',
          port: 4000,
          transports: [{ type: 'sse', enabled: true, options: {} }],
        },
        client: { defaultTransport: 'sse', timeout: 8000, retries: 5 },
        resources: {
          loaders: [],
          registry: {
            autoRefresh: true,
            refreshInterval: 30000,
            maxResources: 500,
            enableWatching: true,
          },
          validation: { strict: false, schemas: {} },
        },
        security: {
          authentication: { required: true, methods: ['ssh-key'], timeout: 60000, maxRetries: 5 },
          authorization: { enabled: true, defaultPolicy: 'allow', roles: [], permissions: [] },
          encryption: {
            algorithm: 'aes-256-gcm',
            keySize: 256,
            keyDerivation: 'pbkdf2',
            saltLength: 32,
          },
          audit: {
            enabled: true,
            level: 'detailed',
            events: ['auth', 'exec'],
            retention: 90,
            destination: 'file',
            format: 'json',
          },
          policies: [],
        },
        monitoring: {
          enabled: false,
          metrics: { enabled: true, endpoint: '/metrics', interval: 30000, retention: 172800 },
          healthChecks: {
            enabled: true,
            endpoint: '/health',
            interval: 15000,
            timeout: 3000,
            dependencies: [],
          },
        },
        logging: {
          level: 'debug',
          format: 'pretty',
          output: [{ type: 'file', target: 'app.log' }],
          correlation: {
            enabled: true,
            header: 'x-correlation-id',
            generator: 'uuid',
            propagate: true,
          },
          masking: { enabled: false, fields: [], replacement: '***', showSecrets: true },
        },
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(fileConfig));
      mockPath.extname.mockReturnValue('.json');

      // CLI overrides
      const cliOverrides = {
        server: {
          port: 6000,
        },
        logging: {
          level: 'error',
        },
      };

      const result = await configManager.loadConfiguration('/path/to/config.json', cliOverrides);

      // Verify priority order
      expect(result.server.host).toBe('env-host'); // Environment override
      expect(result.server.port).toBe(6000); // CLI override
      expect(result.client.timeout).toBe(8000); // File config
      expect(result.logging.level).toBe('error'); // CLI override
      expect(result.monitoring.enabled).toBe(true); // Environment override
      expect(result.client.retries).toBe(5); // File config
    });
  });
});

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { Config } from '@oclif/core';
import Init from '@cli/commands/init';
import Validate from '@cli/commands/validate';
import { ConfigurationManager } from '@infrastructure/config/manager';

describe('CLI Commands Integration Tests', () => {
  let oclifConfig: Config;
  let tempDir: string;

  beforeEach(async () => {
    oclifConfig = new Config({ root: process.cwd() });
    await oclifConfig.load();

    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcpsc-test-'));
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('mcpsc init command', () => {
    it('should generate default configuration file', async () => {
      const outputPath = path.join(tempDir, 'mcpsc.json');
      const command = new Init(['--output', outputPath], oclifConfig);

      // Mock console methods to capture output
      const logSpy = jest.spyOn(command, 'log').mockImplementation();

      await command.run();

      // Verify file was created
      const fileExists = await fs
        .access(outputPath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);

      // Verify file content is valid JSON
      const content = await fs.readFile(outputPath, 'utf-8');
      const parsedConfig = JSON.parse(content);

      // Verify basic structure
      expect(parsedConfig).toHaveProperty('server');
      expect(parsedConfig).toHaveProperty('client');
      expect(parsedConfig).toHaveProperty('resources');
      expect(parsedConfig).toHaveProperty('security');
      expect(parsedConfig).toHaveProperty('monitoring');
      expect(parsedConfig).toHaveProperty('logging');

      logSpy.mockRestore();
    });

    it('should generate configuration file with force flag', async () => {
      const outputPath = path.join(tempDir, 'mcpsc.json');

      // Create existing file
      await fs.writeFile(outputPath, '{"existing": true}');

      const command = new Init(['--output', outputPath, '--force'], oclifConfig);
      const logSpy = jest.spyOn(command, 'log').mockImplementation();

      await command.run();

      // Verify file was overwritten
      const content = await fs.readFile(outputPath, 'utf-8');
      const parsedConfig = JSON.parse(content);

      expect(parsedConfig).not.toHaveProperty('existing');
      expect(parsedConfig).toHaveProperty('server');

      logSpy.mockRestore();
    });

    it('should not overwrite existing file without force flag', async () => {
      const outputPath = path.join(tempDir, 'mcpsc.json');

      // Create existing file
      await fs.writeFile(outputPath, '{"existing": true}');

      const command = new Init(['--output', outputPath], oclifConfig);
      const logSpy = jest.spyOn(command, 'log').mockImplementation();
      const errorSpy = jest.spyOn(command, 'error').mockImplementation(() => {
        throw new Error('File exists');
      });

      await expect(command.run()).rejects.toThrow('File exists');

      // Verify original file is unchanged
      const content = await fs.readFile(outputPath, 'utf-8');
      const parsedConfig = JSON.parse(content);

      expect(parsedConfig).toHaveProperty('existing', true);

      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should output JSON format when --json flag is used', async () => {
      const outputPath = path.join(tempDir, 'mcpsc.json');
      const command = new Init(['--output', outputPath, '--json'], oclifConfig);

      const logSpy = jest.spyOn(command, 'log').mockImplementation();

      await command.run();

      // Verify JSON output was logged
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "init"'));

      logSpy.mockRestore();
    });

    it('should create configuration file in different formats', async () => {
      const formats = [
        { ext: '.json', flag: '--format=json' },
        { ext: '.yaml', flag: '--format=yaml' },
        { ext: '.yml', flag: '--format=yml' },
      ];

      for (const format of formats) {
        const outputPath = path.join(tempDir, `mcpsc${format.ext}`);
        const command = new Init(['--output', outputPath, format.flag], oclifConfig);

        const logSpy = jest.spyOn(command, 'log').mockImplementation();

        await command.run();

        // Verify file was created
        const fileExists = await fs
          .access(outputPath)
          .then(() => true)
          .catch(() => false);
        expect(fileExists).toBe(true);

        logSpy.mockRestore();
      }
    });

    it('should handle directory creation for nested output paths', async () => {
      const nestedDir = path.join(tempDir, 'config', 'nested');
      const outputPath = path.join(nestedDir, 'mcpsc.json');

      const command = new Init(['--output', outputPath], oclifConfig);
      const logSpy = jest.spyOn(command, 'log').mockImplementation();

      await command.run();

      // Verify file was created in nested directory
      const fileExists = await fs
        .access(outputPath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);

      logSpy.mockRestore();
    });
  });

  describe('mcpsc validate command', () => {
    let configManager: ConfigurationManager;

    beforeEach(() => {
      configManager = new ConfigurationManager();
    });

    it('should validate valid configuration file', async () => {
      // Create valid configuration file
      const configPath = path.join(tempDir, 'valid-config.json');
      const validConfig = await configManager.getDefaultConfig();
      await fs.writeFile(configPath, JSON.stringify(validConfig, null, 2));

      const command = new Validate(['--config', configPath], oclifConfig);
      const logSpy = jest.spyOn(command, 'log').mockImplementation();

      await command.run();

      // Verify success message was logged
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Configuration is valid'));

      logSpy.mockRestore();
    });

    it('should detect invalid configuration file', async () => {
      // Create invalid configuration file with invalid port type
      const configPath = path.join(tempDir, 'invalid-config.json');
      const invalidConfig = {
        server: {
          host: 'localhost',
          port: 'invalid-port', // This should be a number
          transports: [],
        },
      };
      await fs.writeFile(configPath, JSON.stringify(invalidConfig, null, 2));

      const command = new Validate(['--config', configPath], oclifConfig);
      const logSpy = jest.spyOn(command, 'log').mockImplementation();
      const errorSpy = jest.spyOn(command, 'error').mockImplementation(() => {
        throw new Error('Validation failed');
      });

      await expect(command.run()).rejects.toThrow('Validation failed');

      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should handle missing configuration file', async () => {
      const configPath = path.join(tempDir, 'nonexistent-config.json');

      const command = new Validate(['--config', configPath], oclifConfig);
      const logSpy = jest.spyOn(command, 'log').mockImplementation();
      const errorSpy = jest.spyOn(command, 'error').mockImplementation(() => {
        throw new Error('File not found');
      });

      await expect(command.run()).rejects.toThrow('File not found');

      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should validate YAML configuration file', async () => {
      // Create valid YAML configuration file
      const configPath = path.join(tempDir, 'valid-config.yaml');
      const validConfig = await configManager.getDefaultConfig();

      // Convert to YAML format (simplified)
      const yamlContent = `
server:
  host: ${validConfig.server.host}
  port: ${validConfig.server.port}
  transports:
    - type: stdio
      enabled: true
      options: {}
client:
  defaultTransport: stdio
  timeout: 5000
  retries: 3
resources:
  loaders: []
  registry:
    autoRefresh: false
    refreshInterval: 60000
    maxResources: 1000
    enableWatching: false
  validation:
    strict: true
    schemas: {}
security:
  authentication:
    required: false
    methods: []
    timeout: 30000
    maxRetries: 3
  authorization:
    enabled: false
    defaultPolicy: deny
    roles: []
    permissions: []
  encryption:
    algorithm: aes-256-gcm
    keySize: 256
    keyDerivation: pbkdf2
    saltLength: 32
  audit:
    enabled: false
    level: standard
    events: []
    retention: 30
    destination: file
    format: json
  policies: []
monitoring:
  enabled: false
  metrics:
    enabled: false
    endpoint: /metrics
    interval: 60000
    retention: 86400
  healthChecks:
    enabled: false
    endpoint: /health
    interval: 30000
    timeout: 5000
    dependencies: []
logging:
  level: info
  format: json
  output:
    - type: console
  correlation:
    enabled: true
    header: x-correlation-id
    generator: uuid
    propagate: true
  masking:
    enabled: true
    fields:
      - password
      - token
      - key
    replacement: "***"
    showSecrets: false
`;

      await fs.writeFile(configPath, yamlContent);

      const command = new Validate(['--config', configPath], oclifConfig);
      const logSpy = jest.spyOn(command, 'log').mockImplementation();

      await command.run();

      // Verify success message was logged
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Configuration is valid'));

      logSpy.mockRestore();
    });

    it('should output JSON format when --json flag is used', async () => {
      // Create valid configuration file
      const configPath = path.join(tempDir, 'valid-config.json');
      const validConfig = await configManager.getDefaultConfig();
      await fs.writeFile(configPath, JSON.stringify(validConfig, null, 2));

      const command = new Validate(['--config', configPath, '--json'], oclifConfig);
      const logSpy = jest.spyOn(command, 'log').mockImplementation();

      await command.run();

      // Verify JSON output was logged
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"command": "validate"'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"valid": true'));

      logSpy.mockRestore();
    });

    it('should provide detailed validation errors in JSON format', async () => {
      // Create invalid configuration file
      const configPath = path.join(tempDir, 'invalid-config.json');
      const invalidConfig = {
        server: {
          host: 'localhost',
          port: 'invalid-port', // This should be a number
          transports: [],
        },
      };
      await fs.writeFile(configPath, JSON.stringify(invalidConfig, null, 2));

      const command = new Validate(['--config', configPath, '--json'], oclifConfig);
      const logSpy = jest.spyOn(command, 'log').mockImplementation();

      try {
        await command.run();
      } catch (error) {
        // Expected to fail
      }

      // Verify JSON error output was logged
      const jsonCalls = logSpy.mock.calls.filter(
        (call: any[]) =>
          call[0] && (call[0].includes('"valid": false') || call[0].includes('"errors"'))
      );
      expect(jsonCalls.length).toBeGreaterThan(0);

      logSpy.mockRestore();
    });

    it('should use default config path when none specified', async () => {
      // Create default configuration file
      const defaultConfigPath = path.join(process.cwd(), 'mcpsc.json');
      const validConfig = await configManager.getDefaultConfig();

      // Only run this test if default config doesn't exist
      const defaultExists = await fs
        .access(defaultConfigPath)
        .then(() => true)
        .catch(() => false);

      if (!defaultExists) {
        await fs.writeFile(defaultConfigPath, JSON.stringify(validConfig, null, 2));

        try {
          const command = new Validate([], oclifConfig);
          const logSpy = jest.spyOn(command, 'log').mockImplementation();

          await command.run();

          // Verify success message was logged
          expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Configuration is valid'));

          logSpy.mockRestore();
        } finally {
          // Clean up default config file
          await fs.unlink(defaultConfigPath).catch(() => {});
        }
      }
    });
  });

  describe('ConfigurationManager Integration', () => {
    let configManager: ConfigurationManager;

    beforeEach(() => {
      configManager = new ConfigurationManager();
    });

    it('should integrate with ConfigurationManager for file generation', async () => {
      const outputPath = path.join(tempDir, 'generated-config.json');

      // Generate default config using ConfigurationManager
      const defaultConfig = await configManager.getDefaultConfig();

      // Verify the config structure matches expected format
      expect(defaultConfig).toHaveProperty('server');
      expect(defaultConfig).toHaveProperty('client');
      expect(defaultConfig).toHaveProperty('resources');
      expect(defaultConfig).toHaveProperty('security');
      expect(defaultConfig).toHaveProperty('monitoring');
      expect(defaultConfig).toHaveProperty('logging');

      // Write config to file
      await fs.writeFile(outputPath, JSON.stringify(defaultConfig, null, 2));

      // Validate the generated config
      const loadedConfig = await configManager.loadFromFile(outputPath);
      expect(loadedConfig).toEqual(defaultConfig);
    });

    it('should integrate with ConfigurationManager for validation', async () => {
      const configPath = path.join(tempDir, 'test-config.json');

      // Create a config using ConfigurationManager
      const defaultConfig = await configManager.getDefaultConfig();
      await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));

      // Validate using ConfigurationManager
      const validatedConfig = await configManager.validate(defaultConfig);
      expect(validatedConfig).toBeDefined();
      expect(validatedConfig.server.host).toBe('localhost');
      expect(validatedConfig.server.port).toBe(3000);
    });

    it('should handle environment variable injection during validation', async () => {
      const configPath = path.join(tempDir, 'env-config.json');

      // Set test environment variables
      process.env['MCPSC_SERVER_HOST'] = 'test-host';
      process.env['MCPSC_SERVER_PORT'] = '8080';

      try {
        const baseConfig = await configManager.getDefaultConfig();
        await fs.writeFile(configPath, JSON.stringify(baseConfig, null, 2));

        // Load config with environment variable injection
        const config = await configManager.loadConfiguration(configPath);

        expect(config.server.host).toBe('test-host');
        expect(config.server.port).toBe(8080);
      } finally {
        // Clean up environment variables
        delete process.env['MCPSC_SERVER_HOST'];
        delete process.env['MCPSC_SERVER_PORT'];
      }
    });
  });
});

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { MCPSCConfig } from '@core/models/config';
import { ConfigurationValidator } from '@infrastructure/config/validator';
import { MCPSCError, ErrorCategory, ErrorSeverity } from '@core/errors/base';
import { ErrorCodes } from '@core/errors/codes';

/**
 * Configuration loading options
 */
export interface ConfigLoadOptions {
  validateOnLoad?: boolean;
  allowPartial?: boolean;
  envPrefix?: string;
}

/**
 * Configuration manager class
 */
export class ConfigurationManager {
  private validator: ConfigurationValidator;
  private defaultConfig: MCPSCConfig | null = null;

  constructor() {
    this.validator = new ConfigurationValidator();
  }

  /**
   * Set validation timeout
   */
  setValidationTimeout(timeout: number): void {
    this.validator.setValidationTimeout(timeout);
  }

  /**
   * Load configuration from file
   */
  async loadFromFile(filePath: string, options: ConfigLoadOptions = {}): Promise<MCPSCConfig> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const extension = path.extname(filePath).toLowerCase();

      let config: any;

      switch (extension) {
        case '.json':
          config = this.parseJSON(content);
          break;
        case '.yaml':
        case '.yml':
          config = this.parseYAML(content);
          break;
        case '.js':
          config = await this.parseJavaScript(content, filePath);
          break;
        case '.ts':
          config = await this.parseTypeScript(content, filePath);
          break;
        default:
          throw new MCPSCError(
            ErrorCodes.CONFIG_UNSUPPORTED_FORMAT,
            `Unsupported configuration format: ${extension}`,
            ErrorCategory.CONFIGURATION,
            ErrorSeverity.ERROR,
            { filePath, extension }
          );
      }

      if (options.validateOnLoad !== false) {
        const validationResult = options.allowPartial
          ? await this.validator.validatePartial(config)
          : await this.validator.validateComplete(config);

        if (!validationResult.success) {
          throw this.createValidationError(validationResult.errors || []);
        }

        return validationResult.data;
      }

      return config;
    } catch (error) {
      if (error instanceof MCPSCError) {
        throw error;
      }

      if ((error as any).code === 'ENOENT' || (error as any).message?.includes('ENOENT')) {
        throw new MCPSCError(
          ErrorCodes.CONFIG_FILE_NOT_FOUND,
          'Configuration file not found',
          ErrorCategory.CONFIGURATION,
          ErrorSeverity.ERROR,
          { filePath }
        );
      }

      throw new MCPSCError(
        ErrorCodes.CONFIG_LOAD_ERROR,
        'Failed to load configuration file',
        ErrorCategory.CONFIGURATION,
        ErrorSeverity.ERROR,
        { filePath, originalError: error }
      );
    }
  }

  /**
   * Parse JSON configuration (with comments support)
   */
  private parseJSON(content: string): any {
    try {
      // Remove comments from JSON
      const cleanContent = content
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* */ comments
        .replace(/\/\/.*$/gm, ''); // Remove // comments

      return JSON.parse(cleanContent);
    } catch (error) {
      throw new MCPSCError(
        ErrorCodes.CONFIG_PARSE_ERROR,
        'Invalid JSON configuration',
        ErrorCategory.CONFIGURATION,
        ErrorSeverity.ERROR,
        { originalError: error }
      );
    }
  }

  /**
   * Parse YAML configuration
   */
  private parseYAML(content: string): any {
    try {
      return yaml.load(content);
    } catch (error) {
      throw new MCPSCError(
        ErrorCodes.CONFIG_PARSE_ERROR,
        'Invalid YAML configuration',
        ErrorCategory.CONFIGURATION,
        ErrorSeverity.ERROR,
        { originalError: error }
      );
    }
  }

  /**
   * Parse JavaScript configuration
   */
  private async parseJavaScript(content: string, filePath: string): Promise<any> {
    try {
      // Create a temporary module to evaluate the JavaScript
      const module = { exports: {} };
      const exports = module.exports;

      // Use Function constructor to evaluate the code safely
      const func = new Function('module', 'exports', 'require', content);
      func(module, exports, require);

      // Handle both CommonJS and ES module exports
      let config = module.exports;
      if (config && typeof config === 'object' && 'default' in config) {
        config = (config as any).default;
      }

      return config;
    } catch (error) {
      throw new MCPSCError(
        ErrorCodes.CONFIG_PARSE_ERROR,
        'Invalid JavaScript configuration',
        ErrorCategory.CONFIGURATION,
        ErrorSeverity.ERROR,
        { filePath, originalError: error }
      );
    }
  }

  /**
   * Parse TypeScript configuration
   */
  private async parseTypeScript(content: string, filePath: string): Promise<any> {
    try {
      // For now, we'll use a simple approach to handle TypeScript
      // In a production environment, you might want to use ts-node or compile the TypeScript

      // Remove TypeScript-specific syntax for basic parsing
      let jsContent = content
        .replace(/import\s+.*?from\s+['"][^'"]*['"];?\s*/g, '') // Remove imports
        .replace(/export\s+default\s+/g, 'module.exports = ') // Convert export default
        .replace(/:\s*\w+(\[\])?/g, '') // Remove type annotations
        .replace(/interface\s+\w+\s*{[^}]*}/g, '') // Remove interfaces
        .replace(/type\s+\w+\s*=\s*[^;]+;/g, ''); // Remove type aliases

      return await this.parseJavaScript(jsContent, filePath);
    } catch (error) {
      throw new MCPSCError(
        ErrorCodes.CONFIG_PARSE_ERROR,
        'Invalid TypeScript configuration',
        ErrorCategory.CONFIGURATION,
        ErrorSeverity.ERROR,
        { filePath, originalError: error }
      );
    }
  }

  /**
   * Inject environment variables into configuration
   */
  async injectEnvironmentVariables(config: any, prefix: string = 'MCPSC_'): Promise<any> {
    const result = JSON.parse(JSON.stringify(config)); // Deep clone

    // Process MCPSC_ prefixed environment variables
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix) && value !== undefined) {
        const configPath = key.substring(prefix.length).toLowerCase().split('_');
        this.setNestedValue(result, configPath, this.parseEnvironmentValue(value));
      }
    }

    // Process ${ENV_VAR} placeholders in string values
    this.processEnvironmentPlaceholders(result);

    return result;
  }

  /**
   * Set nested value in configuration object
   */
  private setNestedValue(obj: any, path: string[], value: any): void {
    let current = obj;

    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (!key) continue;

      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    const lastKey = path[path.length - 1];
    if (lastKey) {
      current[lastKey] = value;
    }
  }

  /**
   * Parse environment variable value to appropriate type
   */
  private parseEnvironmentValue(value: string): any {
    // Boolean values
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // Number values
    if (/^\d+$/.test(value)) return parseInt(value, 10);
    if (/^\d+\.\d+$/.test(value)) return parseFloat(value);

    // Array values (comma-separated)
    if (value.includes(',')) {
      return value.split(',').map(item => item.trim());
    }

    // String values
    return value;
  }

  /**
   * Process ${ENV_VAR} placeholders in configuration
   */
  private processEnvironmentPlaceholders(obj: any): void {
    if (typeof obj === 'string') {
      return;
    }

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        if (typeof obj[i] === 'string') {
          obj[i] = this.replaceEnvironmentPlaceholders(obj[i]);
        } else if (typeof obj[i] === 'object' && obj[i] !== null) {
          this.processEnvironmentPlaceholders(obj[i]);
        }
      }
      return;
    }

    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          if (typeof obj[key] === 'string') {
            obj[key] = this.replaceEnvironmentPlaceholders(obj[key]);
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            this.processEnvironmentPlaceholders(obj[key]);
          }
        }
      }
    }
  }

  /**
   * Replace ${ENV_VAR} placeholders with environment variable values
   */
  private replaceEnvironmentPlaceholders(value: string): string {
    return value.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
      const envValue = process.env[envVar];
      if (envValue === undefined) {
        throw new MCPSCError(
          ErrorCodes.CONFIG_ENV_VAR_NOT_FOUND,
          `Environment variable ${envVar} is not defined`,
          ErrorCategory.CONFIGURATION,
          ErrorSeverity.ERROR,
          { envVar, placeholder: match }
        );
      }
      return envValue;
    });
  }

  /**
   * Merge configurations with priority handling
   */
  async mergeConfigurations(base: any, override: any): Promise<any> {
    return this.deepMerge(base, override);
  }

  /**
   * Deep merge two configuration objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        if (source[key] === null || source[key] === undefined) {
          result[key] = source[key];
        } else if (Array.isArray(source[key])) {
          // Arrays are replaced, not merged
          result[key] = [...source[key]];
        } else if (typeof source[key] === 'object' && typeof result[key] === 'object') {
          // Recursively merge objects
          result[key] = this.deepMerge(result[key], source[key]);
        } else {
          // Primitive values are replaced
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * Get default configuration
   */
  async getDefaultConfig(): Promise<MCPSCConfig> {
    if (this.defaultConfig) {
      return JSON.parse(JSON.stringify(this.defaultConfig));
    }

    this.defaultConfig = {
      server: {
        host: 'localhost',
        port: 3000,
        transports: [
          {
            type: 'stdio',
            enabled: true,
            options: {},
          },
        ],
      },
      client: {
        defaultTransport: 'stdio',
        timeout: 5000,
        retries: 3,
      },
      resources: {
        loaders: [],
        registry: {
          autoRefresh: false,
          refreshInterval: 60000,
          maxResources: 1000,
          enableWatching: false,
        },
        validation: {
          strict: true,
          schemas: {},
        },
      },
      security: {
        authentication: {
          required: false,
          methods: [],
          timeout: 30000,
          maxRetries: 3,
        },
        authorization: {
          enabled: false,
          defaultPolicy: 'deny',
          roles: [],
          permissions: [],
        },
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
        metrics: {
          enabled: false,
          endpoint: '/metrics',
          interval: 60000,
          retention: 86400,
        },
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
        output: [
          {
            type: 'console',
          },
        ],
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

    return JSON.parse(JSON.stringify(this.defaultConfig));
  }

  /**
   * Validate configuration
   */
  async validate(config: any): Promise<MCPSCConfig> {
    const result = await this.validator.validateComplete(config);

    if (!result.success) {
      throw this.createValidationError(result.errors || []);
    }

    return result.data;
  }

  /**
   * Load complete configuration with all sources and priority handling
   */
  async loadConfiguration(
    configPath?: string,
    cliOverrides?: any,
    options: ConfigLoadOptions = {}
  ): Promise<MCPSCConfig> {
    // Start with default configuration
    let config = await this.getDefaultConfig();

    // Merge file configuration if provided
    if (configPath) {
      const fileConfig = await this.loadFromFile(configPath, {
        ...options,
        allowPartial: true,
        validateOnLoad: false,
      });
      config = await this.mergeConfigurations(config, fileConfig);
    }

    // Inject environment variables
    config = await this.injectEnvironmentVariables(config, options.envPrefix);

    // Merge CLI overrides if provided
    if (cliOverrides) {
      config = await this.mergeConfigurations(config, cliOverrides);
    }

    // Final validation
    return await this.validate(config);
  }

  /**
   * Create validation error from validation results
   */
  private createValidationError(errors: any[]): MCPSCError {
    const details = errors.map(err => `${err.path}: ${err.message}`).join(', ');

    return new MCPSCError(
      ErrorCodes.CONFIG_VALIDATION_ERROR,
      'Configuration validation failed',
      ErrorCategory.CONFIGURATION,
      ErrorSeverity.ERROR,
      { errors, details },
      ['Check the configuration structure and values', 'Refer to the schema documentation']
    );
  }
}

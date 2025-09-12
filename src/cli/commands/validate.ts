import { BaseCommand } from '@cli/base';
import { Flags } from '@oclif/core';
import { ConfigurationManager } from '@infrastructure/config/manager';
import { MCPSCError, ErrorCategory, ErrorSeverity } from '@core/errors/base';
import * as fs from 'fs/promises';

export default class Validate extends BaseCommand {
  static override description = 'Validate mcpsc configuration file';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --config ./config/mcpsc.yaml',
    '<%= config.bin %> <%= command.id %> --config ./mcpsc.json --strict',
    '<%= config.bin %> <%= command.id %> --config ./mcpsc.yaml --json',
  ];

  static override flags = {
    ...BaseCommand.baseFlags,
    strict: Flags.boolean({
      char: 's',
      description: 'enable strict validation mode',
      default: false,
    }),
    'show-warnings': Flags.boolean({
      char: 'w',
      description: 'show validation warnings',
      default: false,
    }),
  };

  private configManager: ConfigurationManager;

  constructor(argv: string[], config: any) {
    super(argv, config);
    this.configManager = new ConfigurationManager();
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Validate);

    const configPath = flags.config || './mcpsc.json';

    try {
      // Check if configuration file exists
      await this.checkFileExists(configPath);

      if (!flags.json) {
        this.logInfo(`Validating configuration file: ${configPath}`);

        if (flags.strict) {
          this.logInfo('Strict validation mode enabled');
        }
      }

      // Load and validate configuration
      const validationResult = await this.validateConfiguration(configPath, flags.strict);

      if (flags.json) {
        this.outputJson({
          command: 'validate',
          configPath,
          valid: validationResult.valid,
          errors: validationResult.errors || [],
          warnings: validationResult.warnings || [],
          summary: validationResult.summary,
        });
      } else {
        if (validationResult.valid) {
          this.logInfo('✓ Configuration is valid');

          if (validationResult.summary) {
            this.logInfo('\nConfiguration Summary:');
            this.logInfo(
              `  Server: ${validationResult.summary.server.host}:${validationResult.summary.server.port}`
            );
            this.logInfo(`  Transports: ${validationResult.summary.server.transports.join(', ')}`);
            this.logInfo(
              `  Security: ${validationResult.summary.security.enabled ? 'Enabled' : 'Disabled'}`
            );
            this.logInfo(
              `  Monitoring: ${validationResult.summary.monitoring.enabled ? 'Enabled' : 'Disabled'}`
            );
            this.logInfo(`  Log Level: ${validationResult.summary.logging.level}`);
          }

          if (
            validationResult.warnings &&
            validationResult.warnings.length > 0 &&
            flags['show-warnings']
          ) {
            this.logInfo('\nWarnings:');
            validationResult.warnings.forEach(warning => {
              this.logInfo(`  ⚠ ${warning}`);
            });
          }
        } else {
          this.logError('✗ Configuration validation failed');

          if (validationResult.errors && validationResult.errors.length > 0) {
            this.logError('\nValidation Errors:');
            validationResult.errors.forEach(error => {
              this.logError(`  ✗ ${error}`);
            });
          }
        }
      }

      if (!validationResult.valid) {
        const error = new Error('Configuration validation failed');
        throw error;
      }
    } catch (error) {
      if (error instanceof MCPSCError) {
        if (flags.json) {
          this.outputJson({
            command: 'validate',
            configPath,
            valid: false,
            error: error.message,
            code: error.code,
            context: error.context,
            suggestions: error.suggestions || [],
          });
        } else {
          this.logError(`Configuration validation failed: ${error.message}`);
          if (error.suggestions && error.suggestions.length > 0) {
            this.logInfo('\nSuggestions:');
            error.suggestions.forEach(suggestion => this.logInfo(`  - ${suggestion}`));
          }
        }
        throw error;
      } else {
        if (flags.json) {
          this.outputJson({
            command: 'validate',
            configPath,
            valid: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
          });
        } else {
          this.logError(
            `Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
          );
        }
        throw error;
      }
    }
  }

  private async checkFileExists(filePath: string): Promise<void> {
    try {
      await fs.access(filePath);
    } catch {
      throw new MCPSCError(
        1001, // CONFIG_FILE_NOT_FOUND
        `Configuration file not found: ${filePath}`,
        ErrorCategory.CONFIGURATION,
        ErrorSeverity.ERROR,
        { filePath },
        [
          'Check if the file path is correct',
          'Use mcpsc init to create a new configuration file',
          'Specify a different config file with --config flag',
        ]
      );
    }
  }

  private async validateConfiguration(
    configPath: string,
    strict: boolean = false
  ): Promise<ValidationResult> {
    try {
      // Load configuration using ConfigurationManager
      const config = await this.configManager.loadFromFile(configPath, {
        validateOnLoad: true,
        allowPartial: !strict,
      });

      // Generate summary information
      const summary = this.generateConfigSummary(config);

      // Generate warnings for common configuration issues
      const warnings = this.generateWarnings(config);

      return {
        valid: true,
        summary,
        warnings,
      };
    } catch (error) {
      if (error instanceof MCPSCError) {
        // Extract validation errors from MCPSCError
        const errors = this.extractValidationErrors(error);
        return {
          valid: false,
          errors,
        };
      }

      throw error;
    }
  }

  private generateConfigSummary(config: any): ConfigSummary {
    return {
      server: {
        host: config.server?.host || 'localhost',
        port: config.server?.port || 3000,
        transports: config.server?.transports?.map((t: any) => t.type) || ['stdio'],
      },
      security: {
        enabled:
          config.security?.authentication?.required ||
          config.security?.authorization?.enabled ||
          false,
      },
      monitoring: {
        enabled: config.monitoring?.enabled || false,
      },
      logging: {
        level: config.logging?.level || 'info',
      },
    };
  }

  private generateWarnings(config: any): string[] {
    const warnings: string[] = [];

    // Check for common security issues
    if (!config.security?.authentication?.required) {
      warnings.push('Authentication is not required - consider enabling for production use');
    }

    if (!config.security?.authorization?.enabled) {
      warnings.push('Authorization is disabled - consider enabling for production use');
    }

    // Check for monitoring configuration
    if (!config.monitoring?.enabled) {
      warnings.push('Monitoring is disabled - consider enabling for production observability');
    }

    // Check for logging configuration
    if (config.logging?.level === 'debug' || config.logging?.level === 'trace') {
      warnings.push('Debug/trace logging is enabled - consider using info level for production');
    }

    // Check for default ports
    if (config.server?.port === 3000) {
      warnings.push('Using default port 3000 - consider using a different port for production');
    }

    // Check for TLS configuration
    const hasHttpsTransport = config.server?.transports?.some(
      (t: any) => t.type === 'sse' && t.options?.tls
    );
    if (!hasHttpsTransport) {
      warnings.push('No HTTPS/TLS transport configured - consider enabling TLS for production');
    }

    return warnings;
  }

  private extractValidationErrors(error: MCPSCError): string[] {
    const errors: string[] = [];

    if (error.context?.errors && Array.isArray(error.context.errors)) {
      error.context.errors.forEach((err: any) => {
        if (err.path && err.message) {
          errors.push(`${err.path}: ${err.message}`);
        } else if (err.message) {
          errors.push(err.message);
        }
      });
    } else if (error.message) {
      errors.push(error.message);
    }

    return errors;
  }
}

interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
  summary?: ConfigSummary;
}

interface ConfigSummary {
  server: {
    host: string;
    port: number;
    transports: string[];
  };
  security: {
    enabled: boolean;
  };
  monitoring: {
    enabled: boolean;
  };
  logging: {
    level: string;
  };
}

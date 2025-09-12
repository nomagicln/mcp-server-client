import { BaseCommand } from '@cli/base';
import { Flags } from '@oclif/core';
import { ConfigurationManager } from '@infrastructure/config/manager';
import { MCPSCError } from '@core/errors/base';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';

export default class Init extends BaseCommand {
  static override description = 'Initialize mcpsc configuration';

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --force',
    '<%= config.bin %> <%= command.id %> --output ./config/mcpsc.json',
    '<%= config.bin %> <%= command.id %> --format yaml --output ./mcpsc.yaml',
  ];

  static override flags = {
    ...BaseCommand.baseFlags,
    force: Flags.boolean({
      char: 'f',
      description: 'overwrite existing configuration file',
      default: false,
    }),
    output: Flags.string({
      char: 'o',
      description: 'output path for configuration file',
      default: './mcpsc.json',
    }),
    format: Flags.string({
      description: 'configuration file format (json, yaml, yml)',
      options: ['json', 'yaml', 'yml'],
      default: 'json',
    }),
  };

  private configManager: ConfigurationManager;

  constructor(argv: string[], config: any) {
    super(argv, config);
    this.configManager = new ConfigurationManager();
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Init);

    try {
      // Check if file exists and handle force flag
      const fileExists = await this.checkFileExists(flags.output);
      if (fileExists && !flags.force) {
        const error = new Error(
          `Configuration file already exists at ${flags.output}. Use --force to overwrite.`
        );
        if (flags.json) {
          this.outputJson({
            command: 'init',
            output: flags.output,
            force: flags.force,
            status: 'error',
            error: error.message,
          });
        } else {
          this.logError(error.message);
        }
        throw error;
      }

      // Generate default configuration
      const defaultConfig = await this.configManager.getDefaultConfig();

      // Create output directory if it doesn't exist
      const outputDir = path.dirname(flags.output);
      await fs.mkdir(outputDir, { recursive: true });

      // Determine format from flag or file extension
      const format = this.determineFormat(flags.format, flags.output);

      // Generate configuration content based on format
      const configContent = await this.generateConfigContent(defaultConfig, format);

      // Write configuration file
      await fs.writeFile(flags.output, configContent, 'utf-8');

      if (flags.json) {
        this.outputJson({
          command: 'init',
          output: flags.output,
          format: format,
          force: flags.force,
          status: 'success',
          message: 'Configuration file created successfully',
        });
      } else {
        this.logInfo(`Initializing mcpsc configuration at ${flags.output}`);

        if (flags.force && fileExists) {
          this.logInfo('Force mode enabled - overwriting existing file');
        }

        this.logInfo(`Configuration file created successfully in ${format.toUpperCase()} format`);
        this.logInfo(`Edit ${flags.output} to customize your configuration`);
      }
    } catch (error) {
      if (error instanceof MCPSCError) {
        if (flags.json) {
          this.outputJson({
            command: 'init',
            output: flags.output,
            force: flags.force,
            status: 'error',
            error: error.message,
            code: error.code,
            context: error.context,
          });
        } else {
          this.logError(`Configuration initialization failed: ${error.message}`);
          if (error.suggestions && error.suggestions.length > 0) {
            this.logInfo('Suggestions:');
            error.suggestions.forEach(suggestion => this.logInfo(`  - ${suggestion}`));
          }
        }
        throw error;
      } else {
        if (flags.json) {
          this.outputJson({
            command: 'init',
            output: flags.output,
            force: flags.force,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error occurred',
          });
        } else {
          this.logError(
            `Configuration initialization failed: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
          );
        }
        throw error;
      }
    }
  }

  private async checkFileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private determineFormat(formatFlag: string, outputPath: string): string {
    // Use explicit format flag if provided
    if (formatFlag && formatFlag !== 'json') {
      return formatFlag;
    }

    // Determine from file extension
    const ext = path.extname(outputPath).toLowerCase();
    switch (ext) {
      case '.yaml':
      case '.yml':
        return 'yaml';
      case '.js':
        return 'js';
      case '.ts':
        return 'ts';
      default:
        return 'json';
    }
  }

  private async generateConfigContent(config: any, format: string): Promise<string> {
    switch (format) {
      case 'yaml':
      case 'yml':
        return yaml.dump(config, {
          indent: 2,
          lineWidth: 120,
          noRefs: true,
          sortKeys: false,
        });

      case 'js':
        return this.generateJavaScriptConfig(config);

      case 'ts':
        return this.generateTypeScriptConfig(config);

      case 'json':
      default:
        return JSON.stringify(config, null, 2);
    }
  }

  private generateJavaScriptConfig(config: any): string {
    return `// mcpsc configuration file
// Generated by mcpsc init command

module.exports = ${JSON.stringify(config, null, 2)};
`;
  }

  private generateTypeScriptConfig(config: any): string {
    return `// mcpsc configuration file
// Generated by mcpsc init command

import { MCPSCConfig } from 'mcpsc';

const config: MCPSCConfig = ${JSON.stringify(config, null, 2)};

export default config;
`;
  }
}

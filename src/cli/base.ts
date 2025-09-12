import { Command, Flags } from '@oclif/core';

/**
 * Base command class with common functionality for all CLI commands
 */
export abstract class BaseCommand extends Command {
  static override baseFlags = {
    config: Flags.string({
      char: 'c',
      description: 'path to configuration file',
      env: 'MCPSC_CONFIG',
    }),
    verbose: Flags.boolean({
      char: 'v',
      description: 'enable verbose logging',
      env: 'MCPSC_VERBOSE',
    }),
    debug: Flags.boolean({
      char: 'd',
      description: 'enable debug mode',
      env: 'MCPSC_DEBUG',
    }),
    json: Flags.boolean({
      char: 'j',
      description: 'output in JSON format',
      env: 'MCPSC_JSON',
    }),
  };

  private _jsonMode = false;

  public override async init(): Promise<void> {
    await super.init();
    // Parse flags to determine JSON mode
    const { flags } = await this.parse(this.constructor as any);
    this._jsonMode = Boolean(flags.json);
  }

  public logInfo(message: string): void {
    if (!this.isJsonEnabled()) {
      this.log(message);
    }
  }

  public logError(message: string): void {
    if (!this.isJsonEnabled()) {
      this.error(message);
    }
  }

  public isJsonEnabled(): boolean {
    return this._jsonMode;
  }

  public outputJson(data: unknown): void {
    this.log(JSON.stringify(data, null, 2));
  }

  public async formatHelp(): Promise<string> {
    // Generate basic help content for testing
    const commandClass = this.constructor as any;
    const description = commandClass.description || 'No description available';
    const flags = commandClass.flags || {};
    const examples = commandClass.examples || [];

    let help = `${description}\n\nUSAGE\n  $ command\n\nFLAGS\n`;

    Object.entries(flags).forEach(([name, flag]: [string, any]) => {
      const char = flag.char ? `-${flag.char}, ` : '';
      help += `  ${char}--${name}  ${flag.description || ''}\n`;
    });

    if (examples.length > 0) {
      help += '\nEXAMPLES\n';
      examples.forEach((example: string) => {
        help += `  $ ${example}\n`;
      });
    }

    return help;
  }

  public async getHelp(): Promise<string> {
    return this.formatHelp();
  }
}

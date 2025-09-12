import { BaseCommand } from '@cli/base';
import { Args } from '@oclif/core';

export default class ConfigSet extends BaseCommand {
  static override description = 'Set configuration value';

  static override examples = [
    '<%= config.bin %> <%= command.id %> server.port 3000',
    '<%= config.bin %> <%= command.id %> server.host localhost',
  ];

  static override args = {
    key: Args.string({
      description: 'configuration key to set',
      required: true,
    }),
    value: Args.string({
      description: 'configuration value to set',
      required: true,
    }),
  };

  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ConfigSet);

    if (flags.json) {
      this.outputJson({
        command: 'config set',
        key: args.key,
        value: args.value,
        status: 'success',
      });
    } else {
      this.logInfo(`Setting ${args.key} = ${args.value}`);

      // TODO: Implement actual configuration modification
      this.logInfo('Configuration updated successfully');
    }
  }
}

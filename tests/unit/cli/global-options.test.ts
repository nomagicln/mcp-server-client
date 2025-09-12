import { Config } from '@oclif/core';
import { BaseCommand } from '@cli/base';

class TestGlobalOptionsCommand extends BaseCommand {
  static override description = 'Test command for global options';
  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(TestGlobalOptionsCommand);

    if (flags.json) {
      this.outputJson({
        config: flags.config,
        verbose: flags.verbose,
        debug: flags.debug,
        json: flags.json,
      });
    } else {
      this.logInfo(`Config: ${flags.config || 'default'}`);
      this.logInfo(`Verbose: ${flags.verbose}`);
      this.logInfo(`Debug: ${flags.debug}`);
    }
  }
}

describe('Global CLI Options', () => {
  let config: Config;

  beforeEach(async () => {
    config = new Config({ root: process.cwd() });
    await config.load();
  });

  describe('Flag Definitions', () => {
    it('should have config flag with correct properties', () => {
      const configFlag = TestGlobalOptionsCommand.baseFlags.config;
      expect(configFlag.char).toBe('c');
      expect(configFlag.description).toBe('path to configuration file');
      expect(configFlag.env).toBe('MCPSC_CONFIG');
    });

    it('should have verbose flag with correct properties', () => {
      const verboseFlag = TestGlobalOptionsCommand.baseFlags.verbose;
      expect(verboseFlag.char).toBe('v');
      expect(verboseFlag.description).toBe('enable verbose logging');
      expect(verboseFlag.env).toBe('MCPSC_VERBOSE');
    });

    it('should have debug flag with correct properties', () => {
      const debugFlag = TestGlobalOptionsCommand.baseFlags.debug;
      expect(debugFlag.char).toBe('d');
      expect(debugFlag.description).toBe('enable debug mode');
      expect(debugFlag.env).toBe('MCPSC_DEBUG');
    });

    it('should have json flag with correct properties', () => {
      const jsonFlag = TestGlobalOptionsCommand.baseFlags.json;
      expect(jsonFlag.char).toBe('j');
      expect(jsonFlag.description).toBe('output in JSON format');
      expect(jsonFlag.env).toBe('MCPSC_JSON');
    });
  });

  describe('Environment Variable Support', () => {
    it('should support MCPSC_CONFIG environment variable', async () => {
      const originalEnv = process.env['MCPSC_CONFIG'];
      process.env['MCPSC_CONFIG'] = '/env/config.json';

      try {
        // Environment variables are handled by oclif internally
        // We test that the flag definition includes the env property
        expect(TestGlobalOptionsCommand.baseFlags.config.env).toBe('MCPSC_CONFIG');
      } finally {
        if (originalEnv !== undefined) {
          process.env['MCPSC_CONFIG'] = originalEnv;
        } else {
          delete process.env['MCPSC_CONFIG'];
        }
      }
    });

    it('should support MCPSC_VERBOSE environment variable', () => {
      expect(TestGlobalOptionsCommand.baseFlags.verbose.env).toBe('MCPSC_VERBOSE');
    });

    it('should support MCPSC_DEBUG environment variable', () => {
      expect(TestGlobalOptionsCommand.baseFlags.debug.env).toBe('MCPSC_DEBUG');
    });

    it('should support MCPSC_JSON environment variable', () => {
      expect(TestGlobalOptionsCommand.baseFlags.json.env).toBe('MCPSC_JSON');
    });
  });

  describe('Flag Validation', () => {
    it('should accept valid config paths', () => {
      const configFlag = TestGlobalOptionsCommand.baseFlags.config;
      expect(configFlag.type).toBe('option');
      expect(configFlag.char).toBe('c');
    });

    it('should define boolean flags correctly', () => {
      const verboseFlag = TestGlobalOptionsCommand.baseFlags.verbose;
      const debugFlag = TestGlobalOptionsCommand.baseFlags.debug;
      const jsonFlag = TestGlobalOptionsCommand.baseFlags.json;

      expect(verboseFlag.type).toBe('boolean');
      expect(debugFlag.type).toBe('boolean');
      expect(jsonFlag.type).toBe('boolean');
    });

    it('should have proper flag characters', () => {
      const flags = TestGlobalOptionsCommand.baseFlags;
      const chars = Object.values(flags).map(flag => flag.char);

      expect(chars).toContain('c');
      expect(chars).toContain('v');
      expect(chars).toContain('d');
      expect(chars).toContain('j');

      // Ensure no duplicate characters
      expect(new Set(chars).size).toBe(chars.length);
    });
  });

  describe('Command Execution', () => {
    it('should execute without errors', async () => {
      const command = new TestGlobalOptionsCommand([], config);
      await expect(command.run()).resolves.not.toThrow();
    });

    it('should handle JSON output mode', async () => {
      const command = new TestGlobalOptionsCommand(['--json'], config);
      const logSpy = jest.spyOn(command, 'log').mockImplementation();

      await command.run();

      expect(logSpy).toHaveBeenCalled();
      const logCall = logSpy.mock.calls[0]?.[0];
      expect(logCall).toBeDefined();
      expect(() => JSON.parse(logCall as string)).not.toThrow();

      logSpy.mockRestore();
    });

    it('should handle regular output mode', async () => {
      const command = new TestGlobalOptionsCommand([], config);
      const logSpy = jest.spyOn(command, 'logInfo').mockImplementation();

      await command.run();

      expect(logSpy).toHaveBeenCalled();

      logSpy.mockRestore();
    });
  });

  describe('Flag Inheritance', () => {
    it('should inherit base flags in command flags', () => {
      const commandFlags = TestGlobalOptionsCommand.flags;
      const baseFlags = TestGlobalOptionsCommand.baseFlags;

      expect(commandFlags).toEqual(expect.objectContaining(baseFlags));
    });

    it('should maintain flag properties after inheritance', () => {
      const commandFlags = TestGlobalOptionsCommand.flags;

      expect(commandFlags.config).toBeDefined();
      expect(commandFlags.verbose).toBeDefined();
      expect(commandFlags.debug).toBeDefined();
      expect(commandFlags.json).toBeDefined();
    });
  });

  describe('Help Integration', () => {
    it('should include global flags in help output', async () => {
      const command = new TestGlobalOptionsCommand([], config);
      const help = await command.formatHelp();

      expect(help).toContain('config');
      expect(help).toContain('verbose');
      expect(help).toContain('debug');
      expect(help).toContain('json');
    });

    it('should show flag descriptions in help', async () => {
      const command = new TestGlobalOptionsCommand([], config);
      const help = await command.formatHelp();

      expect(help).toContain('path to configuration file');
      expect(help).toContain('enable verbose logging');
      expect(help).toContain('enable debug mode');
      expect(help).toContain('output in JSON format');
    });
  });
});

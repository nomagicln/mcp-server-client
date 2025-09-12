import { BaseCommand } from '@cli/base';
import { Config } from '@oclif/core';

class TestCommand extends BaseCommand {
  static override description = 'Test command for unit testing';
  static override examples = ['<%= config.bin %> <%= command.id %>'];
  static override flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(TestCommand);

    if (flags.json) {
      this.outputJson({ message: 'test output', flags });
    } else {
      this.logInfo('Test command executed');
    }
  }
}

describe('BaseCommand', () => {
  let config: Config;

  beforeEach(async () => {
    config = new Config({ root: process.cwd() });
    await config.load();
  });

  describe('Base Flags', () => {
    it('should have all required base flags defined', () => {
      expect(TestCommand.baseFlags).toBeDefined();
      expect(TestCommand.baseFlags.config).toBeDefined();
      expect(TestCommand.baseFlags.verbose).toBeDefined();
      expect(TestCommand.baseFlags.debug).toBeDefined();
      expect(TestCommand.baseFlags.json).toBeDefined();
    });

    it('should have correct flag characters', () => {
      expect(TestCommand.baseFlags.config.char).toBe('c');
      expect(TestCommand.baseFlags.verbose.char).toBe('v');
      expect(TestCommand.baseFlags.debug.char).toBe('d');
      expect(TestCommand.baseFlags.json.char).toBe('j');
    });

    it('should have correct flag descriptions', () => {
      expect(TestCommand.baseFlags.config.description).toBe('path to configuration file');
      expect(TestCommand.baseFlags.verbose.description).toBe('enable verbose logging');
      expect(TestCommand.baseFlags.debug.description).toBe('enable debug mode');
      expect(TestCommand.baseFlags.json.description).toBe('output in JSON format');
    });

    it('should have correct environment variable mappings', () => {
      expect(TestCommand.baseFlags.config.env).toBe('MCPSC_CONFIG');
      expect(TestCommand.baseFlags.verbose.env).toBe('MCPSC_VERBOSE');
      expect(TestCommand.baseFlags.debug.env).toBe('MCPSC_DEBUG');
      expect(TestCommand.baseFlags.json.env).toBe('MCPSC_JSON');
    });
  });

  describe('Logging Methods', () => {
    let command: TestCommand;
    let logSpy: jest.SpyInstance;
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
      command = new TestCommand([], config);
      logSpy = jest.spyOn(command, 'log').mockImplementation();
      errorSpy = jest.spyOn(command, 'error').mockImplementation();
    });

    afterEach(() => {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should log info messages when JSON is disabled', () => {
      jest.spyOn(command, 'isJsonEnabled').mockReturnValue(false);
      command.logInfo('Test message');
      expect(logSpy).toHaveBeenCalledWith('Test message');
    });

    it('should not log info messages when JSON is enabled', () => {
      jest.spyOn(command, 'isJsonEnabled').mockReturnValue(true);
      command.logInfo('Test message');
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('should log error messages when JSON is disabled', () => {
      jest.spyOn(command, 'isJsonEnabled').mockReturnValue(false);
      command.logError('Error message');
      expect(errorSpy).toHaveBeenCalledWith('Error message');
    });

    it('should not log error messages when JSON is enabled', () => {
      jest.spyOn(command, 'isJsonEnabled').mockReturnValue(true);
      command.logError('Error message');
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe('JSON Output', () => {
    let command: TestCommand;
    let logSpy: jest.SpyInstance;

    beforeEach(() => {
      command = new TestCommand([], config);
      logSpy = jest.spyOn(command, 'log').mockImplementation();
    });

    afterEach(() => {
      logSpy.mockRestore();
    });

    it('should output JSON correctly', () => {
      const testData = { message: 'test', status: 'success' };
      command.outputJson(testData);
      expect(logSpy).toHaveBeenCalledWith(JSON.stringify(testData, null, 2));
    });

    it('should handle complex objects in JSON output', () => {
      const complexData = {
        config: { host: 'localhost', port: 3000 },
        resources: [{ id: '1', name: 'test' }],
        metadata: { timestamp: '2023-01-01T00:00:00Z' },
      };
      command.outputJson(complexData);
      expect(logSpy).toHaveBeenCalledWith(JSON.stringify(complexData, null, 2));
    });
  });

  describe('Help System', () => {
    it('should generate help content', async () => {
      const command = new TestCommand([], config);
      const help = await command.formatHelp();

      expect(help).toBeDefined();
      expect(typeof help).toBe('string');
      expect(help.length).toBeGreaterThan(0);
    });

    it('should include command description in help', async () => {
      const command = new TestCommand([], config);
      const help = await command.formatHelp();

      expect(help).toContain('Test command for unit testing');
    });
  });

  describe('Initialization', () => {
    it('should initialize without errors', async () => {
      const command = new TestCommand([], config);
      await expect(command.init()).resolves.not.toThrow();
    });

    it('should detect JSON mode during initialization', async () => {
      const command = new TestCommand(['--json'], config);
      await command.init();
      expect(command.isJsonEnabled()).toBe(true);
    });

    it('should default to non-JSON mode', async () => {
      const command = new TestCommand([], config);
      await command.init();
      expect(command.isJsonEnabled()).toBe(false);
    });
  });
});

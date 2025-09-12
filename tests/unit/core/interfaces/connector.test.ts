import {
  IConnector,
  Command,
  ExecutionResult,
  Connection,
  TestOptions,
  TestResult,
  ConnectionPool,
  CommandDefinition,
  ConnectionStatus,
} from '@core/interfaces/connector';
import { Resource, ResourceType } from '@core/models/resource';

describe('IConnector Interface Contract', () => {
  let mockConnector: IConnector;

  beforeEach(() => {
    mockConnector = {
      type: 'ssh',
      supportedProtocols: ['ssh', 'sftp'],
      capabilities: [],
      connect: jest.fn(),
      test: jest.fn(),
      disconnect: jest.fn().mockResolvedValue(undefined),
      execute: jest.fn(),
      getConnectionPool: jest.fn(),
      getSupportedCommands: jest.fn(),
    };
  });

  describe('Connector Properties', () => {
    it('should have type property', () => {
      expect(mockConnector.type).toBeDefined();
      expect(typeof mockConnector.type).toBe('string');
    });

    it('should have supportedProtocols array', () => {
      expect(mockConnector.supportedProtocols).toBeDefined();
      expect(Array.isArray(mockConnector.supportedProtocols)).toBe(true);
    });

    it('should have capabilities array', () => {
      expect(mockConnector.capabilities).toBeDefined();
      expect(Array.isArray(mockConnector.capabilities)).toBe(true);
    });
  });

  describe('Connection Management', () => {
    it('should connect to resources', async () => {
      const resource: Resource = {
        id: 'test-resource',
        name: 'Test Resource',
        type: ResourceType.SSH_HOST,
        group: 'test',
        enabled: true,
        metadata: {},
        connection: {},
        security: {},
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const expectedConnection: Connection = {
        id: 'conn-1',
        resourceId: resource.id,
        type: 'ssh',
        status: ConnectionStatus.CONNECTED,
        metadata: {},
        createdAt: new Date(),
        lastUsed: new Date(),
      };

      (mockConnector.connect as jest.Mock).mockResolvedValue(expectedConnection);

      const connection = await mockConnector.connect(resource);
      expect(connection).toEqual(expectedConnection);
      expect(mockConnector.connect).toHaveBeenCalledWith(resource);
    });

    it('should test connections with options', async () => {
      const resource: Resource = {
        id: 'test-resource',
        name: 'Test Resource',
        type: ResourceType.SSH_HOST,
        group: 'test',
        enabled: true,
        metadata: {},
        connection: {},
        security: {},
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const testOptions: TestOptions = {
        timeout: 5000,
        dryRun: true,
      };

      const expectedResult: TestResult = {
        success: true,
        latency: 100,
        details: 'Connection successful',
      };

      (mockConnector.test as jest.Mock).mockResolvedValue(expectedResult);

      const result = await mockConnector.test(resource, testOptions);
      expect(result).toEqual(expectedResult);
      expect(mockConnector.test).toHaveBeenCalledWith(resource, testOptions);
    });

    it('should disconnect connections', async () => {
      const connection: Connection = {
        id: 'conn-1',
        resourceId: 'resource-1',
        type: 'ssh',
        status: ConnectionStatus.CONNECTED,
        metadata: {},
        createdAt: new Date(),
        lastUsed: new Date(),
      };

      await expect(mockConnector.disconnect(connection)).resolves.toBeUndefined();
      expect(mockConnector.disconnect).toHaveBeenCalledWith(connection);
    });
  });

  describe('Command Execution', () => {
    it('should execute commands and return results', async () => {
      const connection: Connection = {
        id: 'conn-1',
        resourceId: 'resource-1',
        type: 'ssh',
        status: ConnectionStatus.CONNECTED,
        metadata: {},
        createdAt: new Date(),
        lastUsed: new Date(),
      };

      const command: Command = {
        type: 'shell',
        parameters: { command: 'ls -la' },
        timeout: 30000,
      };

      const expectedResult: ExecutionResult = {
        success: true,
        output: 'file1.txt\nfile2.txt',
        metadata: {
          executionTime: 150,
          exitCode: 0,
        },
      };

      (mockConnector.execute as jest.Mock).mockResolvedValue(expectedResult);

      const result = await mockConnector.execute(connection, command);
      expect(result).toEqual(expectedResult);
      expect(mockConnector.execute).toHaveBeenCalledWith(connection, command);
    });
  });

  describe('Pool and Command Management', () => {
    it('should return connection pool', () => {
      const mockPool: ConnectionPool = {
        size: 5,
        active: 2,
        idle: 3,
      };

      (mockConnector.getConnectionPool as jest.Mock).mockReturnValue(mockPool);

      const pool = mockConnector.getConnectionPool();
      expect(pool).toEqual(mockPool);
    });

    it('should return supported commands', () => {
      const mockCommands: CommandDefinition[] = [
        {
          name: 'shell',
          description: 'Execute shell command',
          parameters: [],
        },
      ];

      (mockConnector.getSupportedCommands as jest.Mock).mockReturnValue(mockCommands);

      const commands = mockConnector.getSupportedCommands();
      expect(commands).toEqual(mockCommands);
    });
  });
});

import {
  ITransport,
  TransportConfig,
  MCPMessage,
  MCPResponse,
  MessageHandler,
  HealthStatus,
} from '@core/interfaces/transport';

describe('ITransport Interface Contract', () => {
  let mockTransport: ITransport;

  beforeEach(() => {
    mockTransport = {
      name: 'test-transport',
      supportedMethods: ['initialize', 'call_tool', 'list_resources'],
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      send: jest.fn(),
      onMessage: jest.fn(),
      getHealthStatus: jest.fn(),
    };
  });

  describe('Transport Properties', () => {
    it('should have a name property', () => {
      expect(mockTransport.name).toBeDefined();
      expect(typeof mockTransport.name).toBe('string');
    });

    it('should have supportedMethods array', () => {
      expect(mockTransport.supportedMethods).toBeDefined();
      expect(Array.isArray(mockTransport.supportedMethods)).toBe(true);
    });
  });

  describe('Transport Lifecycle', () => {
    it('should start with configuration', async () => {
      const config: TransportConfig = {
        type: 'stdio',
        options: {},
      };

      await expect(mockTransport.start(config)).resolves.toBeUndefined();
      expect(mockTransport.start).toHaveBeenCalledWith(config);
    });

    it('should stop gracefully', async () => {
      await expect(mockTransport.stop()).resolves.toBeUndefined();
      expect(mockTransport.stop).toHaveBeenCalled();
    });
  });

  describe('Message Handling', () => {
    it('should send messages and return responses', async () => {
      const message: MCPMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {},
      };

      const expectedResponse: MCPResponse = {
        jsonrpc: '2.0',
        id: 1,
        result: { capabilities: {} },
      };

      (mockTransport.send as jest.Mock).mockResolvedValue(expectedResponse);

      const response = await mockTransport.send(message);
      expect(response).toEqual(expectedResponse);
      expect(mockTransport.send).toHaveBeenCalledWith(message);
    });

    it('should register message handlers', () => {
      const handler: MessageHandler = jest.fn();
      mockTransport.onMessage(handler);
      expect(mockTransport.onMessage).toHaveBeenCalledWith(handler);
    });
  });

  describe('Health Monitoring', () => {
    it('should return health status', () => {
      const healthStatus: HealthStatus = {
        status: 'healthy',
        timestamp: new Date(),
        details: {},
      };

      (mockTransport.getHealthStatus as jest.Mock).mockReturnValue(healthStatus);

      const status = mockTransport.getHealthStatus();
      expect(status).toEqual(healthStatus);
      expect(status.status).toBeDefined();
      expect(status.timestamp).toBeInstanceOf(Date);
    });
  });
});

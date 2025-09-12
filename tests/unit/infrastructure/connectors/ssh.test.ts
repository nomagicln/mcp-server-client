import { SSHConnector } from '@infrastructure/connectors/ssh';
import { Resource, ResourceType } from '@core/models/resource';
import { ConnectionStatus } from '@core/models/connection';
import * as fs from 'fs';
import * as os from 'os';

// Mock ssh2 module
const mockSSHClient = {
  connect: jest.fn(),
  end: jest.fn(),
  exec: jest.fn(),
  sftp: jest.fn(),
  forwardOut: jest.fn(),
  shell: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn(),
};

jest.mock('ssh2', () => ({
  Client: jest.fn().mockImplementation(() => mockSSHClient),
}));

jest.mock('fs');
jest.mock('os');

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedOs = os as jest.Mocked<typeof os>;

describe('SSHConnector', () => {
  let sshConnector: SSHConnector;

  beforeEach(() => {
    jest.clearAllMocks();
    sshConnector = new SSHConnector();
  });

  describe('Basic Properties', () => {
    it('should have correct type and supported protocols', () => {
      expect(sshConnector.type).toBe('ssh');
      expect(sshConnector.supportedProtocols).toContain('ssh');
      expect(sshConnector.supportedProtocols).toContain('sftp');
    });

    it('should have defined capabilities', () => {
      const capabilities = sshConnector.capabilities;
      expect(capabilities).toBeDefined();
      expect(capabilities.length).toBeGreaterThan(0);

      const shellCapability = capabilities.find(cap => cap.name === 'shell');
      expect(shellCapability).toBeDefined();
      expect(shellCapability?.description).toContain('shell');
    });

    it('should return supported commands', () => {
      const commands = sshConnector.getSupportedCommands();
      expect(commands).toBeDefined();
      expect(commands.length).toBeGreaterThan(0);

      const execCommand = commands.find(cmd => cmd.name === 'exec');
      expect(execCommand).toBeDefined();
    });
  });

  describe('Connection Management', () => {
    const createSSHResource = (overrides: Partial<Resource> = {}): Resource => ({
      id: 'test-ssh-host',
      name: 'Test SSH Host',
      type: ResourceType.SSH_HOST,
      enabled: true,
      metadata: {
        description: 'Test SSH host',
        environment: 'test',
      },
      connection: {
        host: 'test.example.com',
        port: 22,
        protocol: 'ssh',
        timeout: 30000,
      },
      security: {
        authentication: {
          type: 'key',
          keyPath: '~/.ssh/test_rsa',
        },
      },
      tags: ['test'],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });

    describe('Key-based Authentication', () => {
      it('should connect with private key authentication', async () => {
        const resource = createSSHResource();

        // Mock file system operations
        mockedFs.readFileSync.mockReturnValue(Buffer.from('mock-private-key'));
        mockedFs.existsSync.mockReturnValue(true);
        mockedOs.homedir.mockReturnValue('/home/user');

        // Mock successful connection - simulate ready event immediately
        mockSSHClient.on.mockImplementation((event: string, handler: Function) => {
          if (event === 'ready') {
            // Call the ready handler immediately
            setTimeout(() => handler(), 0);
          }
          return mockSSHClient;
        });

        const connection = await sshConnector.connect(resource);

        expect(connection).toBeDefined();
        expect(connection.status).toBe(ConnectionStatus.CONNECTED);
        expect(connection.resourceId).toBe(resource.id);
        expect(connection.type).toBe('ssh');
        expect(mockSSHClient.connect).toHaveBeenCalledWith(
          expect.objectContaining({
            host: 'test.example.com',
            port: 22,
            privateKey: expect.any(Buffer),
          })
        );
      });

      it('should handle missing private key file', async () => {
        const resource = createSSHResource();

        mockedFs.existsSync.mockReturnValue(false);

        await expect(sshConnector.connect(resource)).rejects.toThrow('Private key file not found');
      });
    });

    describe('Password Authentication', () => {
      it('should connect with password authentication', async () => {
        const resource = createSSHResource({
          security: {
            authentication: {
              type: 'password',
              credentials: {
                username: 'testuser',
                password: 'testpass',
              },
            },
          },
        });

        // Mock successful connection
        mockSSHClient.on.mockImplementation((event: string, handler: Function) => {
          if (event === 'ready') {
            setTimeout(() => handler(), 0);
          }
          return mockSSHClient;
        });

        const connection = await sshConnector.connect(resource);

        expect(connection.status).toBe(ConnectionStatus.CONNECTED);
        expect(mockSSHClient.connect).toHaveBeenCalledWith(
          expect.objectContaining({
            username: 'testuser',
            password: 'testpass',
          })
        );
      });

      it('should handle missing password credentials', async () => {
        const resource = createSSHResource({
          security: {
            authentication: {
              type: 'password',
              credentials: {
                username: 'testuser',
                // password missing
              },
            },
          },
        });

        await expect(sshConnector.connect(resource)).rejects.toThrow('Password is required');
      });
    });

    describe('SSH Config File Support', () => {
      it('should read and parse ~/.ssh/config file', async () => {
        const sshConfigContent = `
Host testhost
    HostName test.example.com
    Port 2222
    User testuser
    IdentityFile ~/.ssh/custom_key
`;

        mockedFs.readFileSync.mockImplementation((filePath: any) => {
          if (filePath.toString().includes('.ssh/config')) {
            return sshConfigContent;
          }
          return Buffer.from('mock-key-content');
        });
        mockedFs.existsSync.mockReturnValue(true);
        mockedOs.homedir.mockReturnValue('/home/user');

        // Create a new connector instance after setting up mocks so SSH config is loaded
        const configAwareConnector = new SSHConnector();

        const resource = createSSHResource({
          connection: {
            host: 'testhost', // This should match the Host in config
            protocol: 'ssh',
          },
        });

        mockSSHClient.on.mockImplementation((event: string, handler: Function) => {
          if (event === 'ready') {
            setTimeout(() => handler(), 0);
          }
          return mockSSHClient;
        });

        const connection = await configAwareConnector.connect(resource);
        expect(connection.status).toBe(ConnectionStatus.CONNECTED);

        // Verify that SSH config values were used
        expect(mockSSHClient.connect).toHaveBeenCalledWith(
          expect.objectContaining({
            host: 'test.example.com', // Should use HostName from config
            port: 2222, // Should use Port from config
            username: 'testuser', // Should use User from config
          })
        );
      });
    });

    describe('Connection Pooling', () => {
      it('should reuse existing connections', async () => {
        const resource = createSSHResource();

        mockedFs.readFileSync.mockReturnValue(Buffer.from('mock-private-key'));
        mockedFs.existsSync.mockReturnValue(true);

        mockSSHClient.on.mockImplementation((event: string, handler: Function) => {
          if (event === 'ready') {
            setTimeout(() => handler(), 0);
          }
          return mockSSHClient;
        });

        // First connection
        const connection1 = await sshConnector.connect(resource);
        expect(connection1.status).toBe(ConnectionStatus.CONNECTED);

        // Second connection should reuse the first
        const connection2 = await sshConnector.connect(resource);
        expect(connection2.id).toBe(connection1.id);

        // Should only have called connect once
        expect(mockSSHClient.connect).toHaveBeenCalledTimes(1);
      });
    });

    describe('Error Handling', () => {
      it('should handle connection timeout', async () => {
        const resource = createSSHResource({
          connection: {
            host: 'unreachable.example.com',
            port: 22,
            protocol: 'ssh',
            timeout: 1000,
          },
        });

        // Mock error event
        mockSSHClient.on.mockImplementation((event: string, handler: Function) => {
          if (event === 'error') {
            setTimeout(() => handler(new Error('Connection timeout')), 0);
          }
          return mockSSHClient;
        });

        await expect(sshConnector.connect(resource)).rejects.toThrow('Connection timeout');
      });

      it('should handle authentication failure', async () => {
        const resource = createSSHResource({
          security: {
            authentication: {
              type: 'password',
              credentials: {
                username: 'testuser',
                password: 'wrongpass',
              },
            },
          },
        });

        mockSSHClient.on.mockImplementation((event: string, handler: Function) => {
          if (event === 'error') {
            setTimeout(() => handler(new Error('Authentication failed')), 0);
          }
          return mockSSHClient;
        });

        await expect(sshConnector.connect(resource)).rejects.toThrow('Authentication failed');
      });
    });
  });

  describe('Connection Testing', () => {
    const createSSHResource = (): Resource => ({
      id: 'test-ssh-host',
      name: 'Test SSH Host',
      type: ResourceType.SSH_HOST,
      enabled: true,
      metadata: { description: 'Test SSH host' },
      connection: {
        host: 'test.example.com',
        port: 22,
        protocol: 'ssh',
      },
      security: {
        authentication: {
          type: 'key',
          keyPath: '~/.ssh/test_rsa',
        },
      },
      tags: ['test'],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    it('should test connection successfully', async () => {
      const resource = createSSHResource();

      mockedFs.readFileSync.mockReturnValue(Buffer.from('mock-private-key'));
      mockedFs.existsSync.mockReturnValue(true);

      mockSSHClient.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'ready') {
          setTimeout(() => handler(), 10);
        }
        return mockSSHClient;
      });

      const result = await sshConnector.test(resource);

      expect(result.success).toBe(true);
      expect(result.latency).toBeGreaterThan(0);
      expect(mockSSHClient.end).toHaveBeenCalled();
    });

    it('should support dry-run testing', async () => {
      const resource = createSSHResource();

      const result = await sshConnector.test(resource, { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.details).toContain('dry-run');
      expect(mockSSHClient.connect).not.toHaveBeenCalled();
    });

    it('should handle test timeout', async () => {
      const resource = createSSHResource();

      mockedFs.readFileSync.mockReturnValue(Buffer.from('mock-private-key'));
      mockedFs.existsSync.mockReturnValue(true);

      // Don't trigger any events to simulate timeout
      mockSSHClient.on.mockImplementation(() => mockSSHClient);

      const result = await sshConnector.test(resource, { timeout: 100 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });

  describe('Command Execution', () => {
    let connection: any;

    beforeEach(async () => {
      const resource: Resource = {
        id: 'test-ssh-host',
        name: 'Test SSH Host',
        type: ResourceType.SSH_HOST,
        enabled: true,
        metadata: { description: 'Test SSH host' },
        connection: {
          host: 'test.example.com',
          port: 22,
          protocol: 'ssh',
        },
        security: {
          authentication: {
            type: 'key',
            keyPath: '~/.ssh/test_rsa',
          },
        },
        tags: ['test'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockedFs.readFileSync.mockReturnValue(Buffer.from('mock-private-key'));
      mockedFs.existsSync.mockReturnValue(true);

      mockSSHClient.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'ready') {
          setTimeout(() => handler(), 0);
        }
        return mockSSHClient;
      });

      connection = await sshConnector.connect(resource);
    });

    it('should execute shell commands', async () => {
      const mockStream = {
        on: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        stderr: {
          on: jest.fn(),
        },
      };

      mockSSHClient.exec.mockImplementation(
        (command: string, optionsOrCallback: any, callback?: any) => {
          const actualCallback =
            typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
          expect(command).toBe('ls -la');
          actualCallback(null, mockStream);

          // Simulate command output
          setTimeout(() => {
            const dataCall = mockStream.on.mock.calls.find((call: any[]) => call[0] === 'data');
            const closeCall = mockStream.on.mock.calls.find((call: any[]) => call[0] === 'close');

            if (dataCall && dataCall[1]) {
              dataCall[1](Buffer.from('file1.txt\nfile2.txt\n'));
            }
            if (closeCall && closeCall[1]) {
              closeCall[1](0);
            }
          }, 0);
        }
      );

      const result = await sshConnector.execute(connection, {
        type: 'exec',
        parameters: {
          command: 'ls -la',
        },
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('file1.txt');
      expect(result.metadata.exitCode).toBe(0);
    });

    it('should handle command execution errors', async () => {
      const mockStream = {
        on: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        stderr: {
          on: jest.fn(),
        },
      };

      mockSSHClient.exec.mockImplementation(
        (_command: string, optionsOrCallback: any, callback?: any) => {
          const actualCallback =
            typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
          actualCallback(null, mockStream);

          setTimeout(() => {
            const stderrCall = mockStream.stderr.on.mock.calls.find(
              (call: any[]) => call[0] === 'data'
            );
            const closeCall = mockStream.on.mock.calls.find((call: any[]) => call[0] === 'close');

            if (stderrCall && stderrCall[1]) {
              stderrCall[1](Buffer.from('command not found'));
            }
            if (closeCall && closeCall[1]) {
              closeCall[1](127);
            }
          }, 0);
        }
      );

      const result = await sshConnector.execute(connection, {
        type: 'exec',
        parameters: {
          command: 'nonexistent-command',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('command not found');
      expect(result.metadata.exitCode).toBe(127);
    });

    it('should support SFTP file operations', async () => {
      const mockSFTP = {
        readdir: jest.fn(),
        readFile: jest.fn(),
        writeFile: jest.fn(),
        end: jest.fn(),
      };

      mockSSHClient.sftp.mockImplementation((callback: any) => {
        callback(null, mockSFTP);
      });

      mockSFTP.readdir.mockImplementation((_path: string, callback: any) => {
        callback(null, [
          { filename: 'file1.txt', attrs: { size: 100 } },
          { filename: 'file2.txt', attrs: { size: 200 } },
        ]);
      });

      const result = await sshConnector.execute(connection, {
        type: 'sftp',
        parameters: {
          operation: 'readdir',
          path: '/home/user',
        },
      });

      expect(result.success).toBe(true);
      expect(result.output).toHaveLength(2);
      expect(result.output[0].filename).toBe('file1.txt');
    });

    it('should support port forwarding', async () => {
      const mockStream = {
        on: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
      };

      mockSSHClient.forwardOut.mockImplementation(
        (_srcIP: string, _srcPort: number, dstIP: string, dstPort: number, callback: any) => {
          expect(dstIP).toBe('localhost');
          expect(dstPort).toBe(3306);
          callback(null, mockStream);
        }
      );

      const result = await sshConnector.execute(connection, {
        type: 'forward',
        parameters: {
          localPort: 13306,
          remoteHost: 'localhost',
          remotePort: 3306,
        },
      });

      expect(result.success).toBe(true);
      expect(result.metadata['forwardingActive']).toBe(true);
    });

    it('should handle command timeout', async () => {
      const mockStream = {
        on: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        stderr: {
          on: jest.fn(),
        },
      };

      mockSSHClient.exec.mockImplementation(
        (_command: string, optionsOrCallback: any, callback?: any) => {
          const actualCallback =
            typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
          actualCallback(null, mockStream);
          // Don't call close event to simulate hanging command
        }
      );

      const result = await sshConnector.execute(connection, {
        type: 'exec',
        parameters: {
          command: 'sleep 10',
        },
        timeout: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('timeout');
    });

    describe('Shell Command Execution and Output Capture', () => {
      it('should capture stdout and stderr separately', async () => {
        const mockStream = {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn(),
          stderr: {
            on: jest.fn(),
          },
        };

        mockSSHClient.exec.mockImplementation(
          (_command: string, optionsOrCallback: any, callback?: any) => {
            const actualCallback =
              typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
            actualCallback(null, mockStream);

            setTimeout(() => {
              const stdoutCall = mockStream.on.mock.calls.find((call: any[]) => call[0] === 'data');
              const stderrCall = mockStream.stderr.on.mock.calls.find(
                (call: any[]) => call[0] === 'data'
              );
              const closeCall = mockStream.on.mock.calls.find((call: any[]) => call[0] === 'close');

              if (stdoutCall && stdoutCall[1]) {
                stdoutCall[1](Buffer.from('stdout output'));
              }
              if (stderrCall && stderrCall[1]) {
                stderrCall[1](Buffer.from('stderr output'));
              }
              if (closeCall && closeCall[1]) {
                closeCall[1](0);
              }
            }, 0);
          }
        );

        const result = await sshConnector.execute(connection, {
          type: 'exec',
          parameters: {
            command: 'echo "test" && echo "error" >&2',
          },
        });

        expect(result.success).toBe(true);
        expect(result.output).toBe('stdout output');
        expect(result.metadata.exitCode).toBe(0);
      });

      it('should handle large output streams', async () => {
        const mockStream = {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn(),
          stderr: {
            on: jest.fn(),
          },
        };

        const largeOutput = 'x'.repeat(10000);

        mockSSHClient.exec.mockImplementation(
          (_command: string, optionsOrCallback: any, callback?: any) => {
            const actualCallback =
              typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
            actualCallback(null, mockStream);

            setTimeout(() => {
              const stdoutCall = mockStream.on.mock.calls.find((call: any[]) => call[0] === 'data');
              const closeCall = mockStream.on.mock.calls.find((call: any[]) => call[0] === 'close');

              if (stdoutCall && stdoutCall[1]) {
                // Simulate chunked data
                stdoutCall[1](Buffer.from(largeOutput.slice(0, 5000)));
                stdoutCall[1](Buffer.from(largeOutput.slice(5000)));
              }
              if (closeCall && closeCall[1]) {
                closeCall[1](0);
              }
            }, 0);
          }
        );

        const result = await sshConnector.execute(connection, {
          type: 'exec',
          parameters: {
            command: 'cat large_file.txt',
          },
        });

        expect(result.success).toBe(true);
        expect(result.output).toBe(largeOutput);
      });

      it('should handle binary output', async () => {
        const mockStream = {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn(),
          stderr: {
            on: jest.fn(),
          },
        };

        const binaryData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG header

        mockSSHClient.exec.mockImplementation(
          (_command: string, optionsOrCallback: any, callback?: any) => {
            const actualCallback =
              typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
            actualCallback(null, mockStream);

            setTimeout(() => {
              const stdoutCall = mockStream.on.mock.calls.find((call: any[]) => call[0] === 'data');
              const closeCall = mockStream.on.mock.calls.find((call: any[]) => call[0] === 'close');

              if (stdoutCall && stdoutCall[1]) {
                stdoutCall[1](binaryData);
              }
              if (closeCall && closeCall[1]) {
                closeCall[1](0);
              }
            }, 0);
          }
        );

        const result = await sshConnector.execute(connection, {
          type: 'exec',
          parameters: {
            command: 'cat image.png',
          },
        });

        expect(result.success).toBe(true);
        expect(result.output).toBe(binaryData.toString());
      });

      it('should handle interactive command prompts', async () => {
        const mockStream = {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn(),
          stderr: {
            on: jest.fn(),
          },
        };

        mockSSHClient.exec.mockImplementation(
          (_command: string, optionsOrCallback: any, callback?: any) => {
            const actualCallback =
              typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
            actualCallback(null, mockStream);

            setTimeout(() => {
              const stdoutCall = mockStream.on.mock.calls.find((call: any[]) => call[0] === 'data');
              const closeCall = mockStream.on.mock.calls.find((call: any[]) => call[0] === 'close');

              if (stdoutCall && stdoutCall[1]) {
                stdoutCall[1](Buffer.from('Enter password: '));
                // Simulate user input
                setTimeout(() => {
                  stdoutCall[1](Buffer.from('\nAuthentication successful\n'));
                  if (closeCall && closeCall[1]) {
                    closeCall[1](0);
                  }
                }, 10);
              }
            }, 0);
          }
        );

        const result = await sshConnector.execute(connection, {
          type: 'exec',
          parameters: {
            command: 'sudo -S ls',
            interactive: true,
            input: 'password123\n',
          },
        });

        expect(result.success).toBe(true);
        expect(result.output).toContain('Authentication successful');
      });

      it('should handle command execution with environment variables', async () => {
        const mockStream = {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn(),
          stderr: {
            on: jest.fn(),
          },
        };

        mockSSHClient.exec.mockImplementation(
          (command: string, optionsOrCallback: any, callback?: any) => {
            const actualCallback =
              typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
            expect(command).toBe('export TEST_VAR=test_value && echo $TEST_VAR');
            actualCallback(null, mockStream);

            setTimeout(() => {
              const stdoutCall = mockStream.on.mock.calls.find((call: any[]) => call[0] === 'data');
              const closeCall = mockStream.on.mock.calls.find((call: any[]) => call[0] === 'close');

              if (stdoutCall && stdoutCall[1]) {
                stdoutCall[1](Buffer.from('test_value\n'));
              }
              if (closeCall && closeCall[1]) {
                closeCall[1](0);
              }
            }, 0);
          }
        );

        const result = await sshConnector.execute(connection, {
          type: 'exec',
          parameters: {
            command: 'echo $TEST_VAR',
            environment: {
              TEST_VAR: 'test_value',
            },
          },
        });

        expect(result.success).toBe(true);
        expect(result.output).toBe('test_value\n');
      });
    });

    describe('SFTP File Operations', () => {
      it('should upload files via SFTP', async () => {
        const mockSFTP = {
          writeFile: jest.fn(),
          readFile: jest.fn(),
          readdir: jest.fn(),
          mkdir: jest.fn(),
          rmdir: jest.fn(),
          unlink: jest.fn(),
          stat: jest.fn(),
          end: jest.fn(),
        };

        mockSSHClient.sftp.mockImplementation((callback: any) => {
          callback(null, mockSFTP);
        });

        mockSFTP.writeFile.mockImplementation(
          (_remotePath: string, _data: Buffer, callback: any) => {
            callback(null);
          }
        );

        const result = await sshConnector.execute(connection, {
          type: 'sftp',
          parameters: {
            operation: 'writeFile',
            path: '/remote/path/file.txt',
            data: Buffer.from('file content'),
          },
        });

        expect(result.success).toBe(true);
        expect(mockSFTP.writeFile).toHaveBeenCalledWith(
          '/remote/path/file.txt',
          Buffer.from('file content'),
          expect.any(Function)
        );
      });

      it('should download files via SFTP', async () => {
        const mockSFTP = {
          readFile: jest.fn(),
          writeFile: jest.fn(),
          readdir: jest.fn(),
          mkdir: jest.fn(),
          rmdir: jest.fn(),
          unlink: jest.fn(),
          stat: jest.fn(),
          end: jest.fn(),
        };

        mockSSHClient.sftp.mockImplementation((callback: any) => {
          callback(null, mockSFTP);
        });

        mockSFTP.readFile.mockImplementation((_remotePath: string, callback: any) => {
          callback(null, Buffer.from('downloaded file content'));
        });

        const result = await sshConnector.execute(connection, {
          type: 'sftp',
          parameters: {
            operation: 'readFile',
            path: '/remote/path/file.txt',
          },
        });

        expect(result.success).toBe(true);
        expect(result.output).toEqual(Buffer.from('downloaded file content'));
      });

      it('should create directories via SFTP', async () => {
        const mockSFTP = {
          mkdir: jest.fn(),
          readFile: jest.fn(),
          writeFile: jest.fn(),
          readdir: jest.fn(),
          rmdir: jest.fn(),
          unlink: jest.fn(),
          stat: jest.fn(),
          end: jest.fn(),
        };

        mockSSHClient.sftp.mockImplementation((callback: any) => {
          callback(null, mockSFTP);
        });

        mockSFTP.mkdir.mockImplementation((_remotePath: string, callback: any) => {
          callback(null);
        });

        const result = await sshConnector.execute(connection, {
          type: 'sftp',
          parameters: {
            operation: 'mkdir',
            path: '/remote/new/directory',
          },
        });

        expect(result.success).toBe(true);
        expect(mockSFTP.mkdir).toHaveBeenCalledWith('/remote/new/directory', expect.any(Function));
      });

      it('should delete files via SFTP', async () => {
        const mockSFTP = {
          unlink: jest.fn(),
          readFile: jest.fn(),
          writeFile: jest.fn(),
          readdir: jest.fn(),
          mkdir: jest.fn(),
          rmdir: jest.fn(),
          stat: jest.fn(),
          end: jest.fn(),
        };

        mockSSHClient.sftp.mockImplementation((callback: any) => {
          callback(null, mockSFTP);
        });

        mockSFTP.unlink.mockImplementation((_remotePath: string, callback: any) => {
          callback(null);
        });

        const result = await sshConnector.execute(connection, {
          type: 'sftp',
          parameters: {
            operation: 'unlink',
            path: '/remote/path/file.txt',
          },
        });

        expect(result.success).toBe(true);
        expect(mockSFTP.unlink).toHaveBeenCalledWith('/remote/path/file.txt', expect.any(Function));
      });

      it('should get file stats via SFTP', async () => {
        const mockSFTP = {
          stat: jest.fn(),
          readFile: jest.fn(),
          writeFile: jest.fn(),
          readdir: jest.fn(),
          mkdir: jest.fn(),
          rmdir: jest.fn(),
          unlink: jest.fn(),
          end: jest.fn(),
        };

        mockSSHClient.sftp.mockImplementation((callback: any) => {
          callback(null, mockSFTP);
        });

        const mockStats = {
          size: 1024,
          mode: 33188,
          mtime: new Date(),
          atime: new Date(),
        };

        mockSFTP.stat.mockImplementation((_remotePath: string, callback: any) => {
          callback(null, mockStats);
        });

        const result = await sshConnector.execute(connection, {
          type: 'sftp',
          parameters: {
            operation: 'stat',
            path: '/remote/path/file.txt',
          },
        });

        expect(result.success).toBe(true);
        expect(result.output).toEqual(mockStats);
      });

      it('should handle SFTP errors gracefully', async () => {
        const mockSFTP = {
          readFile: jest.fn(),
          writeFile: jest.fn(),
          readdir: jest.fn(),
          mkdir: jest.fn(),
          rmdir: jest.fn(),
          unlink: jest.fn(),
          stat: jest.fn(),
          end: jest.fn(),
        };

        mockSSHClient.sftp.mockImplementation((callback: any) => {
          callback(null, mockSFTP);
        });

        mockSFTP.readFile.mockImplementation((_remotePath: string, callback: any) => {
          callback(new Error('File not found'));
        });

        const result = await sshConnector.execute(connection, {
          type: 'sftp',
          parameters: {
            operation: 'readFile',
            path: '/nonexistent/file.txt',
          },
        });

        expect(result.success).toBe(false);
        expect(result.error?.message).toContain('File not found');
      });
    });

    describe('Interactive Session Support', () => {
      it('should support shell session creation', async () => {
        const mockStream = {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn(),
          stderr: {
            on: jest.fn(),
          },
        };

        mockSSHClient.shell.mockImplementation((callback: any) => {
          callback(null, mockStream);
        });

        const result = await sshConnector.execute(connection, {
          type: 'shell',
          parameters: {
            sessionType: 'interactive',
          },
        });

        expect(result.success).toBe(true);
        expect(result.metadata['sessionActive']).toBe(true);
        expect(mockSSHClient.shell).toHaveBeenCalled();
      });

      it('should handle shell session input/output', async () => {
        const mockStream = {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn(),
          stderr: {
            on: jest.fn(),
          },
        };

        mockSSHClient.shell.mockImplementation((callback: any) => {
          callback(null, mockStream);

          // Simulate shell prompt
          setTimeout(() => {
            const dataCall = mockStream.on.mock.calls.find((call: any[]) => call[0] === 'data');
            if (dataCall && dataCall[1]) {
              dataCall[1](Buffer.from('user@host:~$ '));
            }
          }, 0);
        });

        const result = await sshConnector.execute(connection, {
          type: 'shell',
          parameters: {
            sessionType: 'interactive',
            commands: ['ls -la', 'pwd'],
          },
        });

        expect(result.success).toBe(true);
        expect(mockStream.write).toHaveBeenCalledWith('ls -la\n');
        expect(mockStream.write).toHaveBeenCalledWith('pwd\n');
      });

      it('should manage session state and cleanup', async () => {
        const mockStream = {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn(),
          stderr: {
            on: jest.fn(),
          },
        };

        mockSSHClient.shell.mockImplementation((callback: any) => {
          callback(null, mockStream);
        });

        const result = await sshConnector.execute(connection, {
          type: 'shell',
          parameters: {
            sessionType: 'interactive',
            timeout: 5000,
          },
        });

        expect(result.success).toBe(true);

        // Test session cleanup
        const closeResult = await sshConnector.execute(connection, {
          type: 'shell',
          parameters: {
            sessionType: 'close',
            sessionId: result.metadata['sessionId'],
          },
        });

        expect(closeResult.success).toBe(true);
      });

      it('should handle session timeouts', async () => {
        const mockStream = {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn(),
          stderr: {
            on: jest.fn(),
          },
        };

        mockSSHClient.shell.mockImplementation((callback: any) => {
          callback(null, mockStream);
          // Don't simulate any data events to trigger timeout
        });

        const result = await sshConnector.execute(connection, {
          type: 'shell',
          parameters: {
            sessionType: 'interactive',
          },
          timeout: 100, // Set a short timeout
        });

        // With a short timeout, the session should timeout before the 1000ms wait
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('SESSION_TIMEOUT');
      }, 1000);
    });

    describe('Security Controls', () => {
      it('should enforce command whitelisting', async () => {
        const result = await sshConnector.execute(connection, {
          type: 'exec',
          parameters: {
            command: 'rm -rf /',
          },
          securityContext: {
            permissions: ['read'],
            restrictions: ['no-destructive-commands'],
            auditRequired: true,
            commandWhitelist: ['ls', 'cat', 'grep', 'find'],
          },
        });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('COMMAND_BLOCKED');
        expect(result.error?.message).toContain('Command not in whitelist');
      });

      it('should enforce command blacklisting', async () => {
        const result = await sshConnector.execute(connection, {
          type: 'exec',
          parameters: {
            command: 'sudo rm -rf /etc',
          },
          securityContext: {
            permissions: ['execute'],
            restrictions: ['no-sudo'],
            auditRequired: true,
            commandBlacklist: ['rm', 'sudo', 'chmod 777'],
          },
        });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('COMMAND_BLOCKED');
        expect(result.error?.message).toContain('blacklisted');
      });

      it('should enforce resource limits', async () => {
        const mockStream = {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn(),
          stderr: {
            on: jest.fn(),
          },
        };

        mockSSHClient.exec.mockImplementation(
          (_command: string, optionsOrCallback: any, callback?: any) => {
            const actualCallback =
              typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
            actualCallback(null, mockStream);
            // Simulate timeout by not calling close
          }
        );

        const result = await sshConnector.execute(connection, {
          type: 'exec',
          parameters: {
            command: 'sleep 1000',
          },
          timeout: 100, // Set a short timeout
          securityContext: {
            permissions: ['execute'],
            restrictions: [],
            auditRequired: true,
            resourceLimits: {
              maxExecutionTime: 100,
              maxMemory: 1024,
              maxCpu: 50,
            },
          },
        });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('TIMEOUT'); // Should timeout due to short timeout
      }, 1000); // Add test timeout

      it('should enforce timeout limits', async () => {
        const mockStream = {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn(),
          stderr: {
            on: jest.fn(),
          },
        };

        mockSSHClient.exec.mockImplementation(
          (_command: string, optionsOrCallback: any, callback?: any) => {
            const actualCallback =
              typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
            actualCallback(null, mockStream);
            // Don't trigger close event to simulate hanging command
          }
        );

        const result = await sshConnector.execute(connection, {
          type: 'exec',
          parameters: {
            command: 'sleep 1000',
          },
          timeout: 50,
          securityContext: {
            permissions: ['execute'],
            restrictions: [],
            auditRequired: true,
          },
        });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('TIMEOUT');
      });

      it('should validate user permissions', async () => {
        const result = await sshConnector.execute(connection, {
          type: 'exec',
          parameters: {
            command: 'cat /etc/passwd',
          },
          securityContext: {
            userId: 'user123',
            permissions: ['read-public'],
            restrictions: ['no-system-files'],
            auditRequired: true,
          },
        });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('PERMISSION_DENIED');
        expect(result.error?.message).toContain('Insufficient permissions');
      });

      it('should enforce sandboxing restrictions', async () => {
        const result = await sshConnector.execute(connection, {
          type: 'exec',
          parameters: {
            command: 'cd /root && ls',
          },
          securityContext: {
            permissions: ['execute'],
            restrictions: ['sandbox:/home/user'],
            auditRequired: true,
          },
        });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('SANDBOX_VIOLATION');
        expect(result.error?.message).toContain('outside sandbox');
      });
    });

    describe('Audit Logging', () => {
      let mockLogger: any;

      beforeEach(() => {
        mockLogger = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        };
        // Mock the logger in the connector
        (sshConnector as any).auditLogger = mockLogger;
      });

      it('should log successful command execution', async () => {
        const mockStream = {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn(),
          stderr: {
            on: jest.fn(),
          },
        };

        mockSSHClient.exec.mockImplementation(
          (_command: string, optionsOrCallback: any, callback?: any) => {
            const actualCallback =
              typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
            actualCallback(null, mockStream);

            setTimeout(() => {
              const stdoutCall = mockStream.on.mock.calls.find((call: any[]) => call[0] === 'data');
              const closeCall = mockStream.on.mock.calls.find((call: any[]) => call[0] === 'close');

              if (stdoutCall && stdoutCall[1]) {
                stdoutCall[1](Buffer.from('command output'));
              }
              if (closeCall && closeCall[1]) {
                closeCall[1](0); // Success exit code
              }
            }, 0);
          }
        );

        const result = await sshConnector.execute(connection, {
          type: 'exec',
          parameters: {
            command: 'ls -la',
          },
          securityContext: {
            userId: 'user123',
            permissions: ['read'], // ls command requires read permission
            restrictions: [],
            auditRequired: true,
          },
        });

        expect(result.success).toBe(true);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'SSH command executed successfully',
          expect.objectContaining({
            userId: 'user123',
            action: 'ls -la',
            success: true,
            type: 'command',
          })
        );
      });

      it('should log failed command execution', async () => {
        const mockStream = {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn(),
          stderr: {
            on: jest.fn(),
          },
        };

        mockSSHClient.exec.mockImplementation(
          (_command: string, optionsOrCallback: any, callback?: any) => {
            const actualCallback =
              typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
            actualCallback(null, mockStream);

            setTimeout(() => {
              const stderrCall = mockStream.stderr.on.mock.calls.find(
                (call: any[]) => call[0] === 'data'
              );
              const closeCall = mockStream.on.mock.calls.find((call: any[]) => call[0] === 'close');

              if (stderrCall && stderrCall[1]) {
                stderrCall[1](Buffer.from('command failed'));
              }
              if (closeCall && closeCall[1]) {
                closeCall[1](1);
              }
            }, 0);
          }
        );

        const result = await sshConnector.execute(connection, {
          type: 'exec',
          parameters: {
            command: 'invalid-command',
          },
          securityContext: {
            userId: 'user123',
            permissions: ['execute'],
            restrictions: [],
            auditRequired: true,
          },
        });

        expect(result.success).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'SSH command execution failed',
          expect.objectContaining({
            userId: 'user123',
            action: 'invalid-command',
            success: false,
            type: 'command',
          })
        );
      });

      it('should log security violations', async () => {
        const result = await sshConnector.execute(connection, {
          type: 'exec',
          parameters: {
            command: 'rm -rf /',
          },
          securityContext: {
            userId: 'user123',
            permissions: ['read'],
            restrictions: ['no-destructive-commands'],
            auditRequired: true,
          },
        });

        expect(result.success).toBe(false);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'SSH command blocked by security policy',
          expect.objectContaining({
            userId: 'user123',
            action: 'rm -rf /',
            success: false,
            type: 'security',
          })
        );
      });

      it('should log SFTP operations', async () => {
        const mockSFTP = {
          readFile: jest.fn(),
          writeFile: jest.fn(),
          readdir: jest.fn(),
          mkdir: jest.fn(),
          rmdir: jest.fn(),
          unlink: jest.fn(),
          stat: jest.fn(),
          end: jest.fn(),
        };

        mockSSHClient.sftp.mockImplementation((callback: any) => {
          callback(null, mockSFTP);
        });

        mockSFTP.readFile.mockImplementation((_remotePath: string, callback: any) => {
          callback(null, Buffer.from('file content'));
        });

        const result = await sshConnector.execute(connection, {
          type: 'sftp',
          parameters: {
            operation: 'readFile',
            path: '/home/user/file.txt',
          },
          securityContext: {
            userId: 'user123',
            permissions: ['execute'], // SFTP doesn't go through the same permission check
            restrictions: [],
            auditRequired: true,
          },
        });

        expect(result.success).toBe(true);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'SFTP operation completed',
          expect.objectContaining({
            userId: 'user123',
            action: 'readFile',
            resource: '/home/user/file.txt',
            success: true,
            type: 'sftp',
          })
        );
      });

      it('should include correlation IDs in audit logs', async () => {
        const mockStream = {
          on: jest.fn(),
          write: jest.fn(),
          end: jest.fn(),
          stderr: {
            on: jest.fn(),
          },
        };

        mockSSHClient.exec.mockImplementation(
          (_command: string, optionsOrCallback: any, callback?: any) => {
            const actualCallback =
              typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
            actualCallback(null, mockStream);

            setTimeout(() => {
              const closeCall = mockStream.on.mock.calls.find((call: any[]) => call[0] === 'close');
              if (closeCall && closeCall[1]) {
                closeCall[1](0);
              }
            }, 0);
          }
        );

        const result = await sshConnector.execute(connection, {
          type: 'exec',
          parameters: {
            command: 'echo test',
          },
          securityContext: {
            userId: 'user123',
            permissions: ['execute'],
            restrictions: [],
            auditRequired: true,
          },
        });

        expect(result.success).toBe(true);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'SSH command executed successfully',
          expect.objectContaining({
            userId: 'user123',
            action: 'echo test',
            success: true,
          })
        );
      });
    });
  });

  describe('Disconnect', () => {
    it('should disconnect and clean up resources', async () => {
      const resource: Resource = {
        id: 'test-ssh-host',
        name: 'Test SSH Host',
        type: ResourceType.SSH_HOST,
        enabled: true,
        metadata: { description: 'Test SSH host' },
        connection: {
          host: 'test.example.com',
          port: 22,
          protocol: 'ssh',
        },
        security: {
          authentication: {
            type: 'key',
            keyPath: '~/.ssh/test_rsa',
          },
        },
        tags: ['test'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockedFs.readFileSync.mockReturnValue(Buffer.from('mock-private-key'));
      mockedFs.existsSync.mockReturnValue(true);

      mockSSHClient.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'ready') {
          setTimeout(() => handler(), 0);
        }
        return mockSSHClient;
      });

      const connection = await sshConnector.connect(resource);
      expect(connection.status).toBe(ConnectionStatus.CONNECTED);

      await sshConnector.disconnect(connection);

      expect(mockSSHClient.end).toHaveBeenCalled();
      expect(mockSSHClient.removeAllListeners).toHaveBeenCalled();
    });
  });

  describe('Connection Pool Management', () => {
    it('should return connection pool information', () => {
      const pool = sshConnector.getConnectionPool();

      expect(pool).toBeDefined();
      expect(pool.size).toBeGreaterThanOrEqual(0);
      expect(pool.active).toBeGreaterThanOrEqual(0);
      expect(pool.idle).toBeGreaterThanOrEqual(0);
    });
  });

  afterAll(() => {
    // Clean up any timers or intervals
    jest.clearAllTimers();
  });
});

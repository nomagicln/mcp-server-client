/**
 * 安全验证器单元测试
 */

import { describe, expect, test } from '@jest/globals';
import { McpError } from '../../src/utils/error-handler.js';
import { SecurityValidator } from '../../src/utils/security.js';

describe('SecurityValidator', () => {
  describe('validateUrl', () => {
    test('应该接受有效的 HTTPS URL', () => {
      expect(() => {
        SecurityValidator.validateUrl('https://example.com');
      }).not.toThrow();
    });

    test('应该接受有效的 HTTP URL', () => {
      expect(() => {
        SecurityValidator.validateUrl('http://example.com');
      }).not.toThrow();
    });

    test('应该拒绝不支持的协议', () => {
      expect(() => {
        SecurityValidator.validateUrl('ftp://example.com');
      }).toThrow(McpError);
    });

    test('应该拒绝本地地址（默认配置）', () => {
      expect(() => {
        SecurityValidator.validateUrl('http://localhost');
      }).toThrow(McpError);

      expect(() => {
        SecurityValidator.validateUrl('http://127.0.0.1');
      }).toThrow(McpError);
    });

    test('应该拒绝私有 IP 地址', () => {
      expect(() => {
        SecurityValidator.validateUrl('http://192.168.1.1');
      }).toThrow(McpError);

      expect(() => {
        SecurityValidator.validateUrl('http://10.0.0.1');
      }).toThrow(McpError);

      expect(() => {
        SecurityValidator.validateUrl('http://172.16.0.1');
      }).toThrow(McpError);
    });

    test('应该拒绝受限端口', () => {
      expect(() => {
        SecurityValidator.validateUrl('http://example.com:22');
      }).toThrow(McpError);

      expect(() => {
        SecurityValidator.validateUrl('http://example.com:25');
      }).toThrow(McpError);
    });

    test('应该拒绝无效的 URL', () => {
      expect(() => {
        SecurityValidator.validateUrl('not-a-url');
      }).toThrow(McpError);
    });
  });

  describe('isPrivateIP', () => {
    test('应该正确识别私有 IP 地址', () => {
      expect(SecurityValidator.isPrivateIP('192.168.1.1')).toBe(true);
      expect(SecurityValidator.isPrivateIP('10.0.0.1')).toBe(true);
      expect(SecurityValidator.isPrivateIP('172.16.0.1')).toBe(true);
      expect(SecurityValidator.isPrivateIP('169.254.1.1')).toBe(true);
    });

    test('应该正确识别公网 IP 地址', () => {
      expect(SecurityValidator.isPrivateIP('8.8.8.8')).toBe(false);
      expect(SecurityValidator.isPrivateIP('1.1.1.1')).toBe(false);
      expect(SecurityValidator.isPrivateIP('example.com')).toBe(false);
    });
  });

  describe('validateHeaders', () => {
    test('应该接受有效的请求头', () => {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token123',
        'User-Agent': 'MCP Client/1.0',
      };

      expect(() => {
        SecurityValidator.validateHeaders(headers);
      }).not.toThrow();
    });

    test('应该拒绝过长的请求头值', () => {
      const headers = {
        'Long-Header': 'x'.repeat(10000),
      };

      expect(() => {
        SecurityValidator.validateHeaders(headers);
      }).toThrow(McpError);
    });

    test('应该拒绝包含恶意字符的请求头', () => {
      const headers = {
        'XSS-Header': '<script>alert("xss")</script>',
      };

      expect(() => {
        SecurityValidator.validateHeaders(headers);
      }).toThrow(McpError);
    });

    test('应该处理空的请求头', () => {
      expect(() => {
        SecurityValidator.validateHeaders(null);
      }).not.toThrow();

      expect(() => {
        SecurityValidator.validateHeaders(undefined);
      }).not.toThrow();

      expect(() => {
        SecurityValidator.validateHeaders({});
      }).not.toThrow();
    });
  });

  describe('validateRequestBody', () => {
    test('应该接受有效的 JSON 请求体', () => {
      const body = JSON.stringify({ name: 'test', value: 123 });

      expect(() => {
        SecurityValidator.validateRequestBody(body, 'application/json');
      }).not.toThrow();
    });

    test('应该拒绝过大的请求体', () => {
      const largeBody = 'x'.repeat(10 * 1024 * 1024); // 10MB

      expect(() => {
        SecurityValidator.validateRequestBody(largeBody);
      }).toThrow(McpError);
    });

    test('应该拒绝包含恶意内容的请求体', () => {
      const maliciousBody = '<iframe src="evil.com"></iframe>';

      expect(() => {
        SecurityValidator.validateRequestBody(maliciousBody);
      }).toThrow(McpError);
    });

    test('应该处理空的请求体', () => {
      expect(() => {
        SecurityValidator.validateRequestBody(null);
      }).not.toThrow();

      expect(() => {
        SecurityValidator.validateRequestBody('');
      }).not.toThrow();
    });
  });

  describe('validateSshCommand', () => {
    test('应该接受安全的命令', () => {
      expect(() => {
        SecurityValidator.validateSshCommand('ls -la');
      }).not.toThrow();

      expect(() => {
        SecurityValidator.validateSshCommand('cat /etc/hostname');
      }).not.toThrow();

      expect(() => {
        SecurityValidator.validateSshCommand('ps aux | grep nginx');
      }).not.toThrow();
    });

    test('应该拒绝危险的命令', () => {
      expect(() => {
        SecurityValidator.validateSshCommand('rm -rf /');
      }).toThrow(McpError);

      expect(() => {
        SecurityValidator.validateSshCommand('sudo rm -rf *');
      }).toThrow(McpError);

      expect(() => {
        SecurityValidator.validateSshCommand('mkfs.ext4 /dev/sda1');
      }).toThrow(McpError);

      expect(() => {
        SecurityValidator.validateSshCommand('dd if=/dev/zero of=/dev/sda');
      }).toThrow(McpError);
    });

    test('应该拒绝过长的命令', () => {
      const longCommand = 'echo ' + 'x'.repeat(10000);

      expect(() => {
        SecurityValidator.validateSshCommand(longCommand);
      }).toThrow(McpError);
    });

    test('应该拒绝过多的管道操作', () => {
      const command = Array(10).fill('cat /etc/hostname').join(' | ');

      expect(() => {
        SecurityValidator.validateSshCommand(command);
      }).toThrow(McpError);
    });

    test('应该拒绝空命令', () => {
      expect(() => {
        SecurityValidator.validateSshCommand('');
      }).toThrow(McpError);

      expect(() => {
        SecurityValidator.validateSshCommand(null);
      }).toThrow(McpError);
    });
  });

  describe('validateSshHost', () => {
    test('应该接受有效的主机名', () => {
      expect(() => {
        SecurityValidator.validateSshHost('example.com');
      }).not.toThrow();

      expect(() => {
        SecurityValidator.validateSshHost('example.com:2222');
      }).not.toThrow();

      // 注意：192.168.1.100 是私有 IP，默认配置下会被阻止
      // 这里测试的是公网 IP
      expect(() => {
        SecurityValidator.validateSshHost('8.8.8.8:22');
      }).not.toThrow();
    });

    test('应该拒绝无效的主机格式', () => {
      expect(() => {
        SecurityValidator.validateSshHost('');
      }).toThrow(McpError);

      expect(() => {
        SecurityValidator.validateSshHost('invalid:host:format');
      }).toThrow(McpError);
    });

    test('应该拒绝无效的端口号', () => {
      expect(() => {
        SecurityValidator.validateSshHost('example.com:0');
      }).toThrow(McpError);

      expect(() => {
        SecurityValidator.validateSshHost('example.com:70000');
      }).toThrow(McpError);
    });

    test('应该拒绝过长的主机名', () => {
      const longHost = 'x'.repeat(300) + '.com';

      expect(() => {
        SecurityValidator.validateSshHost(longHost);
      }).toThrow(McpError);
    });
  });

  describe('validateCredentials', () => {
    test('应该接受有效的凭据', () => {
      expect(() => {
        SecurityValidator.validateCredentials('admin', 'password123');
      }).not.toThrow();

      expect(() => {
        SecurityValidator.validateCredentials('user.name', 'complex_pass-123');
      }).not.toThrow();
    });

    test('应该拒绝空的用户名或密码', () => {
      expect(() => {
        SecurityValidator.validateCredentials('', 'password');
      }).toThrow(McpError);

      expect(() => {
        SecurityValidator.validateCredentials('user', '');
      }).toThrow(McpError);

      expect(() => {
        SecurityValidator.validateCredentials(null, 'password');
      }).toThrow(McpError);
    });

    test('应该拒绝无效字符的用户名', () => {
      expect(() => {
        SecurityValidator.validateCredentials('user@domain', 'password');
      }).toThrow(McpError);

      expect(() => {
        SecurityValidator.validateCredentials('user space', 'password');
      }).toThrow(McpError);
    });

    test('应该拒绝过长的凭据', () => {
      const longUsername = 'x'.repeat(100);
      const longPassword = 'x'.repeat(200);

      expect(() => {
        SecurityValidator.validateCredentials(longUsername, 'password');
      }).toThrow(McpError);

      expect(() => {
        SecurityValidator.validateCredentials('user', longPassword);
      }).toThrow(McpError);
    });
  });

  describe('containsMaliciousChars', () => {
    test('应该检测恶意字符', () => {
      expect(SecurityValidator.containsMaliciousChars('<script>')).toBe(true);
      expect(
        SecurityValidator.containsMaliciousChars('javascript:alert(1)'),
      ).toBe(true);
      expect(SecurityValidator.containsMaliciousChars('onclick="evil()"')).toBe(
        true,
      );
      expect(SecurityValidator.containsMaliciousChars('test\x00null')).toBe(
        true,
      );
    });

    test('应该接受安全字符', () => {
      expect(SecurityValidator.containsMaliciousChars('normal text')).toBe(
        false,
      );
      expect(SecurityValidator.containsMaliciousChars('user@example.com')).toBe(
        false,
      );
      expect(SecurityValidator.containsMaliciousChars('123-456-789')).toBe(
        false,
      );
    });
  });

  describe('sanitizeInput', () => {
    test('应该正确转义危险字符', () => {
      expect(SecurityValidator.sanitizeInput('<script>')).toBe(
        '&lt;script&gt;',
      );
      expect(SecurityValidator.sanitizeInput('A & B')).toBe('A &amp; B');
      expect(SecurityValidator.sanitizeInput('"quote"')).toBe(
        '&quot;quote&quot;',
      );
    });

    test('应该移除 NULL 字节', () => {
      expect(SecurityValidator.sanitizeInput('test\x00null')).toBe('testnull');
    });

    test('应该修剪空白字符', () => {
      expect(SecurityValidator.sanitizeInput('  text  ')).toBe('text');
    });

    test('应该处理非字符串输入', () => {
      expect(SecurityValidator.sanitizeInput(123)).toBe(123);
      expect(SecurityValidator.sanitizeInput(null)).toBe(null);
      expect(SecurityValidator.sanitizeInput(undefined)).toBe(undefined);
    });
  });
});

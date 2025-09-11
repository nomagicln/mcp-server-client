/**
 * Integration Test: 远程资源目录加载
 */
import { describe, expect, it } from '@jest/globals';
import http from 'node:http';

import RemoteApiLoader from '../../src/resources/loaders/RemoteApiLoader.js';

describe('Integration: 远程资源目录加载', () => {
  it('应能通过 HTTP 拉取资源定义并解析', async () => {
    // 启动本地 HTTP 服务器，返回资源 JSON
    const server = http.createServer((req, res) => {
      if (req.url === '/resources' && req.method === 'GET') {
        const payload = [
          {
            id: 'api-1',
            type: 'api',
            name: 'Test API',
            capabilities: ['http.request'],
          },
        ];
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(payload));
      } else {
        res.statusCode = 404;
        res.end('Not Found');
      }
    });

    // 监听随机端口
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}/resources`;

    try {
      const loader = new RemoteApiLoader({ baseUrl });
      const result = await loader.loadResources();

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(Array.isArray(result.resources)).toBe(true);
      expect(result.resources[0].id).toBe('api-1');
    } finally {
      server.close();
    }
  });
});

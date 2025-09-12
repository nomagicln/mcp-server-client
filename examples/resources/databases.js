module.exports = [
  {
    id: 'postgres-main',
    name: 'Main PostgreSQL Database',
    type: 'database',
    enabled: true,
    group: 'databases',
    metadata: {
      description: 'Primary PostgreSQL database cluster',
      version: '14.9',
      environment: 'production',
      owner: 'dba-team'
    },
    connection: {
      host: 'postgres.prod.example.com',
      port: 5432,
      protocol: 'postgresql',
      poolSize: 20
    },
    security: {
      authentication: {
        type: 'password',
        credentials: {
          username: 'app_user',
          database: 'main_db'
        }
      },
      encryption: {
        enabled: true,
        protocol: 'tls'
      }
    },
    tags: ['database', 'postgresql', 'production']
  },
  {
    id: 'redis-cache',
    name: 'Redis Cache Cluster',
    type: 'database',
    enabled: true,
    group: 'cache',
    metadata: {
      description: 'Redis cluster for application caching',
      version: '7.0',
      environment: 'production'
    },
    connection: {
      host: 'redis.prod.example.com',
      port: 6379,
      protocol: 'redis'
    },
    security: {
      authentication: {
        type: 'password',
        credentials: {
          password: '${REDIS_PASSWORD}'
        }
      }
    },
    tags: ['cache', 'redis', 'performance']
  }
];
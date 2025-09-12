# Technology Stack

## Core Technologies

- **Runtime**: Node.js (latest LTS)
- **Language**: TypeScript with strict type checking
- **CLI Framework**: oclif for robust command-line interface
- **Build System**: esbuild/tsup for fast compilation and CLI distribution
- **Package Manager**: npm with package.json bin entry configuration

## Key Dependencies

### Networking & Protocols
- **ssh2**: SSH connections with key/password auth, jump hosts, port forwarding
- **undici**: High-performance HTTP/1.1 and HTTP/2 client
- **fastify**: Web server for SSE transport and health endpoints

### Configuration & Validation
- **zod**: Runtime type validation and schema enforcement
- **pino**: Structured logging with correlation IDs
- **dotenv**: Environment variable management

### Monitoring & Observability
- **prom-client**: Prometheus metrics collection
- **correlation-id**: Request tracing and debugging

## Development Tools

- **ESLint**: Code linting with TypeScript rules
- **Prettier**: Code formatting
- **Jest**: Unit and integration testing
- **Husky**: Pre-commit hooks for quality gates

## Common Commands

### Development
```bash
# Install dependencies
npm install

# Development build with watch
npm run dev

# Run tests
npm test
npm run test:watch

# Linting and formatting
npm run lint
npm run format

# Type checking
npm run type-check
```

### Build & Distribution
```bash
# Production build
npm run build

# Package for distribution
npm run package

# Install globally for testing
npm install -g .

# Publish to npm
npm publish
```

### Testing
```bash
# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

## Architecture Patterns

- **Layered Architecture**: Clear separation between CLI, services, and infrastructure
- **Dependency Injection**: IoC patterns for testability and loose coupling
- **Interface-Driven Design**: Abstract interfaces for transports, connectors, and loaders
- **Async/Await**: Non-blocking I/O with proper error handling
- **Circuit Breaker**: Fault tolerance for external service calls

## Security Standards

- **TLS 1.3**: Minimum TLS version for all network communications
- **Principle of Least Privilege**: Minimal required permissions
- **Secure Defaults**: Security-first configuration defaults
- **Audit Logging**: Comprehensive security event tracking
- **Secret Management**: Environment variable injection for sensitive data
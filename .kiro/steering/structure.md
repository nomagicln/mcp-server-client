# Project Structure

## Root Directory Layout

```
mcpsc/
├── src/                    # Source code
├── tests/                  # Test files
├── docs/                   # Documentation
├── examples/               # Example configurations and resources
├── .kiro/                  # Kiro configuration and specs
├── package.json            # Package configuration with CLI bin entry
├── tsconfig.json           # TypeScript configuration
├── jest.config.js          # Jest testing configuration
├── .eslintrc.js           # ESLint configuration
├── .prettierrc            # Prettier configuration
└── README.md              # Project documentation
```

## Source Code Organization

```
src/
├── cli/                    # CLI layer (oclif commands)
│   ├── commands/          # Individual CLI commands
│   │   ├── init.ts        # mcpsc init command
│   │   ├── config/        # Configuration commands
│   │   ├── resource/      # Resource management commands
│   │   ├── server/        # Server operation commands
│   │   ├── client/        # Client operation commands
│   │   └── connect/       # Connection testing commands
│   ├── base.ts            # Base command class
│   └── index.ts           # CLI entry point
├── core/                   # Core business logic
│   ├── interfaces/        # Core interfaces and contracts
│   │   ├── transport.ts   # ITransport interface
│   │   ├── connector.ts   # IConnector interface
│   │   └── resource.ts    # IResourceLoader interface
│   ├── services/          # Business logic services
│   │   ├── mcp-server.ts  # MCP Server service
│   │   ├── mcp-client.ts  # MCP Client service
│   │   ├── resource-manager.ts # Resource management
│   │   ├── session-manager.ts  # Session management
│   │   └── security-manager.ts # Security service
│   ├── models/            # Data models and types
│   │   ├── resource.ts    # Resource data model
│   │   ├── connection.ts  # Connection model
│   │   ├── config.ts      # Configuration model
│   │   └── mcp.ts         # MCP protocol models
│   └── errors/            # Error handling system
│       ├── base.ts        # MCPSCError base class
│       └── codes.ts       # Error code definitions
├── infrastructure/         # Infrastructure layer
│   ├── transports/        # MCP transport implementations
│   │   ├── stdio.ts       # Stdio transport
│   │   ├── sse.ts         # Server-Sent Events transport
│   │   └── http.ts        # Streamable HTTP transport
│   ├── connectors/        # Resource connector implementations
│   │   ├── ssh.ts         # SSH connector
│   │   └── http.ts        # HTTP connector
│   ├── loaders/           # Resource loader implementations
│   │   ├── local.ts       # Local file system loader
│   │   └── remote.ts      # Remote HTTP loader
│   ├── config/            # Configuration management
│   │   ├── manager.ts     # Configuration manager
│   │   ├── validator.ts   # Configuration validation
│   │   └── schemas.ts     # Zod validation schemas
│   ├── logging/           # Logging infrastructure
│   │   ├── logger.ts      # Structured logging with pino
│   │   └── correlation.ts # Request correlation IDs
│   └── monitoring/        # Observability infrastructure
│       ├── metrics.ts     # Prometheus metrics
│       └── health.ts      # Health check endpoints
├── utils/                  # Utility functions
│   ├── crypto.ts          # Cryptographic utilities
│   ├── network.ts         # Network utilities
│   └── validation.ts      # Validation helpers
└── index.ts               # Main application entry point
```

## Test Structure

```
tests/
├── unit/                  # Unit tests (mirror src structure)
│   ├── cli/
│   ├── core/
│   ├── infrastructure/
│   └── utils/
├── integration/           # Integration tests
│   ├── transports/
│   ├── connectors/
│   └── end-to-end/
├── fixtures/              # Test data and mock services
│   ├── configs/           # Sample configurations
│   ├── resources/         # Sample resource definitions
│   └── mocks/             # Mock implementations
└── helpers/               # Test utilities and helpers
```

## Configuration Structure

```
examples/
├── configs/               # Example configuration files
│   ├── basic.json         # Basic configuration
│   ├── enterprise.yaml    # Enterprise setup
│   └── development.js     # Development configuration
├── resources/             # Example resource definitions
│   ├── ssh-hosts.json     # SSH host examples
│   └── api-endpoints.yaml # HTTP API examples
└── docker/                # Docker deployment examples
    ├── Dockerfile
    └── docker-compose.yml
```

## Naming Conventions

### Files and Directories
- **kebab-case** for file and directory names
- **PascalCase** for class files when they export a single class
- **camelCase** for utility and helper files
- **index.ts** for barrel exports and main entry points

### Code Structure
- **Interfaces**: Prefix with `I` (e.g., `ITransport`, `IConnector`)
- **Abstract Classes**: Prefix with `Abstract` (e.g., `AbstractTransport`)
- **Error Classes**: Suffix with `Error` (e.g., `MCPSCError`, `ConnectionError`)
- **Service Classes**: Suffix with `Service` or `Manager` (e.g., `ResourceManager`)
- **Constants**: UPPER_SNAKE_CASE for module-level constants

### Import Organization
1. Node.js built-in modules
2. Third-party dependencies
3. Internal modules (relative imports)
4. Type-only imports (grouped separately)

## Module Boundaries

### CLI Layer
- Handles user input and output formatting
- Delegates business logic to core services
- Manages global CLI options and configuration loading

### Core Layer
- Contains business logic and domain models
- Defines interfaces and contracts
- Implements service orchestration and coordination

### Infrastructure Layer
- Implements external integrations and protocols
- Handles low-level networking and I/O operations
- Provides concrete implementations of core interfaces

## Build Artifacts

```
dist/                      # Build output
├── cli/                   # Compiled CLI commands
├── core/                  # Compiled core services
├── infrastructure/        # Compiled infrastructure
├── utils/                 # Compiled utilities
└── index.js              # Main entry point
```
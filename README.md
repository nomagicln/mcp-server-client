# mcpsc (MCP Server Client)

A Node.js + TypeScript command-line tool that serves as an MCP (Model Context Protocol) gateway middleware. The tool provides unified connection, management, and exposure capabilities for heterogeneous environment resources including SSH hosts and HTTP API endpoints.

## Features

- **Dual Mode Operation**: Functions as both MCP Server and MCP Client
- **Resource Management**: Unified interface for SSH hosts, HTTP APIs, and other resources
- **Multi-Transport Support**: stdio, SSE, and Streamable HTTP transports
- **Security-First Design**: Comprehensive authentication and encryption
- **Enterprise Ready**: Built for scalability with monitoring and observability

## Installation

```bash
npm install -g mcpsc
```

## Quick Start

```bash
# Initialize configuration
mcpsc init

# Add a resource
mcpsc resource add ssh --name myserver --host example.com --user admin

# Start MCP server
mcpsc server start --transport sse --port 3000

# Test connection
mcpsc connect ssh myserver --dry-run
```

## Development

```bash
# Install dependencies
npm install

# Development build with watch
npm run dev

# Run tests
npm test

# Lint and format
npm run lint
npm run format

# Build for production
npm run build
```

## Documentation

See the [docs](./docs) directory for detailed documentation.

## License

MIT
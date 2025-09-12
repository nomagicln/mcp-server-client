---
inclusion: always
---

# Import Alias Conventions

## Path Alias Configuration

The project uses TypeScript path aliases to improve code readability and maintainability. All relative imports (`./` and `../`) have been eliminated in favor of absolute path aliases.

### Available Aliases

| Alias | Maps To | Usage |
|-------|---------|-------|
| `@src/*` | `src/*` | General source code imports |
| `@cli/*` | `src/cli/*` | CLI commands and base classes |
| `@core/*` | `src/core/*` | Core business logic (interfaces, models, services, errors) |
| `@infrastructure/*` | `src/infrastructure/*` | Infrastructure layer (transports, connectors, loaders, config) |
| `@utils/*` | `src/utils/*` | Utility functions and helpers |
| `@tests/*` | `tests/*` | Test utilities and fixtures |

## Import Rules

### 1. Always Use Path Aliases
- **DO**: `import { Logger } from '@infrastructure/logging/logger';`
- **DON'T**: `import { Logger } from '../infrastructure/logging/logger';`

### 2. Layer-Specific Import Patterns
- **CLI Layer**: Use `@cli/*` for internal CLI imports, `@core/*` and `@infrastructure/*` for dependencies
- **Core Layer**: Use `@core/*` for internal imports, avoid importing from `@infrastructure/*` or `@cli/*`
- **Infrastructure Layer**: Use `@infrastructure/*` for internal imports, `@core/*` for interfaces and models
- **Utils**: Use `@utils/*` for utility imports, can be imported by any layer

### 3. Import Organization Order
```typescript
// 1. Node.js built-in modules
import * as fs from 'fs/promises';
import * as path from 'path';

// 2. Third-party dependencies
import { Command, Flags } from '@oclif/core';
import { z } from 'zod';

// 3. Internal modules using path aliases
import { BaseCommand } from '@cli/base';
import { MCPSCError } from '@core/errors/base';
import { Logger } from '@infrastructure/logging/logger';

// 4. Type-only imports (grouped separately)
import type { Resource } from '@core/models/resource';
import type { ValidationResult } from '@core/interfaces/resource';
```

### 4. Barrel Export Usage
- Use barrel exports (`index.ts`) for clean public APIs
- Import from specific files when you need only one export
- Import from barrel exports when you need multiple exports from the same module

**Examples:**
```typescript
// Specific import
import { Logger } from '@infrastructure/logging/logger';

// Barrel import for multiple exports
import { MCPSCError, ErrorCategory, ErrorSeverity } from '@core/errors';
```

### 5. Cross-Layer Dependencies
- **CLI → Core**: ✅ Allowed (CLI uses core services)
- **CLI → Infrastructure**: ✅ Allowed (CLI uses infrastructure services)
- **Core → Infrastructure**: ❌ Avoid (use dependency injection instead)
- **Infrastructure → Core**: ✅ Allowed (implements core interfaces)
- **Any → Utils**: ✅ Allowed (utilities are shared)

## Configuration Files

### TypeScript (`tsconfig.json`)
Path aliases are configured in the `paths` section with `baseUrl: "."`.

### Jest (`jest.config.js`)
Module name mapping ensures test files can use the same aliases.

### Build (`tsup.config.ts`)
Alias configuration ensures proper bundling with path resolution.

## Best Practices

1. **Consistency**: Always use the same alias pattern throughout the codebase
2. **Clarity**: Choose the most specific alias available (`@cli/*` over `@src/*` for CLI files)
3. **Maintainability**: Path aliases make refactoring easier by avoiding relative path updates
4. **IDE Support**: Configure your IDE to recognize path aliases for better autocomplete and navigation

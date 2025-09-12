import { defineConfig } from 'tsup';

export default defineConfig([
  // Main library build
  {
    entry: {
      'index': 'src/index.ts'
    },
    format: ['cjs'],
    target: 'node18',
    outDir: 'dist',
    sourcemap: true,
    clean: true,
    dts: true,
    splitting: false,
    bundle: true,
    minify: false,
    external: [
      '@oclif/core',
      '@oclif/plugin-help',
      'dotenv',
      'fastify',
      'pino',
      'prom-client',
      'ssh2',
      'undici',
      'zod'
    ],
    esbuildOptions(options) {
      options.conditions = ['node'];
      // Handle path aliases
      options.alias = {
        '@src': './src',
        '@cli': './src/cli',
        '@core': './src/core',
        '@infrastructure': './src/infrastructure',
        '@utils': './src/utils'
      };
    }
  },
  // CLI build with shebang
  {
    entry: {
      'cli/index': 'src/cli/index.ts',
      'cli/base': 'src/cli/base.ts',
      'cli/commands/init': 'src/cli/commands/init.ts',
      'cli/commands/validate': 'src/cli/commands/validate.ts',
      'cli/commands/config/set': 'src/cli/commands/config/set.ts'
    },
    format: ['cjs'],
    target: 'node18',
    outDir: 'dist',
    sourcemap: true,
    clean: false,
    dts: true,
    splitting: false,
    bundle: true,
    minify: false,
    external: [
      '@oclif/core',
      '@oclif/plugin-help',
      'dotenv',
      'fastify',
      'pino',
      'prom-client',
      'ssh2',
      'undici',
      'zod'
    ],
    banner: {
      js: '#!/usr/bin/env node'
    },
    esbuildOptions(options) {
      options.conditions = ['node'];
      // Handle path aliases
      options.alias = {
        '@src': './src',
        '@cli': './src/cli',
        '@core': './src/core',
        '@infrastructure': './src/infrastructure',
        '@utils': './src/utils'
      };
    }
  }
]);
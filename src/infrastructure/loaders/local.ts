import * as fs from 'fs/promises';
import * as path from 'path';
import { watch, FSWatcher } from 'chokidar';
import * as yaml from 'js-yaml';
import {
  IResourceLoader,
  LoaderConfig,
  ValidationResult,
  ResourceChangeCallback,
  ResourceChangeEvent,
} from '@core/interfaces/resource';
import { Resource, ResourceType } from '@core/models/resource';

/**
 * Local file system resource loader
 */
export class LocalResourceLoader implements IResourceLoader {
  public readonly source = 'local';
  public readonly supportedTypes = [
    ResourceType.SSH_HOST,
    ResourceType.HTTP_API,
    ResourceType.DATABASE,
    ResourceType.KUBERNETES,
  ];

  private watcher?: FSWatcher | undefined;
  private currentPath?: string;
  private changeCallback?: ResourceChangeCallback;

  /**
   * Load resources from local file system
   */
  async load(config: LoaderConfig): Promise<Resource[]> {
    if (!config.path) {
      throw new Error('Path is required for local resource loader');
    }

    this.currentPath = config.path;
    const resources: Resource[] = [];

    const stat = await fs.stat(config.path);

    if (stat.isFile()) {
      // Single file
      const resource = await this.loadResourceFromFile(config.path);
      if (resource) {
        resources.push(resource);
      }
    } else if (stat.isDirectory()) {
      // Directory scanning
      const foundResources = await this.scanDirectory(config.path, config.recursive ?? true);
      resources.push(...foundResources);
    }

    // Apply filters if specified
    if (config.filter) {
      return this.applyFilters(resources, config.filter);
    }

    return resources;
  }

  /**
   * Validate a resource against schema
   */
  validate(resource: Resource): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!resource.id) {
      errors.push('Missing required field: id');
    }
    if (!resource.name) {
      errors.push('Missing required field: name');
    }
    if (!resource.type) {
      errors.push('Missing required field: type');
    }
    if (resource.enabled === undefined || resource.enabled === null) {
      errors.push('Missing required field: enabled');
    }

    // Validate resource type
    if (resource.type && !Object.values(ResourceType).includes(resource.type)) {
      errors.push(`Invalid resource type: ${resource.type}`);
    }

    // Type-specific validation
    if (resource.type === ResourceType.SSH_HOST) {
      if (!resource.connection?.host) {
        errors.push('SSH host requires connection.host');
      }
    }

    if (resource.type === ResourceType.HTTP_API) {
      if (!resource.connection?.url) {
        errors.push('HTTP API requires connection.url');
      }
    }

    // Validate metadata structure
    if (resource.metadata && typeof resource.metadata !== 'object') {
      errors.push('Metadata must be an object');
    }

    // Validate connection structure
    if (resource.connection && typeof resource.connection !== 'object') {
      errors.push('Connection must be an object');
    }

    // Validate security structure
    if (resource.security && typeof resource.security !== 'object') {
      errors.push('Security must be an object');
    }

    // Validate tags
    if (resource.tags && !Array.isArray(resource.tags)) {
      errors.push('Tags must be an array');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        validatedAt: new Date(),
        validatedBy: 'LocalResourceLoader',
      },
    };
  }

  /**
   * Watch for file system changes
   */
  watch(callback: ResourceChangeCallback): void {
    if (!this.currentPath) {
      throw new Error('No path configured for watching. Call load() first.');
    }

    this.changeCallback = callback;

    this.watcher = watch(this.currentPath, {
      ignored: /node_modules/,
      persistent: true,
      ignoreInitial: true,
    });

    this.watcher
      .on('add', async (filePath: string) => {
        try {
          const resource = await this.loadResourceFromFile(filePath);
          if (resource && this.changeCallback) {
            const event: ResourceChangeEvent = {
              type: 'added',
              resource,
              timestamp: new Date(),
              source: this.source,
              metadata: { filePath },
            };
            this.changeCallback(event);
          }
        } catch (error) {
          // Log error but don't crash
          // eslint-disable-next-line no-console
          console.error(`Error loading added file ${filePath}:`, error);
        }
      })
      .on('change', async (filePath: string) => {
        try {
          const resource = await this.loadResourceFromFile(filePath);
          if (resource && this.changeCallback) {
            const event: ResourceChangeEvent = {
              type: 'updated',
              resource,
              timestamp: new Date(),
              source: this.source,
              metadata: { filePath },
            };
            this.changeCallback(event);
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(`Error loading changed file ${filePath}:`, error);
        }
      })
      .on('unlink', (filePath: string) => {
        if (this.changeCallback) {
          // Create a minimal resource object for removal event
          const resourceId = this.extractResourceIdFromPath(filePath);
          const event: ResourceChangeEvent = {
            type: 'removed',
            resource: {
              id: resourceId,
              name: '',
              type: ResourceType.SSH_HOST, // Default type for removal
              enabled: false,
              metadata: {},
              connection: {},
              security: {},
              tags: [],
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            timestamp: new Date(),
            source: this.source,
            metadata: { filePath },
          };
          this.changeCallback(event);
        }
      })
      .on('error', (error: unknown) => {
        // eslint-disable-next-line no-console
        console.error('File watcher error:', error);
      });
  }

  /**
   * Refresh resources by reloading from current path
   */
  async refresh(): Promise<void> {
    if (!this.currentPath) {
      throw new Error('No path configured for refresh. Call load() first.');
    }

    // Reload resources from the current path
    await this.load({ path: this.currentPath });
  }

  /**
   * Scan directory for resource files
   */
  private async scanDirectory(dirPath: string, recursive: boolean): Promise<Resource[]> {
    const resources: Resource[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isFile() && this.isSupportedFile(entry.name)) {
          try {
            const resource = await this.loadResourceFromFile(fullPath);
            if (resource) {
              resources.push(resource);
            }
          } catch (error) {
            // eslint-disable-next-line no-console
            console.warn(`Failed to load resource from ${fullPath}:`, error);
          }
        } else if (entry.isDirectory() && recursive) {
          const subResources = await this.scanDirectory(fullPath, recursive);
          resources.push(...subResources);
        }
      }
    } catch (error) {
      throw new Error(`Failed to scan directory ${dirPath}: ${error}`);
    }

    return resources;
  }

  /**
   * Load a single resource from file
   */
  private async loadResourceFromFile(filePath: string): Promise<Resource | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const ext = path.extname(filePath).toLowerCase();

      let resourceData: any;

      switch (ext) {
        case '.json':
          resourceData = JSON.parse(content);
          break;
        case '.yaml':
        case '.yml':
          resourceData = yaml.load(content);
          break;
        case '.js':
          // For JS files, we need to evaluate the content
          // This is a simplified approach - in production, consider using a safer method
          resourceData = this.evaluateJavaScript(content);
          break;
        case '.ts':
          // For TS files, we need to handle TypeScript syntax
          // This is a simplified approach - in production, consider using ts-node or compilation
          resourceData = this.evaluateTypeScript(content);
          break;
        default:
          return null;
      }

      // Ensure required fields are present and add timestamps
      if (resourceData && typeof resourceData === 'object') {
        const now = new Date();
        const resource: Resource = {
          ...resourceData,
          createdAt: resourceData.createdAt ? new Date(resourceData.createdAt) : now,
          updatedAt: resourceData.updatedAt ? new Date(resourceData.updatedAt) : now,
          metadata: resourceData.metadata || {},
          connection: resourceData.connection || {},
          security: resourceData.security || {},
          tags: resourceData.tags || [],
        };

        return resource;
      }

      return null;
    } catch (error) {
      throw new Error(`Failed to parse resource file ${filePath}: ${error}`);
    }
  }

  /**
   * Check if file extension is supported
   */
  private isSupportedFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return ['.json', '.yaml', '.yml', '.js', '.ts'].includes(ext);
  }

  /**
   * Apply filters to resources
   */
  private applyFilters(resources: Resource[], filter: any): Resource[] {
    return resources.filter(resource => {
      if (filter.types && !filter.types.includes(resource.type)) {
        return false;
      }
      if (filter.groups && resource.group && !filter.groups.includes(resource.group)) {
        return false;
      }
      if (filter.enabled !== undefined && resource.enabled !== filter.enabled) {
        return false;
      }
      if (filter.tags && filter.tags.length > 0) {
        const hasMatchingTag = filter.tags.some((tag: string) => resource.tags.includes(tag));
        if (!hasMatchingTag) {
          return false;
        }
      }
      if (filter.pattern) {
        const regex = new RegExp(filter.pattern, 'i');
        if (!regex.test(resource.name) && !regex.test(resource.id)) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Extract resource ID from file path for removal events
   */
  private extractResourceIdFromPath(filePath: string): string {
    const basename = path.basename(filePath, path.extname(filePath));
    return basename.replace(/[^a-zA-Z0-9-_]/g, '-');
  }

  /**
   * Evaluate JavaScript content (simplified)
   */
  private evaluateJavaScript(content: string): any {
    // This is a simplified evaluation - in production, use a safer method
    try {
      // Remove 'module.exports =' and 'export default' patterns
      let cleanContent = content.replace(/module\.exports\s*=\s*/, 'return ');
      cleanContent = cleanContent.replace(/export\s+default\s+/, 'return ');

      // Create a function and execute it
      const func = new Function(cleanContent);
      return func();
    } catch (error) {
      throw new Error(`Failed to evaluate JavaScript: ${error}`);
    }
  }

  /**
   * Evaluate TypeScript content (simplified)
   */
  private evaluateTypeScript(content: string): any {
    // This is a simplified evaluation - in production, use ts-node or compilation
    try {
      // Remove TypeScript-specific syntax and treat as JavaScript
      let cleanContent = content.trim();

      // Handle export default syntax - extract the object
      if (cleanContent.includes('export default')) {
        // Find the object after 'export default'
        const match = cleanContent.match(/export\s+default\s+({[\s\S]*});?\s*$/);
        if (match) {
          cleanContent = `return ${match[1]};`;
        } else {
          cleanContent = cleanContent.replace(/export\s+default\s+/, 'return ');
        }
      }

      // Remove type annotations (more careful approach)
      cleanContent = cleanContent.replace(/:\s*string(?=\s*[,}])/g, '');
      cleanContent = cleanContent.replace(/:\s*number(?=\s*[,}])/g, '');
      cleanContent = cleanContent.replace(/:\s*boolean(?=\s*[,}])/g, '');

      // Remove interface definitions
      cleanContent = cleanContent.replace(/interface\s+\w+\s*{[^}]*}/g, '');

      const func = new Function(cleanContent);
      return func();
    } catch (error) {
      throw new Error(`Failed to evaluate TypeScript: ${error}`);
    }
  }

  /**
   * Close file watcher
   */
  async close(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
    }
  }
}

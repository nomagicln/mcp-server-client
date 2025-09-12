import { Resource, ResourceType } from '@core/models/resource';
import { ResourceValidator } from '@core/models/resource-validator';
import {
  IResourceRegistry,
  ResourceFilter,
  ResourceChangeCallback,
  ResourceChangeEvent,
} from '@core/interfaces/resource';
import { MCPSCError, ErrorCategory, ErrorSeverity } from '@core/errors/base';

/**
 * Options for resource removal
 */
export interface RemoveOptions {
  force?: boolean;
}

/**
 * Central registry for resource management with CRUD operations,
 * filtering, grouping, and dependency resolution
 */
export class ResourceRegistry implements IResourceRegistry {
  private resources = new Map<string, Resource>();
  private changeCallbacks: ResourceChangeCallback[] = [];
  private validator = new ResourceValidator();

  /**
   * Add a new resource to the registry
   */
  async add(resource: Resource): Promise<void> {
    // Check for duplicate ID
    if (this.resources.has(resource.id)) {
      throw new MCPSCError(
        3002,
        `Resource with ID '${resource.id}' already exists`,
        ErrorCategory.RESOURCE,
        ErrorSeverity.ERROR,
        { resourceId: resource.id }
      );
    }

    // Validate the resource
    const validation = this.validator.validate(resource);
    if (!validation.valid) {
      throw new MCPSCError(
        3001,
        `Invalid resource: ${validation.errors.join(', ')}`,
        ErrorCategory.RESOURCE,
        ErrorSeverity.ERROR,
        { resourceId: resource.id, validationErrors: validation.errors }
      );
    }

    // Update timestamps
    const now = new Date();
    const resourceWithTimestamps = {
      ...resource,
      createdAt: now,
      updatedAt: now,
    };

    // Store the resource
    this.resources.set(resource.id, resourceWithTimestamps);

    // Notify change listeners
    this.notifyChange({
      type: 'added',
      resource: resourceWithTimestamps,
      timestamp: now,
      source: 'ResourceRegistry',
    });
  }

  /**
   * Remove a resource from the registry
   */
  async remove(id: string, options: RemoveOptions = {}): Promise<void> {
    const resource = this.resources.get(id);
    if (!resource) {
      throw new MCPSCError(
        3003,
        `Resource with ID '${id}' not found`,
        ErrorCategory.RESOURCE,
        ErrorSeverity.ERROR,
        { resourceId: id }
      );
    }

    // Check for dependents unless forced
    if (!options.force) {
      const dependents = await this.getDependents(id);
      if (dependents.length > 0) {
        const dependentIds = dependents.map(r => r.id).join(', ');
        throw new MCPSCError(
          3004,
          `Cannot remove resource '${id}' because it has dependents: ${dependentIds}. Use force option to override.`,
          ErrorCategory.RESOURCE,
          ErrorSeverity.ERROR,
          { resourceId: id, dependentIds: dependents.map(r => r.id) },
          ['Use the force option to remove the resource and its dependents']
        );
      }
    }

    // Remove the resource
    this.resources.delete(id);

    // Notify change listeners
    this.notifyChange({
      type: 'removed',
      resource,
      timestamp: new Date(),
      source: 'ResourceRegistry',
    });
  }

  /**
   * Update an existing resource
   */
  async update(id: string, updates: Partial<Resource>): Promise<void> {
    const existingResource = this.resources.get(id);
    if (!existingResource) {
      throw new MCPSCError(
        3003,
        `Resource with ID '${id}' not found`,
        ErrorCategory.RESOURCE,
        ErrorSeverity.ERROR,
        { resourceId: id }
      );
    }

    // Create updated resource using validator
    const updatedResource = this.validator.updateResource(existingResource, updates);

    // Store the updated resource
    this.resources.set(id, updatedResource);

    // Notify change listeners
    this.notifyChange({
      type: 'updated',
      resource: updatedResource,
      timestamp: new Date(),
      source: 'ResourceRegistry',
    });
  }

  /**
   * Get a resource by ID
   */
  async get(id: string): Promise<Resource | null> {
    return this.resources.get(id) || null;
  }

  /**
   * List resources with optional filtering
   */
  async list(filter?: ResourceFilter): Promise<Resource[]> {
    let resources = Array.from(this.resources.values());

    if (!filter) {
      return resources;
    }

    // Apply filters
    if (filter.types && filter.types.length > 0) {
      resources = resources.filter(r => filter.types!.includes(r.type));
    }

    if (filter.groups && filter.groups.length > 0) {
      resources = resources.filter(r => r.group && filter.groups!.includes(r.group));
    }

    if (filter.enabled !== undefined) {
      resources = resources.filter(r => r.enabled === filter.enabled);
    }

    if (filter.tags && filter.tags.length > 0) {
      resources = resources.filter(r => filter.tags!.some(tag => r.tags.includes(tag)));
    }

    if (filter.pattern) {
      const regex = new RegExp(filter.pattern, 'i');
      resources = resources.filter(r => regex.test(r.name));
    }

    return resources;
  }

  /**
   * Enable a resource
   */
  async enable(id: string): Promise<void> {
    await this.update(id, { enabled: true });
  }

  /**
   * Disable a resource
   */
  async disable(id: string): Promise<void> {
    await this.update(id, { enabled: false });
  }

  /**
   * Refresh all resources (triggers update events)
   */
  async refresh(): Promise<void> {
    const now = new Date();

    for (const [id, resource] of this.resources.entries()) {
      const refreshedResource = {
        ...resource,
        updatedAt: now,
      };

      this.resources.set(id, refreshedResource);

      this.notifyChange({
        type: 'updated',
        resource: refreshedResource,
        timestamp: now,
        source: 'ResourceRegistry',
      });
    }
  }

  /**
   * Watch for resource changes
   */
  watch(callback: ResourceChangeCallback): void {
    this.changeCallbacks.push(callback);
  }

  /**
   * Get resources that depend on the specified resource
   */
  async getDependents(resourceId: string): Promise<Resource[]> {
    const dependents: Resource[] = [];

    for (const resource of this.resources.values()) {
      if (resource.metadata?.dependencies?.includes(resourceId)) {
        dependents.push(resource);
      }
    }

    return dependents;
  }

  /**
   * Get resources that the specified resource depends on
   */
  async getDependencies(resourceId: string): Promise<Resource[]> {
    const resource = await this.get(resourceId);
    if (!resource || !resource.metadata?.dependencies) {
      return [];
    }

    const dependencies: Resource[] = [];

    for (const depId of resource.metadata.dependencies) {
      const dependency = await this.get(depId);
      if (dependency) {
        dependencies.push(dependency);
      }
    }

    return dependencies;
  }

  /**
   * Get resources by group
   */
  async getByGroup(group: string): Promise<Resource[]> {
    return this.list({ groups: [group] });
  }

  /**
   * Get resources by type
   */
  async getByType(type: ResourceType): Promise<Resource[]> {
    return this.list({ types: [type] });
  }

  /**
   * Get resources by tags
   */
  async getByTags(tags: string[]): Promise<Resource[]> {
    return this.list({ tags });
  }

  /**
   * Get enabled resources only
   */
  async getEnabled(): Promise<Resource[]> {
    return this.list({ enabled: true });
  }

  /**
   * Get disabled resources only
   */
  async getDisabled(): Promise<Resource[]> {
    return this.list({ enabled: false });
  }

  /**
   * Search resources by name pattern
   */
  async search(pattern: string): Promise<Resource[]> {
    return this.list({ pattern });
  }

  /**
   * Get resource count
   */
  async count(filter?: ResourceFilter): Promise<number> {
    const resources = await this.list(filter);
    return resources.length;
  }

  /**
   * Check if resource exists
   */
  async exists(id: string): Promise<boolean> {
    return this.resources.has(id);
  }

  /**
   * Get all resource IDs
   */
  async getIds(): Promise<string[]> {
    return Array.from(this.resources.keys());
  }

  /**
   * Get all groups
   */
  async getGroups(): Promise<string[]> {
    const groups = new Set<string>();

    for (const resource of this.resources.values()) {
      if (resource.group) {
        groups.add(resource.group);
      }
    }

    return Array.from(groups).sort();
  }

  /**
   * Get all tags
   */
  async getTags(): Promise<string[]> {
    const tags = new Set<string>();

    for (const resource of this.resources.values()) {
      for (const tag of resource.tags) {
        tags.add(tag);
      }
    }

    return Array.from(tags).sort();
  }

  /**
   * Clear all resources
   */
  async clear(): Promise<void> {
    const resourceIds = Array.from(this.resources.keys());

    for (const id of resourceIds) {
      await this.remove(id, { force: true });
    }
  }

  /**
   * Import resources from array
   */
  async import(resources: Resource[]): Promise<void> {
    for (const resource of resources) {
      await this.add(resource);
    }
  }

  /**
   * Export all resources to array
   */
  async export(): Promise<Resource[]> {
    return Array.from(this.resources.values());
  }

  /**
   * Notify change listeners
   */
  private notifyChange(event: ResourceChangeEvent): void {
    for (const callback of this.changeCallbacks) {
      try {
        callback(event);
      } catch (error) {
        // Log error but don't throw to prevent one callback from affecting others
        // eslint-disable-next-line no-console
        console.error('Error in resource change callback:', error);
      }
    }
  }
}

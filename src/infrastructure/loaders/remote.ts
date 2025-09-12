import { request } from 'undici';
import * as yaml from 'js-yaml';
import {
  IResourceLoader,
  LoaderConfig,
  ValidationResult,
  ResourceChangeCallback,
  AuthenticationConfig,
  RetryConfig,
  SecurityChecks,
} from '@core/interfaces/resource';
import { Resource, ResourceType } from '@core/models/resource';

/**
 * Cache entry for storing fetched resources
 */
interface CacheEntry {
  data: Resource[];
  timestamp: number;
  ttl: number;
}

/**
 * Remote resource loader for fetching resources from HTTP endpoints
 */
export class RemoteResourceLoader implements IResourceLoader {
  public readonly source = 'remote';
  public readonly supportedTypes = [
    ResourceType.SSH_HOST,
    ResourceType.HTTP_API,
    ResourceType.DATABASE,
    ResourceType.KUBERNETES,
  ];

  private cache = new Map<string, CacheEntry>();
  private currentUrl?: string;
  private currentConfig?: LoaderConfig;

  /**
   * Load resources from remote HTTP endpoint
   */
  async load(config: LoaderConfig): Promise<Resource[]> {
    if (!config.url) {
      throw new Error('URL is required for remote resource loader');
    }

    this.currentUrl = config.url;
    this.currentConfig = config;

    // Check cache first if caching is enabled
    if (config.caching?.enabled) {
      const cached = this.getCachedResources(config.url, config.caching.ttl);
      if (cached) {
        return cached;
      }
    }

    // Validate URL and perform security checks
    this.validateUrl(config.url, config.securityChecks);

    try {
      const resources = await this.fetchResourcesWithRetry(config);

      // Cache the results if caching is enabled
      if (config.caching?.enabled) {
        this.cacheResources(config.url, resources, config.caching.ttl);
      }

      return resources;
    } catch (error) {
      throw new Error(
        `Failed to fetch resources from ${config.url}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
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
        validatedBy: 'RemoteResourceLoader',
      },
    };
  }

  /**
   * Watch for changes (no-op for remote loader)
   */
  watch(_callback: ResourceChangeCallback): void {
    // Remote loader doesn't support real-time watching
    // This could be extended to support polling in the future
  }

  /**
   * Refresh resources by reloading from current URL
   */
  async refresh(): Promise<void> {
    if (!this.currentUrl || !this.currentConfig) {
      throw new Error('No URL configured for refresh. Call load() first.');
    }

    // Clear cache for current URL
    this.cache.delete(this.currentUrl);

    // Reload resources
    await this.load(this.currentConfig);
  }

  /**
   * Clear all cached resources
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Fetch resources with retry logic and exponential backoff
   */
  private async fetchResourcesWithRetry(config: LoaderConfig): Promise<Resource[]> {
    const retryConfig: RetryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      exponentialBase: 2,
      ...config.retryConfig,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        return await this.fetchResources(config);
      } catch (error) {
        lastError = error as Error;

        // Don't retry for certain error types
        if (this.isNonRetryableError(error)) {
          throw error;
        }

        // If this was the last attempt, throw the error
        if (attempt === retryConfig.maxRetries) {
          throw new Error(
            `Failed to fetch resources from ${config.url} after ${retryConfig.maxRetries} retries: ${lastError.message}`
          );
        }

        // Calculate delay for next attempt
        const delay = Math.min(
          retryConfig.baseDelay * Math.pow(retryConfig.exponentialBase, attempt),
          retryConfig.maxDelay
        );

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('Unknown error during retry');
  }

  /**
   * Fetch resources from remote endpoint
   */
  private async fetchResources(config: LoaderConfig): Promise<Resource[]> {
    const headers: Record<string, string> = {
      'User-Agent': 'mcpsc-remote-loader/1.0.0',
    };

    // Add authentication headers
    if (config.authentication) {
      this.addAuthenticationHeaders(headers, config.authentication);
    }

    // Check response size if security checks are enabled
    const maxResponseSize = config.securityChecks?.maxResponseSize;

    const response = await request(config.url!, {
      method: 'GET',
      headers,
      throwOnError: true,
    });

    // Check response size
    if (maxResponseSize && response.headers['content-length']) {
      const contentLength = parseInt(response.headers['content-length'] as string, 10);
      if (contentLength > maxResponseSize) {
        throw new Error('Response size exceeds maximum allowed size');
      }
    }

    const responseText = await response.body.text();

    // Check actual response size
    if (maxResponseSize && responseText.length > maxResponseSize) {
      throw new Error('Response size exceeds maximum allowed size');
    }

    // Parse response based on content type or format
    const contentType = (response.headers['content-type'] as string) || '';
    const detectedFormat = config.format || this.detectFormat(contentType, config.url!);

    let resourceData: any;
    try {
      resourceData = this.parseResponse(responseText, detectedFormat);
    } catch (error) {
      throw new Error(
        `Failed to parse response from ${config.url}: ${error instanceof Error ? error.message : 'Parse error'}`
      );
    }

    // Ensure we have an array of resources
    const resources = Array.isArray(resourceData) ? resourceData : [resourceData];

    // Process and validate each resource
    const processedResources: Resource[] = [];
    for (const resourceItem of resources) {
      if (resourceItem && typeof resourceItem === 'object') {
        const resource = this.processResource(resourceItem);
        processedResources.push(resource);
      }
    }

    return processedResources;
  }

  /**
   * Add authentication headers based on configuration
   */
  private addAuthenticationHeaders(
    headers: Record<string, string>,
    auth: AuthenticationConfig
  ): void {
    switch (auth.type) {
      case 'basic':
        if (auth.credentials['username'] && auth.credentials['password']) {
          const credentials = Buffer.from(
            `${auth.credentials['username']}:${auth.credentials['password']}`
          ).toString('base64');
          headers['authorization'] = `Basic ${credentials}`;
        }
        break;

      case 'bearer':
        if (auth.credentials['token']) {
          headers['authorization'] = `Bearer ${auth.credentials['token']}`;
        }
        break;

      case 'apikey':
        // API key can be in headers or credentials
        if (auth.credentials['key']) {
          headers['x-api-key'] = auth.credentials['key'];
        }
        break;
    }

    // Add custom headers
    if (auth.headers) {
      Object.entries(auth.headers).forEach(([key, value]) => {
        headers[key.toLowerCase()] = value;
      });
    }
  }

  /**
   * Validate URL format and security constraints
   */
  private validateUrl(url: string, securityChecks?: SecurityChecks): void {
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(url);
    } catch (error) {
      throw new Error(`Invalid URL format: ${url}`);
    }

    // Check protocol security in production
    if (process.env['NODE_ENV'] === 'production' && parsedUrl.protocol !== 'https:') {
      throw new Error('HTTPS is required in production mode');
    }

    // Apply security checks if configured
    if (securityChecks) {
      const hostname = parsedUrl.hostname;

      // Check localhost
      if (
        !securityChecks.allowLocalhost &&
        (hostname === 'localhost' || hostname === '127.0.0.1')
      ) {
        throw new Error(`URL not allowed by security policy: ${url}`);
      }

      // Check private IP ranges
      if (!securityChecks.allowPrivateIPs && this.isPrivateIP(hostname)) {
        throw new Error(`URL not allowed by security policy: ${url}`);
      }
    }
  }

  /**
   * Check if hostname is a private IP address
   */
  private isPrivateIP(hostname: string): boolean {
    const privateRanges = [/^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./, /^127\./];

    return privateRanges.some(range => range.test(hostname));
  }

  /**
   * Detect response format from content type or URL
   */
  private detectFormat(contentType: string, url: string): 'json' | 'yaml' | 'js' | 'ts' {
    if (contentType.includes('yaml') || contentType.includes('yml')) {
      return 'yaml';
    }

    if (url.endsWith('.yaml') || url.endsWith('.yml')) {
      return 'yaml';
    }

    if (url.endsWith('.js')) {
      return 'js';
    }

    if (url.endsWith('.ts')) {
      return 'ts';
    }

    return 'json'; // Default to JSON
  }

  /**
   * Parse response text based on format
   */
  private parseResponse(text: string, format: 'json' | 'yaml' | 'js' | 'ts'): any {
    switch (format) {
      case 'yaml':
        return yaml.load(text);
      case 'json':
      case 'js':
      case 'ts':
      default:
        return JSON.parse(text);
    }
  }

  /**
   * Process raw resource data into Resource object
   */
  private processResource(resourceData: any): Resource {
    const now = new Date();

    return {
      ...resourceData,
      createdAt: resourceData.createdAt ? new Date(resourceData.createdAt) : now,
      updatedAt: resourceData.updatedAt ? new Date(resourceData.updatedAt) : now,
      metadata: resourceData.metadata || {},
      connection: resourceData.connection || {},
      security: resourceData.security || {},
      tags: resourceData.tags || [],
    };
  }

  /**
   * Check if error should not be retried
   */
  private isNonRetryableError(error: any): boolean {
    // Don't retry for client errors (4xx)
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return true;
    }

    // Don't retry for certain error types
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return false; // These can be retried
    }

    return false;
  }

  /**
   * Get cached resources if they exist and are not expired
   */
  private getCachedResources(url: string, _ttl: number): Resource[] | null {
    const cached = this.cache.get(url);
    if (!cached) {
      return null;
    }

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.cache.delete(url);
      return null;
    }

    return cached.data;
  }

  /**
   * Cache resources with TTL
   */
  private cacheResources(url: string, resources: Resource[], ttl: number): void {
    this.cache.set(url, {
      data: resources,
      timestamp: Date.now(),
      ttl,
    });
  }
}

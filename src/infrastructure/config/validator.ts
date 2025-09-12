import { z } from 'zod';
import { MCPSCConfigSchema, PartialMCPSCConfigSchema } from '@infrastructure/config/schemas';
import { MCPSCError, ErrorCategory, ErrorSeverity } from '@core/errors/base';
import { ErrorCodes } from '@core/errors/codes';

/**
 * Configuration validation result
 */
export interface ValidationResult {
  success: boolean;
  data?: any;
  errors?: ValidationError[];
}

/**
 * Validation error details
 */
export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

/**
 * Configuration validator class
 */
export class ConfigurationValidator {
  private validationTimeout: number = 30000; // 30 seconds default

  /**
   * Set validation timeout
   */
  setValidationTimeout(timeout: number): void {
    this.validationTimeout = timeout;
  }

  /**
   * Validate complete configuration
   */
  async validateComplete(config: any): Promise<ValidationResult> {
    return this.validateWithTimeout(config, MCPSCConfigSchema);
  }

  /**
   * Validate partial configuration (for merging)
   */
  async validatePartial(config: any): Promise<ValidationResult> {
    return this.validateWithTimeout(config, PartialMCPSCConfigSchema);
  }

  /**
   * Validate configuration with timeout
   */
  private async validateWithTimeout(config: any, schema: z.ZodSchema): Promise<ValidationResult> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(
          new MCPSCError(
            ErrorCodes.CONFIG_VALIDATION_TIMEOUT,
            'Configuration validation timeout',
            ErrorCategory.CONFIGURATION,
            ErrorSeverity.ERROR,
            { timeout: this.validationTimeout }
          )
        );
      }, this.validationTimeout);

      try {
        // Check for circular references
        this.checkCircularReferences(config);

        // Validate with Zod schema
        const result = schema.safeParse(config);

        clearTimeout(timeoutId);

        if (result.success) {
          resolve({
            success: true,
            data: result.data,
          });
        } else {
          const errors = this.formatZodErrors(result.error);
          resolve({
            success: false,
            errors,
          });
        }
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof MCPSCError) {
          reject(error);
        } else {
          reject(
            new MCPSCError(
              ErrorCodes.CONFIG_VALIDATION_ERROR,
              'Configuration validation failed',
              ErrorCategory.CONFIGURATION,
              ErrorSeverity.ERROR,
              { originalError: error }
            )
          );
        }
      }
    });
  }

  /**
   * Check for circular references in configuration
   */
  private checkCircularReferences(obj: any, seen = new WeakSet()): void {
    if (obj === null || typeof obj !== 'object') {
      return;
    }

    if (seen.has(obj)) {
      throw new MCPSCError(
        ErrorCodes.CONFIG_CIRCULAR_REFERENCE,
        'Configuration contains circular references',
        ErrorCategory.CONFIGURATION,
        ErrorSeverity.ERROR
      );
    }

    seen.add(obj);

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        this.checkCircularReferences(obj[key], seen);
      }
    }

    seen.delete(obj);
  }

  /**
   * Format Zod validation errors
   */
  private formatZodErrors(error: z.ZodError): ValidationError[] {
    return error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));
  }

  /**
   * Validate TLS version
   */
  validateTLSVersion(version: string): boolean {
    const validVersions = ['TLSv1.2', 'TLSv1.3'];
    return validVersions.includes(version);
  }

  /**
   * Validate port number
   */
  validatePort(port: number): boolean {
    return Number.isInteger(port) && port >= 1 && port <= 65535;
  }

  /**
   * Validate URL format
   */
  validateURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate file path
   */
  validateFilePath(path: string): boolean {
    return typeof path === 'string' && path.length > 0 && !path.includes('\0');
  }

  /**
   * Validate log level
   */
  validateLogLevel(level: string): boolean {
    const validLevels = ['trace', 'debug', 'info', 'warn', 'error'];
    return validLevels.includes(level);
  }

  /**
   * Validate transport type
   */
  validateTransportType(type: string): boolean {
    const validTypes = ['stdio', 'sse', 'http'];
    return validTypes.includes(type);
  }

  /**
   * Validate authentication method
   */
  validateAuthMethod(method: string): boolean {
    const validMethods = ['ssh-key', 'password', 'certificate', 'bearer', 'basic', 'api-key'];
    return validMethods.includes(method);
  }

  /**
   * Validate encryption algorithm
   */
  validateEncryptionAlgorithm(algorithm: string): boolean {
    const validAlgorithms = ['aes-256-gcm', 'aes-256-cbc', 'chacha20-poly1305'];
    return validAlgorithms.includes(algorithm);
  }

  /**
   * Validate correlation ID generator
   */
  validateCorrelationGenerator(generator: string): boolean {
    const validGenerators = ['uuid', 'nanoid', 'custom'];
    return validGenerators.includes(generator);
  }

  /**
   * Create detailed validation error
   */
  createValidationError(path: string, message: string, value?: any): MCPSCError {
    return new MCPSCError(
      ErrorCodes.CONFIG_VALIDATION_ERROR,
      `Configuration validation failed: ${path}: ${message}`,
      ErrorCategory.CONFIGURATION,
      ErrorSeverity.ERROR,
      { path, value },
      [
        `Check the configuration value at path: ${path}`,
        'Refer to the documentation for valid values',
      ]
    );
  }
}

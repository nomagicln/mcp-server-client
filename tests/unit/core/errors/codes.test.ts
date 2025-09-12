import { ErrorCodes, getErrorInfo, isRecoverableError } from '@core/errors/codes';

describe('Error Codes', () => {
  describe('Error Code Ranges', () => {
    it('should have configuration errors in 1000-1099 range', () => {
      expect(ErrorCodes.CONFIG_INVALID_FORMAT).toBeGreaterThanOrEqual(1000);
      expect(ErrorCodes.CONFIG_INVALID_FORMAT).toBeLessThan(1100);

      expect(ErrorCodes.CONFIG_MISSING_REQUIRED).toBeGreaterThanOrEqual(1000);
      expect(ErrorCodes.CONFIG_MISSING_REQUIRED).toBeLessThan(1100);

      expect(ErrorCodes.CONFIG_VALIDATION_FAILED).toBeGreaterThanOrEqual(1000);
      expect(ErrorCodes.CONFIG_VALIDATION_FAILED).toBeLessThan(1100);
    });

    it('should have connection errors in 2000-2099 range', () => {
      expect(ErrorCodes.CONNECTION_FAILED).toBeGreaterThanOrEqual(2000);
      expect(ErrorCodes.CONNECTION_FAILED).toBeLessThan(2100);

      expect(ErrorCodes.CONNECTION_TIMEOUT).toBeGreaterThanOrEqual(2000);
      expect(ErrorCodes.CONNECTION_TIMEOUT).toBeLessThan(2100);

      expect(ErrorCodes.CONNECTION_AUTH_FAILED).toBeGreaterThanOrEqual(2000);
      expect(ErrorCodes.CONNECTION_AUTH_FAILED).toBeLessThan(2100);
    });

    it('should have resource errors in 3000-3099 range', () => {
      expect(ErrorCodes.RESOURCE_NOT_FOUND).toBeGreaterThanOrEqual(3000);
      expect(ErrorCodes.RESOURCE_NOT_FOUND).toBeLessThan(3100);

      expect(ErrorCodes.RESOURCE_INVALID_DEFINITION).toBeGreaterThanOrEqual(3000);
      expect(ErrorCodes.RESOURCE_INVALID_DEFINITION).toBeLessThan(3100);

      expect(ErrorCodes.RESOURCE_LOAD_FAILED).toBeGreaterThanOrEqual(3000);
      expect(ErrorCodes.RESOURCE_LOAD_FAILED).toBeLessThan(3100);
    });

    it('should have protocol errors in 4000-4099 range', () => {
      expect(ErrorCodes.PROTOCOL_INVALID_MESSAGE).toBeGreaterThanOrEqual(4000);
      expect(ErrorCodes.PROTOCOL_INVALID_MESSAGE).toBeLessThan(4100);

      expect(ErrorCodes.PROTOCOL_UNSUPPORTED_METHOD).toBeGreaterThanOrEqual(4000);
      expect(ErrorCodes.PROTOCOL_UNSUPPORTED_METHOD).toBeLessThan(4100);

      expect(ErrorCodes.PROTOCOL_VERSION_MISMATCH).toBeGreaterThanOrEqual(4000);
      expect(ErrorCodes.PROTOCOL_VERSION_MISMATCH).toBeLessThan(4100);
    });

    it('should have system errors in 5000-5099 range', () => {
      expect(ErrorCodes.SYSTEM_INTERNAL_ERROR).toBeGreaterThanOrEqual(5000);
      expect(ErrorCodes.SYSTEM_INTERNAL_ERROR).toBeLessThan(5100);

      expect(ErrorCodes.SYSTEM_OUT_OF_MEMORY).toBeGreaterThanOrEqual(5000);
      expect(ErrorCodes.SYSTEM_OUT_OF_MEMORY).toBeLessThan(5100);

      expect(ErrorCodes.SYSTEM_SHUTDOWN).toBeGreaterThanOrEqual(5000);
      expect(ErrorCodes.SYSTEM_SHUTDOWN).toBeLessThan(5100);
    });

    it('should have execution errors in 6000-6099 range', () => {
      expect(ErrorCodes.EXECUTION_FAILED).toBeGreaterThanOrEqual(6000);
      expect(ErrorCodes.EXECUTION_FAILED).toBeLessThan(6100);

      expect(ErrorCodes.EXECUTION_TIMEOUT).toBeGreaterThanOrEqual(6000);
      expect(ErrorCodes.EXECUTION_TIMEOUT).toBeLessThan(6100);

      expect(ErrorCodes.EXECUTION_PERMISSION_DENIED).toBeGreaterThanOrEqual(6000);
      expect(ErrorCodes.EXECUTION_PERMISSION_DENIED).toBeLessThan(6100);
    });
  });

  describe('Error Information', () => {
    it('should provide error information for configuration errors', () => {
      const info = getErrorInfo(ErrorCodes.CONFIG_INVALID_FORMAT);

      expect(info).toBeDefined();
      expect(info!.category).toBe('configuration');
      expect(info!.severity).toBe('error');
      expect(info!.recoverable).toBe(false);
      expect(info!.description).toContain('format');
    });

    it('should provide error information for connection errors', () => {
      const info = getErrorInfo(ErrorCodes.CONNECTION_TIMEOUT);

      expect(info).toBeDefined();
      expect(info!.category).toBe('connection');
      expect(info!.severity).toBe('warning');
      expect(info!.recoverable).toBe(true);
      expect(info!.description).toContain('timed out');
    });

    it('should provide error information for resource errors', () => {
      const info = getErrorInfo(ErrorCodes.RESOURCE_NOT_FOUND);

      expect(info).toBeDefined();
      expect(info!.category).toBe('resource');
      expect(info!.severity).toBe('error');
      expect(info!.recoverable).toBe(false);
      expect(info!.description).toContain('not found');
    });

    it('should provide error information for protocol errors', () => {
      const info = getErrorInfo(ErrorCodes.PROTOCOL_INVALID_MESSAGE);

      expect(info).toBeDefined();
      expect(info!.category).toBe('protocol');
      expect(info!.severity).toBe('error');
      expect(info!.recoverable).toBe(false);
      expect(info!.description).toContain('Invalid');
    });

    it('should provide error information for execution errors', () => {
      const info = getErrorInfo(ErrorCodes.EXECUTION_TIMEOUT);

      expect(info).toBeDefined();
      expect(info!.category).toBe('execution');
      expect(info!.severity).toBe('error');
      expect(info!.recoverable).toBe(true);
      expect(info!.description).toContain('timed out');
    });

    it('should provide error information for system errors', () => {
      const info = getErrorInfo(ErrorCodes.SYSTEM_INTERNAL_ERROR);

      expect(info).toBeDefined();
      expect(info!.category).toBe('system');
      expect(info!.severity).toBe('critical');
      expect(info!.recoverable).toBe(false);
      expect(info!.description).toContain('Internal');
    });

    it('should return undefined for unknown error codes', () => {
      const info = getErrorInfo(99999);
      expect(info).toBeUndefined();
    });
  });

  describe('Error Recoverability', () => {
    it('should identify recoverable errors', () => {
      expect(isRecoverableError(ErrorCodes.CONNECTION_TIMEOUT)).toBe(true);
      expect(isRecoverableError(ErrorCodes.CONNECTION_FAILED)).toBe(true);
      expect(isRecoverableError(ErrorCodes.EXECUTION_TIMEOUT)).toBe(true);
      expect(isRecoverableError(ErrorCodes.RESOURCE_DISABLED)).toBe(true);
    });

    it('should identify non-recoverable errors', () => {
      expect(isRecoverableError(ErrorCodes.CONFIG_INVALID_FORMAT)).toBe(false);
      expect(isRecoverableError(ErrorCodes.RESOURCE_NOT_FOUND)).toBe(false);
      expect(isRecoverableError(ErrorCodes.PROTOCOL_INVALID_MESSAGE)).toBe(false);
      expect(isRecoverableError(ErrorCodes.SYSTEM_INTERNAL_ERROR)).toBe(false);
    });

    it('should return false for unknown error codes', () => {
      expect(isRecoverableError(99999)).toBe(false);
    });
  });

  describe('Error Code Uniqueness', () => {
    it('should have unique error codes', () => {
      const codes = Object.values(ErrorCodes);
      const uniqueCodes = new Set(codes);

      expect(codes.length).toBe(uniqueCodes.size);
    });

    it('should have meaningful error code names', () => {
      const codeNames = Object.keys(ErrorCodes);

      codeNames.forEach(name => {
        expect(name).toMatch(/^[A-Z_]+$/);
        expect(name.length).toBeGreaterThan(5);
      });
    });
  });
});

/**
 * Logging Utilities
 *
 * Structured logging with request ID context for tracing.
 * Shared across edge functions.
 */

/**
 * Generate a short unique request ID for tracing.
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `req_${timestamp}_${random}`;
}

/**
 * Structured logger with request ID context.
 */
export function createLogger(requestId: string) {
  const prefix = `[${requestId}]`;

  return {
    info: (message: string, data?: Record<string, unknown>) => {
      console.log(prefix, message, data ? JSON.stringify(data) : "");
    },
    warn: (message: string, data?: Record<string, unknown>) => {
      console.warn(prefix, message, data ? JSON.stringify(data) : "");
    },
    error: (
      message: string,
      error?: unknown,
      data?: Record<string, unknown>,
    ) => {
      const errorInfo = error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : { value: String(error) };
      console.error(prefix, message, JSON.stringify({ ...errorInfo, ...data }));
    },
    timing: (operation: string, startTime: number) => {
      const duration = Date.now() - startTime;
      console.log(
        prefix,
        `${operation} completed`,
        JSON.stringify({ duration_ms: duration }),
      );
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;

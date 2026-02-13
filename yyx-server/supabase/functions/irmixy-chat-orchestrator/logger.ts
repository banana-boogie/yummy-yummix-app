/**
 * Re-export from shared logger.
 * The logger now lives in _shared/ for reuse across edge functions.
 */
export {
  createLogger,
  generateRequestId,
  type Logger,
} from "../_shared/logger.ts";

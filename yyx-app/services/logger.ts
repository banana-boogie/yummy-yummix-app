type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levelWeight: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const runtimeLevel: LogLevel = __DEV__ ? 'debug' : 'warn';

function shouldLog(level: LogLevel) {
  return levelWeight[level] >= levelWeight[runtimeLevel];
}

export const logger = {
  debug: (message: string, ...args: unknown[]) => {
    if (!shouldLog('debug')) return;
    console.debug(message, ...args);
  },
  info: (message: string, ...args: unknown[]) => {
    if (!shouldLog('info')) return;
    console.info(message, ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    if (!shouldLog('warn')) return;
    console.warn(message, ...args);
  },
  error: (message: string, ...args: unknown[]) => {
    if (!shouldLog('error')) return;
    console.error(message, ...args);
  },
};

export default logger;

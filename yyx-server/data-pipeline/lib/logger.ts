/**
 * Structured Logger
 *
 * Provides colored, timestamped log output for pipeline scripts.
 */

const colors = {
  reset: '\x1b[0m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

export class Logger {
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  info(message: string, data?: unknown): void {
    this.log(colors.blue, 'INFO', message, data);
  }

  success(message: string, data?: unknown): void {
    this.log(colors.green, 'OK', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log(colors.yellow, 'WARN', message, data);
  }

  error(message: string, data?: unknown): void {
    this.log(colors.red, 'ERROR', message, data);
  }

  /** Print a section header */
  section(title: string): void {
    console.log(`\n${colors.bold}${colors.blue}--- ${title} ---${colors.reset}\n`);
  }

  /** Print a summary table */
  summary(stats: Record<string, number | string>): void {
    console.log(`\n${colors.bold}Summary:${colors.reset}`);
    for (const [key, value] of Object.entries(stats)) {
      const color = typeof value === 'number' && value > 0 ? colors.green : colors.gray;
      console.log(`  ${key}: ${color}${value}${colors.reset}`);
    }
    console.log('');
  }

  private log(color: string, level: string, message: string, data?: unknown): void {
    const time = new Date().toISOString().slice(11, 19);
    const prefix =
      `${colors.gray}${time}${colors.reset} ${color}[${level}]${colors.reset} ${colors.gray}[${this.prefix}]${colors.reset}`;
    if (data !== undefined) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
}

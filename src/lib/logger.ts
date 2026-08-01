function formatMsg(level: string, msg: string): string {
  return `[${new Date().toISOString()}] [${level}] ${msg}`;
}

export const logger = {
  info(msg: string, ...args: unknown[]): void {
    console.log(formatMsg('INFO', msg), ...args);
  },
  warn(msg: string, ...args: unknown[]): void {
    console.warn(formatMsg('WARN', msg), ...args);
  },
  error(msg: string, ...args: unknown[]): void {
    console.error(formatMsg('ERROR', msg), ...args);
  },
};

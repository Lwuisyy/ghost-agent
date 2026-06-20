import pino from 'pino';

export function createLogger(level: string = 'info') {
  return pino({
    level,
    transport: {
      target: 'pino/file',
      options: { destination: 1 }, // stdout
    },
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
  });
}

export type Logger = ReturnType<typeof createLogger>;

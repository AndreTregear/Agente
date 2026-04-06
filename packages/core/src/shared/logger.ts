import pino from 'pino';

export const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
  },
  level: process.env.LOG_LEVEL || 'info',
});

export function logStartupBanner(appName?: string) {
  const name = appName || process.env.APP_NAME || '@yaya/core';
  logger.info('');
  logger.info('═══════════════════════════════════════════');
  logger.info(`  🚀  ${name}`);
  logger.info('═══════════════════════════════════════════');
  logger.info('');
}

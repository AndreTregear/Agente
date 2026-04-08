import pino from 'pino';

export const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
  },
  level: process.env.LOG_LEVEL || 'info',
});

export function logStartupBanner() {
  logger.info('');
  logger.info('═══════════════════════════════════════════');
  logger.info('  🏥  Y A Y A   S A L U D');
  logger.info('  Asistente de salud por WhatsApp para Perú');
  logger.info('═══════════════════════════════════════════');
  logger.info('');
}

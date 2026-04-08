import dotenv from 'dotenv';
dotenv.config();

const { startPlatform } = await import('./platform.js');
const { logger } = await import('./shared/logger.js');
const { WEB_PORT } = await import('./config.js');

let shutdown: (() => Promise<void>) | undefined;

async function main() {
  shutdown = await startPlatform(WEB_PORT);
  logger.info('Yaya Health is running');
}

process.on('SIGINT', () => {
  (shutdown?.() ?? Promise.resolve()).then(() => process.exit(0)).catch(() => process.exit(1));
});
process.on('SIGTERM', () => {
  (shutdown?.() ?? Promise.resolve()).then(() => process.exit(0)).catch(() => process.exit(1));
});

main().catch((err) => {
  logger.error(err, 'Fatal error');
  process.exit(1);
});

import { logger } from '../shared/logger.js';
import { appBus } from '../shared/events.js';

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Check for due reminders every minute and emit events.
 */
export function startReminderScheduler(): void {
  intervalId = setInterval(async () => {
    try {
      // In production: query DB for reminders where scheduled_at <= now AND active = true
      // For now, emit a check event
      appBus.emit('reminder-check', { timestamp: new Date() });
    } catch (err) {
      logger.error(err, 'Reminder scheduler error');
    }
  }, 60_000); // Every minute

  logger.info('Reminder scheduler started (60s interval)');
}

export async function stopReminderScheduler(): Promise<void> {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

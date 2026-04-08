/**
 * Medication Reminder — CRUD for medication schedules + reminder generation.
 */

export interface Medication {
  id: string;
  patientId: string;
  tenantId: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  route: string;
  startDate: Date;
  endDate?: Date;
  active: boolean;
  prescribedBy?: string;
  notes?: string;
}

export interface Reminder {
  id: string;
  patientId: string;
  tenantId: string;
  medicationId?: string;
  reminderType: 'medication' | 'appointment' | 'measurement' | 'vaccination';
  title: string;
  scheduledAt: Date;
  recurrenceRule?: string;
  lastSentAt?: Date;
  active: boolean;
}

/**
 * Parse a Spanish frequency description into a cron-like recurrence rule.
 * Examples:
 *  - "cada 8 horas" → "FREQ=HOURLY;INTERVAL=8"
 *  - "diario" / "cada día" → "FREQ=DAILY;INTERVAL=1"
 *  - "2 veces al día" → "FREQ=DAILY;COUNT=2" (morning + evening)
 *  - "cada 12 horas" → "FREQ=HOURLY;INTERVAL=12"
 *  - "semanal" → "FREQ=WEEKLY;INTERVAL=1"
 *  - "cada semana" → "FREQ=WEEKLY;INTERVAL=1"
 */
export function parseFrequency(frequency: string): { rule: string; timesPerDay: number; intervalHours: number } {
  const f = frequency.toLowerCase().trim();

  // "cada X horas"
  const hoursMatch = f.match(/cada\s+(\d+)\s*horas?/);
  if (hoursMatch) {
    const hours = Number(hoursMatch[1]);
    return {
      rule: `FREQ=HOURLY;INTERVAL=${hours}`,
      timesPerDay: Math.floor(24 / hours),
      intervalHours: hours,
    };
  }

  // "X veces al día"
  const timesMatch = f.match(/(\d+)\s*vece?s?\s*(?:al\s*d[ií]a|diarias?)/);
  if (timesMatch) {
    const times = Number(timesMatch[1]);
    const interval = Math.floor(24 / times);
    return {
      rule: `FREQ=DAILY;COUNT=${times}`,
      timesPerDay: times,
      intervalHours: interval,
    };
  }

  // "diario" / "cada día" / "todos los días"
  if (f.match(/diario|cada\s+d[ií]a|todos\s+los\s+d[ií]as/)) {
    return { rule: 'FREQ=DAILY;INTERVAL=1', timesPerDay: 1, intervalHours: 24 };
  }

  // "semanal" / "cada semana" / "una vez por semana"
  if (f.match(/semanal|cada\s+semana|una\s+vez\s+(?:por|a\s+la)\s+semana/)) {
    return { rule: 'FREQ=WEEKLY;INTERVAL=1', timesPerDay: 0.14, intervalHours: 168 };
  }

  // "mensual" / "cada mes"
  if (f.match(/mensual|cada\s+mes/)) {
    return { rule: 'FREQ=MONTHLY;INTERVAL=1', timesPerDay: 0.03, intervalHours: 720 };
  }

  // Default: assume daily
  return { rule: 'FREQ=DAILY;INTERVAL=1', timesPerDay: 1, intervalHours: 24 };
}

/**
 * Generate reminder times for a medication based on its frequency.
 * Distributes times evenly across waking hours (6:00-22:00).
 */
export function generateReminderTimes(
  startDate: Date,
  timesPerDay: number,
  intervalHours: number,
): Date[] {
  const WAKE_START = 6; // 6 AM
  const WAKE_END = 22;  // 10 PM
  const WAKE_HOURS = WAKE_END - WAKE_START;

  if (timesPerDay < 1) {
    // Weekly or less frequent — just use 8 AM
    const reminder = new Date(startDate);
    reminder.setHours(8, 0, 0, 0);
    return [reminder];
  }

  const times: Date[] = [];
  const gap = WAKE_HOURS / timesPerDay;

  for (let i = 0; i < timesPerDay; i++) {
    const hour = WAKE_START + Math.round(gap * i);
    const reminder = new Date(startDate);
    reminder.setHours(Math.min(hour, WAKE_END), 0, 0, 0);
    times.push(reminder);
  }

  return times;
}

/**
 * Check if a medication is due for a reminder right now (within tolerance window).
 */
export function isDue(reminder: Reminder, now: Date = new Date(), toleranceMinutes: number = 15): boolean {
  if (!reminder.active) return false;
  const diff = Math.abs(now.getTime() - reminder.scheduledAt.getTime());
  return diff <= toleranceMinutes * 60 * 1000;
}

/**
 * Format a medication reminder as a WhatsApp message.
 */
export function formatReminderMessage(medication: Medication): string {
  const lines: string[] = [];
  lines.push('💊 *Recordatorio de medicamento*');
  lines.push('');
  lines.push(`📌 *${medication.medicationName}*`);
  lines.push(`💉 Dosis: ${medication.dosage}`);
  lines.push(`🕐 Frecuencia: ${medication.frequency}`);
  lines.push(`📝 Vía: ${medication.route}`);

  if (medication.notes) {
    lines.push(`ℹ️ Nota: ${medication.notes}`);
  }

  lines.push('');
  lines.push('¿Ya tomaste tu medicamento? Responde *sí* o *no*.');
  lines.push('');
  lines.push('_Nunca dejes de tomar tu medicamento sin consultar al médico._');
  return lines.join('\n');
}

/**
 * Format a summary of all active medications.
 */
export function formatMedicationList(medications: Medication[]): string {
  if (medications.length === 0) {
    return 'No tienes medicamentos registrados. ¿Quieres agregar alguno?';
  }

  const lines: string[] = [];
  lines.push('💊 *Tus medicamentos activos:*');
  lines.push('');

  for (let i = 0; i < medications.length; i++) {
    const med = medications[i];
    lines.push(`${i + 1}. *${med.medicationName}* — ${med.dosage}`);
    lines.push(`   📅 ${med.frequency} | Vía: ${med.route}`);
    if (med.endDate) {
      lines.push(`   ⏰ Hasta: ${med.endDate.toLocaleDateString('es-PE')}`);
    }
  }

  lines.push('');
  lines.push('_Para agregar o quitar un medicamento, dime el nombre y la dosis._');
  return lines.join('\n');
}

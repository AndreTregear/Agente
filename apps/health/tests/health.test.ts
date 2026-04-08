import { describe, it, expect } from 'vitest';
import { assessGrowth, ageInMonths } from '../src/health/growth-tracker.js';
import { analyzeNutrition } from '../src/health/nutrition-analyzer.js';
import { classifyBloodPressure, classifyGlucose, classifyBMI } from '../src/health/health-readings.js';
import { parseFrequency } from '../src/health/medication-reminder.js';
import { findFood } from '../src/health/peruvian-foods.js';
import { scrubPII } from '../src/ai/pii-scrubber.js';
import { encryptField, decryptField } from '../src/crypto/field-crypto.js';
import { detectIntent } from '../src/bot/handler.js';
import crypto from 'node:crypto';

describe('Growth Tracker', () => {
  it('calculates age in months correctly', () => {
    const dob = new Date('2024-03-24');
    const now = new Date('2026-03-24');
    const age = ageInMonths(dob, now);
    expect(age).toBeCloseTo(24, 0);
  });

  it('assesses a healthy 12-month boy', () => {
    const result = assessGrowth('M', new Date('2025-03-24'), 9.6, 75.7);
    expect(result.weightForAge).toBeDefined();
    expect(result.weightForAge!.classification).toBe('normal');
    expect(result.flags).toHaveLength(0);
  });

  it('flags severe stunting', () => {
    const result = assessGrowth('F', new Date('2023-09-24'), 10, 78);
    expect(result.heightForAge!.zScore).toBeLessThan(-2);
    expect(result.flags.some(f => f.includes('stunting'))).toBe(true);
  });

  it('rejects children over 60 months', () => {
    const result = assessGrowth('M', new Date('2018-01-01'), 20, 110);
    expect(result.flags).toContain('age_out_of_range');
  });
});

describe('Nutrition Analyzer', () => {
  it('parses simple Spanish food description', () => {
    const result = analyzeNutrition('arroz con pollo y leche');
    expect(result.parsed_foods.length).toBeGreaterThanOrEqual(3);
    expect(result.total_calories).toBeGreaterThan(200);
  });

  it('handles quantities in Spanish', () => {
    const result = analyzeNutrition('2 huevos y una taza de arroz');
    expect(result.parsed_foods.length).toBeGreaterThanOrEqual(2);
    expect(result.total_protein_g).toBeGreaterThan(10);
  });

  it('finds iron-rich foods', () => {
    const sangrecita = findFood('sangrecita');
    expect(sangrecita).not.toBeNull();
    expect(sangrecita!.iron_mg).toBeGreaterThan(20);
  });
});

describe('Health Readings', () => {
  it('classifies normal blood pressure', () => {
    const bp = classifyBloodPressure(115, 75);
    expect(bp.classification).toBe('normal');
  });

  it('classifies hypertensive crisis', () => {
    const bp = classifyBloodPressure(185, 125);
    expect(bp.classification).toBe('crisis_hipertensiva');
    expect(bp.alerts.length).toBeGreaterThan(0);
  });

  it('classifies fasting glucose levels', () => {
    expect(classifyGlucose(85, true).classification).toBe('normal');
    expect(classifyGlucose(110, true).classification).toBe('prediabetes');
    expect(classifyGlucose(140, true).classification).toBe('diabetes');
  });

  it('classifies BMI', () => {
    expect(classifyBMI(70, 175).classification).toBe('normal');
    expect(classifyBMI(95, 170).classification).toContain('obesidad');
  });
});

describe('Medication Reminder', () => {
  it('parses "cada 8 horas"', () => {
    const freq = parseFrequency('cada 8 horas');
    expect(freq.timesPerDay).toBe(3);
    expect(freq.intervalHours).toBe(8);
  });

  it('parses "diario"', () => {
    const freq = parseFrequency('diario');
    expect(freq.timesPerDay).toBe(1);
  });

  it('parses "2 veces al día"', () => {
    const freq = parseFrequency('2 veces al día');
    expect(freq.timesPerDay).toBe(2);
  });
});

describe('PII Scrubber', () => {
  it('scrubs phone numbers', () => {
    expect(scrubPII('Llámame al 951234567')).not.toContain('951234567');
  });

  it('scrubs DNI numbers', () => {
    expect(scrubPII('DNI 12345678')).toContain('[DNI]');
  });

  it('scrubs patient names', () => {
    const result = scrubPII('Paciente María García');
    expect(result).not.toContain('María García');
    expect(result).toContain('[PATIENT_NAME]');
  });
});

describe('Encryption', () => {
  it('encrypts and decrypts field values', () => {
    const dek = crypto.randomBytes(32);
    const original = 'Juan Pérez';
    const encrypted = encryptField(original, dek, 't1', 'patients', 'name');
    const decrypted = decryptField(encrypted, dek, 't1', 'patients', 'name');
    expect(decrypted).toBe(original);
  });

  it('fails with wrong tenant (AAD)', () => {
    const dek = crypto.randomBytes(32);
    const encrypted = encryptField('test', dek, 't1', 'patients', 'name');
    const result = decryptField(encrypted, dek, 't2', 'patients', 'name');
    expect(result).toBeNull();
  });
});

describe('Intent Detection', () => {
  it('detects greeting', () => {
    expect(detectIntent('Hola')).toBe('greeting');
  });

  it('detects growth measurement', () => {
    expect(detectIntent('Mi hijo pesa 10 kilos')).toBe('growth_measurement');
  });

  it('detects food logging', () => {
    expect(detectIntent('Hoy comimos ceviche')).toBe('food_log');
  });

  it('detects blood pressure', () => {
    expect(detectIntent('Mi presión es 130/85')).toBe('blood_pressure');
  });
});

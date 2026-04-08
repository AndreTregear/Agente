/**
 * WHO Child Growth Assessment — Z-Score Calculation and Classification
 *
 * Implements the LMS method for computing z-scores against WHO Child Growth
 * Standards, and provides clinical classification with Spanish-language
 * recommendations suitable for Yaya Health's WhatsApp-based workflow.
 */

import {
  weightForAge,
  heightForAge,
  weightForHeight,
  bmiForAge,
  type LMSEntry,
  type WHOIndicator,
} from './who-standards.js';

/**
 * Interpolate LMS values for a given x (age in months or height in cm)
 * between the nearest reference points.
 */
function interpolateLMS(table: LMSEntry[], x: number): { L: number; M: number; S: number } {
  // If x is below the first point, use the first point
  if (x <= table[0].x) return { L: table[0].L, M: table[0].M, S: table[0].S };
  // If x is above the last point, use the last point
  if (x >= table[table.length - 1].x) {
    const last = table[table.length - 1];
    return { L: last.L, M: last.M, S: last.S };
  }
  // Find bracketing points and interpolate
  for (let i = 0; i < table.length - 1; i++) {
    if (x >= table[i].x && x <= table[i + 1].x) {
      const t = (x - table[i].x) / (table[i + 1].x - table[i].x);
      return {
        L: table[i].L + t * (table[i + 1].L - table[i].L),
        M: table[i].M + t * (table[i + 1].M - table[i].M),
        S: table[i].S + t * (table[i + 1].S - table[i].S),
      };
    }
  }
  // Fallback (should not reach)
  const last = table[table.length - 1];
  return { L: last.L, M: last.M, S: last.S };
}

/**
 * Calculate z-score using the LMS method.
 * z = ((value/M)^L - 1) / (L * S)  when L ≠ 0
 * z = ln(value/M) / S               when L = 0
 */
function calculateZScore(value: number, L: number, M: number, S: number): number {
  if (Math.abs(L) < 0.001) {
    // L ≈ 0, use logarithmic formula
    return Math.log(value / M) / S;
  }
  return (Math.pow(value / M, L) - 1) / (L * S);
}

export type Sex = 'M' | 'F';

export interface GrowthAssessment {
  weightForAge?: { zScore: number; classification: string };
  heightForAge?: { zScore: number; classification: string };
  weightForHeight?: { zScore: number; classification: string };
  bmiForAge?: { zScore: number; classification: string };
  flags: string[];
  recommendations: string[];
}

function classifyZScore(z: number, indicator: string): string {
  if (z < -3) return 'severe';
  if (z < -2) return 'moderate';
  if (z < -1) return 'mild';
  if (z <= 1) return 'normal';
  if (z <= 2) return 'above_normal';
  if (z <= 3) return 'elevated';
  return 'very_elevated';
}

function getTable(indicator: WHOIndicator, sex: Sex): LMSEntry[] {
  return sex === 'M' ? indicator.boys : indicator.girls;
}

/**
 * Calculate age in months from date of birth.
 */
export function ageInMonths(dateOfBirth: Date, measurementDate: Date = new Date()): number {
  const years = measurementDate.getFullYear() - dateOfBirth.getFullYear();
  const months = measurementDate.getMonth() - dateOfBirth.getMonth();
  const days = measurementDate.getDate() - dateOfBirth.getDate();
  return years * 12 + months + (days < 0 ? -1 : 0) + (days < 0 ? 30 + days : days) / 30.44;
}

/**
 * Assess a child's growth using WHO standards.
 *
 * @param sex - 'M' or 'F'
 * @param dateOfBirth - Child's date of birth
 * @param weightKg - Weight in kilograms (optional)
 * @param heightCm - Height/length in centimeters (optional)
 * @param measurementDate - Date of measurement (defaults to now)
 */
export function assessGrowth(
  sex: Sex,
  dateOfBirth: Date,
  weightKg?: number,
  heightCm?: number,
  measurementDate: Date = new Date(),
): GrowthAssessment {
  const age = ageInMonths(dateOfBirth, measurementDate);
  const flags: string[] = [];
  const recommendations: string[] = [];
  const result: GrowthAssessment = { flags, recommendations };

  // Only assess children 0-60 months
  if (age < 0 || age > 60) {
    flags.push('age_out_of_range');
    return result;
  }

  // Weight-for-age
  if (weightKg !== undefined && age <= 60) {
    const lms = interpolateLMS(getTable(weightForAge, sex), age);
    const z = calculateZScore(weightKg, lms.L, lms.M, lms.S);
    const classification = classifyZScore(z, 'weight_for_age');
    result.weightForAge = { zScore: Math.round(z * 100) / 100, classification };

    if (z < -3) {
      flags.push('severe_underweight');
      recommendations.push('Referir URGENTE al centro de salud. Peso severamente bajo para la edad.');
    } else if (z < -2) {
      flags.push('underweight');
      recommendations.push('Consultar con el médico. Peso bajo para la edad. Aumentar alimentos ricos en energía y proteína.');
    }
  }

  // Height-for-age (stunting indicator)
  if (heightCm !== undefined && age <= 60) {
    const lms = interpolateLMS(getTable(heightForAge, sex), age);
    const z = calculateZScore(heightCm, lms.L, lms.M, lms.S);
    const classification = classifyZScore(z, 'height_for_age');
    result.heightForAge = { zScore: Math.round(z * 100) / 100, classification };

    if (z < -3) {
      flags.push('severe_stunting');
      recommendations.push('Referir URGENTE. Desnutrición crónica severa. Necesita evaluación médica inmediata.');
    } else if (z < -2) {
      flags.push('stunting');
      recommendations.push('Talla baja para la edad (desnutrición crónica). Mejorar alimentación con proteínas de alta calidad, hierro y zinc.');
    }
  }

  // Weight-for-height (wasting indicator)
  if (weightKg !== undefined && heightCm !== undefined && heightCm >= 45 && heightCm <= 120) {
    const lms = interpolateLMS(getTable(weightForHeight, sex), heightCm);
    const z = calculateZScore(weightKg, lms.L, lms.M, lms.S);
    const classification = classifyZScore(z, 'weight_for_height');
    result.weightForHeight = { zScore: Math.round(z * 100) / 100, classification };

    if (z < -3) {
      flags.push('severe_wasting');
      recommendations.push('EMERGENCIA NUTRICIONAL. Emaciación severa. Referir al centro de salud AHORA.');
    } else if (z < -2) {
      flags.push('wasting');
      recommendations.push('Peso bajo para la talla. Necesita alimentación complementaria intensiva. Consultar con nutricionista.');
    } else if (z > 2) {
      flags.push('overweight');
      recommendations.push('Sobrepeso. Reducir alimentos azucarados y procesados. Consultar con nutricionista.');
    } else if (z > 3) {
      flags.push('obese');
      recommendations.push('Obesidad. Referir al médico para evaluación y plan de alimentación.');
    }
  }

  // BMI-for-age
  if (weightKg !== undefined && heightCm !== undefined && age <= 60) {
    const heightM = heightCm / 100;
    const bmi = weightKg / (heightM * heightM);
    const lms = interpolateLMS(getTable(bmiForAge, sex), age);
    const z = calculateZScore(bmi, lms.L, lms.M, lms.S);
    const classification = classifyZScore(z, 'bmi_for_age');
    result.bmiForAge = { zScore: Math.round(z * 100) / 100, classification };
  }

  // Anemia risk flag for age groups at high risk
  if (age >= 6 && age <= 35) {
    recommendations.push('Edad de alto riesgo de anemia (6-35 meses). Asegurar consumo de hierro: hígado, sangrecita, lentejas, espinaca.');
  }

  return result;
}

/**
 * Format growth assessment as a WhatsApp-friendly message in Spanish.
 */
export function formatGrowthMessage(childName: string, assessment: GrowthAssessment): string {
  const lines: string[] = [];
  lines.push(`📊 *Evaluación de crecimiento — ${childName}*`);
  lines.push('');

  if (assessment.weightForAge) {
    const { zScore, classification } = assessment.weightForAge;
    const emoji = zScore < -2 ? '⚠️' : zScore < -1 ? '🔶' : '✅';
    lines.push(`${emoji} Peso/edad: z=${zScore} (${classification})`);
  }
  if (assessment.heightForAge) {
    const { zScore, classification } = assessment.heightForAge;
    const emoji = zScore < -2 ? '⚠️' : zScore < -1 ? '🔶' : '✅';
    lines.push(`${emoji} Talla/edad: z=${zScore} (${classification})`);
  }
  if (assessment.weightForHeight) {
    const { zScore, classification } = assessment.weightForHeight;
    const emoji = zScore < -2 ? '⚠️' : zScore > 2 ? '🔶' : '✅';
    lines.push(`${emoji} Peso/talla: z=${zScore} (${classification})`);
  }
  if (assessment.bmiForAge) {
    const { zScore, classification } = assessment.bmiForAge;
    lines.push(`📏 IMC/edad: z=${zScore} (${classification})`);
  }

  if (assessment.flags.length > 0) {
    lines.push('');
    lines.push('🚩 *Alertas:*');
    for (const flag of assessment.flags) {
      lines.push(`  • ${flag.replace(/_/g, ' ')}`);
    }
  }

  if (assessment.recommendations.length > 0) {
    lines.push('');
    lines.push('💡 *Recomendaciones:*');
    for (const rec of assessment.recommendations) {
      lines.push(`  • ${rec}`);
    }
  }

  lines.push('');
  lines.push('_Yaya Salud es un asistente informativo. No reemplaza la consulta médica._');
  return lines.join('\n');
}

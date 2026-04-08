// TB Screening & Adherence Module — Yaya Salud Phase 3 Module C

// ─── Types ─────────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high';

export type TBSymptom =
  | 'cough_2weeks'
  | 'weight_loss'
  | 'night_sweats'
  | 'fever'
  | 'hemoptysis'
  | 'fatigue'
  | 'chest_pain';

export type TBRiskFactor =
  | 'tb_contact'
  | 'hiv_positive'
  | 'crowded_housing'
  | 'malnutrition'
  | 'previous_tb'
  | 'indigenous_community';

export interface SymptomScreenResult {
  symptoms: TBSymptom[];
  riskLevel: RiskLevel;
  reason: string;
}

export interface RiskFactorResult {
  factors: TBRiskFactor[];
  riskLevel: RiskLevel;
  count: number;
}

export interface CombinedAssessment {
  symptomResult: SymptomScreenResult;
  riskFactorResult: RiskFactorResult;
  overallRisk: RiskLevel;
  recommendation: string;
}

export type DOTSPhase = 'intensive' | 'continuation';

export interface AdherenceReminder {
  day: number;
  phase: DOTSPhase;
  message: string;
  isMedicationDay: boolean;
}

export interface TBMyth {
  id: number;
  myth: string;
  correction: string;
  category: string;
}

export interface MDRWarning {
  detected: boolean;
  warnings: string[];
  recommendation: string;
}

export interface TBFacility {
  department: string;
  name: string;
  city: string;
  capabilities: string[];
}

// ─── Symptom Screening ─────────────────────────────────────────────────────

const ALL_SYMPTOMS: TBSymptom[] = [
  'cough_2weeks', 'weight_loss', 'night_sweats',
  'fever', 'hemoptysis', 'fatigue', 'chest_pain',
];

export function screenSymptoms(symptoms: TBSymptom[]): SymptomScreenResult {
  const valid = symptoms.filter(s => ALL_SYMPTOMS.includes(s));
  const unique = [...new Set(valid)];

  // HIGH: hemoptysis OR (cough>2wk + fever + weight loss)
  const hasHemoptysis = unique.includes('hemoptysis');
  const highCombo =
    unique.includes('cough_2weeks') &&
    unique.includes('fever') &&
    unique.includes('weight_loss');

  if (hasHemoptysis) {
    return {
      symptoms: unique,
      riskLevel: 'high',
      reason: 'Hemoptisis detectada — requiere evaluación médica urgente.',
    };
  }

  if (highCombo) {
    return {
      symptoms: unique,
      riskLevel: 'high',
      reason: 'Combinación de tos >2 semanas, fiebre y pérdida de peso — alta sospecha de TB.',
    };
  }

  if (unique.length >= 2) {
    return {
      symptoms: unique,
      riskLevel: 'medium',
      reason: `${unique.length} síntomas presentes — se recomienda evaluación médica.`,
    };
  }

  if (unique.length === 1) {
    return {
      symptoms: unique,
      riskLevel: 'low',
      reason: 'Un solo síntoma — monitorear y consultar si persiste más de 2 semanas.',
    };
  }

  return {
    symptoms: [],
    riskLevel: 'low',
    reason: 'Sin síntomas de TB reportados.',
  };
}

// ─── Risk Factor Assessment ─────────────────────────────────────────────────

export function assessRiskFactors(factors: TBRiskFactor[]): RiskFactorResult {
  const unique = [...new Set(factors)];
  const count = unique.length;

  let riskLevel: RiskLevel;
  if (unique.includes('hiv_positive') || unique.includes('tb_contact') || count >= 3) {
    riskLevel = 'high';
  } else if (count >= 2) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }

  return { factors: unique, riskLevel, count };
}

// ─── Combined Classification ────────────────────────────────────────────────

const RISK_PRIORITY: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };

function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return RISK_PRIORITY[a] >= RISK_PRIORITY[b] ? a : b;
}

const RECOMMENDATIONS: Record<RiskLevel, string> = {
  high: '⚠️ URGENTE: Acuda al centro de salud más cercano para prueba de baciloscopia o GeneXpert. No demore.',
  medium: '🟡 Se recomienda visitar un establecimiento de salud para evaluación de TB en los próximos días.',
  low: '🟢 Riesgo bajo. Monitoree síntomas. Si aparece tos persistente >2 semanas, consulte a un profesional.',
};

export function classifyTBRisk(
  symptoms: TBSymptom[],
  factors: TBRiskFactor[],
): CombinedAssessment {
  const symptomResult = screenSymptoms(symptoms);
  const riskFactorResult = assessRiskFactors(factors);

  // Escalate: medium symptoms + any risk factor → high
  let overallRisk = maxRisk(symptomResult.riskLevel, riskFactorResult.riskLevel);
  if (symptomResult.riskLevel === 'medium' && riskFactorResult.count >= 1) {
    overallRisk = 'high';
  }

  return {
    symptomResult,
    riskFactorResult,
    overallRisk,
    recommendation: RECOMMENDATIONS[overallRisk],
  };
}

// ─── Treatment Adherence Tracker ────────────────────────────────────────────

// Intensive phase: months 1-2 (days 1-60), daily
// Continuation phase: months 3-6 (days 61-180), Mon/Wed/Fri

const INTENSIVE_DAYS = 60;
const TOTAL_DAYS = 180;

function getPhase(day: number): DOTSPhase {
  return day <= INTENSIVE_DAYS ? 'intensive' : 'continuation';
}

function isMedicationDay(day: number): boolean {
  if (day <= INTENSIVE_DAYS) return true;
  // Continuation: 3x/week (Mon, Wed, Fri)
  // Map day to weekday assuming treatment starts on Monday (day 1)
  const weekday = ((day - 1) % 7); // 0=Mon, 1=Tue, ..., 6=Sun
  return weekday === 0 || weekday === 2 || weekday === 4; // Mon, Wed, Fri
}

const INTENSIVE_MESSAGES = [
  '💊 ¡Buenos días! Hoy es día {day} de tu tratamiento. Toma tus medicamentos a la misma hora todos los días.',
  '💊 Día {day} — Fase intensiva. Recuerda: completar el tratamiento es la clave para curarte.',
  '💊 Día {day} — ¡Sigue adelante! Cada pastilla te acerca a la cura. No dejes de tomar tus medicinas.',
  '💊 Día {day} — Tu cuerpo está luchando contra la TB. Los medicamentos son tu mejor aliado.',
];

const CONTINUATION_MED_MESSAGES = [
  '💊 Día {day} — Fase de continuación. Hoy toca medicación. ¡Ya llevas más de la mitad!',
  '💊 Día {day} — Toma tus medicamentos hoy. La constancia es lo que cura la TB.',
  '💊 Día {day} — ¡Buen trabajo! Sigue tomando tus medicinas los días indicados.',
];

const CONTINUATION_REST_MESSAGES = [
  '🌟 Día {day} — Hoy no toca medicación, pero cuida tu alimentación y descansa bien.',
  '🌟 Día {day} — Día de descanso. Come bien, toma agua y vigila cualquier síntoma nuevo.',
];

const MILESTONE_MESSAGES: Record<number, string> = {
  1: '🎯 ¡Primer día de tratamiento! Los próximos 6 meses cambiarán tu vida. Tú puedes.',
  30: '🎉 ¡Un mes de tratamiento! Tu cuerpo ya está respondiendo. No te detengas.',
  60: '🏆 ¡Fase intensiva completa! Ahora pasas a la fase de continuación (3 veces por semana).',
  90: '💪 ¡3 meses! Ya pasaste la mitad. Sigue así, estás venciendo a la TB.',
  120: '🌟 ¡4 meses! Falta poco para terminar. Tu compromiso salva vidas.',
  150: '🔥 ¡5 meses! Solo 30 días más. ¡La meta está cerca!',
  180: '🎊 ¡FELICIDADES! Completaste tu tratamiento de TB. Consulta con tu médico para confirmar la cura.',
};

export function generateReminder(day: number): AdherenceReminder {
  if (day < 1 || day > TOTAL_DAYS) {
    throw new Error(`Día fuera de rango: ${day}. El tratamiento dura de 1 a ${TOTAL_DAYS} días.`);
  }

  const phase = getPhase(day);
  const medDay = isMedicationDay(day);

  // Check milestones first
  let message: string;
  if (MILESTONE_MESSAGES[day]) {
    message = MILESTONE_MESSAGES[day];
  } else if (phase === 'intensive') {
    const pool = INTENSIVE_MESSAGES;
    message = pool[day % pool.length].replace('{day}', String(day));
  } else if (medDay) {
    const pool = CONTINUATION_MED_MESSAGES;
    message = pool[day % pool.length].replace('{day}', String(day));
  } else {
    const pool = CONTINUATION_REST_MESSAGES;
    message = pool[day % pool.length].replace('{day}', String(day));
  }

  return { day, phase, message, isMedicationDay: medDay };
}

// ─── Myth Buster ────────────────────────────────────────────────────────────

export const TB_MYTHS: TBMyth[] = [
  {
    id: 1,
    myth: 'La tuberculosis es una maldición o castigo divino',
    correction: 'La TB es causada por la bacteria Mycobacterium tuberculosis. Se transmite por el aire cuando una persona infectada tose o estornuda. No tiene relación con maldiciones ni castigos.',
    category: 'causa',
  },
  {
    id: 2,
    myth: 'Las hierbas tradicionales curan la tuberculosis',
    correction: 'Algunas hierbas pueden ayudar con síntomas como la tos, pero NO eliminan la bacteria. Los medicamentos antituberculosos son esenciales. Puedes usar algunas hierbas seguras JUNTO con el tratamiento médico, nunca como reemplazo.',
    category: 'tratamiento',
  },
  {
    id: 3,
    myth: 'El tratamiento de TB te hace sentir peor',
    correction: 'Es normal sentir algunos efectos secundarios al inicio (náuseas, cansancio). Esto significa que los medicamentos están trabajando. Los efectos disminuyen con el tiempo. Si son severos, consulta a tu médico — NO dejes de tomar la medicina.',
    category: 'tratamiento',
  },
  {
    id: 4,
    myth: 'Si ya me siento mejor, puedo dejar el tratamiento',
    correction: 'Sentirse mejor NO significa estar curado. Las bacterias pueden seguir vivas. Dejar el tratamiento temprano causa TB resistente (MDR-TB), mucho más difícil de tratar. Completa los 6 meses completos.',
    category: 'tratamiento',
  },
  {
    id: 5,
    myth: 'La TB solo afecta a personas pobres',
    correction: 'La TB puede afectar a cualquier persona, sin importar nivel económico. Es más común donde hay hacinamiento y mala ventilación, pero nadie es inmune.',
    category: 'estigma',
  },
  {
    id: 6,
    myth: 'La TB se contagia por compartir cubiertos o ropa',
    correction: 'La TB se transmite por gotitas en el AIRE al toser, estornudar o hablar. No se contagia por tocar objetos, compartir cubiertos ni dar la mano.',
    category: 'transmisión',
  },
  {
    id: 7,
    myth: 'La TB es hereditaria',
    correction: 'La TB NO es genética ni hereditaria. Es una infección bacteriana que se transmite por el aire. Vivir con alguien con TB activa aumenta el riesgo de contagio, pero no se hereda.',
    category: 'causa',
  },
  {
    id: 8,
    myth: 'Solo los alcohólicos y drogadictos tienen TB',
    correction: 'El consumo de alcohol y drogas debilitan el sistema inmune y aumentan el riesgo, pero la TB afecta a personas de todas las condiciones. Niños, adultos mayores y personas con VIH son especialmente vulnerables.',
    category: 'estigma',
  },
  {
    id: 9,
    myth: 'La TB siempre es mortal',
    correction: 'La TB es CURABLE con el tratamiento correcto de 6 meses. Sin tratamiento puede ser mortal, pero con medicamentos la tasa de curación supera el 85%.',
    category: 'pronóstico',
  },
  {
    id: 10,
    myth: 'La vacuna BCG me protege completamente contra la TB',
    correction: 'La BCG protege a los niños contra formas graves de TB (meningitis TB), pero NO previene completamente la TB pulmonar en adultos. Puedes tener la vacuna y aún enfermarte.',
    category: 'prevención',
  },
  {
    id: 11,
    myth: 'Tomar leche de vaca cura la tuberculosis',
    correction: 'La leche es nutritiva y ayuda a mantener fuerzas durante el tratamiento, pero NO cura la TB. Solo los medicamentos antituberculosos eliminan la bacteria.',
    category: 'tratamiento',
  },
  {
    id: 12,
    myth: 'Si tengo TB debo aislarme completamente de mi familia',
    correction: 'Después de 2-3 semanas de tratamiento correcto, el riesgo de contagio baja mucho. Al inicio, ventila bien los espacios, cubre tu boca al toser y usa mascarilla. No necesitas aislamiento total.',
    category: 'transmisión',
  },
  {
    id: 13,
    myth: 'La TB solo afecta los pulmones',
    correction: 'La TB pulmonar es la más común, pero la bacteria puede afectar ganglios, huesos, riñones, cerebro y otros órganos (TB extrapulmonar).',
    category: 'causa',
  },
  {
    id: 14,
    myth: 'El ajo y la cebolla curan la tuberculosis',
    correction: 'El ajo y la cebolla tienen propiedades antibacterianas leves y son buenos para la nutrición, pero NO eliminan Mycobacterium tuberculosis. Son un complemento alimenticio, no un reemplazo del tratamiento médico.',
    category: 'tratamiento',
  },
  {
    id: 15,
    myth: 'La tuberculosis ya no existe, es una enfermedad del pasado',
    correction: 'La TB sigue siendo una de las enfermedades infecciosas más mortales del mundo. En Perú hay más de 30,000 casos nuevos cada año. Es un problema actual y real.',
    category: 'estigma',
  },
  {
    id: 16,
    myth: 'El sol cura la tuberculosis',
    correction: 'La luz solar y la vitamina D son buenos para la salud general, pero NO curan la TB. Solo el tratamiento médico completo elimina la bacteria.',
    category: 'tratamiento',
  },
  {
    id: 17,
    myth: 'Si la prueba de esputo sale negativa, no tengo TB',
    correction: 'La baciloscopia puede dar falsos negativos, especialmente al inicio. Si tienes síntomas persistentes, tu médico puede solicitar cultivos, GeneXpert o radiografía de tórax.',
    category: 'diagnóstico',
  },
];

export function lookupMyth(searchTerm: string): TBMyth[] {
  const term = searchTerm.toLowerCase();
  return TB_MYTHS.filter(
    m =>
      m.myth.toLowerCase().includes(term) ||
      m.correction.toLowerCase().includes(term) ||
      m.category.toLowerCase().includes(term),
  );
}

export function getMythById(id: number): TBMyth | undefined {
  return TB_MYTHS.find(m => m.id === id);
}

export function getMythsByCategory(category: string): TBMyth[] {
  return TB_MYTHS.filter(m => m.category === category);
}

// ─── MDR-TB Warning Detection ───────────────────────────────────────────────

export interface MDRCheckInput {
  monthsOnTreatment: number;
  symptomsPersist: boolean;
  symptomsReturning: boolean;
  sputumStillPositive: boolean;
  missedDoses: number;
}

export function checkMDRWarnings(input: MDRCheckInput): MDRWarning {
  const warnings: string[] = [];

  if (input.monthsOnTreatment >= 2 && input.sputumStillPositive) {
    warnings.push('Esputo positivo después de 2 meses de tratamiento — posible resistencia.');
  }

  if (input.symptomsReturning) {
    warnings.push('Síntomas reaparecieron después de mejoría — posible falla terapéutica.');
  }

  if (input.monthsOnTreatment >= 2 && input.symptomsPersist) {
    warnings.push('Síntomas persisten después de 2+ meses de tratamiento.');
  }

  if (input.missedDoses >= 10) {
    warnings.push(`${input.missedDoses} dosis perdidas — riesgo alto de resistencia por adherencia irregular.`);
  }

  const detected = warnings.length > 0;

  return {
    detected,
    warnings,
    recommendation: detected
      ? '🔴 ALERTA MDR-TB: Acuda URGENTEMENTE al centro de salud. Podría necesitar prueba GeneXpert y cambio de esquema de tratamiento.'
      : '✅ Sin señales de alerta de TB resistente. Continúe el tratamiento según indicación.',
  };
}

// ─── Regional Facility Database ─────────────────────────────────────────────

export const TB_FACILITIES: TBFacility[] = [
  // Amazon region
  {
    department: 'Loreto',
    name: 'Hospital Regional de Loreto Felipe Arriola Iglesias',
    city: 'Iquitos',
    capabilities: ['baciloscopia', 'genexpert', 'cultivo', 'radiografía'],
  },
  {
    department: 'Loreto',
    name: 'Centro de Salud San Juan',
    city: 'Iquitos',
    capabilities: ['baciloscopia', 'radiografía'],
  },
  {
    department: 'Junín',
    name: 'Hospital Daniel Alcides Carrión',
    city: 'Huancayo',
    capabilities: ['baciloscopia', 'genexpert', 'cultivo', 'radiografía'],
  },
  {
    department: 'Junín',
    name: 'Hospital de Apoyo La Merced',
    city: 'Chanchamayo',
    capabilities: ['baciloscopia', 'radiografía'],
  },
  // Andes / Southern highlands
  {
    department: 'Cusco',
    name: 'Hospital Antonio Lorena',
    city: 'Cusco',
    capabilities: ['baciloscopia', 'genexpert', 'cultivo', 'radiografía'],
  },
  {
    department: 'Cusco',
    name: 'Hospital Regional del Cusco',
    city: 'Cusco',
    capabilities: ['baciloscopia', 'genexpert', 'radiografía'],
  },
  {
    department: 'Puno',
    name: 'Hospital Regional Manuel Núñez Butrón',
    city: 'Puno',
    capabilities: ['baciloscopia', 'genexpert', 'cultivo', 'radiografía'],
  },
  {
    department: 'Puno',
    name: 'Hospital Carlos Monge Medrano',
    city: 'Juliaca',
    capabilities: ['baciloscopia', 'genexpert', 'radiografía'],
  },
  // Northern highlands
  {
    department: 'Cajamarca',
    name: 'Hospital Regional Docente de Cajamarca',
    city: 'Cajamarca',
    capabilities: ['baciloscopia', 'genexpert', 'cultivo', 'radiografía'],
  },
  // Central highlands
  {
    department: 'Huancavelica',
    name: 'Hospital Departamental de Huancavelica',
    city: 'Huancavelica',
    capabilities: ['baciloscopia', 'genexpert', 'radiografía'],
  },
  // South
  {
    department: 'Arequipa',
    name: 'Hospital Goyeneche',
    city: 'Arequipa',
    capabilities: ['baciloscopia', 'genexpert', 'cultivo', 'radiografía'],
  },
  {
    department: 'Arequipa',
    name: 'Hospital Honorio Delgado Espinoza',
    city: 'Arequipa',
    capabilities: ['baciloscopia', 'genexpert', 'cultivo', 'radiografía'],
  },
  // Lima
  {
    department: 'Lima',
    name: 'Hospital Nacional Hipólito Unanue',
    city: 'Lima',
    capabilities: ['baciloscopia', 'genexpert', 'cultivo', 'radiografía', 'prueba_molecular'],
  },
  {
    department: 'Lima',
    name: 'Hospital Nacional Sergio E. Bernales',
    city: 'Lima',
    capabilities: ['baciloscopia', 'genexpert', 'cultivo', 'radiografía'],
  },
  // Amazonas
  {
    department: 'Amazonas',
    name: 'Hospital Regional Virgen de Fátima',
    city: 'Chachapoyas',
    capabilities: ['baciloscopia', 'genexpert', 'radiografía'],
  },
  // Ucayali
  {
    department: 'Ucayali',
    name: 'Hospital Regional de Pucallpa',
    city: 'Pucallpa',
    capabilities: ['baciloscopia', 'genexpert', 'cultivo', 'radiografía'],
  },
  // Madre de Dios
  {
    department: 'Madre de Dios',
    name: 'Hospital Santa Rosa',
    city: 'Puerto Maldonado',
    capabilities: ['baciloscopia', 'genexpert', 'radiografía'],
  },
  // Ayacucho
  {
    department: 'Ayacucho',
    name: 'Hospital Regional de Ayacucho',
    city: 'Ayacucho',
    capabilities: ['baciloscopia', 'genexpert', 'radiografía'],
  },
];

export function findFacilities(department: string): TBFacility[] {
  const dept = department.toLowerCase().trim();
  return TB_FACILITIES.filter(f => f.department.toLowerCase() === dept);
}

export function findFacilitiesWithCapability(capability: string): TBFacility[] {
  const cap = capability.toLowerCase().trim();
  return TB_FACILITIES.filter(f => f.capabilities.some(c => c.toLowerCase() === cap));
}

export function getAllDepartments(): string[] {
  return [...new Set(TB_FACILITIES.map(f => f.department))].sort();
}

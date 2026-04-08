/**
 * Maternal Health Deep-Dive Module
 *
 * Comprehensive prenatal, birth, and postpartum support for rural Peruvian
 * communities. All text in Spanish. Designed for WhatsApp delivery (short,
 * actionable messages). No external dependencies.
 *
 * Key features:
 * - Gestational week calculator (from LMP)
 * - Week-by-week prenatal guidance (trimester-appropriate)
 * - Danger sign classifier (green/yellow/red severity)
 * - Birth plan generator
 * - Postpartum monitoring checklist (days 1–42)
 * - Partner education messages ("three delays")
 * - Iron needs during pregnancy
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type Severity = 'green' | 'yellow' | 'red';
export type Trimester = 1 | 2 | 3;

export interface GestationalAge {
  weeks: number;
  days: number;
  trimester: Trimester;
  dueDate: Date;
  /** Weeks remaining until due date (40 weeks) */
  weeksRemaining: number;
}

export interface DangerSignResult {
  severity: Severity;
  symptoms: string[];
  guidance: string;
  seekCare: boolean;
  /** Time frame for seeking care */
  urgency: string;
}

export interface BirthPlanInput {
  dueDate: Date;
  nearestFacility: string;
  transportAvailable: boolean;
  emergencyContacts: Array<{ name: string; phone: string }>;
  /** Optional: distance to facility in minutes */
  distanceMinutes?: number;
}

export interface BirthPlan {
  dueDate: string;
  facility: string;
  transport: string;
  emergencyContacts: Array<{ name: string; phone: string }>;
  preparationChecklist: string[];
  warningSignsToWatch: string[];
  whenToLeave: string;
  essentialBag: string[];
}

export interface PostpartumCheck {
  dayRange: string;
  phase: string;
  watchFor: string[];
  seekHelpIf: string[];
  selfCare: string[];
}

export interface PartnerMessage {
  topic: string;
  message: string;
}

export interface IronGuidance {
  dailyNeedMg: number;
  trimester: Trimester;
  foods: Array<{ name: string; ironMgPer100g: number; type: 'heme' | 'non-heme' }>;
  absorptionTips: string[];
  avoid: string[];
}

// ─── Gestational Week Calculator ────────────────────────────────────────────

/**
 * Calculate gestational age from last menstrual period (LMP) date.
 * Standard obstetric calculation: pregnancy is dated from LMP, not conception.
 * Due date = LMP + 280 days (Naegele's rule).
 */
export function calculateGestationalAge(lmpDate: Date, referenceDate?: Date): GestationalAge {
  const now = referenceDate ?? new Date();
  // Use UTC noon to avoid DST issues when computing day differences
  const lmpUtc = Date.UTC(lmpDate.getFullYear(), lmpDate.getMonth(), lmpDate.getDate(), 12);
  const refUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12);

  const diffMs = refUtc - lmpUtc;
  const totalDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (totalDays < 0) {
    throw new Error('La fecha de última menstruación no puede ser en el futuro');
  }

  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;

  // Due date: LMP + 280 days
  const dueDateUtc = lmpUtc + 280 * 24 * 60 * 60 * 1000;
  const dueDate = new Date(lmpDate.getFullYear(), lmpDate.getMonth(), lmpDate.getDate());
  dueDate.setDate(dueDate.getDate() + 280);
  const weeksRemaining = Math.max(0, 40 - weeks);

  let trimester: Trimester;
  if (weeks < 13) trimester = 1;
  else if (weeks < 27) trimester = 2;
  else trimester = 3;

  return { weeks, days, trimester, dueDate, weeksRemaining };
}

// ─── Prenatal Guidance ──────────────────────────────────────────────────────

const FIRST_TRIMESTER_GUIDANCE: Record<string, string> = {
  general: '📋 Primer trimestre (semanas 1-12): Tu bebé se está formando. Es normal sentir náuseas y cansancio.',
  nutrition: '🥗 Come poco y seguido. Incluye ácido fólico (lentejas, espinaca, hígado). Toma tus vitaminas prenatales.',
  activity: '🚶‍♀️ Camina 30 minutos diarios. Descansa cuando lo necesites. Evita cargar cosas pesadas.',
  checkups: '🏥 Tu primer control prenatal debe ser antes de la semana 12. Lleva tu DNI y seguro.',
  warning: '⚠️ Busca ayuda si tienes: sangrado vaginal, dolor abdominal fuerte, o fiebre mayor a 38°C.',
};

const SECOND_TRIMESTER_GUIDANCE: Record<string, string> = {
  general: '📋 Segundo trimestre (semanas 13-26): ¡Tu bebé crece rápido! Empezarás a sentir sus movimientos.',
  nutrition: '🥩 Necesitas más hierro ahora. Come sangrecita, hígado, lentejas. Combina con vitamina C (limón, camu camu).',
  activity: '🚶‍♀️ Sigue caminando. Evita estar mucho tiempo de pie. Duerme de lado izquierdo.',
  checkups: '🏥 Control prenatal cada mes. Ecografía entre semana 18-22 para ver cómo crece tu bebé.',
  warning: '⚠️ Busca ayuda si tienes: hinchazón de manos/cara, dolor de cabeza fuerte, o dejas de sentir al bebé.',
};

const THIRD_TRIMESTER_GUIDANCE: Record<string, string> = {
  general: '📋 Tercer trimestre (semanas 27-40): ¡Ya falta poco! Tu bebé gana peso y se prepara para nacer.',
  nutrition: '🍊 Sigue con alimentos ricos en hierro. Come cada 3 horas. Toma mucha agua.',
  activity: '🛏️ Descansa más, pero sigue caminando. Practica respiración profunda. Prepara tu bolso para el parto.',
  checkups: '🏥 Control cada 2 semanas hasta la semana 36, luego cada semana. Habla con tu médico sobre el parto.',
  warning: '⚠️ Ve al hospital AHORA si: pierdes líquido, sangras, tienes contracciones cada 5 minutos, o no sientes al bebé.',
};

/**
 * Get trimester-appropriate prenatal guidance in Spanish.
 */
export function getPrenatalGuidance(trimester: Trimester): Record<string, string> {
  switch (trimester) {
    case 1: return { ...FIRST_TRIMESTER_GUIDANCE };
    case 2: return { ...SECOND_TRIMESTER_GUIDANCE };
    case 3: return { ...THIRD_TRIMESTER_GUIDANCE };
  }
}

/**
 * Get specific guidance for a gestational week.
 */
export function getWeeklyGuidance(weeks: number): string {
  if (weeks < 0 || weeks > 42) return '⚠️ Semana fuera de rango. Consulta con tu médico.';

  if (weeks <= 4) return '🌱 Semanas 1-4: El embrión se implanta. Toma ácido fólico (400mcg diarios). Evita alcohol y tabaco.';
  if (weeks <= 8) return '💓 Semanas 5-8: El corazón de tu bebé ya late. Las náuseas son normales. Come galletas secas al despertar.';
  if (weeks <= 12) return '👶 Semanas 9-12: Tu bebé ya tiene forma humana. Primer control prenatal y análisis de sangre.';
  if (weeks <= 16) return '✨ Semanas 13-16: Las náuseas suelen mejorar. Tu bebé mide ~12cm. ¡Buen momento para ecografía!';
  if (weeks <= 20) return '🦶 Semanas 17-20: ¡Puedes empezar a sentir al bebé moverse! Ecografía morfológica entre semana 18-22.';
  if (weeks <= 24) return '👂 Semanas 21-24: Tu bebé ya escucha tu voz. Háblale y cántale. Control de glucosa (semana 24-28).';
  if (weeks <= 28) return '👁️ Semanas 25-28: Tu bebé abre los ojos. Cuenta sus movimientos: debe moverse al menos 10 veces al día.';
  if (weeks <= 32) return '🫁 Semanas 29-32: Los pulmones maduran. Prepara tu plan de parto y bolso para el hospital.';
  if (weeks <= 36) return '⬇️ Semanas 33-36: Tu bebé se posiciona cabeza abajo. Controles cada 2 semanas. Descansa más.';
  if (weeks <= 38) return '🎒 Semanas 37-38: ¡Tu bebé está a término! Ten listo: DNI, seguro, bolso, transporte al hospital.';
  if (weeks <= 40) return '🍼 Semanas 39-40: ¡Puede nacer en cualquier momento! Ve al hospital si contracciones duran 1 min cada 5 min.';
  return '⏰ Más de 40 semanas: Tu médico evaluará si necesitas inducción. No te preocupes, muchos bebés nacen en semana 41.';
}

// ─── Danger Sign Classifier ─────────────────────────────────────────────────

interface DangerPattern {
  keywords: string[];
  /** All keywords must match (AND logic) */
  requireAll?: boolean;
  severity: Severity;
  symptomLabel: string;
  guidance: string;
  urgency: string;
}

const DANGER_PATTERNS: DangerPattern[] = [
  // RED — Immediate emergency
  {
    keywords: ['hemorragia', 'sangrado abundante', 'sangrado fuerte', 'mucha sangre'],
    severity: 'red',
    symptomLabel: 'Hemorragia',
    guidance: '🚨 EMERGENCIA: Sangrado abundante puede ser peligroso. Acuéstate, NO camines. Alguien debe llevarte al hospital AHORA.',
    urgency: 'INMEDIATO — Ve al hospital ahora',
  },
  {
    keywords: ['convulsiones', 'convulsión', 'ataque', 'temblor fuerte'],
    severity: 'red',
    symptomLabel: 'Convulsiones',
    guidance: '🚨 EMERGENCIA: Las convulsiones en el embarazo son muy peligrosas (eclampsia). Ponla de lado, NO metas nada en su boca. Llama emergencias AHORA.',
    urgency: 'INMEDIATO — Llama emergencias',
  },
  {
    keywords: ['dolor de cabeza', 'visión borrosa', 've lucecitas', 've estrellas', 'cambios en la visión'],
    requireAll: false,
    severity: 'red',
    symptomLabel: 'Posible pre-eclampsia',
    guidance: '🚨 URGENTE: Dolor de cabeza fuerte con cambios en la visión puede ser pre-eclampsia. Ve al hospital HOY. No esperes.',
    urgency: 'INMEDIATO — Ve al hospital hoy',
  },
  {
    keywords: ['fiebre', 'escalofríos'],
    requireAll: true,
    severity: 'red',
    symptomLabel: 'Fiebre con escalofríos (posible infección)',
    guidance: '🚨 URGENTE: Fiebre con escalofríos puede ser infección grave. Ve al centro de salud HOY. Toma agua y bájate la fiebre con paños húmedos.',
    urgency: 'INMEDIATO — Ve al centro de salud hoy',
  },
  {
    keywords: ['fiebre alta', 'fiebre 38', 'fiebre 39', 'fiebre 40', 'fiebre mayor'],
    severity: 'red',
    symptomLabel: 'Fiebre alta',
    guidance: '🚨 URGENTE: Fiebre mayor a 38°C en el embarazo necesita atención médica. Ve al centro de salud HOY.',
    urgency: 'INMEDIATO — Ve al centro de salud hoy',
  },
  {
    keywords: ['rompió fuente', 'perdió líquido', 'sale agua', 'bolsa rota', 'ruptura de membranas'],
    severity: 'red',
    symptomLabel: 'Ruptura de membranas',
    guidance: '🚨 Si se rompió la fuente antes de la semana 37, ve al hospital INMEDIATAMENTE. Si es después de la semana 37, ve al hospital con calma pero sin demora.',
    urgency: 'INMEDIATO — Ve al hospital',
  },

  // YELLOW — Seek care soon
  {
    keywords: ['vómito persistente', 'vómitos constantes', 'no puedo comer nada', 'vomito todo', 'hiperemesis'],
    severity: 'yellow',
    symptomLabel: 'Vómitos persistentes',
    guidance: '⚠️ Si no puedes retener líquidos por más de 24 horas, necesitas atención médica. Puedes deshidratarte. Ve al centro de salud.',
    urgency: 'Dentro de 24 horas',
  },
  {
    keywords: ['hinchazón manos', 'hinchazón cara', 'manos hinchadas', 'cara hinchada', 'hinchazón de manos', 'hinchazón de cara'],
    severity: 'yellow',
    symptomLabel: 'Hinchazón de manos o cara',
    guidance: '⚠️ Hinchazón de manos o cara puede ser señal de pre-eclampsia. Ve al centro de salud en las próximas 24 horas para que te tomen la presión.',
    urgency: 'Dentro de 24 horas',
  },
  {
    keywords: ['no se mueve', 'no siento al bebé', 'se mueve menos', 'movimiento reducido', 'dejó de moverse'],
    severity: 'yellow',
    symptomLabel: 'Reducción de movimientos fetales',
    guidance: '⚠️ Si tu bebé se mueve menos de lo normal: acuéstate de lado, toma algo dulce y cuenta los movimientos por 2 horas. Si son menos de 10, ve al centro de salud.',
    urgency: 'Dentro de 24 horas — prueba contar movimientos primero',
  },
  {
    keywords: ['dolor al orinar', 'arde al orinar', 'ardor al orinar', 'infección urinaria', 'orina con dolor'],
    severity: 'yellow',
    symptomLabel: 'Dolor al orinar (posible infección urinaria)',
    guidance: '⚠️ Las infecciones urinarias en el embarazo pueden ser peligrosas. Ve al centro de salud para un análisis de orina. Toma mucha agua.',
    urgency: 'Dentro de 24-48 horas',
  },

  // GREEN — Normal symptoms, self-care
  {
    keywords: ['náuseas', 'nausea', 'asco', 'mareo'],
    severity: 'green',
    symptomLabel: 'Náuseas leves',
    guidance: '✅ Las náuseas son normales, especialmente en el primer trimestre. Come poco y seguido. Galletas secas al despertar. Jengibre ayuda.',
    urgency: 'Normal — consulta en tu próximo control',
  },
  {
    keywords: ['dolor de espalda', 'me duele la espalda', 'espalda'],
    severity: 'green',
    symptomLabel: 'Dolor de espalda',
    guidance: '✅ El dolor de espalda es común en el embarazo. Usa zapatos cómodos, no cargues cosas pesadas, duerme de lado con una almohada entre las piernas.',
    urgency: 'Normal — consulta en tu próximo control',
  },
  {
    keywords: ['cansancio', 'fatiga', 'sueño', 'agotada', 'cansada'],
    severity: 'green',
    symptomLabel: 'Fatiga',
    guidance: '✅ El cansancio es normal en el embarazo. Descansa cuando puedas. Come bien, toma hierro y ácido fólico. Duerme 8 horas.',
    urgency: 'Normal — descansa y cuídate',
  },
  {
    keywords: ['braxton hicks', 'contracciones falsas', 'se pone dura la barriga', 'barriga dura'],
    severity: 'green',
    symptomLabel: 'Contracciones de Braxton Hicks',
    guidance: '✅ Las contracciones de Braxton Hicks son normales. Se van con reposo y agua. Si son regulares (cada 5 min por 1 hora), ve al hospital.',
    urgency: 'Normal — descansa y toma agua',
  },
];

/**
 * Classify danger signs from a symptom description.
 * Returns the highest severity match with guidance.
 */
export function classifyDangerSigns(symptomDescription: string): DangerSignResult {
  const text = symptomDescription.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normalizedText = text;

  const matches: Array<{ pattern: DangerPattern; matchCount: number }> = [];

  for (const pattern of DANGER_PATTERNS) {
    const normalizedKeywords = pattern.keywords.map(k =>
      k.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    );

    if (pattern.requireAll) {
      const allMatch = normalizedKeywords.every(kw => normalizedText.includes(kw));
      if (allMatch) matches.push({ pattern, matchCount: normalizedKeywords.length });
    } else {
      const matchCount = normalizedKeywords.filter(kw => normalizedText.includes(kw)).length;
      if (matchCount > 0) matches.push({ pattern, matchCount });
    }
  }

  if (matches.length === 0) {
    return {
      severity: 'green',
      symptoms: [],
      guidance: '✅ No se detectaron señales de peligro. Si tienes dudas, consulta con tu médico en tu próximo control prenatal.',
      seekCare: false,
      urgency: 'Normal — consulta en tu próximo control',
    };
  }

  // Sort: red first, then yellow, then green; within same severity, most matches first
  const severityOrder: Record<Severity, number> = { red: 0, yellow: 1, green: 2 };
  matches.sort((a, b) => {
    const diff = severityOrder[a.pattern.severity] - severityOrder[b.pattern.severity];
    return diff !== 0 ? diff : b.matchCount - a.matchCount;
  });

  const topMatch = matches[0].pattern;
  const allSymptoms = matches.map(m => m.pattern.symptomLabel);
  // Deduplicate
  const uniqueSymptoms = [...new Set(allSymptoms)];

  return {
    severity: topMatch.severity,
    symptoms: uniqueSymptoms,
    guidance: topMatch.guidance,
    seekCare: topMatch.severity !== 'green',
    urgency: topMatch.urgency,
  };
}

// ─── Birth Plan Generator ───────────────────────────────────────────────────

/**
 * Generate a structured birth plan in Spanish.
 */
export function generateBirthPlan(input: BirthPlanInput): BirthPlan {
  const dueDateStr = input.dueDate.toLocaleDateString('es-PE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const transportText = input.transportAvailable
    ? '✅ Transporte disponible — Ten listo el vehículo con gasolina desde la semana 37'
    : '⚠️ Sin transporte propio — Coordina AHORA con un vecino, taxi o ambulancia. Ten el número listo.';

  const whenToLeave = input.distanceMinutes
    ? input.distanceMinutes > 60
      ? `🚗 Tu centro de salud está a más de 1 hora. Sal ANTES de que las contracciones sean cada 10 minutos. Considera ir a una casa de espera materna desde la semana 38.`
      : input.distanceMinutes > 30
        ? `🚗 Tu centro de salud está a ~${input.distanceMinutes} minutos. Sal cuando las contracciones sean cada 7-8 minutos.`
        : `🚗 Tu centro de salud está cerca (~${input.distanceMinutes} min). Sal cuando las contracciones sean cada 5 minutos y duren 1 minuto.`
    : '🚗 Sal cuando las contracciones sean cada 5 minutos, duren 1 minuto y lleves 1 hora así (regla 5-1-1).';

  return {
    dueDate: dueDateStr,
    facility: input.nearestFacility,
    transport: transportText,
    emergencyContacts: input.emergencyContacts,
    preparationChecklist: [
      '📋 Documentos: DNI, seguro SIS/EsSalud, carnet de control prenatal',
      '💰 Dinero para emergencias y transporte',
      '📱 Teléfono cargado con números de emergencia guardados',
      '🩸 Conoce tu tipo de sangre (por si necesitas transfusión)',
      '👤 Identifica 2 donantes de sangre compatibles',
      '🏠 Alguien que cuide a tus otros hijos',
    ],
    warningSignsToWatch: [
      '🔴 Sangrado vaginal abundante',
      '🔴 Dolor de cabeza fuerte con visión borrosa',
      '🔴 Fiebre mayor a 38°C',
      '🔴 Convulsiones',
      '🔴 Pérdida de líquido antes de la semana 37',
      '🟡 Bebé se mueve menos de lo normal',
      '🟡 Hinchazón de cara o manos',
    ],
    whenToLeave,
    essentialBag: [
      '👶 Ropa para el bebé (3 mudas, gorrito, medias)',
      '🧴 Pañales recién nacido (paquete)',
      '👩 Ropa cómoda para ti (bata, chancletas)',
      '🧻 Toallas higiénicas grandes (paquete)',
      '🧼 Jabón, cepillo de dientes, toalla',
      '🍞 Snacks y agua para el acompañante',
      '📄 Documentos en una bolsa plástica',
    ],
  };
}

// ─── Postpartum Monitoring ──────────────────────────────────────────────────

const POSTPARTUM_CHECKLIST: PostpartumCheck[] = [
  {
    dayRange: '1-3',
    phase: 'Primeros días (hospital/casa)',
    watchFor: [
      'Sangrado: es normal que sea como menstruación fuerte los primeros 3 días',
      'Útero: debes sentir una bolita dura debajo del ombligo — eso es bueno',
      'Lactancia: el calostro (primera leche amarilla) es suficiente, no necesitas fórmula',
      'Ánimo: es normal sentirse emocional (baby blues)',
    ],
    seekHelpIf: [
      '🔴 Sangrado que empapa más de 1 toalla por hora',
      '🔴 Fiebre mayor a 38°C',
      '🔴 Dolor abdominal severo que no mejora',
      '🔴 Mal olor en el sangrado vaginal',
      '🔴 Dificultad para respirar o dolor en el pecho',
    ],
    selfCare: [
      'Descansa todo lo que puedas',
      'Toma agua cada vez que amamantas',
      'Come bien — necesitas 500 calorías extra por lactancia',
      'Acepta ayuda de familia',
    ],
  },
  {
    dayRange: '4-7',
    phase: 'Primera semana',
    watchFor: [
      'Sangrado: cambia a color rosado/marrón, disminuye gradualmente',
      'Pechos: pueden estar duros y calientes (subida de leche) — amamanta seguido',
      'Sueño: es normal despertar cada 2-3 horas para alimentar al bebé',
      'Herida de cesárea (si aplica): debe estar seca, sin enrojecimiento',
    ],
    seekHelpIf: [
      '🔴 Sangrado rojo brillante que aumenta',
      '🔴 Fiebre o escalofríos',
      '🔴 Enrojecimiento, hinchazón o pus en herida de cesárea',
      '🟡 Pechos muy rojos, calientes, con dolor — posible mastitis',
      '🟡 Tristeza profunda o pensamientos de hacerte daño',
    ],
    selfCare: [
      'Camina un poco dentro de casa',
      'Sigue tomando vitaminas y hierro',
      'Amamanta a libre demanda (cada vez que el bebé pida)',
      'No hagas esfuerzo físico fuerte',
    ],
  },
  {
    dayRange: '8-14',
    phase: 'Segunda semana',
    watchFor: [
      'Sangrado: debe seguir disminuyendo, color marrón/amarillento',
      'Ánimo: presta atención a tu estado emocional',
      'Bebé: debe mojar al menos 6 pañales al día, señal de buena alimentación',
      'Control: primera visita postparto con tu médico o partera',
    ],
    seekHelpIf: [
      '🔴 Sangrado que regresa a ser rojo y abundante',
      '🔴 Fiebre',
      '🟡 Llanto excesivo, no quieres ver al bebé, pensamientos negativos — habla con alguien',
      '🟡 Dolor o ardor al orinar',
    ],
    selfCare: [
      'Sal a caminar un poco si te sientes bien',
      'Come alimentos ricos en hierro (sangrecita, lentejas, hígado)',
      'Habla con alguien sobre cómo te sientes',
      'Duerme cuando el bebé duerme',
    ],
  },
  {
    dayRange: '15-28',
    phase: 'Semanas 3-4',
    watchFor: [
      'Sangrado: debe estar casi terminando',
      'Lactancia: debe estar establecida, sin dolor al amamantar',
      'Ánimo: baby blues debe mejorar; si no mejora, podría ser depresión postparto',
      'Bebé: ya debe estar ganando peso (control a los 15 días)',
    ],
    seekHelpIf: [
      '🔴 Cualquier sangrado rojo abundante',
      '🟡 Tristeza que no mejora después de 2 semanas',
      '🟡 Dolor en las piernas (hinchazón de una sola pierna)',
      '🟡 Dificultad persistente para amamantar',
    ],
    selfCare: [
      'Puedes empezar ejercicio suave (caminar)',
      'Planifica tu anticoncepción con tu médico',
      'Mantén alimentación rica en hierro y vitamina C',
      'Busca apoyo si te sientes abrumada — es normal pedir ayuda',
    ],
  },
  {
    dayRange: '29-42',
    phase: 'Semanas 5-6 (cuarentena)',
    watchFor: [
      'Recuperación: tu cuerpo se acerca a su estado normal',
      'Menstruación: puede regresar si no amamantas exclusivamente',
      'Sexualidad: habla con tu pareja sobre cuándo retomar relaciones (espera aprobación médica)',
      'Anticoncepción: IMPORTANTE — puedes quedar embarazada antes de tu primera menstruación',
    ],
    seekHelpIf: [
      '🔴 Cualquier sangrado abundante nuevo',
      '🟡 Depresión o ansiedad que no mejora',
      '🟡 Dolor durante relaciones sexuales',
      '🟡 Incontinencia urinaria persistente',
    ],
    selfCare: [
      'Control postparto final (semana 6)',
      'Habla sobre anticoncepción',
      'Ejercicios de Kegel para fortalecer el piso pélvico',
      'Disfruta a tu bebé — ¡lo estás haciendo bien! 💪',
    ],
  },
];

/**
 * Get postpartum monitoring checklist for a specific day (1-42).
 */
export function getPostpartumChecklist(day: number): PostpartumCheck {
  if (day < 1 || day > 42) {
    throw new Error('El día debe estar entre 1 y 42 (periodo postparto/cuarentena)');
  }

  if (day <= 3) return POSTPARTUM_CHECKLIST[0];
  if (day <= 7) return POSTPARTUM_CHECKLIST[1];
  if (day <= 14) return POSTPARTUM_CHECKLIST[2];
  if (day <= 28) return POSTPARTUM_CHECKLIST[3];
  return POSTPARTUM_CHECKLIST[4];
}

/**
 * Get all postpartum phases.
 */
export function getAllPostpartumPhases(): PostpartumCheck[] {
  return [...POSTPARTUM_CHECKLIST];
}

// ─── Partner Education ──────────────────────────────────────────────────────

const PARTNER_MESSAGES: PartnerMessage[] = [
  {
    topic: 'Los tres retrasos',
    message: `📚 LOS TRES RETRASOS que matan madres:

1️⃣ RETRASO EN DECIDIR: "Esperemos a ver si mejora" — NO. Si hay señal de peligro, actúa INMEDIATAMENTE.

2️⃣ RETRASO EN LLEGAR: No tener transporte listo. TÚ debes asegurar cómo llegarán al hospital ANTES de que sea emergencia.

3️⃣ RETRASO EN RECIBIR ATENCIÓN: Llegar al centro de salud y que no haya personal. Por eso el plan de parto incluye un hospital de respaldo.

👉 Como pareja, TÚ puedes eliminar los tres retrasos.`,
  },
  {
    topic: 'Señales de peligro',
    message: `🚨 SEÑALES DE PELIGRO — Memoriza estas:

🔴 LLÉVALA AL HOSPITAL AHORA si:
• Sangrado vaginal abundante
• Convulsiones
• Dolor de cabeza fuerte + visión borrosa
• Fiebre con escalofríos
• Perdió líquido y aún no llega a semana 37

NO esperes. NO le digas "ya se te va a pasar". ACTÚA.`,
  },
  {
    topic: 'Cómo apoyar durante el embarazo',
    message: `💪 CÓMO PUEDES AYUDAR:

🏠 En casa:
• Ayuda con las tareas pesadas
• Que ella descanse, especialmente en el tercer trimestre
• Acompáñala a TODOS los controles prenatales

🍽️ Alimentación:
• Asegura que coma alimentos ricos en hierro (sangrecita, hígado, lentejas)
• Dale limón o naranja con las comidas (ayuda a absorber el hierro)
• NO infusiones de anís/manzanilla con las comidas

❤️ Emocional:
• Pregúntale cómo se siente — DE VERDAD escucha
• Los cambios de humor son normales (hormonas)
• Sé paciente y cariñoso`,
  },
  {
    topic: 'Plan de emergencia',
    message: `🆘 TU PLAN DE EMERGENCIA — Prepáralo HOY:

1. 📱 Ten guardados: número del hospital, ambulancia, y 2 familiares que puedan ayudar
2. 🚗 Transporte listo desde la semana 37 (gasolina, llantas, o número de taxi)
3. 💰 Dinero guardado para emergencias
4. 🩸 Conoce su tipo de sangre — ten identificados 2 donantes
5. 🏠 Alguien que cuide a los otros hijos
6. 🎒 Bolso listo con ropa, documentos, y cosas para el bebé

⏰ Si ella tiene una señal de peligro, tu trabajo es: DECIDIR RÁPIDO, SALIR RÁPIDO, LLEGAR RÁPIDO.`,
  },
  {
    topic: 'Después del parto',
    message: `👨‍👩‍👶 DESPUÉS DEL PARTO — Tu rol es clave:

Los primeros 40 días (cuarentena):
• Ella necesita DESCANSAR — asume tareas del hogar
• Asegura que coma bien y tome agua
• Lactancia: NO le des fórmula al bebé sin indicación médica
• Vigila señales de peligro: sangrado abundante, fiebre, tristeza profunda

⚠️ DEPRESIÓN POSTPARTO:
Si ella llora mucho, no quiere cargar al bebé, o dice que no puede más:
NO es "flojera". Es una condición médica. Llévala al médico.

💕 Ser padre no es solo proveer. Es estar presente.`,
  },
];

/**
 * Get all partner education messages.
 */
export function getPartnerEducation(): PartnerMessage[] {
  return [...PARTNER_MESSAGES];
}

/**
 * Get partner education message by topic.
 */
export function getPartnerMessageByTopic(topic: string): PartnerMessage | null {
  const normalized = topic.toLowerCase();
  return PARTNER_MESSAGES.find(m => m.topic.toLowerCase().includes(normalized)) ?? null;
}

// ─── Iron Needs During Pregnancy ────────────────────────────────────────────

const IRON_RICH_FOODS: Array<{ name: string; ironMgPer100g: number; type: 'heme' | 'non-heme' }> = [
  { name: 'Sangrecita', ironMgPer100g: 27.3, type: 'heme' },
  { name: 'Bazo', ironMgPer100g: 28.7, type: 'heme' },
  { name: 'Hígado de pollo', ironMgPer100g: 8.5, type: 'heme' },
  { name: 'Hígado de res', ironMgPer100g: 6.5, type: 'heme' },
  { name: 'Cañihua', ironMgPer100g: 13.0, type: 'non-heme' },
  { name: 'Quinua', ironMgPer100g: 7.5, type: 'non-heme' },
  { name: 'Lentejas', ironMgPer100g: 7.5, type: 'non-heme' },
  { name: 'Espinaca', ironMgPer100g: 2.7, type: 'non-heme' },
  { name: 'Cushuro', ironMgPer100g: 15.0, type: 'non-heme' },
];

/**
 * Get iron guidance for pregnancy by trimester.
 * During pregnancy, iron needs DOUBLE (from 18mg to 27-30mg daily).
 * Based on VISION.md absorption rules.
 */
export function getIronGuidance(trimester: Trimester): IronGuidance {
  const dailyNeed = trimester === 1 ? 27 : 30; // Higher in 2nd/3rd trimester

  return {
    dailyNeedMg: dailyNeed,
    trimester,
    foods: [...IRON_RICH_FOODS],
    absorptionTips: [
      '🍋 Combina alimentos ricos en hierro con vitamina C (limón, naranja, camu camu) — DUPLICA la absorción',
      '🥩 El hierro de origen animal (heme) se absorbe 15-35%, mucho mejor que el vegetal (2-20%)',
      '🩺 Toma tu suplemento de hierro con jugo de naranja o limón, NUNCA con leche o té',
      '⏰ Toma el suplemento de hierro en ayunas o entre comidas para mejor absorción',
      '🪱 Si no has sido desparasitada en los últimos 6 meses, consulta con tu médico (los parásitos roban hierro)',
    ],
    avoid: [
      '❌ NO tomes té, café ni infusiones de anís/manzanilla con las comidas — bloquean absorción 60-82%',
      '❌ NO tomes leche ni lácteos JUNTO con alimentos ricos en hierro — el calcio compite con el hierro',
      '❌ NO tomes hierro y calcio al mismo tiempo — sepáralos al menos 2 horas',
      '❌ NO confíes solo en suplementos — la alimentación es la base',
    ],
  };
}

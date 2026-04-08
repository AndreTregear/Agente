/**
 * Clinical Decision Support Module — Module D
 *
 * Tools for rural health workers (promotores de salud, SERUMS doctors, nurses):
 * - Quick screening protocols for common conditions
 * - Differential diagnosis helper (symptoms → ranked conditions)
 * - Drug interaction checker (30+ common rural pharmacy drugs)
 * - Batch screening mode (health fairs)
 * - Emergency stabilization protocols
 *
 * No external dependencies. All data embedded.
 * Always remind: "Consulta con tu médico para un diagnóstico definitivo."
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ScreeningCriterion {
  name: string;
  description: string;
  required: boolean;
}

export interface ScreeningProtocol {
  condition: string;
  description: string;
  criteria: ScreeningCriterion[];
  redFlags: string[];
  action: string;
  notes: string;
}

export interface DiagnosisCandidate {
  condition: string;
  confidence: number; // 0–1
  matchedSymptoms: string[];
  unmatchedSymptoms: string[];
  recommendedAction: string;
}

export interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: 'high' | 'moderate' | 'low';
  effect: string;
  recommendation: string;
}

export interface PatientScreeningData {
  id: string;
  name: string;
  age: number;
  sex: 'M' | 'F';
  symptoms: string[];
  vitals?: {
    temperature?: number;
    systolicBP?: number;
    diastolicBP?: number;
    heartRate?: number;
    respiratoryRate?: number;
  };
  medications?: string[];
  pregnant?: boolean;
}

export interface PatientAssessment {
  patientId: string;
  patientName: string;
  conditions: DiagnosisCandidate[];
  drugInteractions: DrugInteraction[];
  urgency: 'green' | 'yellow' | 'red';
  summary: string;
}

export interface EmergencyProtocol {
  condition: string;
  description: string;
  immediateSteps: string[];
  medications: Array<{ name: string; dose: string; route: string; notes: string }>;
  doNot: string[];
  transportNotes: string;
}

// ─── Screening Protocols ─────────────────────────────────────────────────────

export const SCREENING_PROTOCOLS: Record<string, ScreeningProtocol> = {
  malaria: {
    condition: 'Malaria',
    description: 'Sospecha de malaria en zona endémica (selva, Loreto, Amazonas)',
    criteria: [
      { name: 'fever_pattern', description: 'Fiebre cíclica (cada 48-72h) o fiebre persistente', required: true },
      { name: 'chills', description: 'Escalofríos intensos con sudoración', required: false },
      { name: 'headache', description: 'Cefalea intensa', required: false },
      { name: 'endemic_region', description: 'Residente o visitante de zona endémica', required: true },
      { name: 'myalgia', description: 'Dolor muscular y articular', required: false },
      { name: 'nausea', description: 'Náuseas o vómitos', required: false },
    ],
    redFlags: [
      'Alteración de conciencia (malaria cerebral)',
      'Anemia severa (palidez extrema)',
      'Dificultad respiratoria',
      'Convulsiones',
      'Ictericia (piel/ojos amarillos)',
      'Orina oscura (hemoglobinuria)',
    ],
    action: 'Prueba rápida de malaria (RDT) o gota gruesa. Iniciar tratamiento según protocolo MINSA si positivo.',
    notes: 'P. vivax es más común en Perú. P. falciparum requiere tratamiento urgente. En zona endémica, tratar fiebre como malaria hasta demostrar lo contrario.',
  },

  dengue: {
    condition: 'Dengue',
    description: 'Sospecha de dengue en zona con Aedes aegypti',
    criteria: [
      { name: 'high_fever', description: 'Fiebre alta (≥38.5°C) de inicio súbito', required: true },
      { name: 'severe_joint_pain', description: 'Dolor articular intenso ("fiebre quebranta-huesos")', required: false },
      { name: 'rash', description: 'Erupción cutánea (exantema)', required: false },
      { name: 'retro_orbital_pain', description: 'Dolor retro-orbital (detrás de los ojos)', required: false },
      { name: 'headache', description: 'Cefalea intensa', required: false },
      { name: 'myalgia', description: 'Dolor muscular intenso', required: false },
      { name: 'nausea', description: 'Náuseas, vómitos, dolor abdominal', required: false },
    ],
    redFlags: [
      'Dolor abdominal intenso y sostenido',
      'Vómitos persistentes',
      'Sangrado de mucosas (encías, nariz)',
      'Letargia o irritabilidad',
      'Acumulación de líquidos (ascitis, derrame pleural)',
      'Hepatomegalia >2cm',
      'Aumento del hematocrito con caída de plaquetas',
    ],
    action: 'Hidratación oral abundante. Paracetamol para fiebre (NO aspirina, NO ibuprofeno). Monitorear signos de alarma cada 12h.',
    notes: 'Los días 3-7 son los más peligrosos (fase crítica). NO usar AINEs (riesgo de sangrado). Referir al hospital si hay signos de alarma.',
  },

  preeclampsia: {
    condition: 'Pre-eclampsia',
    description: 'Sospecha de pre-eclampsia en gestante >20 semanas',
    criteria: [
      { name: 'high_bp', description: 'Presión arterial ≥140/90 mmHg', required: true },
      { name: 'proteinuria', description: 'Proteinuria (proteínas en orina, tira reactiva ≥1+)', required: false },
      { name: 'headache', description: 'Cefalea intensa que no cede con paracetamol', required: false },
      { name: 'vision_changes', description: 'Visión borrosa, escotomas, fotopsias', required: false },
      { name: 'edema', description: 'Edema facial o de manos (no solo pies)', required: false },
      { name: 'epigastric_pain', description: 'Dolor epigástrico o en hipocondrio derecho', required: false },
    ],
    redFlags: [
      'PA ≥160/110 (pre-eclampsia severa)',
      'Convulsiones (→ eclampsia)',
      'HELLP: dolor abdominal + náuseas + elevación transaminasas',
      'Oliguria (<500ml/24h)',
      'Edema pulmonar',
      'Cefalea refractaria a tratamiento',
    ],
    action: 'Referencia URGENTE al hospital. Reposo lateral izquierdo. Si PA ≥160/110: nifedipino 10mg VO. Preparar sulfato de magnesio si convulsiona.',
    notes: 'Única cura definitiva: terminación del embarazo. El sulfato de magnesio previene eclampsia. No usar diuréticos ni restringir líquidos.',
  },

  severe_dehydration: {
    condition: 'Deshidratación severa',
    description: 'Evaluación de deshidratación (especialmente en niños con diarrea)',
    criteria: [
      { name: 'skin_turgor', description: 'Signo del pliegue: piel vuelve lentamente (>2 segundos)', required: false },
      { name: 'sunken_eyes', description: 'Ojos hundidos', required: false },
      { name: 'lethargy', description: 'Letargia o inconsciencia', required: false },
      { name: 'no_tears', description: 'Llora sin lágrimas', required: false },
      { name: 'dry_mouth', description: 'Boca y lengua muy secas', required: false },
      { name: 'unable_to_drink', description: 'Bebe con dificultad o no puede beber', required: false },
    ],
    redFlags: [
      'Inconsciencia o letargia extrema',
      'No puede beber',
      'Pliegue cutáneo >2 segundos',
      'Pulso débil o ausente',
      'Fontanela hundida (lactantes)',
      'Ojos muy hundidos',
    ],
    action: 'Plan C de OMS: rehidratación IV con Ringer Lactato o SSN. Si no hay IV: SNG con SRO 20ml/kg/h. Referir urgente.',
    notes: 'Preparación SRO casero: 1 litro agua hervida + 6 cucharaditas azúcar + ½ cucharadita sal. Dar sorbos frecuentes. Continuar lactancia materna.',
  },

  pneumonia_children: {
    condition: 'Neumonía en niños',
    description: 'Clasificación AIEPI de infección respiratoria aguda en menores de 5 años',
    criteria: [
      { name: 'fast_breathing', description: 'Respiración rápida: ≥60/min (<2m), ≥50/min (2-11m), ≥40/min (1-5a)', required: true },
      { name: 'chest_indrawing', description: 'Tiraje subcostal (hundimiento debajo de las costillas al respirar)', required: false },
      { name: 'cough', description: 'Tos o dificultad respiratoria', required: true },
      { name: 'fever', description: 'Fiebre (≥38°C)', required: false },
      { name: 'nasal_flaring', description: 'Aleteo nasal', required: false },
      { name: 'grunting', description: 'Quejido respiratorio', required: false },
    ],
    redFlags: [
      'Tiraje subcostal (neumonía grave)',
      'Estridor en reposo',
      'No puede beber o alimentarse',
      'Vomita todo',
      'Convulsiones',
      'Letargia o inconsciencia',
      'Saturación <90%',
      'Cianosis (labios/uñas azules)',
    ],
    action: 'Neumonía: amoxicilina 80-90mg/kg/día ÷ 2 dosis × 5 días. Neumonía grave: primera dosis de amoxicilina + referir URGENTE.',
    notes: 'Frecuencia respiratoria es el signo más importante. Contar durante 1 minuto completo con el niño tranquilo. No dar antitusígenos.',
  },
};

// ─── Differential Diagnosis Engine ───────────────────────────────────────────

interface ConditionProfile {
  condition: string;
  symptoms: string[];
  weights: Record<string, number>; // symptom → weight (0-1)
  action: string;
}

const CONDITION_PROFILES: ConditionProfile[] = [
  {
    condition: 'Malaria',
    symptoms: ['fever', 'chills', 'headache', 'myalgia', 'nausea', 'sweating', 'fatigue'],
    weights: { fever: 0.3, chills: 0.2, headache: 0.1, myalgia: 0.1, nausea: 0.1, sweating: 0.1, fatigue: 0.1 },
    action: 'Prueba rápida de malaria. Tratar según protocolo MINSA.',
  },
  {
    condition: 'Dengue',
    symptoms: ['fever', 'severe_joint_pain', 'rash', 'retro_orbital_pain', 'headache', 'myalgia', 'nausea'],
    weights: { fever: 0.25, severe_joint_pain: 0.2, rash: 0.15, retro_orbital_pain: 0.15, headache: 0.1, myalgia: 0.1, nausea: 0.05 },
    action: 'Hidratación, paracetamol. NO AINEs. Vigilar signos de alarma.',
  },
  {
    condition: 'Pre-eclampsia',
    symptoms: ['high_bp', 'proteinuria', 'headache', 'vision_changes', 'edema', 'pregnant', 'epigastric_pain'],
    weights: { high_bp: 0.3, proteinuria: 0.15, headache: 0.15, vision_changes: 0.15, edema: 0.1, pregnant: 0.1, epigastric_pain: 0.05 },
    action: 'Referencia URGENTE al hospital. Monitoreo PA. Sulfato de magnesio si convulsiona.',
  },
  {
    condition: 'Neumonía',
    symptoms: ['cough', 'fever', 'fast_breathing', 'chest_indrawing', 'difficulty_breathing', 'chest_pain'],
    weights: { cough: 0.2, fever: 0.2, fast_breathing: 0.25, chest_indrawing: 0.15, difficulty_breathing: 0.1, chest_pain: 0.1 },
    action: 'Amoxicilina. Si hay tiraje subcostal → referir urgente.',
  },
  {
    condition: 'Deshidratación severa',
    symptoms: ['diarrhea', 'vomiting', 'skin_turgor', 'sunken_eyes', 'lethargy', 'no_tears', 'dry_mouth', 'unable_to_drink'],
    weights: { diarrhea: 0.15, vomiting: 0.1, skin_turgor: 0.2, sunken_eyes: 0.15, lethargy: 0.15, no_tears: 0.1, dry_mouth: 0.1, unable_to_drink: 0.05 },
    action: 'Plan C OMS: rehidratación IV. Si no hay IV → SRO por sonda.',
  },
  {
    condition: 'Tuberculosis',
    symptoms: ['cough_chronic', 'weight_loss', 'night_sweats', 'fever', 'hemoptysis', 'fatigue', 'chest_pain'],
    weights: { cough_chronic: 0.3, weight_loss: 0.15, night_sweats: 0.15, fever: 0.1, hemoptysis: 0.15, fatigue: 0.1, chest_pain: 0.05 },
    action: 'BK en esputo (2 muestras). Referir a establecimiento con programa TB.',
  },
  {
    condition: 'Infección urinaria',
    symptoms: ['dysuria', 'frequency', 'urgency', 'suprapubic_pain', 'fever', 'hematuria', 'cloudy_urine'],
    weights: { dysuria: 0.25, frequency: 0.15, urgency: 0.15, suprapubic_pain: 0.15, fever: 0.1, hematuria: 0.1, cloudy_urine: 0.1 },
    action: 'Urocultivo si disponible. Iniciar antibiótico empírico (nitrofurantoína o TMP-SMX).',
  },
  {
    condition: 'Gastroenteritis aguda',
    symptoms: ['diarrhea', 'vomiting', 'nausea', 'abdominal_pain', 'fever', 'dehydration'],
    weights: { diarrhea: 0.25, vomiting: 0.2, nausea: 0.1, abdominal_pain: 0.15, fever: 0.15, dehydration: 0.15 },
    action: 'SRO, dieta blanda, zinc en niños. Antibiótico solo si disentería.',
  },
  {
    condition: 'Parasitosis intestinal',
    symptoms: ['abdominal_pain', 'diarrhea', 'weight_loss', 'fatigue', 'anemia', 'bloating', 'nausea'],
    weights: { abdominal_pain: 0.2, diarrhea: 0.15, weight_loss: 0.15, fatigue: 0.15, anemia: 0.15, bloating: 0.1, nausea: 0.1 },
    action: 'Examen de heces. Albendazol 400mg dosis única o mebendazol 500mg.',
  },
  {
    condition: 'Anemia',
    symptoms: ['fatigue', 'pallor', 'dizziness', 'tachycardia', 'weakness', 'shortness_of_breath', 'headache'],
    weights: { fatigue: 0.2, pallor: 0.25, dizziness: 0.1, tachycardia: 0.1, weakness: 0.15, shortness_of_breath: 0.1, headache: 0.1 },
    action: 'Hemoglobina. Sulfato ferroso + vitamina C. Desparasitación. Evaluar causa.',
  },
];

/**
 * Differential diagnosis: given a list of symptoms, return ranked conditions.
 */
export function differentialDiagnosis(symptoms: string[]): DiagnosisCandidate[] {
  const normalized = symptoms.map(s => s.toLowerCase().trim());

  const candidates: DiagnosisCandidate[] = CONDITION_PROFILES.map(profile => {
    const matched: string[] = [];
    const unmatched: string[] = [];

    for (const symptom of normalized) {
      if (profile.symptoms.includes(symptom)) {
        matched.push(symptom);
      } else {
        unmatched.push(symptom);
      }
    }

    // Weighted confidence
    let confidence = 0;
    for (const m of matched) {
      confidence += profile.weights[m] ?? 0.05;
    }

    // Penalize if many symptoms don't match
    const unmatchedPenalty = unmatched.length * 0.03;
    confidence = Math.max(0, Math.min(1, confidence - unmatchedPenalty));

    return {
      condition: profile.condition,
      confidence: Math.round(confidence * 100) / 100,
      matchedSymptoms: matched,
      unmatchedSymptoms: unmatched,
      recommendedAction: profile.action,
    };
  });

  // Sort by confidence descending, filter out zero confidence
  return candidates
    .filter(c => c.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence);
}

// ─── Drug Interaction Database ───────────────────────────────────────────────

interface DrugInteractionEntry {
  drug1: string;
  drug2: string;
  severity: 'high' | 'moderate' | 'low';
  effect: string;
  recommendation: string;
}

const DRUG_INTERACTION_DB: DrugInteractionEntry[] = [
  // Metformin interactions
  { drug1: 'metformin', drug2: 'alcohol', severity: 'high', effect: 'Riesgo de acidosis láctica', recommendation: 'Evitar consumo de alcohol durante tratamiento con metformina.' },
  { drug1: 'metformin', drug2: 'contrast_dye', severity: 'high', effect: 'Acidosis láctica por acumulación', recommendation: 'Suspender metformina 48h antes y después de contraste yodado.' },
  { drug1: 'metformin', drug2: 'cimetidine', severity: 'moderate', effect: 'Aumento niveles de metformina', recommendation: 'Monitorear glucosa. Considerar ranitidina como alternativa.' },

  // ACE inhibitors + potassium
  { drug1: 'enalapril', drug2: 'potassium', severity: 'high', effect: 'Hiperkalemia (potasio elevado)', recommendation: 'No suplementar potasio sin monitoreo de laboratorio. Riesgo de arritmia.' },
  { drug1: 'captopril', drug2: 'potassium', severity: 'high', effect: 'Hiperkalemia', recommendation: 'Evitar suplementos de potasio. Monitorear electrolitos.' },
  { drug1: 'losartan', drug2: 'potassium', severity: 'high', effect: 'Hiperkalemia', recommendation: 'ARA-II también retienen potasio. Evitar suplementos.' },
  { drug1: 'enalapril', drug2: 'spironolactone', severity: 'high', effect: 'Hiperkalemia severa', recommendation: 'Combinación peligrosa. Monitoreo estricto de potasio.' },

  // Warfarin interactions
  { drug1: 'warfarin', drug2: 'ibuprofen', severity: 'high', effect: 'Riesgo de sangrado GI severo', recommendation: 'NO combinar. Usar paracetamol para dolor.' },
  { drug1: 'warfarin', drug2: 'aspirin', severity: 'high', effect: 'Sangrado por doble anticoagulación', recommendation: 'Solo combinar bajo indicación cardiológica estricta.' },
  { drug1: 'warfarin', drug2: 'naproxen', severity: 'high', effect: 'Riesgo elevado de sangrado', recommendation: 'Evitar todos los AINEs con warfarina.' },
  { drug1: 'warfarin', drug2: 'metronidazole', severity: 'high', effect: 'Potencia efecto anticoagulante', recommendation: 'Reducir dosis warfarina 25-50%. Monitorear INR.' },
  { drug1: 'warfarin', drug2: 'fluconazole', severity: 'high', effect: 'Aumenta INR significativamente', recommendation: 'Monitorear INR diario. Reducir dosis warfarina.' },

  // TB drugs (rifampicin)
  { drug1: 'rifampicin', drug2: 'anticonceptivos_orales', severity: 'high', effect: 'Reduce eficacia anticonceptiva (inductor CYP3A4)', recommendation: 'Usar método anticonceptivo alternativo (DIU, inyectable medroxiprogesterona).' },
  { drug1: 'rifampicin', drug2: 'warfarin', severity: 'high', effect: 'Reduce efecto anticoagulante dramáticamente', recommendation: 'Aumentar dosis warfarina. Monitoreo INR semanal.' },
  { drug1: 'rifampicin', drug2: 'methadone', severity: 'high', effect: 'Precipita síndrome de abstinencia', recommendation: 'Aumentar dosis metadona. Monitoreo clínico cercano.' },
  { drug1: 'rifampicin', drug2: 'dexamethasone', severity: 'moderate', effect: 'Reduce eficacia del corticoide', recommendation: 'Puede necesitar aumento de dosis de corticoide.' },
  { drug1: 'rifampicin', drug2: 'atorvastatin', severity: 'high', effect: 'Reduce niveles de estatina 80%', recommendation: 'Considerar otra estatina o aumentar dosis significativamente.' },
  { drug1: 'isoniazid', drug2: 'alcohol', severity: 'high', effect: 'Hepatotoxicidad aumentada', recommendation: 'Abstinencia total de alcohol durante tratamiento con isoniazida.' },
  { drug1: 'isoniazid', drug2: 'phenytoin', severity: 'high', effect: 'Toxicidad por fenitoína (inhibición metabolismo)', recommendation: 'Monitorear niveles de fenitoína. Reducir dosis si necesario.' },
  { drug1: 'pyrazinamide', drug2: 'allopurinol', severity: 'moderate', effect: 'Ambos afectan ácido úrico, gota severa', recommendation: 'Monitorear ácido úrico. Ajustar alopurinol.' },

  // Herbal interactions
  { drug1: 'st_johns_wort', drug2: 'warfarin', severity: 'high', effect: 'Reduce efecto anticoagulante (inductor CYP)', recommendation: 'NO combinar. Riesgo de trombosis.' },
  { drug1: 'st_johns_wort', drug2: 'anticonceptivos_orales', severity: 'high', effect: 'Reduce eficacia anticonceptiva', recommendation: 'Usar método alternativo o suspender hierba de San Juan.' },
  { drug1: 'st_johns_wort', drug2: 'fluoxetine', severity: 'high', effect: 'Síndrome serotoninérgico', recommendation: 'NUNCA combinar. Riesgo de convulsiones, hipertermia, muerte.' },
  { drug1: 'st_johns_wort', drug2: 'sertraline', severity: 'high', effect: 'Síndrome serotoninérgico', recommendation: 'NUNCA combinar con ISRS.' },
  { drug1: 'ginkgo', drug2: 'warfarin', severity: 'high', effect: 'Aumenta riesgo de sangrado', recommendation: 'Suspender ginkgo si toma anticoagulantes.' },
  { drug1: 'ginkgo', drug2: 'aspirin', severity: 'moderate', effect: 'Sangrado por efecto antiplaquetario aditivo', recommendation: 'Precaución. Vigilar signos de sangrado.' },
  { drug1: 'ginkgo', drug2: 'ibuprofen', severity: 'moderate', effect: 'Riesgo de sangrado aumentado', recommendation: 'Evitar combinación si es posible.' },

  // Common drug-drug interactions in rural pharmacy
  { drug1: 'amoxicillin', drug2: 'methotrexate', severity: 'high', effect: 'Toxicidad por methotrexate (reducción excreción renal)', recommendation: 'Monitorear hemograma. Considerar otro antibiótico.' },
  { drug1: 'ciprofloxacin', drug2: 'antiacids', severity: 'moderate', effect: 'Reduce absorción de ciprofloxacino 90%', recommendation: 'Tomar ciprofloxacino 2h antes o 6h después de antiácidos.' },
  { drug1: 'ciprofloxacin', drug2: 'iron_supplements', severity: 'moderate', effect: 'Reduce absorción del antibiótico', recommendation: 'Separar tomas por al menos 2 horas.' },
  { drug1: 'omeprazole', drug2: 'clopidogrel', severity: 'high', effect: 'Reduce activación de clopidogrel (CYP2C19)', recommendation: 'Usar pantoprazol como alternativa.' },
  { drug1: 'simvastatin', drug2: 'erythromycin', severity: 'high', effect: 'Rabdomiólisis por acumulación estatina', recommendation: 'Suspender estatina durante tratamiento con eritromicina.' },
  { drug1: 'amlodipine', drug2: 'simvastatin', severity: 'moderate', effect: 'Aumenta niveles de simvastatina', recommendation: 'No exceder simvastatina 20mg/día con amlodipino.' },
  { drug1: 'glibenclamide', drug2: 'fluconazole', severity: 'high', effect: 'Hipoglicemia severa', recommendation: 'Monitorear glucosa frecuentemente. Reducir dosis sulfonilurea.' },
  { drug1: 'iron_supplements', drug2: 'calcium', severity: 'moderate', effect: 'Calcio reduce absorción de hierro 50-60%', recommendation: 'Separar tomas por al menos 2 horas. No dar leche con hierro.' },
  { drug1: 'iron_supplements', drug2: 'tetracycline', severity: 'moderate', effect: 'Reducción mutua de absorción', recommendation: 'Separar tomas por 2-3 horas.' },
  { drug1: 'digoxin', drug2: 'amiodarone', severity: 'high', effect: 'Toxicidad digitálica (aumenta niveles 70-100%)', recommendation: 'Reducir dosis digoxina 50%. Monitorear niveles.' },
  { drug1: 'lithium', drug2: 'ibuprofen', severity: 'high', effect: 'Toxicidad por litio (reducción excreción renal)', recommendation: 'Evitar AINEs. Usar paracetamol.' },
  { drug1: 'carbamazepine', drug2: 'erythromycin', severity: 'high', effect: 'Toxicidad por carbamazepina', recommendation: 'Usar azitromicina como alternativa.' },
];

/**
 * Normalize drug name for comparison.
 */
function normalizeDrug(name: string): string {
  return name.toLowerCase().trim()
    .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
    .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ñ/g, 'n');
}

/**
 * Check for drug interactions between a list of medications.
 * Returns all detected interactions.
 */
export function checkDrugInteractions(medications: string[]): DrugInteraction[] {
  const normalized = medications.map(normalizeDrug);
  const interactions: DrugInteraction[] = [];

  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      const a = normalized[i];
      const b = normalized[j];

      for (const entry of DRUG_INTERACTION_DB) {
        const d1 = normalizeDrug(entry.drug1);
        const d2 = normalizeDrug(entry.drug2);

        if ((a.includes(d1) && b.includes(d2)) || (a.includes(d2) && b.includes(d1))) {
          interactions.push({
            drug1: medications[i],
            drug2: medications[j],
            severity: entry.severity,
            effect: entry.effect,
            recommendation: entry.recommendation,
          });
        }
      }
    }
  }

  return interactions;
}

/**
 * Get all known drugs in the interaction database.
 */
export function getKnownDrugs(): string[] {
  const drugs = new Set<string>();
  for (const entry of DRUG_INTERACTION_DB) {
    drugs.add(entry.drug1);
    drugs.add(entry.drug2);
  }
  return Array.from(drugs).sort();
}

// ─── Screening Protocol Retrieval ────────────────────────────────────────────

/**
 * Get a screening protocol by condition key.
 */
export function getScreeningProtocol(condition: string): ScreeningProtocol | null {
  const key = condition.toLowerCase().trim().replace(/\s+/g, '_');
  return SCREENING_PROTOCOLS[key] ?? null;
}

/**
 * Get all available screening protocol keys.
 */
export function listScreeningProtocols(): string[] {
  return Object.keys(SCREENING_PROTOCOLS);
}

// ─── Batch Screening Mode ────────────────────────────────────────────────────

/**
 * Process multiple patients at once (health fair mode).
 * Returns assessment for each patient including conditions, drug interactions, urgency.
 */
export function batchScreening(patients: PatientScreeningData[]): PatientAssessment[] {
  return patients.map(patient => {
    const conditions = differentialDiagnosis(patient.symptoms);
    const drugInteractions = patient.medications
      ? checkDrugInteractions(patient.medications)
      : [];

    // Determine urgency
    let urgency: 'green' | 'yellow' | 'red' = 'green';

    // Red flags from vitals
    if (patient.vitals) {
      const v = patient.vitals;
      if (v.temperature && v.temperature >= 39.5) urgency = 'red';
      if (v.systolicBP && v.systolicBP >= 160) urgency = 'red';
      if (v.systolicBP && v.systolicBP >= 140) urgency = urgency === 'red' ? 'red' : 'yellow';
      if (v.heartRate && (v.heartRate > 120 || v.heartRate < 50)) urgency = 'red';
    }

    // Red from high-confidence conditions
    if (conditions.length > 0 && conditions[0].confidence >= 0.5) {
      urgency = urgency === 'green' ? 'yellow' : urgency;
    }

    // Red from high-severity drug interactions
    if (drugInteractions.some(i => i.severity === 'high')) {
      urgency = 'red';
    }

    // Red if pregnant with BP concerns
    if (patient.pregnant && patient.vitals?.systolicBP && patient.vitals.systolicBP >= 140) {
      urgency = 'red';
    }

    // Build summary
    const parts: string[] = [];
    if (conditions.length > 0) {
      parts.push(`Posible: ${conditions[0].condition} (${Math.round(conditions[0].confidence * 100)}%)`);
    }
    if (drugInteractions.length > 0) {
      parts.push(`⚠️ ${drugInteractions.length} interacción(es) medicamentosa(s)`);
    }
    if (urgency === 'red') {
      parts.push('🔴 ATENCIÓN URGENTE');
    } else if (urgency === 'yellow') {
      parts.push('🟡 Requiere seguimiento');
    } else {
      parts.push('🟢 Sin hallazgos de alarma');
    }

    return {
      patientId: patient.id,
      patientName: patient.name,
      conditions,
      drugInteractions,
      urgency,
      summary: parts.join('. ') + '. Consulta con tu médico para un diagnóstico definitivo.',
    };
  });
}

// ─── Emergency Stabilization Protocols ───────────────────────────────────────

export const EMERGENCY_PROTOCOLS: Record<string, EmergencyProtocol> = {
  postpartum_hemorrhage: {
    condition: 'Hemorragia postparto',
    description: 'Sangrado >500ml después del parto vaginal o >1000ml después de cesárea. Primera causa de muerte materna en Perú.',
    immediateSteps: [
      'Pedir ayuda — NO manejar sola',
      'Masaje uterino bimanual: mano en abdomen sobre útero, masajear firmemente en círculos',
      'Vaciar vejiga (sonda si disponible)',
      'Establecer 2 vías IV con cristaloides (Ringer Lactato o SSN) a chorro',
      'Oxitocina 10 UI IM inmediato (si no se administró)',
      'Oxitocina 20 UI en 1L de SSN a 60 gotas/min',
      'Si no responde: misoprostol 800 mcg sublingual',
      'Compresión aórtica bimanual si sangrado masivo',
      'Referir URGENTE al hospital con capacidad quirúrgica',
    ],
    medications: [
      { name: 'Oxitocina', dose: '10 UI IM + 20 UI en 1L SSN IV', route: 'IM / IV', notes: 'Primera línea. Refrigerar.' },
      { name: 'Misoprostol', dose: '800 mcg sublingual', route: 'Sublingual', notes: 'Si oxitocina no disponible o no responde.' },
      { name: 'Ácido tranexámico', dose: '1g IV en 10 min', route: 'IV', notes: 'Dentro de las primeras 3 horas.' },
    ],
    doNot: [
      'NO dejar sola a la paciente',
      'NO esperar para iniciar masaje uterino',
      'NO usar ergometrina si hay hipertensión o pre-eclampsia',
    ],
    transportNotes: 'Posición de Trendelenburg (piernas elevadas). Mantener 2 vías IV permeables. Monitorear signos vitales cada 5 minutos. Mantener paciente abrigada (prevenir hipotermia).',
  },

  eclamptic_seizure: {
    condition: 'Convulsión eclámptica',
    description: 'Convulsiones en gestante con pre-eclampsia. Emergencia obstétrica.',
    immediateSteps: [
      'Proteger a la paciente de caídas y lesiones',
      'Posición lateral izquierda (decúbito lateral)',
      'NO introducir nada en la boca',
      'Aspirar secreciones si es posible',
      'Administrar sulfato de magnesio INMEDIATAMENTE',
      'Dosis de carga: MgSO4 4g IV en 20 min + 5g IM en cada glúteo',
      'Dosis de mantenimiento: MgSO4 1g/h IV o 5g IM cada 4h',
      'Monitorear: reflejos, frecuencia respiratoria, diuresis',
      'Preparar para parto — el parto es la cura definitiva',
      'Referir URGENTE al hospital',
    ],
    medications: [
      { name: 'Sulfato de magnesio', dose: 'Carga: 4g IV (20min) + 10g IM. Mantenimiento: 1g/h IV', route: 'IV / IM', notes: 'Antídoto: gluconato de calcio 1g IV si toxicidad.' },
      { name: 'Nifedipino', dose: '10mg VO, repetir en 30 min si PA>160/110', route: 'Oral', notes: 'Para control de PA. NO sublingual (hipotensión brusca).' },
      { name: 'Gluconato de calcio', dose: '1g IV lento (10 min)', route: 'IV', notes: 'ANTÍDOTO para toxicidad por magnesio. Tener siempre disponible.' },
    ],
    doNot: [
      'NO usar diazepam como primera línea (MgSO4 es superior)',
      'NO dar nifedipino sublingual',
      'NO restringir líquidos excesivamente',
      'NO olvidar monitorear reflejo patelar (si ausente → suspender MgSO4)',
    ],
    transportNotes: 'Decúbito lateral izquierdo. Continuar MgSO4 durante transporte. Monitorear reflejo patelar y FR cada 15 min. Si FR<12 → suspender MgSO4 y dar gluconato de calcio.',
  },

  severe_dehydration: {
    condition: 'Deshidratación severa',
    description: 'Plan C de OMS. Pérdida >10% peso corporal en líquidos. Emergencia en niños con diarrea.',
    immediateSteps: [
      'Evaluar ABC (vía aérea, respiración, circulación)',
      'Establecer vía IV inmediatamente',
      'Ringer Lactato o SSN: 30ml/kg en primera hora (lactantes) o 30 min (>1 año)',
      'Luego 70ml/kg en 5 horas (lactantes) o 2.5 horas (>1 año)',
      'Si no es posible IV: sonda nasogástrica con SRO 20ml/kg/h',
      'Reevaluar cada 1-2 horas',
      'Cuando pueda beber: iniciar SRO oral',
      'Continuar lactancia materna',
      'Zinc: 20mg/día (>6m) o 10mg/día (<6m) por 10-14 días',
    ],
    medications: [
      { name: 'Ringer Lactato', dose: '100ml/kg total (30ml/kg rápido + 70ml/kg en 2.5-5h)', route: 'IV', notes: 'Preferido sobre SSN. Si no hay, usar SSN 0.9%.' },
      { name: 'SRO (Sales de Rehidratación Oral)', dose: '20ml/kg/h por SNG si no hay IV', route: 'Oral / SNG', notes: 'Receta casera: 1L agua hervida + 6 cdtas azúcar + ½ cdta sal.' },
      { name: 'Zinc', dose: '20mg/día (>6m) o 10mg/día (<6m)', route: 'Oral', notes: 'Por 10-14 días. Reduce duración y recurrencia de diarrea.' },
    ],
    doNot: [
      'NO usar bebidas azucaradas (gaseosas, jugos) como rehidratación',
      'NO suspender lactancia materna',
      'NO usar antidiarreicos (loperamida) en niños',
      'NO dar antibióticos sin indicación (solo si disentería)',
    ],
    transportNotes: 'Mantener vía IV durante transporte. Dar SRO a sorbos si consciente. Monitorear diuresis. Mantener abrigado.',
  },

  anaphylaxis: {
    condition: 'Anafilaxia',
    description: 'Reacción alérgica sistémica grave. Puede ser mortal en minutos.',
    immediateSteps: [
      'Retirar alérgeno si es posible (suspender medicamento IV, retirar aguijón)',
      'EPINEFRINA IM inmediata en cara anterolateral del muslo',
      'Dosis adulto: 0.3-0.5mg (0.3-0.5ml de solución 1:1000)',
      'Dosis pediátrica: 0.01mg/kg (máximo 0.3mg)',
      'Posición supina con piernas elevadas (si tolera)',
      'Si dificultad respiratoria: sentado',
      'Oxígeno si disponible (alto flujo)',
      'Vía IV con SSN a chorro si hipotensión',
      'Repetir epinefrina cada 5-15 min si no mejora (máximo 3 dosis)',
      'Antihistamínico: difenhidramina 25-50mg IV/IM como adyuvante',
    ],
    medications: [
      { name: 'Epinefrina 1:1000', dose: 'Adulto: 0.3-0.5mg IM. Niño: 0.01mg/kg IM (máx 0.3mg)', route: 'IM', notes: 'PRIMERA LÍNEA. Muslo anterolateral. Repetir c/5-15min.' },
      { name: 'Difenhidramina', dose: '25-50mg IV/IM', route: 'IV / IM', notes: 'Adyuvante. NO reemplaza epinefrina.' },
      { name: 'Hidrocortisona', dose: '200mg IV', route: 'IV', notes: 'Previene reacción bifásica. Efecto tardío (4-6h).' },
      { name: 'Salbutamol', dose: '2-4 puffs inhalados', route: 'Inhalado', notes: 'Si broncoespasmo persistente.' },
    ],
    doNot: [
      'NO retrasar epinefrina — es el único tratamiento que salva vidas',
      'NO dar epinefrina IV (excepto en paro cardíaco)',
      'NO usar antihistamínicos como primera línea',
      'NO dejar al paciente de pie (riesgo de colapso)',
    ],
    transportNotes: 'Monitorizar continuamente. Llevar epinefrina adicional. Observar mínimo 4-6h por reacción bifásica. Posición supina durante transporte.',
  },

  snakebite: {
    condition: 'Mordedura de serpiente',
    description: 'Mordedura de serpiente venenosa. Común en selva peruana (Bothrops, Lachesis) y sierra (cascabel).',
    immediateSteps: [
      'Calmar al paciente — el movimiento acelera la absorción del veneno',
      'Inmovilizar la extremidad afectada (como fractura, con férula)',
      'Mantener la extremidad al nivel del corazón o ligeramente por debajo',
      'Retirar anillos, relojes, ropa ajustada (por edema)',
      'Marcar el borde del edema con hora para monitorear progresión',
      'Limpiar la herida con agua y jabón',
      'NO aplicar torniquete',
      'NO hacer incisiones ni succionar',
      'NO aplicar hielo ni sustancias',
      'Transportar URGENTE al hospital con suero antiofídico',
      'Si es posible: identificar o fotografiar la serpiente (sin arriesgarse)',
    ],
    medications: [
      { name: 'Suero antiofídico polivalente', dose: 'Según protocolo hospitalario (5-10 viales IV)', route: 'IV', notes: 'Solo en hospital con capacidad de manejar anafilaxia. NO en campo.' },
      { name: 'Paracetamol', dose: '500-1000mg VO', route: 'Oral', notes: 'Para dolor. NO usar AINEs (riesgo de sangrado).' },
      { name: 'SSN', dose: 'Hidratación IV', route: 'IV', notes: 'Mantener hidratación. Monitorear diuresis (rabdomiólisis).' },
    ],
    doNot: [
      'NO aplicar torniquete (causa necrosis)',
      'NO hacer cortes ni succionar el veneno',
      'NO aplicar hielo, electricidad, ni remedios caseros',
      'NO dar aspirina ni AINEs (aumentan sangrado)',
      'NO dar alcohol',
      'NO atrapar la serpiente (riesgo de segunda mordedura)',
    ],
    transportNotes: 'Inmovilización de extremidad. Transporte horizontal. Monitorear signos vitales y progresión del edema cada 15 min. Anotar hora de la mordedura.',
  },
};

/**
 * Get an emergency protocol by condition key.
 */
export function getEmergencyProtocol(condition: string): EmergencyProtocol | null {
  const key = condition.toLowerCase().trim().replace(/\s+/g, '_');
  return EMERGENCY_PROTOCOLS[key] ?? null;
}

/**
 * List all emergency protocol keys.
 */
export function listEmergencyProtocols(): string[] {
  return Object.keys(EMERGENCY_PROTOCOLS);
}

/**
 * Calculate epinephrine dose by weight (for anaphylaxis).
 * Returns dose in mg and ml of 1:1000 solution.
 */
export function calculateEpinephrineDose(weightKg: number, isChild: boolean): { doseMg: number; doseMl: number; notes: string } {
  if (isChild) {
    const dose = Math.min(0.3, weightKg * 0.01);
    return {
      doseMg: Math.round(dose * 1000) / 1000,
      doseMl: Math.round(dose * 1000) / 1000, // 1:1000 = 1mg/ml
      notes: `Niño ${weightKg}kg: ${dose.toFixed(3)}mg IM. Usar solución 1:1000. Repetir c/5-15min si necesario.`,
    };
  }
  const dose = weightKg < 50 ? 0.3 : 0.5;
  return {
    doseMg: dose,
    doseMl: dose,
    notes: `Adulto ${weightKg}kg: ${dose}mg IM en muslo anterolateral. Repetir c/5-15min si necesario (máx 3 dosis).`,
  };
}

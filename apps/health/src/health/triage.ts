/**
 * Emergency Triage Enhancement — Module E
 *
 * Provides severity classification, three-delays intervention,
 * facility lookup, traditional remedy safety, ORS recipes,
 * and water purification guidance for rural Peru.
 *
 * All data is embedded (no external dependencies).
 * Response lengths enforced: critical ≤500 chars, guidance ≤1000 chars.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type TriageLevel = 'BLACK' | 'RED' | 'YELLOW' | 'GREEN';

export interface TriageResult {
  level: TriageLevel;
  label: string;
  description: string;
  instructions: string;
  callEmergency: boolean;
}

export type FacilityLevel = 'posta' | 'centro' | 'hospital';

export interface Facility {
  name: string;
  level: FacilityLevel;
  department: string;
  province: string;
}

export type RemedySafety = 'SAFE' | 'HARMFUL' | 'NEUTRAL';

export interface RemedyInfo {
  name: string;
  safety: RemedySafety;
  description: string;
  warning?: string;
}

export interface ORSRecipe {
  variant: 'who' | 'home';
  ingredients: string[];
  instructions: string;
}

export interface WaterMethod {
  method: string;
  instructions: string;
  effectiveness: string;
}

export interface DelayIntervention {
  delay: 1 | 2 | 3;
  title: string;
  guidance: string;
}

// ─── Severity Classification ─────────────────────────────────────────────────

const BLACK_PATTERNS = [
  /inconsciente.*no respira/i,
  /no respira.*inconsciente/i,
  /sin pulso/i,
  /no tiene pulso/i,
  /paro card/i,
  /no respira.*sin pulso/i,
  /sin signos vitales/i,
  /dejó de respirar/i,
];

const RED_PATTERNS = [
  /hemorragia/i,
  /sangrado (abundante|severo|intenso|activo|no para)/i,
  /sangra (mucho|bastante)/i,
  /no para de sangrar/i,
  /dolor de pecho.*falta de aire/i,
  /falta de aire.*dolor de pecho/i,
  /dolor (en el|de) pecho.*dificultad.*respirar/i,
  /convulsion/i,
  /ataque epilép/i,
  /alergia severa/i,
  /anafilax/i,
  /hinchazón.*garganta/i,
  /no puede respirar.*hinch/i,
  /reacción alérgica.*grave/i,
  /derrame cerebral/i,
  /cara caída/i,
  /no puede mover.*brazo/i,
  /habla raro.*repentino/i,
  /accidente cerebrovascular/i,
  /quemadura.*(?:grave|severa|extensa|más del 20|grande)/i,
  /envenenam/i,
  /veneno/i,
  /tomó.*lejía/i,
  /ingirió.*tóxico/i,
  /mordedura de serpiente/i,
];

const YELLOW_PATTERNS = [
  /fractura/i,
  /hueso roto/i,
  /quemadura.*(?:moderada|segundo grado)/i,
  /vomit(?:o|a|ando).*(?:persist|no para|constante|repetid|todo el día)/i,
  /fiebre.*(?:alta|39|40|41)/i,
  /(?:39|40|41).*grado.*fiebre/i,
  /dolor abdominal/i,
  /dolor de barriga.*fuerte/i,
  /dolor de estómago.*fuerte/i,
  /dificultad.*respirar/i,
  /le cuesta respirar/i,
  /respiración.*difícil/i,
];

const GREEN_PATTERNS = [
  /cort(?:e|ada).*(?:pequeñ|leve|menor)/i,
  /herida.*(?:pequeñ|leve|menor)/i,
  /rasguño/i,
  /fiebre.*(?:leve|baja|37|38)/i,
  /resfr/i,
  /gripe.*leve/i,
  /tos.*leve/i,
  /catarro/i,
  /diarrea.*leve/i,
  /diarrea.*(?:poco|un poco)/i,
  /sarpullido/i,
  /erupción/i,
  /ronchas/i,
  /picazón/i,
  /dolor de cabeza.*leve/i,
];

/**
 * Classify symptom description into triage severity level.
 */
export function classifySeverity(description: string): TriageResult {
  const desc = description.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const original = description.toLowerCase();

  // BLACK: highest priority
  for (const pattern of BLACK_PATTERNS) {
    if (pattern.test(original) || pattern.test(desc)) {
      return {
        level: 'BLACK',
        label: 'EMERGENCIA CRÍTICA',
        description: 'Paciente inconsciente, no respira o sin pulso.',
        instructions: truncate(
          '🚨 INICIA RCP AHORA:\n' +
          '1. Llama al 106 (SAMU) o 116 (bomberos)\n' +
          '2. Coloca al paciente boca arriba en superficie dura\n' +
          '3. Pon el talón de tu mano en el centro del pecho\n' +
          '4. Comprime fuerte y rápido (5-6 cm, 100-120/min)\n' +
          '5. Cada 30 compresiones, da 2 respiraciones\n' +
          '6. NO pares hasta que llegue ayuda',
          500
        ),
        callEmergency: true,
      };
    }
  }

  // RED
  for (const pattern of RED_PATTERNS) {
    if (pattern.test(original) || pattern.test(desc)) {
      return {
        level: 'RED',
        label: 'EMERGENCIA',
        description: 'Situación que pone en riesgo la vida. Requiere atención INMEDIATA.',
        instructions: truncate(
          '🔴 ACCIÓN INMEDIATA:\n' +
          '1. Llama al 106 (SAMU) inmediatamente\n' +
          '2. No muevas al paciente innecesariamente\n' +
          '3. Si hay sangrado, presiona la herida con un trapo limpio\n' +
          '4. Mantén al paciente consciente y calmado\n' +
          '5. Ve al hospital más cercano SIN DEMORA',
          500
        ),
        callEmergency: true,
      };
    }
  }

  // YELLOW
  for (const pattern of YELLOW_PATTERNS) {
    if (pattern.test(original) || pattern.test(desc)) {
      return {
        level: 'YELLOW',
        label: 'URGENCIA',
        description: 'Requiere atención médica pronta pero no inmediata.',
        instructions: truncate(
          '🟡 Necesitas atención médica:\n' +
          '1. Acude al centro de salud más cercano hoy\n' +
          '2. Si hay fiebre alta, aplica paños húmedos\n' +
          '3. Si hay fractura, inmoviliza la zona sin forzar\n' +
          '4. Mantén hidratación con sorbos pequeños\n' +
          '5. No automediques — el médico decidirá el tratamiento',
          500
        ),
        callEmergency: false,
      };
    }
  }

  // GREEN
  for (const pattern of GREEN_PATTERNS) {
    if (pattern.test(original) || pattern.test(desc)) {
      return {
        level: 'GREEN',
        label: 'CONSULTA GENERAL',
        description: 'Condición leve que puede atenderse en casa o consulta programada.',
        instructions: truncate(
          '🟢 Cuidados en casa:\n' +
          '1. Descansa y mantente hidratado\n' +
          '2. Para fiebre leve: paños húmedos, líquidos\n' +
          '3. Para cortadas: lava con agua y jabón, cubre con gasa\n' +
          '4. Observa si los síntomas empeoran\n' +
          '5. Si no mejora en 2-3 días, consulta con tu médico',
          500
        ),
        callEmergency: false,
      };
    }
  }

  // Default: YELLOW (when in doubt, err on side of caution)
  return {
    level: 'YELLOW',
    label: 'EVALUACIÓN NECESARIA',
    description: 'No se pudo determinar la gravedad con certeza. Se recomienda evaluación médica.',
    instructions: truncate(
      '⚠️ Recomendación:\n' +
      '1. Acude al centro de salud más cercano para evaluación\n' +
      '2. Describe todos tus síntomas al personal de salud\n' +
      '3. No automediques\n' +
      '4. Si los síntomas empeoran, llama al 106 (SAMU)',
      500
    ),
    callEmergency: false,
  };
}

// ─── Three Delays Intervention ───────────────────────────────────────────────

/**
 * Delay 1: Help user recognize this IS an emergency.
 */
export function assessDelay1(symptoms: string): DelayIntervention {
  const result = classifySeverity(symptoms);
  let guidance: string;

  if (result.level === 'BLACK' || result.level === 'RED') {
    guidance =
      '⚠️ ESTO ES UNA EMERGENCIA. No esperes. ' +
      'Cada minuto cuenta. Llama al 106 (SAMU) o ve al hospital más cercano AHORA. ' +
      'No intentes tratar esto en casa. No esperes a que "pase solo".';
  } else if (result.level === 'YELLOW') {
    guidance =
      '⚠️ Esta situación necesita atención médica HOY. ' +
      'No es normal. Acude al centro de salud más cercano. ' +
      'Si empeora (fiebre sube, dolor se intensifica, vomita sangre), ve a emergencias.';
  } else {
    guidance =
      'Puedes manejar esto en casa por ahora. ' +
      'Pero si los síntomas empeoran o no mejoran en 2-3 días, consulta con tu médico. ' +
      'Señales de alarma: fiebre que sube, dificultad para respirar, sangrado.';
  }

  return {
    delay: 1,
    title: 'Reconocer la emergencia',
    guidance: truncate(guidance, 1000),
  };
}

/**
 * Delay 2: Transport planning — nearest facility, travel guidance.
 */
export function assessDelay2(department: string, severity: TriageLevel): DelayIntervention {
  const facilities = findFacilitiesByDepartment(department);
  const hospital = facilities.find(f => f.level === 'hospital');
  const centro = facilities.find(f => f.level === 'centro');
  const nearest = severity === 'BLACK' || severity === 'RED'
    ? hospital || centro || facilities[0]
    : centro || facilities[0];

  const facilityName = nearest
    ? `${nearest.name} (${nearest.level}, ${nearest.province})`
    : 'el establecimiento de salud más cercano';

  let journeyAdvice: string;
  if (severity === 'BLACK' || severity === 'RED') {
    journeyAdvice =
      `Lleva al paciente a ${facilityName} INMEDIATAMENTE. ` +
      'Durante el viaje: mantén vía aérea despejada, posición lateral si está inconsciente, ' +
      'presión directa en heridas sangrantes. Llama al 106 en camino.';
  } else {
    journeyAdvice =
      `Acude a ${facilityName}. ` +
      'Lleva DNI y SIS si tienes. Lleva lista de medicamentos actuales. ' +
      'Si el viaje es largo, mantén hidratación y toma nota de los síntomas y cuándo empezaron.';
  }

  return {
    delay: 2,
    title: 'Transporte al establecimiento',
    guidance: truncate(journeyAdvice, 1000),
  };
}

/**
 * Delay 3: What to tell health workers on arrival.
 */
export function assessDelay3(symptoms: string): DelayIntervention {
  const guidance =
    'Al llegar, dile al personal de salud:\n' +
    `• Síntomas: "${symptoms.slice(0, 100)}"\n` +
    '• Cuándo empezaron los síntomas\n' +
    '• Si tomó algún medicamento o remedio\n' +
    '• Alergias conocidas\n' +
    '• Signos vitales si los tienes: temperatura, si respira rápido/lento\n' +
    '• Enfermedades previas (diabetes, hipertensión, etc.)\n' +
    '• Si está embarazada y de cuántas semanas\n' +
    '⏱️ Pide que lo atiendan según la gravedad que describes.';

  return {
    delay: 3,
    title: 'Recibir atención adecuada',
    guidance: truncate(guidance, 1000),
  };
}

// ─── Facility Database ───────────────────────────────────────────────────────

const FACILITIES: Facility[] = [
  // Lima
  { name: 'Hospital Nacional Dos de Mayo', level: 'hospital', department: 'Lima', province: 'Lima' },
  { name: 'Hospital Nacional Arzobispo Loayza', level: 'hospital', department: 'Lima', province: 'Lima' },
  { name: 'Hospital de Emergencias Grau', level: 'hospital', department: 'Lima', province: 'Lima' },
  { name: 'Hospital María Auxiliadora', level: 'hospital', department: 'Lima', province: 'Lima' },
  { name: 'Centro de Salud San Cosme', level: 'centro', department: 'Lima', province: 'Lima' },
  // Cusco
  { name: 'Hospital Antonio Lorena', level: 'hospital', department: 'Cusco', province: 'Cusco' },
  { name: 'Hospital Regional del Cusco', level: 'hospital', department: 'Cusco', province: 'Cusco' },
  { name: 'Centro de Salud San Jerónimo', level: 'centro', department: 'Cusco', province: 'Cusco' },
  { name: 'Posta de Salud Písac', level: 'posta', department: 'Cusco', province: 'Calca' },
  // Puno
  { name: 'Hospital Regional Manuel Núñez Butrón', level: 'hospital', department: 'Puno', province: 'Puno' },
  { name: 'Hospital Carlos Monge Medrano', level: 'hospital', department: 'Puno', province: 'San Román' },
  { name: 'Centro de Salud Ayaviri', level: 'centro', department: 'Puno', province: 'Melgar' },
  { name: 'Posta de Salud Capachica', level: 'posta', department: 'Puno', province: 'Puno' },
  // Arequipa
  { name: 'Hospital Regional Honorio Delgado', level: 'hospital', department: 'Arequipa', province: 'Arequipa' },
  { name: 'Hospital Goyeneche', level: 'hospital', department: 'Arequipa', province: 'Arequipa' },
  { name: 'Centro de Salud Maritza Campos Díaz', level: 'centro', department: 'Arequipa', province: 'Arequipa' },
  // Loreto
  { name: 'Hospital Regional de Loreto', level: 'hospital', department: 'Loreto', province: 'Maynas' },
  { name: 'Hospital de Apoyo Iquitos', level: 'hospital', department: 'Loreto', province: 'Maynas' },
  { name: 'Centro de Salud San Juan', level: 'centro', department: 'Loreto', province: 'Maynas' },
  { name: 'Posta de Salud Nauta', level: 'posta', department: 'Loreto', province: 'Loreto' },
  // Huancavelica
  { name: 'Hospital Departamental de Huancavelica', level: 'hospital', department: 'Huancavelica', province: 'Huancavelica' },
  { name: 'Centro de Salud Acobamba', level: 'centro', department: 'Huancavelica', province: 'Acobamba' },
  { name: 'Posta de Salud Lircay', level: 'posta', department: 'Huancavelica', province: 'Angaraes' },
  // Junín
  { name: 'Hospital Regional Daniel Alcides Carrión', level: 'hospital', department: 'Junín', province: 'Huancayo' },
  { name: 'Hospital El Carmen', level: 'hospital', department: 'Junín', province: 'Huancayo' },
  { name: 'Centro de Salud Satipo', level: 'centro', department: 'Junín', province: 'Satipo' },
  { name: 'Posta de Salud Pangoa', level: 'posta', department: 'Junín', province: 'Satipo' },
  // Cajamarca
  { name: 'Hospital Regional de Cajamarca', level: 'hospital', department: 'Cajamarca', province: 'Cajamarca' },
  { name: 'Centro de Salud Baños del Inca', level: 'centro', department: 'Cajamarca', province: 'Cajamarca' },
  { name: 'Centro de Salud Jaén', level: 'centro', department: 'Cajamarca', province: 'Jaén' },
  { name: 'Posta de Salud San Marcos', level: 'posta', department: 'Cajamarca', province: 'San Marcos' },
  // Ayacucho
  { name: 'Hospital Regional de Ayacucho', level: 'hospital', department: 'Ayacucho', province: 'Huamanga' },
  { name: 'Centro de Salud San Juan Bautista', level: 'centro', department: 'Ayacucho', province: 'Huamanga' },
  { name: 'Posta de Salud Puquio', level: 'posta', department: 'Ayacucho', province: 'Lucanas' },
  // Lambayeque
  { name: 'Hospital Regional Lambayeque', level: 'hospital', department: 'Lambayeque', province: 'Chiclayo' },
  { name: 'Hospital Las Mercedes', level: 'hospital', department: 'Lambayeque', province: 'Chiclayo' },
  // La Libertad
  { name: 'Hospital Regional Docente de Trujillo', level: 'hospital', department: 'La Libertad', province: 'Trujillo' },
  { name: 'Hospital Belén de Trujillo', level: 'hospital', department: 'La Libertad', province: 'Trujillo' },
  // Piura
  { name: 'Hospital de Apoyo II Santa Rosa', level: 'hospital', department: 'Piura', province: 'Piura' },
  { name: 'Hospital de la Amistad Perú-Corea', level: 'hospital', department: 'Piura', province: 'Piura' },
  // Tacna
  { name: 'Hospital Hipólito Unanue de Tacna', level: 'hospital', department: 'Tacna', province: 'Tacna' },
  { name: 'Centro de Salud La Esperanza', level: 'centro', department: 'Tacna', province: 'Tacna' },
  // Ica
  { name: 'Hospital Regional de Ica', level: 'hospital', department: 'Ica', province: 'Ica' },
  { name: 'Hospital San Juan de Dios', level: 'hospital', department: 'Ica', province: 'Pisco' },
  // Madre de Dios
  { name: 'Hospital Santa Rosa de Puerto Maldonado', level: 'hospital', department: 'Madre de Dios', province: 'Tambopata' },
  { name: 'Centro de Salud Mazuko', level: 'centro', department: 'Madre de Dios', province: 'Manu' },
  // San Martín
  { name: 'Hospital de Apoyo II Tarapoto', level: 'hospital', department: 'San Martín', province: 'San Martín' },
  { name: 'Centro de Salud Moyobamba', level: 'centro', department: 'San Martín', province: 'Moyobamba' },
  // Amazonas
  { name: 'Hospital Regional Virgen de Fátima', level: 'hospital', department: 'Amazonas', province: 'Chachapoyas' },
  { name: 'Centro de Salud Bagua Grande', level: 'centro', department: 'Amazonas', province: 'Utcubamba' },
  // Ucayali
  { name: 'Hospital Regional de Pucallpa', level: 'hospital', department: 'Ucayali', province: 'Coronel Portillo' },
  { name: 'Centro de Salud Yarinacocha', level: 'centro', department: 'Ucayali', province: 'Coronel Portillo' },
  // Apurímac
  { name: 'Hospital Guillermo Díaz de la Vega', level: 'hospital', department: 'Apurímac', province: 'Abancay' },
  { name: 'Centro de Salud Andahuaylas', level: 'centro', department: 'Apurímac', province: 'Andahuaylas' },
  // Huánuco
  { name: 'Hospital Regional Hermilio Valdizán', level: 'hospital', department: 'Huánuco', province: 'Huánuco' },
  { name: 'Centro de Salud Tingo María', level: 'centro', department: 'Huánuco', province: 'Leoncio Prado' },
  // Pasco
  { name: 'Hospital Daniel Alcides Carrión de Pasco', level: 'hospital', department: 'Pasco', province: 'Pasco' },
  { name: 'Centro de Salud Oxapampa', level: 'centro', department: 'Pasco', province: 'Oxapampa' },
  // Ancash
  { name: 'Hospital Víctor Ramos Guardia', level: 'hospital', department: 'Ancash', province: 'Huaraz' },
  { name: 'Hospital La Caleta', level: 'hospital', department: 'Ancash', province: 'Santa' },
  // Tumbes
  { name: 'Hospital Regional JAMO II-2 Tumbes', level: 'hospital', department: 'Tumbes', province: 'Tumbes' },
  // Moquegua
  { name: 'Hospital Regional de Moquegua', level: 'hospital', department: 'Moquegua', province: 'Mariscal Nieto' },
  // Callao
  { name: 'Hospital Daniel Alcides Carrión del Callao', level: 'hospital', department: 'Callao', province: 'Callao' },
  { name: 'Hospital San José del Callao', level: 'hospital', department: 'Callao', province: 'Callao' },
];

/**
 * Find facilities by department (case-insensitive, accent-insensitive).
 */
export function findFacilitiesByDepartment(department: string): Facility[] {
  const norm = normalize(department);
  return FACILITIES.filter(f => normalize(f.department) === norm);
}

/**
 * Find nearest hospital-level facility by department.
 */
export function findNearestHospital(department: string): Facility | null {
  const facilities = findFacilitiesByDepartment(department);
  return facilities.find(f => f.level === 'hospital') ?? null;
}

/**
 * Get all facilities in the database.
 */
export function getAllFacilities(): Facility[] {
  return [...FACILITIES];
}

// ─── Traditional Remedy Safety ───────────────────────────────────────────────

const REMEDIES: RemedyInfo[] = [
  // SAFE
  { name: 'mate de coca', safety: 'SAFE', description: 'Alivio del mal de altura (soroche). Seguro junto al tratamiento médico.' },
  { name: 'uña de gato', safety: 'SAFE', description: 'Antiinflamatorio natural. Seguro como complemento.' },
  { name: 'manzanilla', safety: 'SAFE', description: 'Digestivo suave. Seguro para cólicos leves. No dar con comidas ricas en hierro.' },
  { name: 'muña', safety: 'SAFE', description: 'Digestivo andino. Seguro para malestares estomacales leves.' },
  { name: 'agua de boldo', safety: 'SAFE', description: 'Digestivo hepático suave. Seguro en cantidades moderadas.' },
  { name: 'sábila', safety: 'SAFE', description: 'Aplicación tópica para quemaduras leves. Segura externamente.' },
  { name: 'eucalipto inhalado', safety: 'SAFE', description: 'Vapor de eucalipto para congestión. Seguro como inhalación.' },
  { name: 'matico', safety: 'SAFE', description: 'Cicatrizante tópico tradicional. Seguro en heridas superficiales.' },
  { name: 'llantén', safety: 'SAFE', description: 'Antiinflamatorio para dolor de garganta. Seguro como gargarismo.' },
  { name: 'paico', safety: 'SAFE', description: 'Digestivo y antiparasitario suave. Seguro en infusión moderada.' },
  // HARMFUL
  { name: 'infusión de anís con comidas', safety: 'HARMFUL', description: 'Bloquea absorción de hierro 60-82%. NO dar con comidas.', warning: '⚠️ Causa anemia al bloquear absorción de hierro. No dar a niños con comidas.' },
  { name: 'kerosene en heridas', safety: 'HARMFUL', description: 'Quema tejidos y causa intoxicación.', warning: '🚫 NUNCA aplicar kerosene. Causa quemaduras químicas e intoxicación.' },
  { name: 'barro en heridas', safety: 'HARMFUL', description: 'Causa infecciones graves y tétanos.', warning: '🚫 Riesgo de tétanos e infección. Lavar con agua limpia y jabón.' },
  { name: 'orina en heridas', safety: 'HARMFUL', description: 'No es estéril. Causa infecciones.', warning: '🚫 La orina NO es estéril. Causa infecciones. Usar agua limpia.' },
  { name: 'emplasto de papa en fractura', safety: 'HARMFUL', description: 'Retrasa tratamiento de fractura.', warning: '⚠️ No sustituye inmovilización ni atención médica. Puede ocultar gravedad.' },
  { name: 'té de ruda para abortar', safety: 'HARMFUL', description: 'Tóxico, causa fallo hepático y hemorragia.', warning: '🚫 PELIGRO MORTAL. Causa hemorragia e insuficiencia hepática.' },
  { name: 'agua de tabaco', safety: 'HARMFUL', description: 'Nicotina concentrada causa intoxicación.', warning: '🚫 Intoxicación por nicotina. Puede ser fatal en niños.' },
  { name: 'sangre de grado oral en exceso', safety: 'HARMFUL', description: 'En exceso causa problemas gastrointestinales.', warning: '⚠️ Solo uso tópico o dosis mínimas. En exceso es tóxico.' },
  { name: 'infusión de menta con hierro', safety: 'HARMFUL', description: 'Reduce absorción de hierro significativamente.', warning: '⚠️ No tomar con suplementos de hierro ni comidas ricas en hierro.' },
  // NEUTRAL
  { name: 'agua de arroz', safety: 'NEUTRAL', description: 'Hidratante suave. No daña pero tampoco tiene efecto terapéutico significativo.' },
  { name: 'caldo de pollo', safety: 'NEUTRAL', description: 'Nutritivo e hidratante. Bueno como alimento, no como medicamento.' },
  { name: 'miel con limón', safety: 'NEUTRAL', description: 'Alivia garganta irritada. No cura infecciones. No dar a menores de 1 año.' },
  { name: 'vapores de romero', safety: 'NEUTRAL', description: 'Aromático. No daña pero efecto terapéutico no comprobado.' },
  { name: 'emplasto de arcilla', safety: 'NEUTRAL', description: 'Uso cosmético. No tiene efecto medicinal significativo.' },
  { name: 'agua de cebada', safety: 'NEUTRAL', description: 'Hidratante. No daña pero no reemplaza tratamiento médico.' },
  { name: 'limpieza con huevo', safety: 'NEUTRAL', description: 'Práctica cultural. No causa daño físico ni beneficio médico.' },
  { name: 'sahumerio', safety: 'NEUTRAL', description: 'Ritual de limpieza. Sin efecto médico. Evitar en pacientes respiratorios.' },
];

/**
 * Check safety of a traditional remedy.
 */
export function checkRemedySafety(remedyName: string): RemedyInfo | null {
  const norm = normalize(remedyName);
  return REMEDIES.find(r => normalize(r.name).includes(norm) || norm.includes(normalize(r.name))) ?? null;
}

/**
 * Get all remedies of a given safety classification.
 */
export function getRemediesBySafety(safety: RemedySafety): RemedyInfo[] {
  return REMEDIES.filter(r => r.safety === safety);
}

// ─── ORS Recipe ──────────────────────────────────────────────────────────────

/**
 * Generate ORS (Oral Rehydration Salts) recipe.
 * WHO standard or Peruvian home version.
 */
export function generateORSRecipe(variant: 'who' | 'home' = 'who'): ORSRecipe {
  if (variant === 'who') {
    return {
      variant: 'who',
      ingredients: [
        '1 litro de agua hervida (enfriada)',
        '6 cucharaditas rasas de azúcar',
        '½ cucharadita rasa de sal',
      ],
      instructions: truncate(
        'SUERO ORAL CASERO (OMS):\n' +
        '1. Hierve 1 litro de agua y déjala enfriar\n' +
        '2. Agrega 6 cucharaditas rasas de azúcar\n' +
        '3. Agrega ½ cucharadita rasa de sal\n' +
        '4. Mezcla bien hasta disolver\n' +
        '5. Dar sorbos pequeños cada 1-2 minutos\n' +
        '6. Preparar fresco cada día. No guardar más de 24 horas.\n' +
        '⚠️ Si el paciente vomita, espera 10 min y sigue con sorbos más pequeños.',
        1000
      ),
    };
  }

  return {
    variant: 'home',
    ingredients: [
      '1 litro de agua hervida (enfriada)',
      '8 cucharaditas rasas de azúcar o chancaca rallada',
      '½ cucharadita rasa de sal',
      'Jugo de 1 limón o naranja (opcional, aporta potasio)',
    ],
    instructions: truncate(
      'SUERO CASERO PERUANO:\n' +
      '1. Hierve 1 litro de agua y déjala enfriar\n' +
      '2. Agrega 8 cucharaditas de azúcar o chancaca rallada\n' +
      '3. Agrega ½ cucharadita de sal\n' +
      '4. Exprime 1 limón o naranja (potasio natural)\n' +
      '5. Mezcla bien\n' +
      '6. Dar sorbos pequeños frecuentes\n' +
      '7. Para niños: 1 cucharada cada 1-2 minutos\n' +
      '8. Para adultos: medio vaso cada 15 minutos\n' +
      '💡 La chancaca aporta minerales adicionales.',
      1000
    ),
  };
}

// ─── Water Purification ──────────────────────────────────────────────────────

/**
 * Get water purification methods suitable for rural Peru.
 */
export function getWaterPurificationMethods(): WaterMethod[] {
  return [
    {
      method: 'Hervido',
      instructions: truncate(
        'HERVIR EL AGUA:\n' +
        '1. Llena una olla con agua\n' +
        '2. Pon a hervir a fuego fuerte\n' +
        '3. Cuando hierva (burbujeo fuerte), cuenta 1 minuto\n' +
        '4. En altitud >2000m (sierra): hervir 3 minutos\n' +
        '5. Deja enfriar tapada\n' +
        '6. Guarda en recipiente limpio con tapa\n' +
        '✅ Método más seguro y accesible.',
        1000
      ),
      effectiveness: 'Elimina 99.9% de bacterias, virus y parásitos.',
    },
    {
      method: 'Cloración',
      instructions: truncate(
        'CLORACIÓN CON LEJÍA:\n' +
        '1. Usa lejía sin perfume (hipoclorito de sodio al 5%)\n' +
        '2. Para 1 litro de agua: 2 gotas de lejía\n' +
        '3. Para 1 balde (20 litros): 40 gotas (½ cucharadita)\n' +
        '4. Mezcla bien y espera 30 minutos antes de tomar\n' +
        '5. Debe oler ligeramente a cloro\n' +
        '⚠️ Si el agua está turbia, fíltrala primero con tela limpia.',
        1000
      ),
      effectiveness: 'Elimina bacterias y virus. Menos efectivo contra algunos parásitos.',
    },
    {
      method: 'SODIS (Desinfección Solar)',
      instructions: truncate(
        'DESINFECCIÓN SOLAR (SODIS):\n' +
        '1. Usa botellas de plástico transparente (PET) limpias\n' +
        '2. Llena con agua (si está turbia, fíltrala primero con tela)\n' +
        '3. Coloca las botellas al sol directo (en techo de calamina ideal)\n' +
        '4. Sol fuerte: 6 horas mínimo\n' +
        '5. Día nublado: dejar 2 días completos\n' +
        '6. Los rayos UV eliminan las bacterias\n' +
        '💡 Funciona mejor en botellas de hasta 2 litros.',
        1000
      ),
      effectiveness: 'Elimina mayoría de bacterias y virus. Requiere sol directo.',
    },
  ];
}

// ─── Response Length Enforcer ─────────────────────────────────────────────────

/**
 * Truncate text to a maximum character length, breaking at word boundary.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  const lastNewline = truncated.lastIndexOf('\n');
  const breakPoint = Math.max(lastSpace, lastNewline);
  return (breakPoint > maxLength * 0.7 ? truncated.slice(0, breakPoint) : truncated).trimEnd() + '…';
}

/**
 * Enforce critical alert length (≤500 chars).
 */
export function enforceCriticalLength(text: string): string {
  return truncate(text, 500);
}

/**
 * Enforce guidance length (≤1000 chars).
 */
export function enforceGuidanceLength(text: string): string {
  return truncate(text, 1000);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

/**
 * Quechua Language Support Module
 * Bilingual Spanish/Quechua health communication for rural Peru
 * No external dependencies — all phrases and glossary embedded
 */

// ── TYPES ──────────────────────────────────────────────────────────

export interface GlossaryEntry {
  quechua: string;
  spanish: string;
  category: 'body_part' | 'symptom' | 'disease' | 'nutrition' | 'pregnancy' | 'medication' | 'general';
}

export interface HealthPhrase {
  id: string;
  quechua: string;
  spanish: string;
  category: 'prenatal' | 'nutrition' | 'danger_signs' | 'tb_symptoms' | 'child_growth' | 'emergency' | 'general';
}

export interface BilingualResponse {
  spanish: string;
  quechua: string;
  combined: string;
}

export interface LanguageDetection {
  language: 'quechua' | 'spanish' | 'mixed' | 'unknown';
  confidence: number;
  quechuaTokens: string[];
}

export interface GreetingResult {
  isGreeting: boolean;
  response: BilingualResponse | null;
}

// ── QUECHUA GREETINGS ──────────────────────────────────────────────

const QUECHUA_GREETINGS: { pattern: RegExp; response: { spanish: string; quechua: string } }[] = [
  {
    pattern: /\ballillanchu\b/i,
    response: { spanish: '¡Hola! Estoy bien, gracias. ¿En qué puedo ayudarte?', quechua: 'Allillanmi, sulpayki. ¿Imapitaq yanapasqayki?' },
  },
  {
    pattern: /\bimaynallan\b/i,
    response: { spanish: '¡Bien! ¿Cómo estás tú? ¿En qué puedo ayudarte?', quechua: 'Allillanmi. ¿Qanrí? ¿Imapitaq yanapasqayki?' },
  },
  {
    pattern: /\bnapaykullayki\b/i,
    response: { spanish: '¡Te saludo también! ¿Cómo puedo ayudarte hoy?', quechua: 'Napaykullaykitaqmi. ¿Imapiñataq kunan yanapasqayki?' },
  },
  {
    pattern: /\brimaykullayki\b/i,
    response: { spanish: '¡Hola! Bienvenida. ¿En qué te puedo ayudar?', quechua: 'Allinmi. ¿Imapitaq yanapasqayki?' },
  },
  {
    pattern: /\ballillanmi\b/i,
    response: { spanish: '¡Qué bueno que estés bien! ¿En qué puedo ayudarte?', quechua: 'Ancha kusikuni. ¿Imapitaq yanapasqayki?' },
  },
  {
    pattern: /\bñuqa\s+kani\b/i,
    response: { spanish: '¡Bienvenida! ¿Cómo puedo ayudarte?', quechua: 'Allinmi hamunayki. ¿Imapitaq yanapasqayki?' },
  },
  {
    pattern: /\balli\s+p['\u2019]?unchay\b/i,
    response: { spanish: '¡Buen día! ¿En qué puedo ayudarte?', quechua: 'Alli p\'unchay. ¿Imapitaq yanapasqayki?' },
  },
  {
    pattern: /\balli\s+tuta\b/i,
    response: { spanish: '¡Buenas noches! ¿En qué puedo ayudarte?', quechua: 'Alli tuta. ¿Imapitaq yanapasqayki?' },
  },
  {
    pattern: /\balli\s+sukha\b/i,
    response: { spanish: '¡Buenas tardes! ¿En qué puedo ayudarte?', quechua: 'Alli sukha. ¿Imapitaq yanapasqayki?' },
  },
  {
    pattern: /\bimaynalla\b/i,
    response: { spanish: '¡Hola! Estoy bien. ¿En qué puedo ayudarte?', quechua: 'Allillanmi. ¿Imapitaq yanapasqayki?' },
  },
];

// ── MEDICAL GLOSSARY (80+ terms) ──────────────────────────────────

export const MEDICAL_GLOSSARY: GlossaryEntry[] = [
  // Body parts (20)
  { quechua: 'uma', spanish: 'cabeza', category: 'body_part' },
  { quechua: 'ñawi', spanish: 'ojo', category: 'body_part' },
  { quechua: 'rinri', spanish: 'oreja', category: 'body_part' },
  { quechua: 'sinqa', spanish: 'nariz', category: 'body_part' },
  { quechua: 'simi', spanish: 'boca', category: 'body_part' },
  { quechua: 'kiru', spanish: 'diente', category: 'body_part' },
  { quechua: 'kunka', spanish: 'cuello', category: 'body_part' },
  { quechua: 'maki', spanish: 'mano', category: 'body_part' },
  { quechua: 'chaki', spanish: 'pie', category: 'body_part' },
  { quechua: 'sunqu', spanish: 'corazón', category: 'body_part' },
  { quechua: 'wiksa', spanish: 'barriga', category: 'body_part' },
  { quechua: 'wasa', spanish: 'espalda', category: 'body_part' },
  { quechua: 'ñuñu', spanish: 'pecho/seno', category: 'body_part' },
  { quechua: 'qallu', spanish: 'lengua', category: 'body_part' },
  { quechua: 'tullu', spanish: 'hueso', category: 'body_part' },
  { quechua: 'yawar', spanish: 'sangre', category: 'body_part' },
  { quechua: 'aycha', spanish: 'carne/músculo', category: 'body_part' },
  { quechua: 'qara', spanish: 'piel', category: 'body_part' },
  { quechua: 'chukcha', spanish: 'cabello', category: 'body_part' },
  { quechua: 'muqu', spanish: 'rodilla', category: 'body_part' },

  // Symptoms (20)
  { quechua: 'nanay', spanish: 'dolor', category: 'symptom' },
  { quechua: 'uma nanay', spanish: 'dolor de cabeza', category: 'symptom' },
  { quechua: 'wiksa nanay', spanish: 'dolor de barriga', category: 'symptom' },
  { quechua: 'ruphay', spanish: 'fiebre', category: 'symptom' },
  { quechua: 'chiri chiri', spanish: 'escalofríos', category: 'symptom' },
  { quechua: 'uhu', spanish: 'tos', category: 'symptom' },
  { quechua: 'qicha', spanish: 'diarrea', category: 'symptom' },
  { quechua: 'millpukuy', spanish: 'náuseas/vómitos', category: 'symptom' },
  { quechua: 'puñuy munayniyuq', spanish: 'somnolencia', category: 'symptom' },
  { quechua: 'sayk\'usqa', spanish: 'cansancio/fatiga', category: 'symptom' },
  { quechua: 'punkisqa', spanish: 'hinchazón', category: 'symptom' },
  { quechua: 'yawar lluqsiy', spanish: 'sangrado', category: 'symptom' },
  { quechua: 'mana mikhuy munay', spanish: 'falta de apetito', category: 'symptom' },
  { quechua: 'ch\'aki simi', spanish: 'boca seca/sed', category: 'symptom' },
  { quechua: 'quncha', spanish: 'flema/moco', category: 'symptom' },
  { quechua: 'wasa nanay', spanish: 'dolor de espalda', category: 'symptom' },
  { quechua: 'mana puñuy atiy', spanish: 'insomnio', category: 'symptom' },
  { quechua: 'raku uhu', spanish: 'tos con flema', category: 'symptom' },
  { quechua: 'chaki punkisqa', spanish: 'pies hinchados', category: 'symptom' },
  { quechua: 'llakikuy', spanish: 'tristeza/depresión', category: 'symptom' },

  // Diseases (15)
  { quechua: 'unquy', spanish: 'enfermedad', category: 'disease' },
  { quechua: 'yawar pisiyay', spanish: 'anemia', category: 'disease' },
  { quechua: 'ch\'uju unquy', spanish: 'tuberculosis', category: 'disease' },
  { quechua: 'chiri unquy', spanish: 'malaria/paludismo', category: 'disease' },
  { quechua: 'misq\'i yawar unquy', spanish: 'diabetes', category: 'disease' },
  { quechua: 'yawar sinchi unquy', spanish: 'hipertensión', category: 'disease' },
  { quechua: 'q\'utu', spanish: 'bocio/tiroides', category: 'disease' },
  { quechua: 'kuru unquy', spanish: 'parasitosis', category: 'disease' },
  { quechua: 'sara unquy', spanish: 'sarampión', category: 'disease' },
  { quechua: 'hamp\'atu siki', spanish: 'varicela', category: 'disease' },
  { quechua: 'uhu unquy', spanish: 'neumonía', category: 'disease' },
  { quechua: 'wiksa kuru', spanish: 'parásitos intestinales', category: 'disease' },
  { quechua: 'mana allinta mikhuy', spanish: 'desnutrición', category: 'disease' },
  { quechua: 'ñawi unquy', spanish: 'infección ocular', category: 'disease' },
  { quechua: 'sunqu unquy', spanish: 'enfermedad del corazón', category: 'disease' },

  // Nutrition (15)
  { quechua: 'mikhuy', spanish: 'comida/alimento', category: 'nutrition' },
  { quechua: 'unu', spanish: 'agua', category: 'nutrition' },
  { quechua: 'ñuñu', spanish: 'leche', category: 'nutrition' },
  { quechua: 'papa', spanish: 'papa/patata', category: 'nutrition' },
  { quechua: 'sara', spanish: 'maíz', category: 'nutrition' },
  { quechua: 'kinuwa', spanish: 'quinua', category: 'nutrition' },
  { quechua: 'qañiwa', spanish: 'cañihua', category: 'nutrition' },
  { quechua: 'tarwi', spanish: 'tarwi/chocho', category: 'nutrition' },
  { quechua: 'runtu', spanish: 'huevo', category: 'nutrition' },
  { quechua: 'aycha', spanish: 'carne', category: 'nutrition' },
  { quechua: 'challwa', spanish: 'pescado', category: 'nutrition' },
  { quechua: 'uqa', spanish: 'oca', category: 'nutrition' },
  { quechua: 'kachiy', spanish: 'sal', category: 'nutrition' },
  { quechua: 'misk\'i', spanish: 'azúcar/dulce', category: 'nutrition' },
  { quechua: 'wiraq\'uya', spanish: 'grasa/aceite', category: 'nutrition' },

  // Pregnancy (10)
  { quechua: 'chichu', spanish: 'embarazada', category: 'pregnancy' },
  { quechua: 'wachakuy', spanish: 'parto', category: 'pregnancy' },
  { quechua: 'wawa', spanish: 'bebé/niño', category: 'pregnancy' },
  { quechua: 'ñuñuchiy', spanish: 'amamantar', category: 'pregnancy' },
  { quechua: 'mama wiksa', spanish: 'útero', category: 'pregnancy' },
  { quechua: 'wachay nanay', spanish: 'contracciones', category: 'pregnancy' },
  { quechua: 'purik yawar', spanish: 'sangrado en embarazo', category: 'pregnancy' },
  { quechua: 'sulluchiy', spanish: 'aborto espontáneo', category: 'pregnancy' },
  { quechua: 'hampi wachachiq', spanish: 'partera/obstetra', category: 'pregnancy' },
  { quechua: 'qilla killa', spanish: 'meses de embarazo', category: 'pregnancy' },

  // Medications (5)
  { quechua: 'hampi', spanish: 'medicina/remedio', category: 'medication' },
  { quechua: 'yawar hampiy', spanish: 'suplemento de hierro', category: 'medication' },
  { quechua: 'tuqsiy hampi', spanish: 'inyección/vacuna', category: 'medication' },
  { quechua: 'upyana hampi', spanish: 'jarabe/medicina líquida', category: 'medication' },
  { quechua: 'kuru hampiy', spanish: 'antiparasitario', category: 'medication' },
];

// ── HEALTH PHRASE DATABASE (50+ phrases) ──────────────────────────

export const HEALTH_PHRASES: HealthPhrase[] = [
  // Prenatal care (10)
  { id: 'pre01', category: 'prenatal', quechua: 'Chichu kaspaykiqa, killa killapi hampipatamanmi rinayki.', spanish: 'Si estás embarazada, debes ir al centro de salud cada mes.' },
  { id: 'pre02', category: 'prenatal', quechua: 'Yawar hampita mikhunayki, wawaykirayku.', spanish: 'Debes tomar tu suplemento de hierro, por tu bebé.' },
  { id: 'pre03', category: 'prenatal', quechua: 'Ñuñuykita qunki wawaman, ñawpaq kanchis killapi.', spanish: 'Da pecho a tu bebé desde los primeros meses.' },
  { id: 'pre04', category: 'prenatal', quechua: 'Chichu kaspa, achka unuta upyanayki.', spanish: 'Durante el embarazo, toma mucha agua.' },
  { id: 'pre05', category: 'prenatal', quechua: 'Hampipatapiqa yawarniykita qhawanqaku.', spanish: 'En el centro de salud te revisarán la sangre.' },
  { id: 'pre06', category: 'prenatal', quechua: 'Wawata suyaspa, allinta mikhuy, allinta puñuy.', spanish: 'Esperando al bebé, come bien y duerme bien.' },
  { id: 'pre07', category: 'prenatal', quechua: 'Tuqsiy hampikunata churachikuy wawaykirayku.', spanish: 'Ponte las vacunas por tu bebé.' },
  { id: 'pre08', category: 'prenatal', quechua: 'Wawata suyanapaq iskay chunka semanapi ultrasonidota ruwanqaku.', spanish: 'Alrededor de las 20 semanas te harán una ecografía.' },
  { id: 'pre09', category: 'prenatal', quechua: 'Ácido fólicota mikhunayki, wawayki allin kananpaq.', spanish: 'Toma ácido fólico para que tu bebé se desarrolle bien.' },
  { id: 'pre10', category: 'prenatal', quechua: 'Mana alkuhulta upyanaykichu, chichu kaspa.', spanish: 'No debes tomar alcohol durante el embarazo.' },

  // Nutrition (10)
  { id: 'nut01', category: 'nutrition', quechua: 'Yawar pisiyayqa mikhuykunawan allichakunmi.', spanish: 'La anemia se puede mejorar con la alimentación.' },
  { id: 'nut02', category: 'nutrition', quechua: 'Sangrecita, hígado, bazo — yawar pisiyaypaq allinmi.', spanish: 'Sangrecita, hígado, bazo — son buenos contra la anemia.' },
  { id: 'nut03', category: 'nutrition', quechua: 'Limunta, naranjata mikhuy yawar hampiwan kuskachakuq.', spanish: 'Come limón o naranja junto con los alimentos ricos en hierro.' },
  { id: 'nut04', category: 'nutrition', quechua: 'Ama anís ch\'uyata quykichu wawaman, mikhuywan kuskachakuq.', spanish: 'No le des infusión de anís al niño junto con la comida.' },
  { id: 'nut05', category: 'nutrition', quechua: 'Suqta killayuq wawaman mikhuchiy qallariy.', spanish: 'Empieza a darle comida al bebé desde los 6 meses.' },
  { id: 'nut06', category: 'nutrition', quechua: 'Kinuwa, qañiwa, tarwi — achka yawarniyuqmi.', spanish: 'Quinua, cañihua, tarwi — tienen mucho hierro.' },
  { id: 'nut07', category: 'nutrition', quechua: 'Ñuñuchiy wawaykita iskay watakama.', spanish: 'Amamanta a tu bebé hasta los dos años.' },
  { id: 'nut08', category: 'nutrition', quechua: 'Wawaman runtuta mikhuchiy sapa p\'unchay.', spanish: 'Dale huevo a tu hijo todos los días.' },
  { id: 'nut09', category: 'nutrition', quechua: 'Unuta t\'impuchiy mikhuna kananpaq.', spanish: 'Hierve el agua antes de darla de beber.' },
  { id: 'nut10', category: 'nutrition', quechua: 'Wawaman achka laya mikhuykunata quy.', spanish: 'Dale al niño variedad de alimentos.' },

  // Danger signs (10)
  { id: 'dan01', category: 'danger_signs', quechua: 'Achka yawarta rikuspa, usqhaylla hampipata rinayki.', spanish: 'Si ves mucho sangrado, ve al centro de salud de inmediato.' },
  { id: 'dan02', category: 'danger_signs', quechua: 'Umayki sinchita nanasuptinqa, usqhaylla hampipata rinayki.', spanish: 'Si tienes dolor fuerte de cabeza, ve al centro de salud urgente.' },
  { id: 'dan03', category: 'danger_signs', quechua: 'Wawa mana kuyuptinqa, usqhaylla rinayki hampipata.', spanish: 'Si el bebé no se mueve, ve al centro de salud de inmediato.' },
  { id: 'dan04', category: 'danger_signs', quechua: 'Chakiyki achka punkisqa kaptinqa, doctorman rinayki.', spanish: 'Si tus pies están muy hinchados, ve al doctor.' },
  { id: 'dan05', category: 'danger_signs', quechua: 'Sinchi ruphayniyuq kaspaykiqa, usqhaylla rinayki.', spanish: 'Si tienes fiebre alta, ve de inmediato al centro de salud.' },
  { id: 'dan06', category: 'danger_signs', quechua: 'Ñawiyki laqhayasuptinqa, doctorman rinayki.', spanish: 'Si tu vista se nubla, ve al doctor.' },
  { id: 'dan07', category: 'danger_signs', quechua: 'Wawa mana ñuñutachu munaptinqa, qhawachiy doctorta.', spanish: 'Si el bebé no quiere mamar, llévalo al doctor.' },
  { id: 'dan08', category: 'danger_signs', quechua: 'Achka qicha kaptinqa, usqhaylla unuta upyachiy.', spanish: 'Si hay mucha diarrea, dale líquidos de inmediato.' },
  { id: 'dan09', category: 'danger_signs', quechua: 'Wawa q\'uñi q\'uñi kaptinqa, pañuwan mayllay.', spanish: 'Si el bebé tiene fiebre, báñalo con paño húmedo.' },
  { id: 'dan10', category: 'danger_signs', quechua: 'Mana samachikuspayki millpukuptikiqa, usqhaylla rinayki hampipata.', spanish: 'Si vomitas sin parar, ve urgente al centro de salud.' },

  // TB symptoms (8)
  { id: 'tb01', category: 'tb_symptoms', quechua: 'Iskay semanata uhuspaykiqa, ch\'uju unquymanta yachachinakuy.', spanish: 'Si toses más de 2 semanas, hazte un examen de tuberculosis.' },
  { id: 'tb02', category: 'tb_symptoms', quechua: 'Tuta sudayqa ch\'uju unquy señalninmi kanman.', spanish: 'Sudar de noche puede ser señal de tuberculosis.' },
  { id: 'tb03', category: 'tb_symptoms', quechua: 'Mana mikhuy munaspa, pisiyaspa — ch\'uju unquytachu kanman.', spanish: 'Sin apetito y bajando de peso — podría ser tuberculosis.' },
  { id: 'tb04', category: 'tb_symptoms', quechua: 'Ch\'uju unquy hampinmi kanña. Ama manchakuychu.', spanish: 'La tuberculosis tiene cura. No tengas miedo.' },
  { id: 'tb05', category: 'tb_symptoms', quechua: 'Ch\'uju unquy hampiqa suqta killam. Ama saqiykuchu.', spanish: 'El tratamiento de TB dura 6 meses. No lo dejes.' },
  { id: 'tb06', category: 'tb_symptoms', quechua: 'Tukuy hampiyta tukunayki, allin kanaykipaq.', spanish: 'Debes terminar todo tu tratamiento para curarte.' },
  { id: 'tb07', category: 'tb_symptoms', quechua: 'Uhuspa yawarta thuqaptikiqa, usqhaylla hampipata rinayki.', spanish: 'Si toses sangre, ve al centro de salud de inmediato.' },
  { id: 'tb08', category: 'tb_symptoms', quechua: 'Aylluykiruna ch\'uju unquyniyuq kaptinqa, qanpas qhawachikunayki.', spanish: 'Si alguien en tu familia tiene TB, tú también debes hacerte revisar.' },

  // Child growth (7)
  { id: 'gro01', category: 'child_growth', quechua: 'Wawata sapa killa pesachiy, midichiy.', spanish: 'Pesa y mide a tu hijo cada mes.' },
  { id: 'gro02', category: 'child_growth', quechua: 'Wawa mana wiñaptinqa, doctorman apay.', spanish: 'Si el niño no crece, llévalo al doctor.' },
  { id: 'gro03', category: 'child_growth', quechua: 'CRED controlninman sapa killa apamuychis wawata.', spanish: 'Lleva a tu hijo al control CRED cada mes.' },
  { id: 'gro04', category: 'child_growth', quechua: 'Wawa q\'umir q\'umir kaptinqa, yawar pisiyay kanman.', spanish: 'Si el niño está muy pálido, podría tener anemia.' },
  { id: 'gro05', category: 'child_growth', quechua: 'Kuru hampita qunayki suqta killapi suqta killapi.', spanish: 'Dale antiparasitario cada 6 meses.' },
  { id: 'gro06', category: 'child_growth', quechua: 'Tuqsiy hampikunata churachiy wawaman calendario nisqanman hina.', spanish: 'Ponle las vacunas según el calendario de vacunación.' },
  { id: 'gro07', category: 'child_growth', quechua: 'Wawa pukllanmi, kusikunmi — chaymi allin señal.', spanish: 'Un niño que juega y está contento — esa es buena señal.' },

  // Emergency (8)
  { id: 'eme01', category: 'emergency', quechua: 'Usqhaylla hampipata rinayki. Ama suyaychu.', spanish: 'Ve al centro de salud urgente. No esperes.' },
  { id: 'eme02', category: 'emergency', quechua: 'Achka yawar lluqsimuptinqa, chaki pataman puñuchiy, usqhaylla apay.', spanish: 'Si hay mucho sangrado, acuéstala con los pies elevados y llévala urgente.' },
  { id: 'eme03', category: 'emergency', quechua: 'Convulsión kaptinqa, wichiqman churay, ama imata simiman churaychu.', spanish: 'Si tiene convulsiones, ponla de lado, no le metas nada en la boca.' },
  { id: 'eme04', category: 'emergency', quechua: 'Suero casero: litru unupi iskay cucharita kachiy, suqta cucharita misk\'i.', spanish: 'Suero casero: en 1 litro de agua, 2 cucharaditas de sal, 6 de azúcar.' },
  { id: 'eme05', category: 'emergency', quechua: 'Wawa mana samachikuspa waqaptinqa, doctorman usqhaylla apay.', spanish: 'Si el bebé no para de llorar, llévalo al doctor urgente.' },
  { id: 'eme06', category: 'emergency', quechua: 'Sunquyki sinchita nanaptinqa, ambulanciata waqyay.', spanish: 'Si te duele mucho el pecho, llama a la ambulancia.' },
  { id: 'eme07', category: 'emergency', quechua: 'Mana samay atispaqa, usqhaylla hampipata rinayki.', spanish: 'Si no puedes respirar, ve urgente al centro de salud.' },
  { id: 'eme08', category: 'emergency', quechua: 'Ama kutichinaykipaq huk runata kachay yanapata maskaq.', spanish: 'Envía a alguien a buscar ayuda mientras esperas.' },

  // General (3)
  { id: 'gen01', category: 'general', quechua: 'Makiykita mayllay mikhunaykiraqtaq.', spanish: 'Lávate las manos antes de comer.' },
  { id: 'gen02', category: 'general', quechua: 'Pusaq vasuta unuta upyay sapa p\'unchay.', spanish: 'Toma 8 vasos de agua cada día.' },
  { id: 'gen03', category: 'general', quechua: 'Hampipata riy sapa wata qhawachikunaykipaq.', spanish: 'Ve al centro de salud cada año para tu chequeo.' },
];

// ── QUECHUA MARKER WORDS (for language detection) ─────────────────

const QUECHUA_MARKERS = new Set([
  // Common Quechua words
  'allillanchu', 'imaynallan', 'imaynalla', 'napaykullayki', 'rimaykullayki',
  'allillanmi', 'sulpayki', 'ari', 'mana', 'manam', 'icha',
  'imata', 'maypi', 'hayk\'a', 'pita', 'imapaq',
  // Suffixes appear as standalone in detection
  'ñuqa', 'qan', 'pay', 'ñuqanchis', 'qankuna', 'paykuna',
  // Body / health
  'uma', 'ñawi', 'rinri', 'sinqa', 'simi', 'maki', 'chaki', 'sunqu',
  'wiksa', 'nanay', 'unquy', 'hampi', 'wawa', 'chichu',
  'yawar', 'ruphay', 'uhu', 'qicha',
  // Food
  'mikhuy', 'unu', 'papa', 'sara', 'kinuwa', 'qañiwa', 'runtu',
  'aycha', 'challwa', 'kachiy',
  // Verbs / particles
  'kani', 'kanki', 'kay', 'munay', 'riy', 'hamuy', 'apay',
  'mikhunayki', 'upyay', 'puñuy', 'waqyay', 'rinayki',
  // Time / place
  'kunan', 'paqarin', 'qayna', 'tuta', 'p\'unchay',
  'wasiy', 'llaqta', 'hampipata',
  // Numbers
  'huk', 'iskay', 'kinsa', 'tawa', 'pichqa', 'suqta', 'qanchis', 'pusaq', 'isqun', 'chunka',
]);

// ── EXPORTED FUNCTIONS ────────────────────────────────────────────

/**
 * Detect whether a message contains a Quechua greeting and return a bilingual response.
 */
export function detectGreeting(message: string): GreetingResult {
  const normalized = message.toLowerCase().trim();
  for (const g of QUECHUA_GREETINGS) {
    if (g.pattern.test(normalized)) {
      return {
        isGreeting: true,
        response: {
          spanish: g.response.spanish,
          quechua: g.response.quechua,
          combined: `${g.response.quechua}\n${g.response.spanish}`,
        },
      };
    }
  }
  return { isGreeting: false, response: null };
}

/**
 * Detect the language of a message: quechua, spanish, mixed, or unknown.
 */
export function detectLanguage(message: string): LanguageDetection {
  const words = message
    .toLowerCase()
    .replace(/[^a-záéíóúüñ'\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 1);

  if (words.length === 0) {
    return { language: 'unknown', confidence: 0, quechuaTokens: [] };
  }

  const quechuaTokens: string[] = [];
  for (const word of words) {
    if (QUECHUA_MARKERS.has(word)) {
      quechuaTokens.push(word);
    }
  }

  // Also check glossary entries
  for (const entry of MEDICAL_GLOSSARY) {
    const qWords = entry.quechua.toLowerCase().split(/\s+/);
    for (const qw of qWords) {
      if (words.includes(qw) && !quechuaTokens.includes(qw)) {
        quechuaTokens.push(qw);
      }
    }
  }

  const quechuaRatio = quechuaTokens.length / words.length;

  // Spanish markers
  const SPANISH_MARKERS = new Set([
    'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'en', 'con',
    'por', 'para', 'que', 'es', 'son', 'está', 'están', 'hay',
    'como', 'pero', 'más', 'muy', 'también', 'tiene', 'tengo',
    'mi', 'tu', 'su', 'me', 'te', 'se', 'no', 'sí',
    'hola', 'buenas', 'gracias', 'doctor', 'salud',
  ]);

  let spanishCount = 0;
  for (const word of words) {
    if (SPANISH_MARKERS.has(word)) spanishCount++;
  }
  const spanishRatio = spanishCount / words.length;

  if (quechuaRatio >= 0.4 && spanishRatio < 0.1) {
    return { language: 'quechua', confidence: Math.min(quechuaRatio + 0.2, 1), quechuaTokens };
  }
  if (quechuaRatio >= 0.15 && spanishRatio >= 0.1) {
    return { language: 'mixed', confidence: 0.6, quechuaTokens };
  }
  if (quechuaRatio >= 0.15) {
    return { language: 'quechua', confidence: quechuaRatio + 0.1, quechuaTokens };
  }
  if (spanishRatio >= 0.15) {
    return { language: 'spanish', confidence: Math.min(spanishRatio + 0.3, 1), quechuaTokens };
  }
  if (quechuaTokens.length > 0) {
    return { language: 'mixed', confidence: 0.4, quechuaTokens };
  }

  return { language: 'unknown', confidence: 0.2, quechuaTokens: [] };
}

/**
 * Check if a message is likely in Quechua.
 */
export function isQuechua(message: string): boolean {
  const detection = detectLanguage(message);
  return detection.language === 'quechua';
}

/**
 * Look up a term in the medical glossary.
 * Searches both Quechua and Spanish sides. Returns all matches.
 */
export function lookupGlossary(term: string, category?: GlossaryEntry['category']): GlossaryEntry[] {
  const normalized = term.toLowerCase().trim();
  return MEDICAL_GLOSSARY.filter(entry => {
    if (category && entry.category !== category) return false;
    return (
      entry.quechua.toLowerCase().includes(normalized) ||
      entry.spanish.toLowerCase().includes(normalized)
    );
  });
}

/**
 * Get all glossary entries for a given category.
 */
export function getGlossaryByCategory(category: GlossaryEntry['category']): GlossaryEntry[] {
  return MEDICAL_GLOSSARY.filter(e => e.category === category);
}

/**
 * Retrieve health phrases by category.
 */
export function getHealthPhrases(category: HealthPhrase['category']): HealthPhrase[] {
  return HEALTH_PHRASES.filter(p => p.category === category);
}

/**
 * Get a specific health phrase by ID.
 */
export function getHealthPhraseById(id: string): HealthPhrase | undefined {
  return HEALTH_PHRASES.find(p => p.id === id);
}

/**
 * Generate a bilingual response from a Spanish health message.
 * Attempts to find a matching pre-built phrase; otherwise wraps the Spanish
 * with a voice-friendly Quechua header and disclaimer.
 */
export function generateBilingualResponse(spanishMessage: string): BilingualResponse {
  const normalized = spanishMessage.toLowerCase().trim();

  // Try to find a pre-built phrase that closely matches
  for (const phrase of HEALTH_PHRASES) {
    const phraseNorm = phrase.spanish.toLowerCase();
    // Check for substantial overlap
    if (normalized.includes(phraseNorm) || phraseNorm.includes(normalized)) {
      return {
        spanish: phrase.spanish,
        quechua: phrase.quechua,
        combined: `${phrase.quechua}\n${phrase.spanish}`,
      };
    }
  }

  // Check for keyword matches to find the most relevant phrase
  // Filter to meaningful words (>4 chars, skip stopwords)
  const stopwords = new Set(['para', 'como', 'desde', 'cada', 'puede', 'tiene', 'cuando', 'debes', 'donde', 'entre', 'sobre', 'según', 'también', 'mucho', 'estos']);
  const keywords = normalized.split(/\s+/).filter(w => w.length > 4 && !stopwords.has(w));
  let bestMatch: HealthPhrase | null = null;
  let bestScore = 0;

  for (const phrase of HEALTH_PHRASES) {
    const phraseWords = phrase.spanish.toLowerCase().split(/\s+/);
    let score = 0;
    for (const kw of keywords) {
      // Require exact word match (not substring)
      if (phraseWords.includes(kw)) {
        score++;
      }
    }
    if (score > bestScore && score >= 2) {
      bestScore = score;
      bestMatch = phrase;
    }
  }

  if (bestMatch) {
    return {
      spanish: spanishMessage,
      quechua: bestMatch.quechua,
      combined: `${bestMatch.quechua}\n${spanishMessage}`,
    };
  }

  // Fallback: wrap with generic bilingual framing
  const voiceFriendly = formatForVoice(spanishMessage);
  return {
    spanish: voiceFriendly,
    quechua: 'Kaypi willasqayki:',
    combined: `Kaypi willasqayki:\n${voiceFriendly}`,
  };
}

/**
 * Translate a single term from Spanish to Quechua using the glossary.
 * Returns the Quechua term or null if not found.
 */
export function spanishToQuechua(spanishTerm: string): string | null {
  const normalized = spanishTerm.toLowerCase().trim();
  const entry = MEDICAL_GLOSSARY.find(e => e.spanish.toLowerCase() === normalized);
  return entry ? entry.quechua : null;
}

/**
 * Translate a single term from Quechua to Spanish using the glossary.
 * Returns the Spanish term or null if not found.
 */
export function quechuaToSpanish(quechuaTerm: string): string | null {
  const normalized = quechuaTerm.toLowerCase().trim();
  const entry = MEDICAL_GLOSSARY.find(e => e.quechua.toLowerCase() === normalized);
  return entry ? entry.spanish : null;
}

/**
 * Format text for voice-friendly delivery.
 * Breaks long sentences, keeps phrases short, adds oral-tradition-aware patterns.
 */
export function formatForVoice(text: string): string {
  // Split on sentence boundaries
  let sentences = text.split(/(?<=[.!?])\s+/);

  // Break very long sentences at commas
  const result: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length > 80) {
      const parts = sentence.split(/,\s*/);
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed) {
          // Ensure it ends with punctuation
          result.push(trimmed.match(/[.!?]$/) ? trimmed : trimmed + '.');
        }
      }
    } else if (sentence.trim()) {
      result.push(sentence.trim());
    }
  }

  return result.join(' ');
}

/**
 * Get the total count of glossary entries.
 */
export function glossarySize(): number {
  return MEDICAL_GLOSSARY.length;
}

/**
 * Get the total count of health phrases.
 */
export function healthPhraseCount(): number {
  return HEALTH_PHRASES.length;
}

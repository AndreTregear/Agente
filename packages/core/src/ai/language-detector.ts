/**
 * Language detector for multilingual conversations.
 * Detects Spanish, English, and Quechua based on word patterns and vocabulary.
 */

export type DetectedLanguage = 'es' | 'en' | 'qu' | 'unknown';

export interface LanguageDetectionResult {
  language: DetectedLanguage;
  confidence: number;
  scores: {
    es: number;
    en: number;
    qu: number;
  };
}

const QUECHUA_WORDS = new Set([
  'allillanchu', 'imaynallan', 'imaynalla', 'napaykullayki', 'rimaykullayki',
  'allillanmi', 'sulpayki', 'ari', 'manam',
  'ñuqa', 'qan', 'pay', 'ñuqanchis', 'qankuna', 'paykuna',
  'imata', 'maypi', 'imapaq', 'icha', 'mana',
  'uma', 'ñawi', 'rinri', 'sinqa', 'simi', 'kiru', 'kunka',
  'maki', 'chaki', 'sunqu', 'wiksa', 'wasa', 'ñuñu', 'qallu',
  'tullu', 'yawar', 'aycha', 'qara', 'chukcha', 'muqu',
  'nanay', 'ruphay', 'uhu', 'qicha', 'millpukuy', 'punkisqa', 'llakikuy',
  'unquy', 'hampi', 'chichu', 'wachakuy', 'wawa', 'ñuñuchiy',
  'mikhuy', 'unu', 'papa', 'sara', 'kinuwa', 'qañiwa', 'tarwi',
  'runtu', 'challwa', 'kachiy',
  'kani', 'kanki', 'kay', 'munay', 'riy', 'hamuy', 'apay',
  'upyay', 'puñuy', 'waqyay', 'rinayki', 'mikhunayki',
  'kunan', 'paqarin', 'qayna', 'tuta', 'wasiy', 'llaqta', 'hampipata',
  'huk', 'iskay', 'kinsa', 'tawa', 'pichqa', 'suqta', 'qanchis', 'pusaq', 'isqun', 'chunka',
  'allinta', 'usqhaylla', 'sinchita',
]);

const QUECHUA_SUFFIXES = [
  'nchis', 'kuna', 'yuq', 'niyuq', 'manta', 'paq', 'wan', 'man',
  'pi', 'ta', 'qa', 'mi', 'cha', 'raq', 'ña', 'puni', 'lla',
  'sqa', 'spa', 'nayki', 'nqa', 'chis', 'nki', 'yku',
];

const SPANISH_WORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'lo',
  'de', 'del', 'en', 'con', 'por', 'para', 'sin', 'sobre', 'entre', 'hacia', 'desde', 'hasta',
  'que', 'pero', 'porque', 'aunque', 'como', 'cuando', 'donde', 'mientras',
  'yo', 'tu', 'su', 'mi', 'me', 'te', 'se', 'nos', 'le', 'les',
  'es', 'son', 'está', 'están', 'hay', 'tiene', 'tengo', 'tienes',
  'ser', 'estar', 'tener', 'hacer', 'poder', 'querer', 'ir', 'ver', 'dar',
  'soy', 'eres', 'somos', 'estoy', 'estamos', 'puedo', 'puede', 'quiero',
  'no', 'sí', 'muy', 'más', 'también', 'bien', 'mal', 'aquí', 'ahora',
  'hola', 'buenas', 'gracias', 'doctor', 'salud', 'buenos', 'días',
  'noches', 'tardes', 'señor', 'señora',
]);

const ENGLISH_WORDS = new Set([
  'the', 'a', 'an', 'this', 'that', 'these', 'those',
  'of', 'in', 'to', 'for', 'with', 'on', 'at', 'from', 'by', 'about', 'into',
  'and', 'but', 'or', 'so', 'because', 'if', 'when', 'while',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'my', 'your', 'his', 'her',
  'is', 'are', 'was', 'were', 'have', 'has', 'had', 'do', 'does', 'did',
  'can', 'will', 'would', 'should', 'could', 'may', 'might',
  'be', 'been', 'being', 'get', 'got', 'go', 'going', 'make',
  'not', 'yes', 'no', 'very', 'also', 'just', 'well', 'here', 'now', 'how',
  'what', 'where', 'who', 'why', 'which',
  'health', 'doctor', 'pain', 'help', 'please', 'thank', 'thanks',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-záéíóúüñ'\u02BC\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

function hasQuechuaSuffix(word: string): boolean {
  for (const suffix of QUECHUA_SUFFIXES) {
    if (word.length > suffix.length + 2 && word.endsWith(suffix)) {
      return true;
    }
  }
  return false;
}

export function detectLanguage(text: string): DetectedLanguage {
  return detectLanguageDetailed(text).language;
}

export function detectLanguageDetailed(text: string): LanguageDetectionResult {
  const words = tokenize(text);

  if (words.length === 0) {
    return { language: 'unknown', confidence: 0, scores: { es: 0, en: 0, qu: 0 } };
  }

  let quScore = 0;
  let esScore = 0;
  let enScore = 0;

  for (const word of words) {
    if (QUECHUA_WORDS.has(word)) quScore += 1.0;
    if (SPANISH_WORDS.has(word)) esScore += 1.0;
    if (ENGLISH_WORDS.has(word)) enScore += 1.0;
    if (hasQuechuaSuffix(word)) quScore += 0.7;

    if (word.endsWith('ción') || word.endsWith('mente') || word.endsWith('ando') ||
        word.endsWith('endo') || word.endsWith('ado') || word.endsWith('ido')) {
      esScore += 0.5;
    }

    if (word.endsWith('ing') || word.endsWith('tion') || word.endsWith('ness') ||
        word.endsWith('ment') || word.endsWith('able') || word.endsWith('ful')) {
      enScore += 0.5;
    }
  }

  const total = words.length;
  const quRatio = quScore / total;
  const esRatio = esScore / total;
  const enRatio = enScore / total;

  const scores = { es: round(esRatio, 3), en: round(enRatio, 3), qu: round(quRatio, 3) };
  const maxScore = Math.max(quRatio, esRatio, enRatio);

  if (maxScore < 0.1) {
    return { language: 'unknown', confidence: 0.1, scores };
  }

  const minMargin = words.length <= 3 ? 0.15 : 0.05;

  if (quRatio >= esRatio + minMargin && quRatio >= enRatio + minMargin) {
    return { language: 'qu', confidence: Math.min(quRatio + 0.2, 1), scores };
  }
  if (esRatio >= quRatio + minMargin && esRatio >= enRatio + minMargin) {
    return { language: 'es', confidence: Math.min(esRatio + 0.2, 1), scores };
  }
  if (enRatio >= quRatio + minMargin && enRatio >= esRatio + minMargin) {
    return { language: 'en', confidence: Math.min(enRatio + 0.2, 1), scores };
  }

  if (quRatio > 0.15 && quRatio >= esRatio * 0.8) {
    return { language: 'qu', confidence: Math.min(quRatio + 0.1, 0.7), scores };
  }

  if (esRatio > enRatio) {
    return { language: 'es', confidence: Math.min(esRatio + 0.1, 0.8), scores };
  }
  if (enRatio > esRatio) {
    return { language: 'en', confidence: Math.min(enRatio + 0.1, 0.8), scores };
  }

  return { language: 'unknown', confidence: 0.2, scores };
}

export function isQuechua(text: string): boolean { return detectLanguage(text) === 'qu'; }
export function isSpanish(text: string): boolean { return detectLanguage(text) === 'es'; }
export function isEnglish(text: string): boolean { return detectLanguage(text) === 'en'; }

function round(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

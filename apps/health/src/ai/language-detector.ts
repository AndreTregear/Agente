/**
 * Language detector for multilingual health conversations.
 * Detects Spanish, English, and Quechua based on word patterns and vocabulary.
 *
 * Uses the Quechua medical vocabulary from the quechua module as a reference,
 * plus common word lists for Spanish and English.
 */

// ── Types ──────────────────────────────────────────────────────────

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

// ── Word lists ─────────────────────────────────────────────────────

/**
 * Quechua marker words — common vocabulary, body parts, health terms,
 * pronouns, and grammatical particles.
 * Sourced from the medical glossary and common Quechua usage.
 */
const QUECHUA_WORDS = new Set([
  // Greetings & common
  'allillanchu', 'imaynallan', 'imaynalla', 'napaykullayki', 'rimaykullayki',
  'allillanmi', 'sulpayki', 'ari', 'manam',
  // Pronouns & particles
  'ñuqa', 'qan', 'pay', 'ñuqanchis', 'qankuna', 'paykuna',
  'imata', 'maypi', 'imapaq', 'icha', 'mana',
  // Body parts
  'uma', 'ñawi', 'rinri', 'sinqa', 'simi', 'kiru', 'kunka',
  'maki', 'chaki', 'sunqu', 'wiksa', 'wasa', 'ñuñu', 'qallu',
  'tullu', 'yawar', 'aycha', 'qara', 'chukcha', 'muqu',
  // Symptoms
  'nanay', 'ruphay', 'uhu', 'qicha', 'millpukuy', 'punkisqa',
  'llakikuy',
  // Health & disease
  'unquy', 'hampi', 'chichu', 'wachakuy', 'wawa', 'ñuñuchiy',
  // Food
  'mikhuy', 'unu', 'papa', 'sara', 'kinuwa', 'qañiwa', 'tarwi',
  'runtu', 'challwa', 'kachiy',
  // Verbs
  'kani', 'kanki', 'kay', 'munay', 'riy', 'hamuy', 'apay',
  'upyay', 'puñuy', 'waqyay', 'rinayki', 'mikhunayki',
  // Time & place
  'kunan', 'paqarin', 'qayna', 'tuta', 'wasiy', 'llaqta', 'hampipata',
  // Numbers
  'huk', 'iskay', 'kinsa', 'tawa', 'pichqa', 'suqta', 'qanchis', 'pusaq', 'isqun', 'chunka',
  // Common suffixes that appear as words in context
  'allinta', 'usqhaylla', 'sinchita',
]);

/**
 * Quechua morphological suffixes — when these appear at the end of words,
 * they strongly suggest Quechua.
 */
const QUECHUA_SUFFIXES = [
  'nchis', 'kuna', 'yuq', 'niyuq', 'manta', 'paq', 'wan', 'man',
  'pi', 'ta', 'qa', 'mi', 'cha', 'raq', 'ña', 'puni', 'lla',
  'sqa', 'spa', 'nayki', 'nqa', 'chis', 'nki', 'yku',
];

/** Common Spanish words (articles, prepositions, conjunctions, verbs). */
const SPANISH_WORDS = new Set([
  // Articles & determiners
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'lo',
  // Prepositions
  'de', 'del', 'en', 'con', 'por', 'para', 'sin', 'sobre', 'entre', 'hacia', 'desde', 'hasta',
  // Conjunctions
  'que', 'pero', 'porque', 'aunque', 'como', 'cuando', 'donde', 'mientras',
  // Pronouns
  'yo', 'tu', 'su', 'mi', 'me', 'te', 'se', 'nos', 'le', 'les',
  // Common verbs
  'es', 'son', 'está', 'están', 'hay', 'tiene', 'tengo', 'tienes',
  'ser', 'estar', 'tener', 'hacer', 'poder', 'querer', 'ir', 'ver', 'dar',
  'soy', 'eres', 'somos', 'estoy', 'estamos', 'puedo', 'puede', 'quiero',
  // Adverbs
  'no', 'sí', 'muy', 'más', 'también', 'bien', 'mal', 'aquí', 'ahora',
  // Common nouns/greetings
  'hola', 'buenas', 'gracias', 'doctor', 'salud', 'buenos', 'días',
  'noches', 'tardes', 'señor', 'señora',
]);

/** Common English words (articles, prepositions, conjunctions, verbs). */
const ENGLISH_WORDS = new Set([
  // Articles & determiners
  'the', 'a', 'an', 'this', 'that', 'these', 'those',
  // Prepositions
  'of', 'in', 'to', 'for', 'with', 'on', 'at', 'from', 'by', 'about', 'into',
  // Conjunctions
  'and', 'but', 'or', 'so', 'because', 'if', 'when', 'while',
  // Pronouns
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'my', 'your', 'his', 'her',
  // Common verbs
  'is', 'are', 'was', 'were', 'have', 'has', 'had', 'do', 'does', 'did',
  'can', 'will', 'would', 'should', 'could', 'may', 'might',
  'be', 'been', 'being', 'get', 'got', 'go', 'going', 'make',
  // Adverbs & common
  'not', 'yes', 'no', 'very', 'also', 'just', 'well', 'here', 'now', 'how',
  'what', 'where', 'who', 'why', 'which',
  // Health-related
  'health', 'doctor', 'pain', 'help', 'please', 'thank', 'thanks',
]);

// ── Detection logic ────────────────────────────────────────────────

/**
 * Normalize and tokenize text for language detection.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-záéíóúüñ'ʼ\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/**
 * Check if a word has Quechua morphological suffixes.
 */
function hasQuechuaSuffix(word: string): boolean {
  for (const suffix of QUECHUA_SUFFIXES) {
    if (word.length > suffix.length + 2 && word.endsWith(suffix)) {
      return true;
    }
  }
  return false;
}

/**
 * Detect the language of a text string.
 *
 * Returns 'es' (Spanish), 'en' (English), 'qu' (Quechua), or 'unknown'.
 * Designed for short messages typical of WhatsApp health conversations.
 *
 * @param text - Input text to analyze
 * @returns Detected language code
 */
export function detectLanguage(text: string): DetectedLanguage {
  const result = detectLanguageDetailed(text);
  return result.language;
}

/**
 * Detailed language detection with confidence scores.
 */
export function detectLanguageDetailed(text: string): LanguageDetectionResult {
  const words = tokenize(text);

  if (words.length === 0) {
    return { language: 'unknown', confidence: 0, scores: { es: 0, en: 0, qu: 0 } };
  }

  let quScore = 0;
  let esScore = 0;
  let enScore = 0;

  for (const word of words) {
    // Direct word matches (weighted 1.0)
    if (QUECHUA_WORDS.has(word)) quScore += 1.0;
    if (SPANISH_WORDS.has(word)) esScore += 1.0;
    if (ENGLISH_WORDS.has(word)) enScore += 1.0;

    // Quechua suffix detection (weighted 0.7)
    if (hasQuechuaSuffix(word)) quScore += 0.7;

    // Spanish morphological hints (common endings)
    if (word.endsWith('ción') || word.endsWith('mente') || word.endsWith('ando') ||
        word.endsWith('endo') || word.endsWith('ado') || word.endsWith('ido')) {
      esScore += 0.5;
    }

    // English morphological hints
    if (word.endsWith('ing') || word.endsWith('tion') || word.endsWith('ness') ||
        word.endsWith('ment') || word.endsWith('able') || word.endsWith('ful')) {
      enScore += 0.5;
    }
  }

  // Normalize by word count
  const total = words.length;
  const quRatio = quScore / total;
  const esRatio = esScore / total;
  const enRatio = enScore / total;

  const scores = { es: round(esRatio, 3), en: round(enRatio, 3), qu: round(quRatio, 3) };

  // Determine winner
  const maxScore = Math.max(quRatio, esRatio, enRatio);

  if (maxScore < 0.1) {
    return { language: 'unknown', confidence: 0.1, scores };
  }

  // Require meaningful margin for short messages
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

  // Tie-breaking: if Quechua is close to Spanish, prefer Quechua
  // (bilingual speakers often mix — Quechua detection is more valuable)
  if (quRatio > 0.15 && quRatio >= esRatio * 0.8) {
    return { language: 'qu', confidence: Math.min(quRatio + 0.1, 0.7), scores };
  }

  // Default to Spanish (most common in the target population)
  if (esRatio > enRatio) {
    return { language: 'es', confidence: Math.min(esRatio + 0.1, 0.8), scores };
  }
  if (enRatio > esRatio) {
    return { language: 'en', confidence: Math.min(enRatio + 0.1, 0.8), scores };
  }

  return { language: 'unknown', confidence: 0.2, scores };
}

/**
 * Quick check: is the text likely in Quechua?
 */
export function isQuechua(text: string): boolean {
  return detectLanguage(text) === 'qu';
}

/**
 * Quick check: is the text likely in Spanish?
 */
export function isSpanish(text: string): boolean {
  return detectLanguage(text) === 'es';
}

/**
 * Quick check: is the text likely in English?
 */
export function isEnglish(text: string): boolean {
  return detectLanguage(text) === 'en';
}

// ── Helpers ─────────────────────────────────────────────────────────

function round(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

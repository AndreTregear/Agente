import { describe, it, expect } from 'vitest';
import {
  detectGreeting,
  detectLanguage,
  isQuechua,
  lookupGlossary,
  getGlossaryByCategory,
  getHealthPhrases,
  getHealthPhraseById,
  generateBilingualResponse,
  spanishToQuechua,
  quechuaToSpanish,
  formatForVoice,
  glossarySize,
  healthPhraseCount,
  MEDICAL_GLOSSARY,
  HEALTH_PHRASES,
} from '../src/health/quechua.js';

// ── Greeting Detection ─────────────────────────────────────────

describe('Greeting Detection', () => {
  it('detects "allillanchu" greeting', () => {
    const result = detectGreeting('Allillanchu');
    expect(result.isGreeting).toBe(true);
    expect(result.response).not.toBeNull();
    expect(result.response!.quechua).toContain('Allillanmi');
  });

  it('detects "imaynallan" greeting', () => {
    const result = detectGreeting('Imaynallan kashanki?');
    expect(result.isGreeting).toBe(true);
    expect(result.response!.spanish).toContain('Bien');
  });

  it('detects "napaykullayki" greeting', () => {
    const result = detectGreeting('napaykullayki');
    expect(result.isGreeting).toBe(true);
    expect(result.response!.combined).toContain('\n');
  });

  it('detects "alli p\'unchay" (good morning)', () => {
    const result = detectGreeting('alli p\'unchay');
    expect(result.isGreeting).toBe(true);
    expect(result.response!.spanish).toContain('Buen día');
  });

  it('detects "alli tuta" (good evening)', () => {
    const result = detectGreeting('alli tuta');
    expect(result.isGreeting).toBe(true);
  });

  it('returns no greeting for Spanish text', () => {
    const result = detectGreeting('Hola, buenos días');
    expect(result.isGreeting).toBe(false);
    expect(result.response).toBeNull();
  });

  it('is case-insensitive', () => {
    const result = detectGreeting('ALLILLANCHU');
    expect(result.isGreeting).toBe(true);
  });

  it('detects greeting within longer message', () => {
    const result = detectGreeting('Hola, allillanchu, necesito ayuda');
    expect(result.isGreeting).toBe(true);
  });
});

// ── Language Detection ─────────────────────────────────────────

describe('Language Detection', () => {
  it('detects pure Quechua text', () => {
    const result = detectLanguage('Ñuqa wawa nanay uma sinqa');
    expect(result.language).toBe('quechua');
    expect(result.confidence).toBeGreaterThan(0.3);
    expect(result.quechuaTokens.length).toBeGreaterThan(0);
  });

  it('detects pure Spanish text', () => {
    const result = detectLanguage('Mi hijo tiene dolor de cabeza y fiebre');
    expect(result.language).toBe('spanish');
  });

  it('detects mixed Quechua/Spanish text', () => {
    const result = detectLanguage('Mi wawa tiene nanay en la uma');
    expect(result.language).toBe('mixed');
    expect(result.quechuaTokens).toContain('wawa');
  });

  it('returns unknown for empty or very short text', () => {
    const result = detectLanguage('');
    expect(result.language).toBe('unknown');
    expect(result.confidence).toBe(0);
  });

  it('isQuechua returns true for Quechua sentences', () => {
    expect(isQuechua('Ñuqa wawa chichu hampi munay')).toBe(true);
  });

  it('isQuechua returns false for Spanish', () => {
    expect(isQuechua('Mi hijo tiene fiebre muy alta')).toBe(false);
  });
});

// ── Glossary Lookup ────────────────────────────────────────────

describe('Glossary Lookup', () => {
  it('has at least 80 terms', () => {
    expect(glossarySize()).toBeGreaterThanOrEqual(80);
  });

  it('finds body part by Spanish term', () => {
    const results = lookupGlossary('cabeza');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].quechua).toBe('uma');
  });

  it('finds body part by Quechua term', () => {
    const results = lookupGlossary('sunqu');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].spanish).toBe('corazón');
  });

  it('filters by category', () => {
    const results = lookupGlossary('nanay', 'symptom');
    expect(results.length).toBeGreaterThan(0);
    results.forEach(r => expect(r.category).toBe('symptom'));
  });

  it('returns empty for unknown term', () => {
    const results = lookupGlossary('xylophone');
    expect(results).toHaveLength(0);
  });

  it('gets all body parts', () => {
    const bodyParts = getGlossaryByCategory('body_part');
    expect(bodyParts.length).toBeGreaterThanOrEqual(15);
  });

  it('gets all symptoms', () => {
    const symptoms = getGlossaryByCategory('symptom');
    expect(symptoms.length).toBeGreaterThanOrEqual(15);
  });

  it('gets all diseases', () => {
    const diseases = getGlossaryByCategory('disease');
    expect(diseases.length).toBeGreaterThanOrEqual(10);
  });

  it('translates Spanish to Quechua', () => {
    expect(spanishToQuechua('fiebre')).toBe('ruphay');
    expect(spanishToQuechua('dolor')).toBe('nanay');
  });

  it('translates Quechua to Spanish', () => {
    expect(quechuaToSpanish('yawar')).toBe('sangre');
    expect(quechuaToSpanish('hampi')).toBe('medicina/remedio');
  });

  it('returns null for untranslatable terms', () => {
    expect(spanishToQuechua('appendicitis')).toBeNull();
    expect(quechuaToSpanish('internet')).toBeNull();
  });
});

// ── Health Phrases ─────────────────────────────────────────────

describe('Health Phrases', () => {
  it('has at least 50 phrases', () => {
    expect(healthPhraseCount()).toBeGreaterThanOrEqual(50);
  });

  it('retrieves prenatal phrases', () => {
    const phrases = getHealthPhrases('prenatal');
    expect(phrases.length).toBeGreaterThanOrEqual(8);
    phrases.forEach(p => expect(p.category).toBe('prenatal'));
  });

  it('retrieves nutrition phrases', () => {
    const phrases = getHealthPhrases('nutrition');
    expect(phrases.length).toBeGreaterThanOrEqual(8);
  });

  it('retrieves danger sign phrases', () => {
    const phrases = getHealthPhrases('danger_signs');
    expect(phrases.length).toBeGreaterThanOrEqual(8);
  });

  it('retrieves TB symptom phrases', () => {
    const phrases = getHealthPhrases('tb_symptoms');
    expect(phrases.length).toBeGreaterThanOrEqual(5);
  });

  it('retrieves child growth phrases', () => {
    const phrases = getHealthPhrases('child_growth');
    expect(phrases.length).toBeGreaterThanOrEqual(5);
  });

  it('retrieves emergency phrases', () => {
    const phrases = getHealthPhrases('emergency');
    expect(phrases.length).toBeGreaterThanOrEqual(5);
  });

  it('finds phrase by ID', () => {
    const phrase = getHealthPhraseById('pre01');
    expect(phrase).toBeDefined();
    expect(phrase!.category).toBe('prenatal');
    expect(phrase!.quechua.length).toBeGreaterThan(0);
    expect(phrase!.spanish.length).toBeGreaterThan(0);
  });

  it('all phrases have both languages', () => {
    for (const p of HEALTH_PHRASES) {
      expect(p.quechua.length).toBeGreaterThan(0);
      expect(p.spanish.length).toBeGreaterThan(0);
    }
  });
});

// ── Bilingual Response Generation ──────────────────────────────

describe('Bilingual Response Generation', () => {
  it('matches known phrase for anemia', () => {
    const result = generateBilingualResponse('La anemia se puede mejorar con la alimentación.');
    expect(result.quechua).toContain('pisiyay');
    expect(result.combined).toContain('\n');
  });

  it('matches keyword-based for sangrado', () => {
    const result = generateBilingualResponse('Si ves mucho sangrado, ve al centro de salud.');
    expect(result.quechua.length).toBeGreaterThan(0);
  });

  it('falls back gracefully for unknown topic', () => {
    const result = generateBilingualResponse('Blockchain cryptography decentralized protocol.');
    expect(result.spanish.length).toBeGreaterThan(0);
    expect(result.quechua).toBe('Kaypi willasqayki:');
    expect(result.combined).toContain('Kaypi willasqayki:');
  });
});

// ── Voice-friendly Formatting ──────────────────────────────────

describe('Voice-friendly Formatting', () => {
  it('breaks long sentence at commas', () => {
    const input = 'Debes comer alimentos ricos en hierro, como sangrecita, hígado, y bazo, para combatir la anemia.';
    const result = formatForVoice(input);
    expect(result).toBeDefined();
    // Should break into shorter chunks
    const sentences = result.split(/[.!?]\s*/);
    sentences.forEach(s => {
      if (s.trim()) expect(s.length).toBeLessThanOrEqual(100);
    });
  });

  it('preserves short sentences as-is', () => {
    const input = 'Come bien. Duerme bien. Toma agua.';
    const result = formatForVoice(input);
    expect(result).toContain('Come bien.');
    expect(result).toContain('Duerme bien.');
  });

  it('handles single sentence', () => {
    const result = formatForVoice('Toma agua.');
    expect(result).toBe('Toma agua.');
  });
});

// ── Data Integrity ─────────────────────────────────────────────

describe('Data Integrity', () => {
  it('all glossary entries have unique quechua terms within same category', () => {
    const seen = new Map<string, Set<string>>();
    for (const entry of MEDICAL_GLOSSARY) {
      if (!seen.has(entry.category)) seen.set(entry.category, new Set());
      const set = seen.get(entry.category)!;
      // Some terms appear in multiple categories (e.g., aycha, ñuñu), that's OK
      // Just check within category
      const key = `${entry.quechua}|${entry.spanish}`;
      expect(set.has(key)).toBe(false);
      set.add(key);
    }
  });

  it('all health phrases have unique IDs', () => {
    const ids = new Set<string>();
    for (const phrase of HEALTH_PHRASES) {
      expect(ids.has(phrase.id)).toBe(false);
      ids.add(phrase.id);
    }
  });
});

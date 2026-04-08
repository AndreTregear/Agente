import { describe, it, expect } from 'vitest';
import {
  classifySeverity,
  assessDelay1,
  assessDelay2,
  assessDelay3,
  findFacilitiesByDepartment,
  findNearestHospital,
  getAllFacilities,
  checkRemedySafety,
  getRemediesBySafety,
  generateORSRecipe,
  getWaterPurificationMethods,
  truncate,
  enforceCriticalLength,
  enforceGuidanceLength,
} from '../src/health/triage.js';

// ─── Severity Classification ─────────────────────────────────────────────────

describe('Severity Classification', () => {
  // BLACK level
  it('classifies unconscious + not breathing as BLACK', () => {
    const result = classifySeverity('Está inconsciente y no respira');
    expect(result.level).toBe('BLACK');
    expect(result.callEmergency).toBe(true);
    expect(result.instructions).toContain('RCP');
  });

  it('classifies no pulse as BLACK', () => {
    const result = classifySeverity('No tiene pulso, dejó de respirar');
    expect(result.level).toBe('BLACK');
  });

  it('classifies cardiac arrest as BLACK', () => {
    const result = classifySeverity('Paro cardíaco, sin signos vitales');
    expect(result.level).toBe('BLACK');
  });

  // RED level
  it('classifies active hemorrhage as RED', () => {
    const result = classifySeverity('Tiene una hemorragia, sangra mucho');
    expect(result.level).toBe('RED');
    expect(result.callEmergency).toBe(true);
  });

  it('classifies chest pain + shortness of breath as RED', () => {
    const result = classifySeverity('Dolor de pecho y falta de aire');
    expect(result.level).toBe('RED');
  });

  it('classifies seizures as RED', () => {
    const result = classifySeverity('Está teniendo convulsiones');
    expect(result.level).toBe('RED');
  });

  it('classifies severe allergic reaction as RED', () => {
    const result = classifySeverity('Reacción alérgica grave, hinchazón en la garganta');
    expect(result.level).toBe('RED');
  });

  it('classifies poisoning as RED', () => {
    const result = classifySeverity('Mi hijo tomó lejía, envenenamiento');
    expect(result.level).toBe('RED');
  });

  it('classifies snake bite as RED', () => {
    const result = classifySeverity('Le mordió una serpiente, mordedura de serpiente');
    expect(result.level).toBe('RED');
  });

  // YELLOW level
  it('classifies fracture as YELLOW', () => {
    const result = classifySeverity('Se cayó y parece que tiene una fractura en el brazo');
    expect(result.level).toBe('YELLOW');
    expect(result.callEmergency).toBe(false);
  });

  it('classifies high fever as YELLOW', () => {
    const result = classifySeverity('Tiene fiebre alta de 39 grados');
    expect(result.level).toBe('YELLOW');
  });

  it('classifies persistent vomiting as YELLOW', () => {
    const result = classifySeverity('Vomita sin parar, vómito persistente todo el día');
    expect(result.level).toBe('YELLOW');
  });

  it('classifies difficulty breathing as YELLOW', () => {
    const result = classifySeverity('Le cuesta respirar pero está consciente');
    expect(result.level).toBe('YELLOW');
  });

  it('classifies abdominal pain as YELLOW', () => {
    const result = classifySeverity('Tiene dolor abdominal fuerte');
    expect(result.level).toBe('YELLOW');
  });

  // GREEN level
  it('classifies minor cuts as GREEN', () => {
    const result = classifySeverity('Tiene una cortada pequeña en el dedo');
    expect(result.level).toBe('GREEN');
    expect(result.callEmergency).toBe(false);
  });

  it('classifies mild fever as GREEN', () => {
    const result = classifySeverity('Fiebre leve de 37.5 grados');
    expect(result.level).toBe('GREEN');
  });

  it('classifies cold symptoms as GREEN', () => {
    const result = classifySeverity('Tiene un resfriado, estornudos y mocos');
    expect(result.level).toBe('GREEN');
  });

  it('classifies mild diarrhea as GREEN', () => {
    const result = classifySeverity('Tiene un poco de diarrea leve');
    expect(result.level).toBe('GREEN');
  });

  it('classifies rashes as GREEN', () => {
    const result = classifySeverity('Le salió un sarpullido en los brazos');
    expect(result.level).toBe('GREEN');
  });

  // Default behavior
  it('defaults to YELLOW for ambiguous descriptions', () => {
    const result = classifySeverity('Algo le pasa a mi hijo pero no sé qué');
    expect(result.level).toBe('YELLOW');
  });
});

// ─── Three Delays ────────────────────────────────────────────────────────────

describe('Three Delays Intervention', () => {
  it('Delay 1: recognizes RED/BLACK as emergency', () => {
    const d1 = assessDelay1('Está inconsciente y no respira');
    expect(d1.delay).toBe(1);
    expect(d1.guidance).toContain('EMERGENCIA');
    expect(d1.guidance).toContain('106');
  });

  it('Delay 1: YELLOW gets medical attention today guidance', () => {
    const d1 = assessDelay1('Tiene fiebre alta de 40 grados');
    expect(d1.delay).toBe(1);
    expect(d1.guidance).toContain('atención médica HOY');
  });

  it('Delay 1: GREEN gets home care guidance', () => {
    const d1 = assessDelay1('Tiene un resfriado leve');
    expect(d1.delay).toBe(1);
    expect(d1.guidance).toContain('casa');
  });

  it('Delay 2: provides transport guidance for Lima', () => {
    const d2 = assessDelay2('Lima', 'RED');
    expect(d2.delay).toBe(2);
    expect(d2.guidance).toContain('INMEDIATAMENTE');
    expect(d2.guidance).toContain('106');
  });

  it('Delay 2: provides transport guidance for GREEN severity', () => {
    const d2 = assessDelay2('Cusco', 'GREEN');
    expect(d2.delay).toBe(2);
    expect(d2.guidance).toContain('DNI');
  });

  it('Delay 3: tells what to report to health workers', () => {
    const d3 = assessDelay3('Mi hijo tiene fiebre y vomita');
    expect(d3.delay).toBe(3);
    expect(d3.guidance).toContain('Síntomas');
    expect(d3.guidance).toContain('temperatura');
  });
});

// ─── Facility Lookup ─────────────────────────────────────────────────────────

describe('Facility Lookup', () => {
  it('finds facilities in Lima', () => {
    const facilities = findFacilitiesByDepartment('Lima');
    expect(facilities.length).toBeGreaterThanOrEqual(3);
    expect(facilities.some(f => f.level === 'hospital')).toBe(true);
  });

  it('finds facilities in Cusco', () => {
    const facilities = findFacilitiesByDepartment('Cusco');
    expect(facilities.length).toBeGreaterThanOrEqual(2);
  });

  it('finds facilities case-insensitively', () => {
    const facilities = findFacilitiesByDepartment('puno');
    expect(facilities.length).toBeGreaterThanOrEqual(2);
  });

  it('finds nearest hospital', () => {
    const hospital = findNearestHospital('Arequipa');
    expect(hospital).not.toBeNull();
    expect(hospital!.level).toBe('hospital');
  });

  it('returns empty array for unknown department', () => {
    const facilities = findFacilitiesByDepartment('Atlantis');
    expect(facilities).toHaveLength(0);
  });

  it('has at least 50 facilities total', () => {
    const all = getAllFacilities();
    expect(all.length).toBeGreaterThanOrEqual(50);
  });

  it('covers Loreto (Amazon region)', () => {
    const facilities = findFacilitiesByDepartment('Loreto');
    expect(facilities.length).toBeGreaterThanOrEqual(2);
  });

  it('covers Huancavelica (highlands)', () => {
    const facilities = findFacilitiesByDepartment('Huancavelica');
    expect(facilities.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── Traditional Remedy Safety ───────────────────────────────────────────────

describe('Traditional Remedy Safety', () => {
  it('identifies coca tea as SAFE', () => {
    const remedy = checkRemedySafety('coca');
    expect(remedy).not.toBeNull();
    expect(remedy!.safety).toBe('SAFE');
  });

  it('identifies anise tea with meals as HARMFUL', () => {
    const remedy = checkRemedySafety('anís con comidas');
    expect(remedy).not.toBeNull();
    expect(remedy!.safety).toBe('HARMFUL');
  });

  it('identifies uña de gato as SAFE', () => {
    const remedy = checkRemedySafety('uña de gato');
    expect(remedy).not.toBeNull();
    expect(remedy!.safety).toBe('SAFE');
  });

  it('identifies kerosene on wounds as HARMFUL', () => {
    const remedy = checkRemedySafety('kerosene');
    expect(remedy).not.toBeNull();
    expect(remedy!.safety).toBe('HARMFUL');
    expect(remedy!.warning).toBeDefined();
  });

  it('identifies agua de arroz as NEUTRAL', () => {
    const remedy = checkRemedySafety('agua de arroz');
    expect(remedy).not.toBeNull();
    expect(remedy!.safety).toBe('NEUTRAL');
  });

  it('returns null for unknown remedy', () => {
    const remedy = checkRemedySafety('cristal mágico de curación');
    expect(remedy).toBeNull();
  });

  it('has at least 25 remedies total', () => {
    const safe = getRemediesBySafety('SAFE');
    const harmful = getRemediesBySafety('HARMFUL');
    const neutral = getRemediesBySafety('NEUTRAL');
    expect(safe.length + harmful.length + neutral.length).toBeGreaterThanOrEqual(25);
  });

  it('harmful remedies have warnings', () => {
    const harmful = getRemediesBySafety('HARMFUL');
    for (const r of harmful) {
      expect(r.warning).toBeDefined();
      expect(r.warning!.length).toBeGreaterThan(0);
    }
  });
});

// ─── ORS Recipe ──────────────────────────────────────────────────────────────

describe('ORS Recipe', () => {
  it('generates WHO standard recipe', () => {
    const recipe = generateORSRecipe('who');
    expect(recipe.variant).toBe('who');
    expect(recipe.ingredients.length).toBeGreaterThanOrEqual(3);
    expect(recipe.instructions).toContain('azúcar');
    expect(recipe.instructions).toContain('sal');
  });

  it('generates Peruvian home recipe with local ingredients', () => {
    const recipe = generateORSRecipe('home');
    expect(recipe.variant).toBe('home');
    expect(recipe.ingredients.some(i => i.includes('chancaca') || i.includes('limón'))).toBe(true);
  });

  it('defaults to WHO variant', () => {
    const recipe = generateORSRecipe();
    expect(recipe.variant).toBe('who');
  });
});

// ─── Water Purification ──────────────────────────────────────────────────────

describe('Water Purification', () => {
  it('provides multiple purification methods', () => {
    const methods = getWaterPurificationMethods();
    expect(methods.length).toBeGreaterThanOrEqual(3);
  });

  it('includes boiling method', () => {
    const methods = getWaterPurificationMethods();
    const boiling = methods.find(m => m.method === 'Hervido');
    expect(boiling).toBeDefined();
    expect(boiling!.instructions).toContain('hervir');
  });

  it('includes chlorination method', () => {
    const methods = getWaterPurificationMethods();
    const chlorine = methods.find(m => m.method === 'Cloración');
    expect(chlorine).toBeDefined();
    expect(chlorine!.instructions).toContain('lejía');
  });

  it('includes SODIS method', () => {
    const methods = getWaterPurificationMethods();
    const sodis = methods.find(m => m.method.includes('SODIS'));
    expect(sodis).toBeDefined();
    expect(sodis!.instructions).toContain('sol');
  });
});

// ─── Response Length Compliance ───────────────────────────────────────────────

describe('Response Length Compliance', () => {
  it('truncate respects max length', () => {
    const long = 'a'.repeat(600);
    const result = truncate(long, 500);
    expect(result.length).toBeLessThanOrEqual(501); // +1 for ellipsis char
  });

  it('truncate preserves short text', () => {
    const short = 'Hello world';
    expect(truncate(short, 500)).toBe(short);
  });

  it('critical alerts are ≤500 chars', () => {
    const result = classifySeverity('Está inconsciente y no respira');
    expect(result.instructions.length).toBeLessThanOrEqual(500);
  });

  it('all severity instructions are ≤500 chars', () => {
    const cases = [
      'Está inconsciente y no respira',
      'Hemorragia activa sangra mucho',
      'Fractura en el brazo',
      'Resfriado leve',
    ];
    for (const c of cases) {
      const result = classifySeverity(c);
      expect(result.instructions.length).toBeLessThanOrEqual(500);
    }
  });

  it('enforceCriticalLength works', () => {
    const long = 'X'.repeat(600);
    expect(enforceCriticalLength(long).length).toBeLessThanOrEqual(501);
  });

  it('enforceGuidanceLength works', () => {
    const long = 'Y '.repeat(600);
    expect(enforceGuidanceLength(long).length).toBeLessThanOrEqual(1001);
  });

  it('ORS instructions are ≤1000 chars', () => {
    const who = generateORSRecipe('who');
    const home = generateORSRecipe('home');
    expect(who.instructions.length).toBeLessThanOrEqual(1000);
    expect(home.instructions.length).toBeLessThanOrEqual(1000);
  });

  it('water purification instructions are ≤1000 chars each', () => {
    const methods = getWaterPurificationMethods();
    for (const m of methods) {
      expect(m.instructions.length).toBeLessThanOrEqual(1000);
    }
  });

  it('delay guidance is ≤1000 chars', () => {
    const d1 = assessDelay1('Hemorragia activa');
    const d2 = assessDelay2('Lima', 'RED');
    const d3 = assessDelay3('Mi hijo tiene fiebre y vomita sangre');
    expect(d1.guidance.length).toBeLessThanOrEqual(1000);
    expect(d2.guidance.length).toBeLessThanOrEqual(1000);
    expect(d3.guidance.length).toBeLessThanOrEqual(1000);
  });
});

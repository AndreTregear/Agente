import { describe, it, expect } from 'vitest';
import {
  screenSymptoms,
  assessRiskFactors,
  classifyTBRisk,
  generateReminder,
  lookupMyth,
  getMythById,
  getMythsByCategory,
  checkMDRWarnings,
  findFacilities,
  findFacilitiesWithCapability,
  getAllDepartments,
  TB_MYTHS,
  TB_FACILITIES,
  type TBSymptom,
  type TBRiskFactor,
} from '../src/health/tuberculosis.js';

// ─── Symptom Screening ──────────────────────────────────────────────────────

describe('TB Symptom Screening', () => {
  it('returns low risk for no symptoms', () => {
    const result = screenSymptoms([]);
    expect(result.riskLevel).toBe('low');
    expect(result.symptoms).toHaveLength(0);
  });

  it('returns low risk for a single symptom', () => {
    const result = screenSymptoms(['fatigue']);
    expect(result.riskLevel).toBe('low');
    expect(result.symptoms).toEqual(['fatigue']);
  });

  it('returns medium risk for 2 symptoms', () => {
    const result = screenSymptoms(['cough_2weeks', 'night_sweats']);
    expect(result.riskLevel).toBe('medium');
  });

  it('returns medium risk for 3 symptoms without high combo', () => {
    const result = screenSymptoms(['fatigue', 'night_sweats', 'chest_pain']);
    expect(result.riskLevel).toBe('medium');
  });

  it('returns high risk for hemoptysis alone', () => {
    const result = screenSymptoms(['hemoptysis']);
    expect(result.riskLevel).toBe('high');
    expect(result.reason).toContain('Hemoptisis');
  });

  it('returns high risk for cough + fever + weight loss combo', () => {
    const result = screenSymptoms(['cough_2weeks', 'fever', 'weight_loss']);
    expect(result.riskLevel).toBe('high');
    expect(result.reason).toContain('tos >2 semanas');
  });

  it('returns high for hemoptysis even with other symptoms', () => {
    const result = screenSymptoms(['hemoptysis', 'fatigue', 'night_sweats']);
    expect(result.riskLevel).toBe('high');
  });

  it('deduplicates repeated symptoms', () => {
    const result = screenSymptoms(['fever', 'fever', 'fever']);
    expect(result.symptoms).toHaveLength(1);
    expect(result.riskLevel).toBe('low');
  });

  it('ignores invalid symptom values', () => {
    const result = screenSymptoms(['fever', 'headache' as TBSymptom]);
    expect(result.symptoms).toEqual(['fever']);
    expect(result.riskLevel).toBe('low');
  });
});

// ─── Risk Factor Assessment ─────────────────────────────────────────────────

describe('TB Risk Factor Assessment', () => {
  it('returns low risk for no factors', () => {
    const result = assessRiskFactors([]);
    expect(result.riskLevel).toBe('low');
    expect(result.count).toBe(0);
  });

  it('returns low risk for single non-critical factor', () => {
    const result = assessRiskFactors(['crowded_housing']);
    expect(result.riskLevel).toBe('low');
    expect(result.count).toBe(1);
  });

  it('returns high risk for HIV+', () => {
    const result = assessRiskFactors(['hiv_positive']);
    expect(result.riskLevel).toBe('high');
  });

  it('returns high risk for TB contact', () => {
    const result = assessRiskFactors(['tb_contact']);
    expect(result.riskLevel).toBe('high');
  });

  it('returns medium risk for 2 non-critical factors', () => {
    const result = assessRiskFactors(['crowded_housing', 'malnutrition']);
    expect(result.riskLevel).toBe('medium');
  });

  it('returns high risk for 3+ factors', () => {
    const result = assessRiskFactors(['crowded_housing', 'malnutrition', 'indigenous_community']);
    expect(result.riskLevel).toBe('high');
  });
});

// ─── Combined Classification ────────────────────────────────────────────────

describe('TB Combined Classification', () => {
  it('returns low overall for no symptoms and no factors', () => {
    const result = classifyTBRisk([], []);
    expect(result.overallRisk).toBe('low');
    expect(result.recommendation).toContain('Riesgo bajo');
  });

  it('escalates medium symptoms + risk factor to high', () => {
    const result = classifyTBRisk(
      ['cough_2weeks', 'night_sweats'],
      ['crowded_housing'],
    );
    expect(result.symptomResult.riskLevel).toBe('medium');
    expect(result.overallRisk).toBe('high');
    expect(result.recommendation).toContain('URGENTE');
  });

  it('returns high for hemoptysis regardless of factors', () => {
    const result = classifyTBRisk(['hemoptysis'], []);
    expect(result.overallRisk).toBe('high');
  });

  it('returns high when risk factors alone are high', () => {
    const result = classifyTBRisk(['fatigue'], ['hiv_positive']);
    expect(result.overallRisk).toBe('high');
  });
});

// ─── Adherence Reminders ────────────────────────────────────────────────────

describe('TB Adherence Reminders', () => {
  it('generates day 1 milestone message', () => {
    const r = generateReminder(1);
    expect(r.day).toBe(1);
    expect(r.phase).toBe('intensive');
    expect(r.isMedicationDay).toBe(true);
    expect(r.message).toContain('Primer día');
  });

  it('generates intensive phase reminder for day 30', () => {
    const r = generateReminder(30);
    expect(r.phase).toBe('intensive');
    expect(r.isMedicationDay).toBe(true);
    expect(r.message).toContain('mes');
  });

  it('generates day 60 milestone (phase transition)', () => {
    const r = generateReminder(60);
    expect(r.phase).toBe('intensive');
    expect(r.message).toContain('Fase intensiva completa');
  });

  it('generates continuation phase reminder for day 90', () => {
    const r = generateReminder(90);
    expect(r.phase).toBe('continuation');
    expect(r.message).toContain('3 meses');
  });

  it('generates day 180 completion message', () => {
    const r = generateReminder(180);
    expect(r.phase).toBe('continuation');
    expect(r.message).toContain('FELICIDADES');
  });

  it('marks continuation phase non-med days correctly', () => {
    // Day 61 is continuation, day 61: (61-1)%7 = 4 → Friday = medication day
    // Day 62: (62-1)%7 = 5 → Saturday = rest day
    const r62 = generateReminder(62);
    expect(r62.phase).toBe('continuation');
    expect(r62.isMedicationDay).toBe(false);
  });

  it('marks continuation phase med days correctly', () => {
    // Day 63: (63-1)%7 = 6 → Sunday = rest, Day 64: (64-1)%7 = 0 → Monday = med
    const r64 = generateReminder(64);
    expect(r64.phase).toBe('continuation');
    expect(r64.isMedicationDay).toBe(true);
  });

  it('throws for day 0', () => {
    expect(() => generateReminder(0)).toThrow('fuera de rango');
  });

  it('throws for day 181', () => {
    expect(() => generateReminder(181)).toThrow('fuera de rango');
  });
});

// ─── Myth Database ──────────────────────────────────────────────────────────

describe('TB Myth Buster', () => {
  it('has at least 15 myths', () => {
    expect(TB_MYTHS.length).toBeGreaterThanOrEqual(15);
  });

  it('finds myth about curses', () => {
    const results = lookupMyth('maldición');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].correction).toContain('bacteria');
  });

  it('finds myths about herbs', () => {
    const results = lookupMyth('hierbas');
    expect(results.length).toBeGreaterThan(0);
  });

  it('gets myth by ID', () => {
    const myth = getMythById(1);
    expect(myth).toBeDefined();
    expect(myth!.id).toBe(1);
  });

  it('returns undefined for non-existent myth ID', () => {
    expect(getMythById(999)).toBeUndefined();
  });

  it('filters myths by category', () => {
    const tratamiento = getMythsByCategory('tratamiento');
    expect(tratamiento.length).toBeGreaterThanOrEqual(3);
    tratamiento.forEach(m => expect(m.category).toBe('tratamiento'));
  });

  it('returns empty for non-matching search', () => {
    const results = lookupMyth('xyznonexistent');
    expect(results).toHaveLength(0);
  });
});

// ─── MDR-TB Warning Detection ───────────────────────────────────────────────

describe('MDR-TB Warning Detection', () => {
  it('detects no warnings for healthy progress', () => {
    const result = checkMDRWarnings({
      monthsOnTreatment: 1,
      symptomsPersist: false,
      symptomsReturning: false,
      sputumStillPositive: false,
      missedDoses: 0,
    });
    expect(result.detected).toBe(false);
    expect(result.warnings).toHaveLength(0);
  });

  it('warns on sputum positive after 2 months', () => {
    const result = checkMDRWarnings({
      monthsOnTreatment: 3,
      symptomsPersist: false,
      symptomsReturning: false,
      sputumStillPositive: true,
      missedDoses: 0,
    });
    expect(result.detected).toBe(true);
    expect(result.warnings.some(w => w.includes('Esputo positivo'))).toBe(true);
  });

  it('warns on returning symptoms', () => {
    const result = checkMDRWarnings({
      monthsOnTreatment: 4,
      symptomsPersist: false,
      symptomsReturning: true,
      sputumStillPositive: false,
      missedDoses: 2,
    });
    expect(result.detected).toBe(true);
    expect(result.warnings.some(w => w.includes('reaparecieron'))).toBe(true);
  });

  it('warns on persistent symptoms after 2 months', () => {
    const result = checkMDRWarnings({
      monthsOnTreatment: 2,
      symptomsPersist: true,
      symptomsReturning: false,
      sputumStillPositive: false,
      missedDoses: 0,
    });
    expect(result.detected).toBe(true);
  });

  it('warns on high missed doses', () => {
    const result = checkMDRWarnings({
      monthsOnTreatment: 3,
      symptomsPersist: false,
      symptomsReturning: false,
      sputumStillPositive: false,
      missedDoses: 15,
    });
    expect(result.detected).toBe(true);
    expect(result.warnings.some(w => w.includes('dosis perdidas'))).toBe(true);
  });

  it('returns urgent recommendation when warnings detected', () => {
    const result = checkMDRWarnings({
      monthsOnTreatment: 3,
      symptomsPersist: true,
      symptomsReturning: true,
      sputumStillPositive: true,
      missedDoses: 20,
    });
    expect(result.detected).toBe(true);
    expect(result.warnings.length).toBeGreaterThanOrEqual(3);
    expect(result.recommendation).toContain('ALERTA MDR-TB');
  });
});

// ─── Facility Lookup ────────────────────────────────────────────────────────

describe('TB Facility Lookup', () => {
  it('finds facilities in Loreto', () => {
    const facilities = findFacilities('Loreto');
    expect(facilities.length).toBeGreaterThanOrEqual(1);
    facilities.forEach(f => expect(f.department).toBe('Loreto'));
  });

  it('finds facilities in Cusco', () => {
    const facilities = findFacilities('Cusco');
    expect(facilities.length).toBeGreaterThanOrEqual(1);
  });

  it('is case-insensitive', () => {
    const a = findFacilities('PUNO');
    const b = findFacilities('puno');
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it('returns empty for unknown department', () => {
    expect(findFacilities('Atlantis')).toHaveLength(0);
  });

  it('finds facilities with GeneXpert', () => {
    const facilities = findFacilitiesWithCapability('genexpert');
    expect(facilities.length).toBeGreaterThanOrEqual(5);
    facilities.forEach(f => expect(f.capabilities).toContain('genexpert'));
  });

  it('lists all departments', () => {
    const depts = getAllDepartments();
    expect(depts).toContain('Loreto');
    expect(depts).toContain('Cusco');
    expect(depts).toContain('Puno');
    expect(depts).toContain('Lima');
    expect(depts.length).toBeGreaterThanOrEqual(8);
  });
});

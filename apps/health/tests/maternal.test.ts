import { describe, it, expect } from 'vitest';
import {
  calculateGestationalAge,
  getPrenatalGuidance,
  getWeeklyGuidance,
  classifyDangerSigns,
  generateBirthPlan,
  getPostpartumChecklist,
  getAllPostpartumPhases,
  getPartnerEducation,
  getPartnerMessageByTopic,
  getIronGuidance,
  type BirthPlanInput,
} from '../src/health/maternal.js';

// ─── Gestational Week Calculation ───────────────────────────────────────────

describe('Gestational Week Calculator', () => {
  // Use local date constructors to avoid UTC/local timezone issues
  it('calculates exact weeks and days', () => {
    const lmp = new Date(2026, 0, 1);   // Jan 1
    const ref = new Date(2026, 2, 12);  // Mar 12 → 70 days = 10 weeks 0 days
    const result = calculateGestationalAge(lmp, ref);
    expect(result.weeks).toBe(10);
    expect(result.days).toBe(0);
  });

  it('calculates partial weeks correctly', () => {
    const lmp = new Date(2026, 0, 1);   // Jan 1
    const ref = new Date(2026, 2, 15);  // Mar 15 → 73 days = 10 weeks 3 days
    const result = calculateGestationalAge(lmp, ref);
    expect(result.weeks).toBe(10);
    expect(result.days).toBe(3);
  });

  it('assigns first trimester for weeks 0-12', () => {
    const lmp = new Date(2026, 0, 1);
    const ref = new Date(2026, 1, 26);  // ~8 weeks
    const result = calculateGestationalAge(lmp, ref);
    expect(result.trimester).toBe(1);
  });

  it('assigns second trimester for weeks 13-26', () => {
    const lmp = new Date(2025, 11, 1);  // Dec 1
    const ref = new Date(2026, 2, 24);  // Mar 24 → ~16 weeks
    const result = calculateGestationalAge(lmp, ref);
    expect(result.trimester).toBe(2);
  });

  it('assigns third trimester for weeks 27+', () => {
    const lmp = new Date(2025, 8, 1);   // Sep 1
    const ref = new Date(2026, 2, 24);  // Mar 24 → ~29 weeks
    const result = calculateGestationalAge(lmp, ref);
    expect(result.trimester).toBe(3);
  });

  it('calculates due date correctly (LMP + 280 days)', () => {
    const lmp = new Date(2026, 0, 1);   // Jan 1
    const result = calculateGestationalAge(lmp, new Date(2026, 1, 1));
    // Jan 1 + 280 days = Oct 8
    const dueStr = `${result.dueDate.getFullYear()}-${String(result.dueDate.getMonth() + 1).padStart(2, '0')}-${String(result.dueDate.getDate()).padStart(2, '0')}`;
    expect(dueStr).toBe('2026-10-08');
  });

  it('calculates weeks remaining', () => {
    const lmp = new Date(2026, 0, 1);
    const ref = new Date(2026, 2, 12);  // 10 weeks
    const result = calculateGestationalAge(lmp, ref);
    expect(result.weeksRemaining).toBe(30);
  });

  it('throws for future LMP date', () => {
    const lmp = new Date(2027, 0, 1);
    const ref = new Date(2026, 2, 24);
    expect(() => calculateGestationalAge(lmp, ref)).toThrow();
  });

  it('handles LMP on same day as reference', () => {
    const date = new Date(2026, 2, 24);
    const result = calculateGestationalAge(date, date);
    expect(result.weeks).toBe(0);
    expect(result.days).toBe(0);
  });
});

// ─── Danger Sign Classification ─────────────────────────────────────────────

describe('Danger Sign Classifier', () => {
  // RED scenarios
  it('classifies hemorrhage as RED', () => {
    const result = classifyDangerSigns('Tengo mucha sangre, hemorragia');
    expect(result.severity).toBe('red');
    expect(result.seekCare).toBe(true);
  });

  it('classifies seizures as RED', () => {
    const result = classifyDangerSigns('Mi esposa tuvo convulsiones');
    expect(result.severity).toBe('red');
    expect(result.seekCare).toBe(true);
  });

  it('classifies headache with vision changes as RED (pre-eclampsia)', () => {
    const result = classifyDangerSigns('Tengo dolor de cabeza fuerte y visión borrosa');
    expect(result.severity).toBe('red');
    expect(result.symptoms.some(s => s.toLowerCase().includes('eclampsia'))).toBe(true);
  });

  it('classifies fever with chills as RED', () => {
    const result = classifyDangerSigns('Tengo fiebre y escalofríos');
    expect(result.severity).toBe('red');
    expect(result.seekCare).toBe(true);
  });

  it('classifies high fever as RED', () => {
    const result = classifyDangerSigns('Tengo fiebre 39 grados');
    expect(result.severity).toBe('red');
  });

  it('classifies water breaking early as RED', () => {
    const result = classifyDangerSigns('Se rompió fuente y estoy de 34 semanas');
    expect(result.severity).toBe('red');
  });

  // YELLOW scenarios
  it('classifies persistent vomiting as YELLOW', () => {
    const result = classifyDangerSigns('No puedo comer nada, vomito todo');
    expect(result.severity).toBe('yellow');
  });

  it('classifies face swelling as YELLOW', () => {
    const result = classifyDangerSigns('Tengo la cara hinchada');
    expect(result.severity).toBe('yellow');
  });

  it('classifies reduced fetal movement as YELLOW', () => {
    const result = classifyDangerSigns('No siento al bebé, se mueve menos');
    expect(result.severity).toBe('yellow');
    expect(result.seekCare).toBe(true);
  });

  it('classifies painful urination as YELLOW', () => {
    const result = classifyDangerSigns('Me arde al orinar');
    expect(result.severity).toBe('yellow');
  });

  // GREEN scenarios
  it('classifies mild nausea as GREEN', () => {
    const result = classifyDangerSigns('Tengo náuseas por la mañana');
    expect(result.severity).toBe('green');
    expect(result.seekCare).toBe(false);
  });

  it('classifies back pain as GREEN', () => {
    const result = classifyDangerSigns('Me duele la espalda');
    expect(result.severity).toBe('green');
  });

  it('classifies fatigue as GREEN', () => {
    const result = classifyDangerSigns('Estoy muy cansada y con sueño todo el día');
    expect(result.severity).toBe('green');
  });

  it('classifies Braxton Hicks as GREEN', () => {
    const result = classifyDangerSigns('Se me pone dura la barriga a veces');
    expect(result.severity).toBe('green');
  });

  it('returns GREEN with no matches for unknown symptoms', () => {
    const result = classifyDangerSigns('Me siento bien');
    expect(result.severity).toBe('green');
    expect(result.symptoms).toHaveLength(0);
  });

  it('prioritizes RED over GREEN when both match', () => {
    const result = classifyDangerSigns('Tengo náuseas y convulsiones');
    expect(result.severity).toBe('red');
  });
});

// ─── Birth Plan Generation ──────────────────────────────────────────────────

describe('Birth Plan Generator', () => {
  const basePlan: BirthPlanInput = {
    dueDate: new Date('2026-08-15'),
    nearestFacility: 'Hospital Regional de Ayacucho',
    transportAvailable: true,
    emergencyContacts: [
      { name: 'Pedro', phone: '987654321' },
      { name: 'Mamá Rosa', phone: '912345678' },
    ],
  };

  it('generates a complete birth plan', () => {
    const plan = generateBirthPlan(basePlan);
    expect(plan.facility).toBe('Hospital Regional de Ayacucho');
    expect(plan.emergencyContacts).toHaveLength(2);
    expect(plan.preparationChecklist.length).toBeGreaterThan(3);
    expect(plan.essentialBag.length).toBeGreaterThan(3);
    expect(plan.warningSignsToWatch.length).toBeGreaterThan(3);
  });

  it('warns when no transport available', () => {
    const plan = generateBirthPlan({ ...basePlan, transportAvailable: false });
    expect(plan.transport).toContain('Sin transporte');
  });

  it('adjusts timing for distant facilities', () => {
    const plan = generateBirthPlan({ ...basePlan, distanceMinutes: 120 });
    expect(plan.whenToLeave).toContain('casa de espera');
  });

  it('adjusts timing for nearby facilities', () => {
    const plan = generateBirthPlan({ ...basePlan, distanceMinutes: 15 });
    expect(plan.whenToLeave).toContain('cada 5 minutos');
  });
});

// ─── Postpartum Checklist ───────────────────────────────────────────────────

describe('Postpartum Monitoring', () => {
  it('returns day 1-3 checklist for day 1', () => {
    const check = getPostpartumChecklist(1);
    expect(check.dayRange).toBe('1-3');
    expect(check.watchFor.length).toBeGreaterThan(0);
    expect(check.seekHelpIf.length).toBeGreaterThan(0);
  });

  it('returns correct phase for day 10', () => {
    const check = getPostpartumChecklist(10);
    expect(check.dayRange).toBe('8-14');
    expect(check.phase).toContain('Segunda semana');
  });

  it('returns correct phase for day 35', () => {
    const check = getPostpartumChecklist(35);
    expect(check.dayRange).toBe('29-42');
  });

  it('throws for day 0', () => {
    expect(() => getPostpartumChecklist(0)).toThrow();
  });

  it('throws for day 43', () => {
    expect(() => getPostpartumChecklist(43)).toThrow();
  });

  it('returns all 5 phases', () => {
    const phases = getAllPostpartumPhases();
    expect(phases).toHaveLength(5);
  });
});

// ─── Partner Education ──────────────────────────────────────────────────────

describe('Partner Education', () => {
  it('returns all partner messages', () => {
    const messages = getPartnerEducation();
    expect(messages.length).toBeGreaterThanOrEqual(4);
  });

  it('includes three delays topic', () => {
    const messages = getPartnerEducation();
    const delays = messages.find(m => m.topic.toLowerCase().includes('retrasos'));
    expect(delays).toBeDefined();
    expect(delays!.message).toContain('RETRASO');
  });

  it('finds message by topic keyword', () => {
    const msg = getPartnerMessageByTopic('retrasos');
    expect(msg).not.toBeNull();
    expect(msg!.message).toContain('DECIDIR');
  });

  it('returns null for unknown topic', () => {
    const msg = getPartnerMessageByTopic('xyz_nonexistent');
    expect(msg).toBeNull();
  });
});

// ─── Prenatal Guidance ──────────────────────────────────────────────────────

describe('Prenatal Guidance', () => {
  it('returns first trimester guidance', () => {
    const guidance = getPrenatalGuidance(1);
    expect(guidance.general).toContain('Primer trimestre');
    expect(guidance.nutrition).toContain('ácido fólico');
  });

  it('returns second trimester guidance with iron focus', () => {
    const guidance = getPrenatalGuidance(2);
    expect(guidance.nutrition).toContain('hierro');
    expect(guidance.nutrition).toContain('sangrecita');
  });

  it('returns third trimester guidance mentioning birth preparation', () => {
    const guidance = getPrenatalGuidance(3);
    expect(guidance.activity).toContain('bolso');
  });

  it('returns week-specific guidance for early pregnancy', () => {
    const guidance = getWeeklyGuidance(6);
    expect(guidance).toContain('corazón');
  });

  it('returns week-specific guidance for late pregnancy', () => {
    const guidance = getWeeklyGuidance(39);
    expect(guidance).toContain('nacer');
  });

  it('handles post-40 weeks', () => {
    const guidance = getWeeklyGuidance(41);
    expect(guidance).toContain('inducción');
  });

  it('handles out of range weeks', () => {
    const guidance = getWeeklyGuidance(50);
    expect(guidance).toContain('fuera de rango');
  });
});

// ─── Iron Needs ─────────────────────────────────────────────────────────────

describe('Iron Needs During Pregnancy', () => {
  it('returns 27mg daily need for first trimester', () => {
    const iron = getIronGuidance(1);
    expect(iron.dailyNeedMg).toBe(27);
  });

  it('returns 30mg daily need for second trimester', () => {
    const iron = getIronGuidance(2);
    expect(iron.dailyNeedMg).toBe(30);
  });

  it('includes iron-rich Peruvian foods', () => {
    const iron = getIronGuidance(1);
    const foodNames = iron.foods.map(f => f.name.toLowerCase());
    expect(foodNames).toContain('sangrecita');
    expect(foodNames).toContain('hígado de pollo');
    expect(foodNames).toContain('lentejas');
  });

  it('includes absorption tips mentioning vitamin C', () => {
    const iron = getIronGuidance(2);
    const hasVitC = iron.absorptionTips.some(t => t.toLowerCase().includes('vitamina c'));
    expect(hasVitC).toBe(true);
  });

  it('warns against tea/coffee with iron meals', () => {
    const iron = getIronGuidance(1);
    const hasWarning = iron.avoid.some(a => a.includes('té') || a.includes('café'));
    expect(hasWarning).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import {
  SCREENING_PROTOCOLS,
  getScreeningProtocol,
  listScreeningProtocols,
  differentialDiagnosis,
  checkDrugInteractions,
  getKnownDrugs,
  batchScreening,
  EMERGENCY_PROTOCOLS,
  getEmergencyProtocol,
  listEmergencyProtocols,
  calculateEpinephrineDose,
  type PatientScreeningData,
} from '../src/health/clinical.js';

// ─── Screening Protocols ─────────────────────────────────────────────────────

describe('Screening Protocols', () => {
  it('lists all 5 screening protocols', () => {
    const keys = listScreeningProtocols();
    expect(keys).toContain('malaria');
    expect(keys).toContain('dengue');
    expect(keys).toContain('preeclampsia');
    expect(keys).toContain('severe_dehydration');
    expect(keys).toContain('pneumonia_children');
    expect(keys).toHaveLength(5);
  });

  it('retrieves malaria screening protocol with criteria', () => {
    const protocol = getScreeningProtocol('malaria');
    expect(protocol).not.toBeNull();
    expect(protocol!.condition).toBe('Malaria');
    expect(protocol!.criteria.length).toBeGreaterThanOrEqual(4);
    expect(protocol!.redFlags.length).toBeGreaterThan(0);
    expect(protocol!.criteria.some(c => c.name === 'fever_pattern')).toBe(true);
    expect(protocol!.criteria.some(c => c.name === 'endemic_region')).toBe(true);
  });

  it('retrieves dengue protocol with red flags', () => {
    const protocol = getScreeningProtocol('dengue');
    expect(protocol).not.toBeNull();
    expect(protocol!.criteria.some(c => c.name === 'retro_orbital_pain')).toBe(true);
    expect(protocol!.redFlags.some(r => r.toLowerCase().includes('sangrado'))).toBe(true);
    expect(protocol!.action.toLowerCase()).toContain('paracetamol');
  });

  it('retrieves pre-eclampsia protocol', () => {
    const protocol = getScreeningProtocol('preeclampsia');
    expect(protocol).not.toBeNull();
    expect(protocol!.criteria.some(c => c.name === 'high_bp' && c.required)).toBe(true);
    expect(protocol!.criteria.some(c => c.name === 'vision_changes')).toBe(true);
  });

  it('retrieves severe dehydration protocol with ORS info', () => {
    const protocol = getScreeningProtocol('severe_dehydration');
    expect(protocol).not.toBeNull();
    expect(protocol!.notes.toLowerCase()).toContain('sro');
    expect(protocol!.criteria.some(c => c.name === 'skin_turgor')).toBe(true);
  });

  it('retrieves pneumonia in children protocol', () => {
    const protocol = getScreeningProtocol('pneumonia_children');
    expect(protocol).not.toBeNull();
    expect(protocol!.criteria.some(c => c.name === 'fast_breathing' && c.required)).toBe(true);
    expect(protocol!.criteria.some(c => c.name === 'chest_indrawing')).toBe(true);
    expect(protocol!.action.toLowerCase()).toContain('amoxicilina');
  });

  it('returns null for unknown condition', () => {
    expect(getScreeningProtocol('nonexistent')).toBeNull();
  });

  it('each protocol has action and notes fields', () => {
    for (const key of listScreeningProtocols()) {
      const p = SCREENING_PROTOCOLS[key];
      expect(p.action.length).toBeGreaterThan(10);
      expect(p.notes.length).toBeGreaterThan(10);
      expect(p.redFlags.length).toBeGreaterThan(0);
    }
  });
});

// ─── Differential Diagnosis ──────────────────────────────────────────────────

describe('Differential Diagnosis', () => {
  it('ranks dengue highest for fever + rash + severe joint pain', () => {
    const result = differentialDiagnosis(['fever', 'rash', 'severe_joint_pain']);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].condition).toBe('Dengue');
    expect(result[0].confidence).toBeGreaterThan(0.3);
    expect(result[0].matchedSymptoms).toContain('fever');
    expect(result[0].matchedSymptoms).toContain('rash');
  });

  it('ranks pneumonia high for fever + cough + fast_breathing', () => {
    const result = differentialDiagnosis(['fever', 'cough', 'fast_breathing']);
    const pneumonia = result.find(r => r.condition === 'Neumonía');
    expect(pneumonia).toBeDefined();
    expect(pneumonia!.confidence).toBeGreaterThan(0.4);
    // Pneumonia should be top or near top
    expect(result.indexOf(pneumonia!)).toBeLessThan(3);
  });

  it('ranks pre-eclampsia for pregnant + headache + high_bp', () => {
    const result = differentialDiagnosis(['pregnant', 'headache', 'high_bp']);
    const preeclampsia = result.find(r => r.condition === 'Pre-eclampsia');
    expect(preeclampsia).toBeDefined();
    expect(preeclampsia!.confidence).toBeGreaterThan(0.3);
    expect(preeclampsia!.matchedSymptoms).toContain('pregnant');
    expect(preeclampsia!.matchedSymptoms).toContain('high_bp');
  });

  it('returns multiple candidates for ambiguous symptoms', () => {
    const result = differentialDiagnosis(['fever', 'headache', 'fatigue']);
    expect(result.length).toBeGreaterThanOrEqual(3);
    // Multiple conditions share these symptoms
    const conditions = result.map(r => r.condition);
    expect(conditions).toContain('Malaria');
  });

  it('returns empty array for no matching symptoms', () => {
    const result = differentialDiagnosis(['xyz_unknown_symptom']);
    // All should be zero or near zero after penalty
    expect(result.every(r => r.confidence < 0.1)).toBe(true);
  });

  it('provides recommended action for each candidate', () => {
    const result = differentialDiagnosis(['fever', 'cough']);
    for (const candidate of result) {
      expect(candidate.recommendedAction.length).toBeGreaterThan(5);
    }
  });

  it('identifies dehydration for diarrhea + vomiting + sunken_eyes', () => {
    const result = differentialDiagnosis(['diarrhea', 'vomiting', 'sunken_eyes', 'lethargy']);
    const dehydration = result.find(r => r.condition === 'Deshidratación severa');
    expect(dehydration).toBeDefined();
    expect(dehydration!.confidence).toBeGreaterThan(0.4);
  });
});

// ─── Drug Interaction Checker ────────────────────────────────────────────────

describe('Drug Interaction Checker', () => {
  it('detects metformin + alcohol interaction', () => {
    const result = checkDrugInteractions(['metformin', 'alcohol']);
    expect(result.length).toBe(1);
    expect(result[0].severity).toBe('high');
    expect(result[0].effect.toLowerCase()).toContain('acidosis');
  });

  it('detects warfarin + ibuprofen interaction', () => {
    const result = checkDrugInteractions(['warfarin', 'ibuprofen']);
    expect(result.length).toBe(1);
    expect(result[0].severity).toBe('high');
    expect(result[0].effect.toLowerCase()).toContain('sangrado');
  });

  it('detects enalapril + potassium (ACE inhibitor + K)', () => {
    const result = checkDrugInteractions(['enalapril', 'potassium']);
    expect(result.length).toBe(1);
    expect(result[0].severity).toBe('high');
    expect(result[0].effect.toLowerCase()).toContain('hiperkalemia');
  });

  it('detects rifampicin + oral contraceptives', () => {
    const result = checkDrugInteractions(['rifampicin', 'anticonceptivos_orales']);
    expect(result.length).toBe(1);
    expect(result[0].severity).toBe('high');
  });

  it('detects St Johns Wort + fluoxetine (serotonin syndrome)', () => {
    const result = checkDrugInteractions(['st_johns_wort', 'fluoxetine']);
    expect(result.length).toBe(1);
    expect(result[0].severity).toBe('high');
    expect(result[0].effect.toLowerCase()).toContain('serotoninérgico');
  });

  it('detects ginkgo + warfarin interaction', () => {
    const result = checkDrugInteractions(['ginkgo', 'warfarin']);
    expect(result.length).toBe(1);
    expect(result[0].severity).toBe('high');
  });

  it('detects multiple interactions in a medication list', () => {
    const result = checkDrugInteractions(['warfarin', 'ibuprofen', 'metronidazole']);
    expect(result.length).toBeGreaterThanOrEqual(2);
    const effects = result.map(r => r.effect);
    expect(effects.some(e => e.toLowerCase().includes('sangrado'))).toBe(true);
    expect(effects.some(e => e.toLowerCase().includes('anticoagulante'))).toBe(true);
  });

  it('returns empty array for non-interacting drugs', () => {
    const result = checkDrugInteractions(['paracetamol', 'amoxicillin']);
    expect(result).toHaveLength(0);
  });

  it('has 30+ drugs in the database', () => {
    const drugs = getKnownDrugs();
    expect(drugs.length).toBeGreaterThanOrEqual(30);
  });

  it('handles case-insensitive drug names', () => {
    const result = checkDrugInteractions(['METFORMIN', 'ALCOHOL']);
    expect(result.length).toBe(1);
  });
});

// ─── Batch Screening ─────────────────────────────────────────────────────────

describe('Batch Screening', () => {
  const patients: PatientScreeningData[] = [
    {
      id: 'P001',
      name: 'María',
      age: 25,
      sex: 'F',
      symptoms: ['fever', 'rash', 'severe_joint_pain'],
      vitals: { temperature: 39.0 },
      pregnant: false,
    },
    {
      id: 'P002',
      name: 'Juan',
      age: 3,
      sex: 'M',
      symptoms: ['cough', 'fever', 'fast_breathing'],
      vitals: { temperature: 38.5, respiratoryRate: 55 },
    },
    {
      id: 'P003',
      name: 'Rosa',
      age: 28,
      sex: 'F',
      symptoms: ['headache', 'high_bp', 'edema', 'pregnant'],
      vitals: { systolicBP: 155, diastolicBP: 100 },
      medications: ['enalapril', 'potassium'],
      pregnant: true,
    },
    {
      id: 'P004',
      name: 'Carlos',
      age: 60,
      sex: 'M',
      symptoms: [],
      medications: ['metformin'],
    },
  ];

  it('processes 4 patients and returns 4 assessments', () => {
    const results = batchScreening(patients);
    expect(results).toHaveLength(4);
    expect(results[0].patientId).toBe('P001');
    expect(results[1].patientId).toBe('P002');
  });

  it('identifies dengue suspect in patient 1', () => {
    const results = batchScreening(patients);
    expect(results[0].conditions[0].condition).toBe('Dengue');
    expect(results[0].conditions[0].confidence).toBeGreaterThan(0.3);
  });

  it('identifies pneumonia suspect in patient 2', () => {
    const results = batchScreening(patients);
    const pneumonia = results[1].conditions.find(c => c.condition === 'Neumonía');
    expect(pneumonia).toBeDefined();
  });

  it('flags pregnant patient with high BP as red urgency', () => {
    const results = batchScreening(patients);
    expect(results[2].urgency).toBe('red');
    expect(results[2].drugInteractions.length).toBeGreaterThan(0);
  });

  it('flags high-severity drug interactions as red', () => {
    const results = batchScreening(patients);
    // Rosa has enalapril + potassium
    expect(results[2].drugInteractions[0].severity).toBe('high');
    expect(results[2].urgency).toBe('red');
  });

  it('produces summary with disclaimer for each patient', () => {
    const results = batchScreening(patients);
    for (const r of results) {
      expect(r.summary).toContain('Consulta con tu médico');
    }
  });

  it('marks patient without symptoms or interactions as green', () => {
    const results = batchScreening(patients);
    expect(results[3].urgency).toBe('green');
  });
});

// ─── Emergency Protocols ─────────────────────────────────────────────────────

describe('Emergency Protocols', () => {
  it('lists all 5 emergency protocols', () => {
    const keys = listEmergencyProtocols();
    expect(keys).toContain('postpartum_hemorrhage');
    expect(keys).toContain('eclamptic_seizure');
    expect(keys).toContain('severe_dehydration');
    expect(keys).toContain('anaphylaxis');
    expect(keys).toContain('snakebite');
    expect(keys).toHaveLength(5);
  });

  it('postpartum hemorrhage includes uterine massage and oxytocin', () => {
    const protocol = getEmergencyProtocol('postpartum_hemorrhage');
    expect(protocol).not.toBeNull();
    expect(protocol!.immediateSteps.some(s => s.toLowerCase().includes('masaje uterino'))).toBe(true);
    expect(protocol!.medications.some(m => m.name.toLowerCase().includes('oxitocina'))).toBe(true);
  });

  it('eclamptic seizure protocol includes magnesium sulfate', () => {
    const protocol = getEmergencyProtocol('eclamptic_seizure');
    expect(protocol).not.toBeNull();
    expect(protocol!.medications.some(m => m.name.toLowerCase().includes('magnesio'))).toBe(true);
    expect(protocol!.immediateSteps.some(s => s.toLowerCase().includes('lateral'))).toBe(true);
  });

  it('severe dehydration includes ORS preparation', () => {
    const protocol = getEmergencyProtocol('severe_dehydration');
    expect(protocol).not.toBeNull();
    expect(protocol!.medications.some(m => m.name.includes('SRO'))).toBe(true);
    expect(protocol!.medications.some(m => m.notes.toLowerCase().includes('agua hervida'))).toBe(true);
  });

  it('anaphylaxis includes weight-based epinephrine dosing', () => {
    const protocol = getEmergencyProtocol('anaphylaxis');
    expect(protocol).not.toBeNull();
    expect(protocol!.immediateSteps.some(s => s.includes('0.01mg/kg'))).toBe(true);
    expect(protocol!.medications[0].name).toContain('Epinefrina');
  });

  it('snakebite says NO tourniquet', () => {
    const protocol = getEmergencyProtocol('snakebite');
    expect(protocol).not.toBeNull();
    expect(protocol!.doNot.some(d => d.toLowerCase().includes('torniquete'))).toBe(true);
    expect(protocol!.immediateSteps.some(s => s.includes('Inmovilizar'))).toBe(true);
  });

  it('each protocol has doNot list and transport notes', () => {
    for (const key of listEmergencyProtocols()) {
      const p = EMERGENCY_PROTOCOLS[key];
      expect(p.doNot.length).toBeGreaterThan(0);
      expect(p.transportNotes.length).toBeGreaterThan(10);
      expect(p.immediateSteps.length).toBeGreaterThan(3);
      expect(p.medications.length).toBeGreaterThan(0);
    }
  });

  it('returns null for unknown emergency protocol', () => {
    expect(getEmergencyProtocol('unknown_condition')).toBeNull();
  });
});

// ─── Epinephrine Dose Calculator ─────────────────────────────────────────────

describe('Epinephrine Dose Calculator', () => {
  it('calculates child dose correctly (20kg)', () => {
    const result = calculateEpinephrineDose(20, true);
    expect(result.doseMg).toBeCloseTo(0.2, 2);
    expect(result.doseMl).toBeCloseTo(0.2, 2);
    expect(result.notes).toContain('Niño');
  });

  it('caps child dose at 0.3mg', () => {
    const result = calculateEpinephrineDose(50, true);
    expect(result.doseMg).toBe(0.3);
  });

  it('gives 0.3mg for adult under 50kg', () => {
    const result = calculateEpinephrineDose(45, false);
    expect(result.doseMg).toBe(0.3);
    expect(result.notes).toContain('Adulto');
  });

  it('gives 0.5mg for adult 50kg+', () => {
    const result = calculateEpinephrineDose(70, false);
    expect(result.doseMg).toBe(0.5);
  });
});

/**
 * Health MCP Server — 7 focused tools for Yaya Salud.
 *
 * Philosophy: "Tools do math and lookups. The model does thinking and talking."
 * Each tool handles ONLY: calculations, database lookups, API calls, data transforms.
 * The LLM handles: advice, conversation, reasoning, cultural context.
 *
 * Tools:
 *  1. assess_growth        — WHO z-score calculation (children 0-60 months)
 *  2. assess_health_reading — BP / glucose / BMI classification
 *  3. search_food           — Peruvian food DB + Open Food Facts fallback
 *  4. screen_symptoms       — Symptom screening with risk scoring
 *  5. check_drug_interactions — Drug interaction database lookup
 *  6. calculate_pregnancy   — Gestational age from LMP
 *  7. find_facility         — Health facility lookup by department
 */

import { assessGrowth, ageInMonths, type Sex } from '../../src/health/growth-tracker.js';
import { classifyBloodPressure, classifyGlucose, classifyBMI } from '../../src/health/health-readings.js';
import { searchFoods } from '../../src/health/peruvian-foods.js';
import { screenSymptoms, assessRiskFactors, type TBSymptom, type TBRiskFactor } from '../../src/health/tuberculosis.js';
import { classifySeverity, findFacilitiesByDepartment, type Facility } from '../../src/health/triage.js';
import { differentialDiagnosis, checkDrugInteractions } from '../../src/health/clinical.js';
import { calculateGestationalAge } from '../../src/health/maternal.js';
import { findFacilities as findTBFacilities } from '../../src/health/tuberculosis.js';

// ─── Open Food Facts API (merged from food-search-mcp) ─────────────────────

const OFF_BASE = process.env.OPENFOODFACTS_BASE_URL || 'https://world.openfoodfacts.org';

interface OFFProduct {
  product_name?: string;
  nutriments?: {
    'energy-kcal_100g'?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
    iron_100g?: number;
    zinc_100g?: number;
    'vitamin-a_100g'?: number;
  };
}

interface FoodResult {
  name: string;
  source: 'local_db' | 'openfoodfacts';
  per_100g: {
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    iron_mg: number;
    zinc_mg: number;
    vitamin_a_mcg: number;
  };
  typical_serving?: string;
  typical_serving_g?: number;
  category?: string;
}

async function searchOpenFoodFacts(query: string, limit = 5): Promise<FoodResult[]> {
  const url = `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&json=1&page_size=${limit}&lc=es`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'YayaHealth/1.0 (health@yaya.sh)' },
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = await res.json() as { products?: OFFProduct[] };
    if (!data.products) return [];
    return data.products
      .filter(p => p.product_name && p.nutriments)
      .map(p => ({
        name: p.product_name!,
        source: 'openfoodfacts' as const,
        per_100g: {
          kcal: p.nutriments!['energy-kcal_100g'] ?? 0,
          protein_g: p.nutriments!.proteins_100g ?? 0,
          carbs_g: p.nutriments!.carbohydrates_100g ?? 0,
          fat_g: p.nutriments!.fat_100g ?? 0,
          iron_mg: (p.nutriments!.iron_100g ?? 0) * 1000,
          zinc_mg: (p.nutriments!.zinc_100g ?? 0) * 1000,
          vitamin_a_mcg: (p.nutriments!['vitamin-a_100g'] ?? 0) * 1e6,
        },
      }));
  } catch {
    return [];
  }
}

// ─── Tool Definitions ───────────────────────────────────────────────────────

const tools = {

  // ── 1. assess_growth ─────────────────────────────────────────────────────
  assess_growth: {
    description: 'Calcular z-scores WHO para un niño/a (0-60 meses). Retorna peso/edad, talla/edad, peso/talla, IMC/edad con clasificación.',
    parameters: {
      sex: { type: 'string', description: 'Sexo: "M" o "F"', required: true },
      date_of_birth: { type: 'string', description: 'Fecha de nacimiento (YYYY-MM-DD)', required: true },
      weight_kg: { type: 'number', description: 'Peso en kg', required: false },
      height_cm: { type: 'number', description: 'Talla en cm', required: false },
    },
    execute: (params: { sex: string; date_of_birth: string; weight_kg?: number; height_cm?: number }) => {
      const dob = new Date(params.date_of_birth);
      const age = Math.round(ageInMonths(dob) * 10) / 10;
      const assessment = assessGrowth(params.sex as Sex, dob, params.weight_kg, params.height_cm);
      return {
        age_months: age,
        weight_for_age: assessment.weightForAge ?? null,
        height_for_age: assessment.heightForAge ?? null,
        weight_for_height: assessment.weightForHeight ?? null,
        bmi_for_age: assessment.bmiForAge ?? null,
        flags: assessment.flags,
      };
    },
  },

  // ── 2. assess_health_reading ─────────────────────────────────────────────
  assess_health_reading: {
    description: 'Clasificar una lectura de salud: presión arterial (bp), glucosa (glucose) o IMC (bmi). Retorna clasificación y severidad.',
    parameters: {
      type: { type: 'string', description: '"bp" | "glucose" | "bmi"', required: true },
      systolic: { type: 'number', description: 'Presión sistólica (solo para bp)', required: false },
      diastolic: { type: 'number', description: 'Presión diastólica (solo para bp)', required: false },
      glucose_value: { type: 'number', description: 'Glucosa en mg/dL (solo para glucose)', required: false },
      fasting: { type: 'boolean', description: 'En ayunas? (solo para glucose)', required: false },
      weight_kg: { type: 'number', description: 'Peso en kg (solo para bmi)', required: false },
      height_cm: { type: 'number', description: 'Talla en cm (solo para bmi)', required: false },
    },
    execute: (params: {
      type: 'bp' | 'glucose' | 'bmi';
      systolic?: number; diastolic?: number;
      glucose_value?: number; fasting?: boolean;
      weight_kg?: number; height_cm?: number;
    }) => {
      switch (params.type) {
        case 'bp': {
          if (params.systolic == null || params.diastolic == null) {
            return { error: 'Se requiere systolic y diastolic para bp' };
          }
          const r = classifyBloodPressure(params.systolic, params.diastolic);
          return {
            type: 'bp',
            systolic: r.systolic,
            diastolic: r.diastolic,
            classification: r.classification,
            alerts: r.alerts,
          };
        }
        case 'glucose': {
          if (params.glucose_value == null || params.fasting == null) {
            return { error: 'Se requiere glucose_value y fasting para glucose' };
          }
          const r = classifyGlucose(params.glucose_value, params.fasting);
          return {
            type: 'glucose',
            value: r.value,
            fasting: r.fasting,
            classification: r.classification,
            alerts: r.alerts,
          };
        }
        case 'bmi': {
          if (params.weight_kg == null || params.height_cm == null) {
            return { error: 'Se requiere weight_kg y height_cm para bmi' };
          }
          const r = classifyBMI(params.weight_kg, params.height_cm);
          return {
            type: 'bmi',
            bmi: r.bmi,
            classification: r.classification,
          };
        }
        default:
          return { error: `Tipo no reconocido: ${params.type}. Usa "bp", "glucose" o "bmi".` };
      }
    },
  },

  // ── 3. search_food ───────────────────────────────────────────────────────
  search_food: {
    description: 'Buscar alimento por nombre. Primero busca en base de datos peruana local, si no encuentra busca en Open Food Facts (online). Retorna datos nutricionales por 100g.',
    parameters: {
      query: { type: 'string', description: 'Nombre del alimento en español', required: true },
    },
    execute: async (params: { query: string }) => {
      // Try local DB first
      const local = searchFoods(params.query);
      if (local.length > 0) {
        const results: FoodResult[] = local.slice(0, 5).map(f => ({
          name: f.name,
          source: 'local_db' as const,
          category: f.category,
          per_100g: {
            kcal: f.kcal,
            protein_g: f.protein_g,
            carbs_g: f.carbs_g,
            fat_g: f.fat_g,
            iron_mg: f.iron_mg,
            zinc_mg: f.zinc_mg,
            vitamin_a_mcg: f.vitamin_a_mcg,
          },
          typical_serving: f.typical_serving,
          typical_serving_g: f.typical_serving_g,
        }));
        return { count: results.length, foods: results };
      }

      // Fallback to Open Food Facts
      const online = await searchOpenFoodFacts(params.query);
      return {
        count: online.length,
        foods: online.length > 0 ? online : [],
        note: online.length === 0 ? 'No se encontró el alimento en ninguna base de datos.' : undefined,
      };
    },
  },

  // ── 4. screen_symptoms ───────────────────────────────────────────────────
  screen_symptoms: {
    description: 'Evaluar síntomas y calcular nivel de riesgo. Combina: tamizaje TB, triaje de severidad y diagnóstico diferencial. Retorna nivel de riesgo, condiciones probables y color de severidad.',
    parameters: {
      symptoms: { type: 'array', description: 'Lista de síntomas (ej: ["cough_chronic","fever","weight_loss"])', required: true },
      context: { type: 'string', description: '"pregnancy" | "tb" | "emergency" | "general" (default: "general")', required: false },
      risk_factors: { type: 'array', description: 'Factores de riesgo TB (ej: ["tb_contact","hiv_positive"])', required: false },
    },
    execute: (params: {
      symptoms: string[];
      context?: 'pregnancy' | 'tb' | 'emergency' | 'general';
      risk_factors?: string[];
    }) => {
      const ctx = params.context ?? 'general';
      const symptoms = params.symptoms;

      // Differential diagnosis (always run)
      const differential = differentialDiagnosis(symptoms).slice(0, 5);

      // TB-specific screening
      let tb_screening = null;
      if (ctx === 'tb' || ctx === 'general') {
        const tbSymptoms = symptoms.filter(s =>
          ['cough_2weeks', 'cough_chronic', 'weight_loss', 'night_sweats', 'fever', 'hemoptysis', 'fatigue', 'chest_pain'].includes(s)
        ) as TBSymptom[];
        if (tbSymptoms.length > 0) {
          const symptomResult = screenSymptoms(tbSymptoms);
          const riskResult = params.risk_factors
            ? assessRiskFactors(params.risk_factors as TBRiskFactor[])
            : null;
          tb_screening = {
            risk_level: symptomResult.riskLevel,
            reason: symptomResult.reason,
            risk_factors: riskResult,
          };
        }
      }

      // Triage severity (using symptom description for pattern matching)
      const description = symptoms.join(', ');
      const triage = classifySeverity(description);

      // Compute overall risk
      type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';
      let risk_level: RiskLevel = 'LOW';
      let severity_color: 'GREEN' | 'YELLOW' | 'RED' | 'BLACK' = 'GREEN';

      if (triage.level === 'BLACK') {
        risk_level = 'EMERGENCY';
        severity_color = 'BLACK';
      } else if (triage.level === 'RED') {
        risk_level = 'EMERGENCY';
        severity_color = 'RED';
      } else if (triage.level === 'YELLOW') {
        risk_level = 'MEDIUM';
        severity_color = 'YELLOW';
      }

      // Escalate based on TB screening
      if (tb_screening?.risk_level === 'high' && risk_level === 'LOW') {
        risk_level = 'HIGH';
        severity_color = severity_color === 'GREEN' ? 'YELLOW' : severity_color;
      } else if (tb_screening?.risk_level === 'medium' && risk_level === 'LOW') {
        risk_level = 'MEDIUM';
      }

      // Escalate based on differential confidence
      if (differential.length > 0 && differential[0].confidence >= 0.5 && risk_level === 'LOW') {
        risk_level = 'MEDIUM';
        severity_color = severity_color === 'GREEN' ? 'YELLOW' : severity_color;
      }

      return {
        risk_level,
        severity_color,
        likely_conditions: differential.map(d => ({
          condition: d.condition,
          confidence: d.confidence,
          matched_symptoms: d.matchedSymptoms,
          action: d.recommendedAction,
        })),
        tb_screening,
        triage_level: triage.level,
      };
    },
  },

  // ── 5. check_drug_interactions ───────────────────────────────────────────
  check_drug_interactions: {
    description: 'Verificar interacciones entre medicamentos. Retorna interacciones encontradas con severidad y recomendación.',
    parameters: {
      medications: { type: 'array', description: 'Lista de medicamentos (ej: ["metformina","warfarina","ibuprofeno"])', required: true },
    },
    execute: (params: { medications: string[] }) => {
      const interactions = checkDrugInteractions(params.medications);
      return {
        count: interactions.length,
        interactions: interactions.map(i => ({
          drug_a: i.drug1,
          drug_b: i.drug2,
          severity: i.severity,
          effect: i.effect,
          recommendation: i.recommendation,
        })),
      };
    },
  },

  // ── 6. calculate_pregnancy ───────────────────────────────────────────────
  calculate_pregnancy: {
    description: 'Calcular edad gestacional a partir de la fecha de última menstruación (FUM/LMP). Retorna semanas, trimestre, fecha probable de parto.',
    parameters: {
      lmp_date: { type: 'string', description: 'Fecha de última menstruación (YYYY-MM-DD)', required: true },
    },
    execute: (params: { lmp_date: string }) => {
      const lmp = new Date(params.lmp_date);
      const ga = calculateGestationalAge(lmp);
      return {
        gestational_weeks: ga.weeks,
        gestational_days: ga.days,
        trimester: ga.trimester,
        due_date: ga.dueDate.toISOString().split('T')[0],
        weeks_remaining: ga.weeksRemaining,
        days_remaining: ga.weeksRemaining * 7 - ga.days,
      };
    },
  },

  // ── 7. find_facility ─────────────────────────────────────────────────────
  find_facility: {
    description: 'Buscar establecimientos de salud por departamento peruano. Opcionalmente filtrar por capacidad (tb, emergency, maternal, general).',
    parameters: {
      department: { type: 'string', description: 'Departamento peruano (ej: "Cusco", "Lima", "Loreto")', required: true },
      capability: { type: 'string', description: '"tb" | "emergency" | "maternal" | "general" (opcional)', required: false },
    },
    execute: (params: { department: string; capability?: 'tb' | 'emergency' | 'maternal' | 'general' }) => {
      // Get general facilities
      const generalFacilities = findFacilitiesByDepartment(params.department);

      // Get TB facilities
      const tbFacilities = findTBFacilities(params.department);

      // Merge into unified format
      interface UnifiedFacility {
        name: string;
        level: string;
        department: string;
        province?: string;
        city?: string;
        capabilities: string[];
      }

      const seen = new Set<string>();
      const merged: UnifiedFacility[] = [];

      // Add general facilities
      for (const f of generalFacilities) {
        const key = f.name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          const caps: string[] = ['general'];
          if (f.level === 'hospital') caps.push('emergency', 'maternal');
          merged.push({
            name: f.name,
            level: f.level,
            department: f.department,
            province: f.province,
            capabilities: caps,
          });
        }
      }

      // Add/enrich with TB facilities
      for (const f of tbFacilities) {
        const key = f.name.toLowerCase();
        const existing = merged.find(m => m.name.toLowerCase() === key);
        if (existing) {
          existing.capabilities = [...new Set([...existing.capabilities, 'tb', ...f.capabilities])];
        } else {
          seen.add(key);
          merged.push({
            name: f.name,
            level: 'hospital',
            department: f.department,
            city: f.city,
            capabilities: ['tb', ...f.capabilities],
          });
        }
      }

      // Filter by capability if specified
      let results = merged;
      if (params.capability && params.capability !== 'general') {
        results = merged.filter(f => f.capabilities.includes(params.capability!));
      }

      return {
        department: params.department,
        count: results.length,
        facilities: results.map(f => ({
          name: f.name,
          level: f.level,
          province: f.province ?? f.city ?? null,
          capabilities: f.capabilities,
        })),
      };
    },
  },
};

// ─── Server Ready ───────────────────────────────────────────────────────────

console.error('Health MCP server ready. 7 tools:', Object.keys(tools).join(', '));

export { tools };

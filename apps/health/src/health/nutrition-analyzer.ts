import { findFood, searchFoods, type FoodEntry, PERUVIAN_FOODS } from './peruvian-foods.js';

export interface ParsedFood {
  food_name: string;
  matched_entry: FoodEntry | null;
  amount_g: number;
  source: 'local_db' | 'estimated';
}

export interface NutritionSummary {
  parsed_foods: ParsedFood[];
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  total_iron_mg: number;
  total_zinc_mg: number;
  total_vitamin_a_mcg: number;
}

// Common Spanish quantity patterns
const QUANTITY_PATTERNS: Array<{ re: RegExp; grams: (match: RegExpMatchArray) => number }> = [
  // Explicit grams: "200g", "200 gramos"
  { re: /(\d+)\s*(?:g(?:ramos?)?|gr)\b/i, grams: (m) => Number(m[1]) },
  // Kilos: "1 kilo", "medio kilo"
  { re: /(\d+(?:\.\d+)?)\s*(?:kg|kilos?)\b/i, grams: (m) => Number(m[1]) * 1000 },
  { re: /medio\s+kilo/i, grams: () => 500 },
  // Cups: "1 taza", "2 tazas", "media taza"
  { re: /(\d+)\s*tazas?\b/i, grams: (m) => Number(m[1]) * 200 },
  { re: /media\s+taza/i, grams: () => 100 },
  // Spoons: "2 cucharadas", "1 cucharadita"
  { re: /(\d+)\s*cucharadas?\b/i, grams: (m) => Number(m[1]) * 15 },
  { re: /(\d+)\s*cucharaditas?\b/i, grams: (m) => Number(m[1]) * 5 },
  // Plates/portions: "1 plato", "2 porciones"
  { re: /(\d+)\s*platos?\b/i, grams: (m) => Number(m[1]) * 350 },
  { re: /(\d+)\s*porcione?s?\b/i, grams: (m) => Number(m[1]) * 200 },
  // Glasses: "1 vaso", "2 vasos"
  { re: /(\d+)\s*vasos?\b/i, grams: (m) => Number(m[1]) * 240 },
  // Pieces: "2 huevos", "1 pieza"
  { re: /(\d+)\s*(?:piezas?|unidades?)\b/i, grams: (m) => Number(m[1]) * 100 },
  // Bare number at start: "2 pollos"
  { re: /^(\d+)\s+/i, grams: (m) => Number(m[1]) },
  // "un/una" = 1
  { re: /^(?:una?)\s+/i, grams: () => 1 },
  // "medio/media" = 0.5
  { re: /^(?:media?)\s+/i, grams: () => 0.5 },
  // "poco de" / "un poco"
  { re: /(?:un\s+)?poco\s+(?:de\s+)?/i, grams: () => 0.5 },
];

/**
 * Extract quantity multiplier from a food description fragment.
 * Returns { multiplier, cleanedText }.
 */
function extractQuantity(text: string): { multiplier: number; cleanedText: string } {
  for (const { re, grams } of QUANTITY_PATTERNS) {
    const match = text.match(re);
    if (match) {
      const value = grams(match);
      const cleanedText = text.replace(re, '').trim();
      // If the pattern returned a multiplier (like a bare number), indicate that
      // The grams function returns actual grams for explicit units (g, taza, etc.)
      // but for bare numbers it returns the count
      return { multiplier: value, cleanedText };
    }
  }
  return { multiplier: 1, cleanedText: text };
}

/**
 * Parse a natural Spanish food description into individual food items.
 * Example: "Mi hijo comió arroz con pollo y un vaso de leche"
 * → ["arroz", "pollo", "un vaso de leche"]
 */
function splitFoodDescription(text: string): string[] {
  // Remove common prefixes
  let cleaned = text
    .replace(/^(?:mi\s+(?:hijo|hija|beb[eé]|ni[ñn]o|ni[ñn]a)\s+(?:comi[oó]|tom[oó]|desayun[oó]|almor[zc][oó]|cen[oó])\s*)/i, '')
    .replace(/^(?:(?:hoy\s+)?(?:comi[oó]|com[ií]|tomé|tom[oó]|desayun[eé]|almor[cz][eé]|cen[eé])\s*)/i, '')
    .replace(/^(?:le\s+di\s+(?:de\s+comer\s+)?)/i, '')
    .replace(/^(?:para\s+(?:el\s+)?(?:desayuno|almuerzo|cena|lonche)\s*:?\s*)/i, '')
    .trim();

  // Split on connectors: y, con, más, también, además, comma, semicolon
  const items = cleaned
    .split(/\s*(?:,|;|\s+y\s+|\s+con\s+|\s+m[aá]s\s+|\s+tambi[eé]n\s+|\s+adem[aá]s\s+)\s*/i)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return items;
}

/**
 * Analyze a natural Spanish food description and estimate nutrition.
 *
 * @param description - Natural language food description in Spanish
 * @returns NutritionSummary with parsed foods and totals
 */
export function analyzeNutrition(description: string): NutritionSummary {
  const items = splitFoodDescription(description);
  const parsed_foods: ParsedFood[] = [];
  let total_calories = 0;
  let total_protein_g = 0;
  let total_carbs_g = 0;
  let total_fat_g = 0;
  let total_iron_mg = 0;
  let total_zinc_mg = 0;
  let total_vitamin_a_mcg = 0;

  for (const item of items) {
    const { multiplier, cleanedText } = extractQuantity(item);
    const foodQuery = cleanedText || item;
    const entry = findFood(foodQuery);

    let amount_g: number;
    if (entry) {
      // If multiplier looks like a count (small number without explicit unit), use typical serving
      if (multiplier <= 10 && !item.match(/\d+\s*(?:g|gr|kg|taza|cucharad|plato|porci|vaso)/i)) {
        amount_g = multiplier * entry.typical_serving_g;
      } else {
        amount_g = multiplier;
      }

      const factor = amount_g / 100;
      total_calories += entry.kcal * factor;
      total_protein_g += entry.protein_g * factor;
      total_carbs_g += entry.carbs_g * factor;
      total_fat_g += entry.fat_g * factor;
      total_iron_mg += entry.iron_mg * factor;
      total_zinc_mg += entry.zinc_mg * factor;
      total_vitamin_a_mcg += entry.vitamin_a_mcg * factor;
    } else {
      // Unknown food — estimate with average values
      amount_g = multiplier <= 10 ? multiplier * 150 : multiplier;
    }

    parsed_foods.push({
      food_name: foodQuery || item,
      matched_entry: entry,
      amount_g: Math.round(amount_g),
      source: entry ? 'local_db' : 'estimated',
    });
  }

  return {
    parsed_foods,
    total_calories: Math.round(total_calories),
    total_protein_g: Math.round(total_protein_g * 10) / 10,
    total_carbs_g: Math.round(total_carbs_g * 10) / 10,
    total_fat_g: Math.round(total_fat_g * 10) / 10,
    total_iron_mg: Math.round(total_iron_mg * 100) / 100,
    total_zinc_mg: Math.round(total_zinc_mg * 100) / 100,
    total_vitamin_a_mcg: Math.round(total_vitamin_a_mcg * 10) / 10,
  };
}

/**
 * Format nutrition analysis as a WhatsApp-friendly message.
 */
export function formatNutritionMessage(description: string, summary: NutritionSummary): string {
  const lines: string[] = [];
  lines.push('*Analisis nutricional*');
  lines.push(`"${description}"`);
  lines.push('');

  for (const food of summary.parsed_foods) {
    const status = food.matched_entry ? '[OK]' : '[?]';
    const name = food.matched_entry?.name || food.food_name;
    lines.push(`${status} ${name} (~${food.amount_g}g)`);
  }

  lines.push('');
  lines.push('*Totales estimados:*');
  lines.push(`  Calorias: ${summary.total_calories} kcal`);
  lines.push(`  Proteina: ${summary.total_protein_g}g`);
  lines.push(`  Carbohidratos: ${summary.total_carbs_g}g`);
  lines.push(`  Grasa: ${summary.total_fat_g}g`);
  lines.push(`  Hierro: ${summary.total_iron_mg}mg`);
  lines.push(`  Zinc: ${summary.total_zinc_mg}mg`);
  lines.push(`  Vitamina A: ${summary.total_vitamin_a_mcg}mcg`);

  // Iron adequacy check
  if (summary.total_iron_mg < 3) {
    lines.push('');
    lines.push('*Bajo en hierro.* Agrega higado, sangrecita, lentejas o espinaca.');
  }

  // Protein check for children
  if (summary.total_protein_g < 5) {
    lines.push('');
    lines.push('*Bajo en proteina.* Agrega huevo, pollo, pescado o lentejas.');
  }

  const unmatched = summary.parsed_foods.filter(f => !f.matched_entry);
  if (unmatched.length > 0) {
    lines.push('');
    lines.push(`No reconoci: ${unmatched.map(f => f.food_name).join(', ')}. Los valores son estimados.`);
  }

  lines.push('');
  lines.push('_Valores estimados. Para informacion nutricional exacta, consulta con un nutricionista._');
  return lines.join('\n');
}

/**
 * Get nutrition recommendations based on child's age and deficiencies.
 */
export function getNutritionRecommendations(
  ageMonths: number,
  flags: string[],
): string[] {
  const recs: string[] = [];

  if (ageMonths < 6) {
    recs.push('Lactancia materna exclusiva hasta los 6 meses.');
  } else if (ageMonths >= 6 && ageMonths < 9) {
    recs.push('Iniciar alimentacion complementaria: papillas de camote, zapallo, platano.');
    recs.push('Agregar proteina: huevo, higado de pollo en pequenas cantidades.');
    recs.push('Continuar con lactancia materna.');
  } else if (ageMonths >= 9 && ageMonths < 12) {
    recs.push('Aumentar variedad: incluir quinua, lentejas, pescado desmenuzado.');
    recs.push('Texturas mas espesas y trocitos pequenos.');
    recs.push('3 comidas al dia + 1-2 meriendas.');
  } else if (ageMonths >= 12 && ageMonths <= 24) {
    recs.push('La familia completa puede compartir la comida, adaptada en textura.');
    recs.push('Incluir: huevo diario, higado 2x/semana, frutas con vitamina C.');
    recs.push('3 comidas + 2 meriendas nutritivas.');
  } else if (ageMonths > 24) {
    recs.push('Alimentacion variada con todos los grupos: cereales, proteinas, verduras, frutas.');
    recs.push('Limitar golosinas, gaseosas y alimentos ultraprocesados.');
  }

  // Deficiency-specific recommendations
  if (flags.includes('underweight') || flags.includes('severe_underweight')) {
    recs.push('Para ganar peso: agregar aceite o palta a las papillas, dar alimentos densos en energia.');
    recs.push('Alimentos recomendados: quinua con leche, huevo frito, platano con mantequilla de mani.');
  }

  if (flags.includes('stunting') || flags.includes('severe_stunting')) {
    recs.push('Para mejorar talla: proteinas de alta calidad (huevo, higado, cuy, pescado).');
    recs.push('Asegurar hierro (sangrecita, lentejas) y zinc (carne, mani).');
  }

  if (flags.includes('wasting') || flags.includes('severe_wasting')) {
    recs.push('URGENTE: Alimentar con frecuencia, cada 2-3 horas.');
    recs.push('Dar alimentos blandos ricos en energia: pure de papa con aceite, mazamorra con leche.');
  }

  return recs;
}

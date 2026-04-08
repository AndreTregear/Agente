/**
 * Persona Tests — 10 test personas simulating real Peruvian users.
 * Tests the health modules (growth tracker, nutrition analyzer, health readings,
 * medication reminders) with realistic Spanish-language inputs.
 */

import { assessGrowth, formatGrowthMessage, ageInMonths } from '../src/health/growth-tracker.js';
import { analyzeNutrition, formatNutritionMessage, getNutritionRecommendations } from '../src/health/nutrition-analyzer.js';
import { classifyBloodPressure, classifyGlucose, classifyBMI, formatBPMessage, formatGlucoseMessage } from '../src/health/health-readings.js';
import { parseFrequency, generateReminderTimes, formatMedicationList } from '../src/health/medication-reminder.js';
import { findFood, searchFoods } from '../src/health/peruvian-foods.js';
import { detectIntent, getGreeting } from '../src/bot/handler.js';
import { scrubPII } from '../src/ai/pii-scrubber.js';
import { encryptField, decryptField } from '../src/crypto/field-crypto.js';
import crypto from 'node:crypto';

// ── Test Utilities ──
let passed = 0;
let failed = 0;
let total = 0;

function assert(condition: boolean, testName: string, details?: string): void {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    failed++;
    console.log(`  ❌ ${testName}${details ? ` — ${details}` : ''}`);
  }
}

function section(name: string): void {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${name}`);
  console.log('═'.repeat(60));
}

// ═══════════════════════════════════════════════════════════════
//  PERSONA 1: Lucía (28, Lima) — Toddler growth + anemia worry
// ═══════════════════════════════════════════════════════════════
section('👩 Persona 1: Lucía (28, madre de 2, Lima) — Crecimiento y anemia');

// Her son Mateo: 18 months, 9.5kg, 78cm (slightly underweight)
const mateo = assessGrowth('M', new Date('2024-09-24'), 9.5, 78);
assert(mateo.weightForAge !== undefined, 'Mateo: weight-for-age calculated');
assert(mateo.heightForAge !== undefined, 'Mateo: height-for-age calculated');
assert(mateo.weightForAge!.zScore < 0, 'Mateo: weight-for-age is below median (expected for 9.5kg at 18mo)');
assert(mateo.recommendations.length > 0, 'Mateo: has recommendations');
console.log(`  📊 Weight-for-age z-score: ${mateo.weightForAge?.zScore}`);
console.log(`  📊 Height-for-age z-score: ${mateo.heightForAge?.zScore}`);

// Lucía logs food
const luciaFood = analyzeNutrition('Mi hijo comió arroz con pollo y un vaso de leche');
assert(luciaFood.parsed_foods.length >= 3, 'Lucía food log: parsed 3+ items (arroz, pollo, leche)');
assert(luciaFood.total_calories > 300, 'Lucía food log: >300 kcal estimated');
assert(luciaFood.total_protein_g > 10, 'Lucía food log: >10g protein');
console.log(`  🍽️ Parsed: ${luciaFood.parsed_foods.map(f => f.food_name).join(', ')}`);
console.log(`  🔥 Calories: ${luciaFood.total_calories}`);

// ═══════════════════════════════════════════════════════════════
//  PERSONA 2: María (35, rural Cusco) — Stunted child
// ═══════════════════════════════════════════════════════════════
section('👩 Persona 2: María (35, Cusco) — Niño con desnutrición crónica');

// Her daughter Sofía: 30 months, 10kg, 80cm (stunted + underweight)
const sofia = assessGrowth('F', new Date('2023-09-24'), 10, 80);
assert(sofia.heightForAge !== undefined, 'Sofía: height-for-age calculated');
assert(sofia.heightForAge!.zScore < -2, 'Sofía: stunted (z < -2 for height-for-age)');
assert(sofia.flags.includes('stunting') || sofia.flags.includes('severe_stunting'), 'Sofía: stunting flag present');
console.log(`  📊 Height-for-age z: ${sofia.heightForAge?.zScore} (${sofia.heightForAge?.classification})`);
console.log(`  🚩 Flags: ${sofia.flags.join(', ')}`);

// María asks about simple foods
const mariaFood = analyzeNutrition('Le di papa con huevo y un poco de zapallo');
assert(mariaFood.parsed_foods.length >= 3, 'María food: parsed 3+ items');
assert(mariaFood.total_vitamin_a_mcg > 0, 'María food: contains vitamin A (zapallo)');

// Recommendations for stunted child
const mariaRecs = getNutritionRecommendations(30, sofia.flags);
assert(mariaRecs.some(r => r.toLowerCase().includes('proteina') || r.toLowerCase().includes('proteín')), 'María recs: includes protein advice');
console.log(`  💡 Recommendations: ${mariaRecs.length} total`);

// ═══════════════════════════════════════════════════════════════
//  PERSONA 3: Doña Carmen (55, Arequipa) — Diabetes + BP
// ═══════════════════════════════════════════════════════════════
section('👵 Persona 3: Doña Carmen (55, Arequipa) — Diabetes + hipertensión');

const carmenBP = classifyBloodPressure(148, 92);
assert(carmenBP.classification === 'hipertension_grado2', `Carmen BP: grade 2 hypertension (got: ${carmenBP.classification})`);
assert(carmenBP.alerts.length > 0, 'Carmen BP: has alerts');

const carmenGlucose = classifyGlucose(145, true);
assert(carmenGlucose.classification === 'diabetes', `Carmen glucose: diabetes (got: ${carmenGlucose.classification})`);
assert(carmenGlucose.alerts.length > 0, 'Carmen glucose: has alerts');

const carmenBMI = classifyBMI(78, 155);
assert(carmenBMI.classification === 'sobrepeso' || carmenBMI.classification === 'obesidad_grado1',
  `Carmen BMI: overweight/obese (got: ${carmenBMI.classification}, BMI=${carmenBMI.bmi})`);

console.log(`  ❤️ BP: ${carmenBP.classification}`);
console.log(`  🩸 Glucose: ${carmenGlucose.classification}`);
console.log(`  ⚖️ BMI: ${carmenBMI.bmi} (${carmenBMI.classification})`);

// ═══════════════════════════════════════════════════════════════
//  PERSONA 4: Rosa (19, Puno) — Prenatal nutrition
// ═══════════════════════════════════════════════════════════════
section('👧 Persona 4: Rosa (19, Puno) — Nutrición prenatal');

const rosaFood = analyzeNutrition('Desayuno: avena con leche y un plátano');
assert(rosaFood.parsed_foods.length >= 3, 'Rosa food: parsed 3+ items');
assert(rosaFood.total_iron_mg >= 0, 'Rosa food: iron calculated');

// Intent detection
const rosaIntent = detectIntent('Qué le puedo dar de comer a mi bebé de 7 meses?');
assert(rosaIntent === 'nutrition_advice' || rosaIntent === 'food_log', `Rosa intent: nutrition/food (got: ${rosaIntent})`);

const babyRecs = getNutritionRecommendations(7, []);
assert(babyRecs.some(r => r.toLowerCase().includes('complementaria') || r.toLowerCase().includes('papilla')),
  'Rosa recs: includes complementary feeding advice');
console.log(`  💡 Baby recs: ${babyRecs[0]}`);

// ═══════════════════════════════════════════════════════════════
//  PERSONA 5: Pedro (40, truck driver) — Medication reminders
// ═══════════════════════════════════════════════════════════════
section('🧔 Persona 5: Pedro (40, camionero) — Recordatorios de medicación');

const freq1 = parseFrequency('cada 8 horas');
assert(freq1.timesPerDay === 3, `Pedro freq: 3 times/day (got: ${freq1.timesPerDay})`);
assert(freq1.intervalHours === 8, `Pedro freq: every 8h (got: ${freq1.intervalHours})`);

const freq2 = parseFrequency('diario');
assert(freq2.timesPerDay === 1, `Pedro freq daily: 1/day (got: ${freq2.timesPerDay})`);

const freq3 = parseFrequency('2 veces al día');
assert(freq3.timesPerDay === 2, `Pedro freq 2x: 2/day (got: ${freq3.timesPerDay})`);

const times = generateReminderTimes(new Date(), 3, 8);
assert(times.length === 3, `Pedro reminders: 3 times generated (got: ${times.length})`);
assert(times[0].getHours() >= 6, 'Pedro reminders: first reminder after 6 AM');

const medList = formatMedicationList([
  { id: '1', patientId: 'p1', tenantId: 't1', medicationName: 'Losartán', dosage: '50mg', frequency: 'diario', route: 'oral', startDate: new Date(), active: true },
  { id: '2', patientId: 'p1', tenantId: 't1', medicationName: 'Metformina', dosage: '850mg', frequency: 'cada 12 horas', route: 'oral', startDate: new Date(), active: true },
]);
assert(medList.includes('Losartán'), 'Pedro med list: includes Losartán');
assert(medList.includes('Metformina'), 'Pedro med list: includes Metformina');

// ═══════════════════════════════════════════════════════════════
//  PERSONA 6: Elena (32, nurse) — Patient tracking
// ═══════════════════════════════════════════════════════════════
section('👩‍⚕️ Persona 6: Elena (32, enfermera rural) — Seguimiento de pacientes');

// Batch of 3 children
const child1 = assessGrowth('M', new Date('2024-03-24'), 7.2, 65); // 12 months
const child2 = assessGrowth('F', new Date('2023-03-24'), 13, 90);   // 36 months
const child3 = assessGrowth('M', new Date('2025-01-24'), 4.5, 56);  // 2 months

assert(child1.weightForAge !== undefined, 'Elena child1: assessed');
assert(child2.weightForAge !== undefined, 'Elena child2: assessed');
assert(child3.weightForAge !== undefined, 'Elena child3: assessed');

// Test screening message format
const msg1 = formatGrowthMessage('Juan', child1);
assert(msg1.includes('Evaluación de crecimiento'), 'Elena: growth message formatted');
assert(msg1.includes('Yaya Salud'), 'Elena: disclaimer present');

// ═══════════════════════════════════════════════════════════════
//  PERSONA 7: Carlos (45, Lima) — Weight management
// ═══════════════════════════════════════════════════════════════
section('🧔 Persona 7: Carlos (45, Lima) — Control de peso');

const carlosBMI = classifyBMI(95, 172);
assert(carlosBMI.classification.includes('obesidad'), `Carlos BMI: obese (got: ${carlosBMI.classification})`);
assert(carlosBMI.bmi > 30, `Carlos BMI > 30 (got: ${carlosBMI.bmi})`);

const carlosFood = analyzeNutrition('Almorcé lomo saltado con arroz y una Inca Kola');
assert(carlosFood.parsed_foods.length >= 2, 'Carlos food: parsed items');
assert(carlosFood.total_calories > 400, `Carlos food: >400 kcal (got: ${carlosFood.total_calories})`);

// Intent detection for weight tracking
const weightIntent = detectIntent('Peso 95 kilos y mido 1.72');
console.log(`  🎯 Intent: ${weightIntent}`);

// ═══════════════════════════════════════════════════════════════
//  PERSONA 8: Valentina (25, baby 6mo) — Complementary feeding
// ═══════════════════════════════════════════════════════════════
section('👩 Persona 8: Valentina (25, bebé 6 meses) — Alimentación complementaria');

const babyGrowth = assessGrowth('F', new Date('2025-09-24'), 7.3, 65);
assert(babyGrowth.weightForAge !== undefined, 'Baby: growth assessed');
assert(babyGrowth.recommendations.some(r => r.includes('anemia') || r.includes('hierro')),
  'Baby: anemia risk flagged (6-35 months)');

const valFood = analyzeNutrition('Le di papilla de camote con puré de papa y un poquito de hígado');
assert(valFood.parsed_foods.length >= 2, 'Valentina food: parsed items');
assert(valFood.total_iron_mg > 0, 'Valentina food: contains iron (hígado)');
console.log(`  🍽️ Iron: ${valFood.total_iron_mg}mg`);

// Find specific baby foods
const papilla = findFood('papilla');
assert(papilla !== null, 'Food DB: papilla found');
const higado = findFood('hígado');
assert(higado !== null, 'Food DB: hígado found');
assert(higado!.iron_mg > 5, 'Food DB: hígado is iron-rich');

// ═══════════════════════════════════════════════════════════════
//  PERSONA 9: Abuela Juana (65) — Traditional foods
// ═══════════════════════════════════════════════════════════════
section('👵 Persona 9: Abuela Juana (65) — Alimentos tradicionales');

// Search for traditional foods
const quinua = findFood('quinua');
assert(quinua !== null, 'Food DB: quinua found');
assert(quinua!.protein_g > 4, 'Food DB: quinua has high protein');

const cuy = findFood('cuy');
assert(cuy !== null, 'Food DB: cuy found');

const canihua = findFood('cañihua');
assert(canihua !== null, 'Food DB: cañihua found');

const sangrecita = findFood('sangrecita');
assert(sangrecita !== null, 'Food DB: sangrecita found');
assert(sangrecita!.iron_mg > 20, `Food DB: sangrecita is extremely iron-rich (${sangrecita!.iron_mg}mg/100g)`);

// Abuela's meal
const abuelaFood = analyzeNutrition('Les hice sopa de quinua con pollo y zanahoria');
assert(abuelaFood.parsed_foods.length >= 3, 'Abuela food: parsed 3+ items');
assert(abuelaFood.total_protein_g > 5, 'Abuela food: good protein content');
console.log(`  🍽️ ${formatNutritionMessage('sopa de quinua con pollo', abuelaFood).split('\n')[0]}`);

// ═══════════════════════════════════════════════════════════════
//  PERSONA 10: Dr. García — Population screening
// ═══════════════════════════════════════════════════════════════
section('👨‍⚕️ Persona 10: Dr. García (director de clínica) — Tamizaje poblacional');

// Batch assessment of 5 children
const screeningResults = [
  { name: 'Ana', sex: 'F' as const, dob: '2023-06-15', weight: 11, height: 85 },
  { name: 'Luis', sex: 'M' as const, dob: '2024-01-10', weight: 8.5, height: 72 },
  { name: 'Carmen', sex: 'F' as const, dob: '2022-12-01', weight: 9, height: 82 },
  { name: 'Diego', sex: 'M' as const, dob: '2023-09-20', weight: 12, height: 87 },
  { name: 'Esperanza', sex: 'F' as const, dob: '2024-06-01', weight: 6.5, height: 62 },
];

let flaggedCount = 0;
for (const child of screeningResults) {
  const result = assessGrowth(child.sex, new Date(child.dob), child.weight, child.height);
  if (result.flags.length > 0) flaggedCount++;
}
assert(flaggedCount > 0, `Dr. García: ${flaggedCount}/${screeningResults.length} children flagged`);
console.log(`  📊 Screening: ${flaggedCount}/${screeningResults.length} children need attention`);

// ═══════════════════════════════════════════════════════════════
//  CROSS-CUTTING: PII Scrubber
// ═══════════════════════════════════════════════════════════════
section('🔒 PII Scrubber — Health data protection');

const piiText = 'Paciente María García, DNI 12345678, teléfono 951234567, glucosa de Carmen López: 180';
const scrubbed = scrubPII(piiText);
assert(!scrubbed.includes('María García'), 'PII: name scrubbed');
assert(!scrubbed.includes('12345678'), 'PII: DNI scrubbed');
assert(!scrubbed.includes('951234567'), 'PII: phone scrubbed');
assert(!scrubbed.includes('Carmen López'), 'PII: glucose patient name scrubbed');
console.log(`  🔒 Original: ${piiText.substring(0, 40)}...`);
console.log(`  🔒 Scrubbed: ${scrubbed.substring(0, 40)}...`);

// ═══════════════════════════════════════════════════════════════
//  CROSS-CUTTING: Encryption
// ═══════════════════════════════════════════════════════════════
section('🔐 Field-level encryption');

const testDEK = crypto.randomBytes(32);
const original = 'María García Quispe';
const encrypted = encryptField(original, testDEK, 'tenant-1', 'patients', 'full_name');
assert(encrypted !== original, 'Crypto: field encrypted');
assert(encrypted.length > 40, 'Crypto: encrypted value has expected length');

const decrypted = decryptField(encrypted, testDEK, 'tenant-1', 'patients', 'full_name');
assert(decrypted === original, 'Crypto: decrypted matches original');

// Wrong tenant can't decrypt
const wrongDecrypt = decryptField(encrypted, testDEK, 'tenant-2', 'patients', 'full_name');
assert(wrongDecrypt === null, 'Crypto: wrong tenant fails to decrypt (AAD mismatch)');

// ═══════════════════════════════════════════════════════════════
//  CROSS-CUTTING: Intent Detection
// ═══════════════════════════════════════════════════════════════
section('🎯 Intent Detection');

assert(detectIntent('Hola') === 'greeting', 'Intent: greeting');
assert(detectIntent('Mi hijo pesa 10 kilos') === 'growth_measurement', 'Intent: growth');
assert(detectIntent('Hoy comimos arroz con pollo') === 'food_log', 'Intent: food_log');
assert(detectIntent('Mi presión es 130/85') === 'blood_pressure', 'Intent: blood_pressure');
assert(detectIntent('Glucosa en ayunas 110') === 'glucose', 'Intent: glucose');
assert(detectIntent('Necesito recordatorio para mi pastilla') === 'medication', 'Intent: medication');
assert(detectIntent('Qué le doy de comer a mi bebé?') === 'nutrition_advice', 'Intent: nutrition_advice');

// ═══════════════════════════════════════════════════════════════
//  CROSS-CUTTING: Food Database Coverage
// ═══════════════════════════════════════════════════════════════
section('🥘 Food Database Coverage');

const criticalFoods = [
  'arroz', 'papa', 'yuca', 'camote', 'quinua', 'kiwicha', 'cañihua',
  'pollo', 'res', 'pescado', 'cuy', 'huevo', 'hígado', 'sangrecita',
  'lentejas', 'frijoles', 'pallares',
  'leche', 'queso', 'yogur',
  'plátano', 'mango', 'papaya', 'lúcuma', 'camu camu', 'aguaje',
  'tomate', 'zanahoria', 'espinaca', 'zapallo',
  'ceviche', 'lomo saltado', 'arroz con pollo', 'caldo de gallina',
  'papilla', 'mazamorra',
];

let foundCount = 0;
for (const food of criticalFoods) {
  const entry = findFood(food);
  if (entry) {
    foundCount++;
  } else {
    console.log(`  ❌ Missing: ${food}`);
  }
}
assert(foundCount === criticalFoods.length,
  `Food DB coverage: ${foundCount}/${criticalFoods.length} critical foods found`);

// ═══════════════════════════════════════════════════════════════
//  CROSS-CUTTING: Greeting Message
// ═══════════════════════════════════════════════════════════════
section('💬 Greeting Message');

const greeting = getGreeting('Rosa');
assert(greeting.includes('Rosa'), 'Greeting: includes user name');
assert(greeting.includes('Yaya Salud'), 'Greeting: includes brand');
assert(greeting.includes('consulta médica'), 'Greeting: includes medical disclaimer');

// ═══════════════════════════════════════════════════════════════
//  RESULTS
// ═══════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(60)}`);
console.log(`  RESULTS: ${passed}/${total} passed, ${failed} failed`);
console.log('═'.repeat(60));

if (failed > 0) {
  console.log(`\n⚠️  ${failed} tests failed. Review above.`);
  process.exit(1);
} else {
  console.log('\n✅ All persona tests passed!');
  process.exit(0);
}

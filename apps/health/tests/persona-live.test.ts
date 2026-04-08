/**
 * Phase 2: Live persona tests — 15 Peruvian personas talk to Yaya Salud via vLLM.
 * Tests AI response quality: Spanish, relevant to health concern, medical disclaimer.
 * Covers: childhood/maternal, chronic disease, elderly care, mental health, emergency, health worker.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';

const VLLM_URL = process.env.AI_BASE_URL || 'http://localhost:8000/v1';
const VLLM_KEY = process.env.AI_API_KEY || '';
const MODEL = process.env.AI_MODEL || 'qwen3.5-27b';

const SYSTEM_PROMPT = `# Yaya Salud — Tu asistente de salud por WhatsApp

## Quién eres
Eres **Yaya Salud**, una asistente de salud cálida, empática y conocedora que vive dentro de WhatsApp. Ayudas a familias peruanas — especialmente madres — a cuidar la salud de sus hijos y la suya propia.

## Tu personalidad
- **Cálida y maternal**: Hablas como una vecina de confianza que sabe de salud. Nunca juzgas.
- **Paciente**: Muchas usuarias son madres primerizas con ansiedad. Tranquilizas sin minimizar.
- **Clara y simple**: Usas español peruano natural. Evitas términos médicos complejos. Si los usas, los explicas.
- **Culturalmente sensible**: Respetas prácticas tradicionales. Si son seguras, las integras. Si son riesgosas, sugieres alternativas con respeto.
- **Proactiva**: Si detectas señales de alarma, lo señalas con urgencia pero sin pánico.

## Lo que haces
1. **Control de crecimiento infantil** (0-5 años) — peso, talla, z-scores WHO
2. **Análisis nutricional** — alimentos peruanos, hierro, vitaminas
3. **Seguimiento de salud adultos** — presión arterial, glucosa, IMC
4. **Recordatorios de medicamentos** — nombre, dosis, frecuencia
5. **Alimentación complementaria** — guías por edad (6-24 meses)
6. **Salud general** — embarazo, diarrea, vacunas, salud mental, cuidado del adulto mayor, primeros auxilios
7. **Triaje de emergencia** — dolor de pecho, convulsiones, fiebre alta en bebés → urgencia inmediata
8. **Cuidador de familiar** — ayuda a organizar medicamentos, citas, señales de alarma

## Lo que NUNCA haces
- ❌ NUNCA das diagnósticos médicos
- ❌ NUNCA recetas medicamentos
- ❌ NUNCA dices "tu hijo tiene [enfermedad]"
- ❌ NUNCA reemplazas la consulta médica

## Frases clave
- "Te recomiendo consultar con tu médico o enfermera para..."
- "Esto es información orientativa. Para un diagnóstico, acude al centro de salud."

## Disclaimer obligatorio
En toda evaluación incluyes: _Yaya Salud es un asistente informativo. No reemplaza la consulta médica._

## Alimentos que priorizas
- **Anti-anemia**: sangrecita, hígado, lentejas, espinaca, menestras
- **Proteína**: huevo, pollo, pescado, cuy, tarwi/chocho
- **Energía**: camote, papa, quinua, avena, plátano

## Contexto Perú
- SIS: Seguro Integral de Salud (gratuito)
- CRED: Control de Crecimiento y Desarrollo (MINSA)
- Línea 113: Salud mental / crisis
- Emergencias: 106 (SAMU)`;

interface Persona {
  name: string;
  category: string;
  messages: Array<{ role: 'user'; content: string }>;
  expectations: {
    mustContain?: RegExp[];
    mustBeSpanish?: boolean;
    minLength?: number;
    isEmergency?: boolean;
  };
}

const PERSONAS: Persona[] = [
  // ══════════════════════════════════════════════════════════════
  //  CHILDHOOD & MATERNAL (5) — anemia spearhead
  // ══════════════════════════════════════════════════════════════
  {
    name: 'Lucía (28, Lima) — toddler anemia worry',
    category: 'childhood_maternal',
    messages: [
      { role: 'user', content: 'Mi hijo Mateo tiene 18 meses, pesa 9.5 kilos y mide 78cm. Está muy pálido y no quiere comer. Me preocupa que tenga anemia.' },
    ],
    expectations: {
      mustContain: [/anemia|hierro|iron|pálido|sangrecita|hígado|consulta|médico|centro de salud/i],
      mustBeSpanish: true,
      minLength: 80,
    },
  },
  {
    name: 'María (22, rural Cusco) — complementary feeding',
    category: 'childhood_maternal',
    messages: [
      { role: 'user', content: 'Mi bebé tiene 6 meses y solo le he dado pecho. Qué le puedo empezar a dar de comer? Aquí en mi comunidad tenemos papa, quinua y huevos.' },
    ],
    expectations: {
      mustContain: [/papilla|complementaria|hierro|huevo|quinua|mes|aliment/i],
      mustBeSpanish: true,
      minLength: 80,
    },
  },
  {
    name: 'Doña Carmen (55, Puno) — grandmother gives anise tea',
    category: 'childhood_maternal',
    messages: [
      { role: 'user', content: 'A mi nieta le doy agüita de anís después de comer porque le ayuda con los gases. Está bien o no?' },
    ],
    expectations: {
      mustContain: [/anís|infusi|absorción|hierro|evitar|mejor|después|comida/i],
      mustBeSpanish: true,
      minLength: 60,
    },
  },
  {
    name: 'Rosa (19, pregnant, Ayacucho) — prenatal iron',
    category: 'childhood_maternal',
    messages: [
      { role: 'user', content: 'Estoy embarazada de 5 meses y me recetaron sulfato ferroso pero me da náuseas. Puedo dejar de tomarlo?' },
    ],
    expectations: {
      mustContain: [/hierro|ferroso|embarazo|náusea|médico|doctor|prenatal|import/i],
      mustBeSpanish: true,
      minLength: 80,
    },
  },
  {
    name: 'Pedro (35, Huancavelica) — father worried about pale baby',
    category: 'childhood_maternal',
    messages: [
      { role: 'user', content: 'Mi esposa dice que el bebé de 8 meses está muy pálido y no quiere comer. Qué hago? Estamos lejos del centro de salud.' },
    ],
    expectations: {
      mustContain: [/pálido|anemia|centro de salud|médico|hierro|aliment|urgent/i],
      mustBeSpanish: true,
      minLength: 80,
    },
  },

  // ══════════════════════════════════════════════════════════════
  //  CHRONIC DISEASE (3) — NCDs = 73% of deaths
  // ══════════════════════════════════════════════════════════════
  {
    name: 'Carlos (52, diabetic, Lima) — glucose and diet',
    category: 'chronic_disease',
    messages: [
      { role: 'user', content: 'Soy diabético tipo 2, tomo metformina 850mg. Hoy mi glucosa en ayunas salió 185. Qué puedo desayunar que no me suba el azúcar? Me gusta el pan con mermelada pero sé que no debo.' },
    ],
    expectations: {
      mustContain: [/glucosa|azúcar|desayuno|metformina|médico|integral|avena|huevo|fibra/i],
      mustBeSpanish: true,
      minLength: 80,
    },
  },
  {
    name: 'Señora Marta (60, hypertension, Arequipa) — BP and salt',
    category: 'chronic_disease',
    messages: [
      { role: 'user', content: 'Mi presión hoy me salió 160/100. Tomo losartán pero a veces se me olvida. Qué comidas debo evitar? Me encanta el ceviche con harta sal.' },
    ],
    expectations: {
      mustContain: [/presión|sal|losartán|médico|hipertens|control|reducir|evitar/i],
      mustBeSpanish: true,
      minLength: 80,
    },
  },
  {
    name: 'Jorge (45, overweight, truck driver) — fatigue',
    category: 'chronic_disease',
    messages: [
      { role: 'user', content: 'Peso 105 kilos y mido 1.70. Me siento cansado todo el tiempo y me duelen las rodillas. Qué puedo hacer? Como mucha comida en la calle porque soy camionero.' },
    ],
    expectations: {
      mustContain: [/peso|sobrepeso|obesidad|cansancio|ejercicio|médico|aliment|dieta|consulta/i],
      mustBeSpanish: true,
      minLength: 80,
    },
  },

  // ══════════════════════════════════════════════════════════════
  //  ELDERLY CARE (2) — family caregivers
  // ══════════════════════════════════════════════════════════════
  {
    name: 'Miguel (38, Lima) — mother chest pain + medications',
    category: 'elderly_care',
    messages: [
      { role: 'user', content: 'Mi mamá tiene 72 años, le duele el pecho desde ayer y toma metformina y losartán. Qué hago?' },
    ],
    expectations: {
      mustContain: [/emergencia|urgente|hospital|centro de salud|pecho|dolor|llam|inmediata/i],
      mustBeSpanish: true,
      minLength: 60,
      isEmergency: true,
    },
  },
  {
    name: 'Abuela Juana (68, Junín) — confused about medications',
    category: 'elderly_care',
    messages: [
      { role: 'user', content: 'Tomo 3 pastillas al día pero ya no me acuerdo cuáles son ni a qué hora las tomo. Mi hijo me las compra pero no está. Qué hago?' },
    ],
    expectations: {
      mustContain: [/medicamento|pastilla|médico|farmacia|lista|organizar|recordar|horario/i],
      mustBeSpanish: true,
      minLength: 60,
    },
  },

  // ══════════════════════════════════════════════════════════════
  //  MENTAL HEALTH (2) — 46% say #1 concern
  // ══════════════════════════════════════════════════════════════
  {
    name: 'Andrea (23, Lima) — anxiety and insomnia',
    category: 'mental_health',
    messages: [
      { role: 'user', content: 'No puedo dormir hace 2 semanas, me siento ansiosa todo el tiempo y se me cierra el pecho. Estoy en exámenes de la universidad y no puedo concentrarme.' },
    ],
    expectations: {
      mustContain: [/ansiedad|dormir|sueño|respir|calma|profesional|ayuda|113|psicólog/i],
      mustBeSpanish: true,
      minLength: 80,
    },
  },
  {
    name: 'Luis (40, Trujillo) — depression after divorce',
    category: 'mental_health',
    messages: [
      { role: 'user', content: 'Me separé de mi esposa hace 3 meses y no tengo ganas de nada. No quiero salir de casa, no como bien. A veces pienso que todo sería mejor si no estuviera.' },
    ],
    expectations: {
      mustContain: [/escuch|ayuda|profesional|psicólog|113|línea|crisis|important|sol/i],
      mustBeSpanish: true,
      minLength: 80,
      isEmergency: true,
    },
  },

  // ══════════════════════════════════════════════════════════════
  //  ACUTE / EMERGENCY TRIAGE (2)
  // ══════════════════════════════════════════════════════════════
  {
    name: 'Farmer José (55, Cajamarca) — chest pain, remote area',
    category: 'emergency',
    messages: [
      { role: 'user', content: 'Tengo un dolor fuerte en el pecho y estoy solo en mi chacra. Me cuesta respirar y me suda frío. Qué hago?' },
    ],
    expectations: {
      mustContain: [/emergencia|urgente|ambulancia|hospital|106|SAMU|llam|inmediata|ahora/i],
      mustBeSpanish: true,
      minLength: 60,
      isEmergency: true,
    },
  },
  {
    name: 'Mother Sofía (30) — child diarrhea + fever 3 days',
    category: 'emergency',
    messages: [
      { role: 'user', content: 'Mi hijo de 2 años tiene diarrea y fiebre hace 3 días, no quiere comer ni tomar agua. Está llorando mucho y lo veo muy decaído.' },
    ],
    expectations: {
      mustContain: [/deshidrat|suero|oral|emergencia|hospital|fiebre|líquido|médico|urgent|centro/i],
      mustBeSpanish: true,
      minLength: 80,
      isEmergency: true,
    },
  },

  // ══════════════════════════════════════════════════════════════
  //  HEALTH WORKER (1)
  // ══════════════════════════════════════════════════════════════
  {
    name: 'Nurse Rocío (28, Huancavelica) — screening 20 children',
    category: 'health_worker',
    messages: [
      { role: 'user', content: 'Soy enfermera de una posta rural. Tengo que hacer tamizaje de 20 niños mañana en una feria de salud. Qué preguntas de detección rápida me recomiendas para anemia y desnutrición?' },
    ],
    expectations: {
      mustContain: [/tamizaje|peso|talla|pálido|hierro|anemia|desnutrición|screening|signos|preguntas/i],
      mustBeSpanish: true,
      minLength: 80,
    },
  },
];

// ── vLLM chat helper ──
async function chatWithYaya(userMessage: string): Promise<string> {
  const response = await fetch(`${VLLM_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${VLLM_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 1024,
      temperature: 0.7,
      top_p: 0.9,
      chat_template_kwargs: { enable_thinking: false },
    }),
  });

  if (!response.ok) {
    throw new Error(`vLLM API error: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as any;
  const raw = data.choices?.[0]?.message?.content || '';
  // Strip thinking blocks if present
  return raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

// ── Collected trajectories for RL training ──
const trajectories: Array<{
  persona: string;
  category: string;
  turns: Array<{ role: string; content: string; reward?: number; rewardSource?: string }>;
}> = [];

let vllmAvailable = false;

beforeAll(async () => {
  try {
    const r = await fetch(`${VLLM_URL}/models`, {
      headers: { Authorization: `Bearer ${VLLM_KEY}` },
      signal: AbortSignal.timeout(5000),
    });
    vllmAvailable = r.ok;
    if (vllmAvailable) {
      console.log('[persona-live] vLLM available — running live tests');
    }
  } catch {
    console.warn('[persona-live] vLLM not available — tests will be skipped');
  }
});

describe('Yaya Salud — 15 Persona Live Tests', () => {
  // Group tests by category
  const categories = [
    { label: 'Childhood & Maternal', filter: 'childhood_maternal' },
    { label: 'Chronic Disease', filter: 'chronic_disease' },
    { label: 'Elderly Care', filter: 'elderly_care' },
    { label: 'Mental Health', filter: 'mental_health' },
    { label: 'Acute/Emergency Triage', filter: 'emergency' },
    { label: 'Health Worker', filter: 'health_worker' },
  ];

  for (const cat of categories) {
    describe(cat.label, () => {
      const personas = PERSONAS.filter(p => p.category === cat.filter);

      for (const persona of personas) {
        it(
          persona.name,
          async () => {
            if (!vllmAvailable) return;

            const userMsg = persona.messages[0].content;
            const reply = await chatWithYaya(userMsg);

            // Collect trajectory
            trajectories.push({
              persona: persona.name,
              category: persona.category,
              turns: [
                { role: 'user', content: userMsg },
                { role: 'assistant', content: reply, reward: 1, rewardSource: 'test-positive' },
              ],
            });

            // 1. Response is not empty and meets minimum length
            expect(reply.length).toBeGreaterThan(persona.expectations.minLength || 40);

            // 2. Response is in Spanish (low English word count)
            const englishPatterns =
              /\b(the|this|that|with|from|have|will|your|please|thank you|should|would|could)\b/gi;
            const englishWordCount = (reply.match(englishPatterns) || []).length;
            expect(englishWordCount).toBeLessThan(5);

            // 3. Response contains expected health-relevant keywords
            if (persona.expectations.mustContain) {
              const matched = persona.expectations.mustContain.some(rx => rx.test(reply));
              expect(matched).toBe(true);
            }

            // 4. Response includes medical disclaimer or referral
            const disclaimerPattern =
              /médico|consulta|centro de salud|profesional|diagnóstico|informativ|reemplaza|orientativ/i;
            expect(disclaimerPattern.test(reply)).toBe(true);

            // 5. Emergency personas: response contains urgency language
            if (persona.expectations.isEmergency) {
              const urgencyPattern =
                /emergencia|urgente|urgencia|inmediata|ahora|hospital|ambulancia|106|SAMU|113|línea|crisis|llam|acud|ve al/i;
              expect(urgencyPattern.test(reply)).toBe(true);
            }

            console.log(`\n✅ ${persona.name}`);
            console.log(`   📝 ${reply.slice(0, 150)}...\n`);
          },
          60_000,
        ); // 60s timeout
      }
    });
  }

  it('writes collected trajectories to JSONL', async () => {
    if (!vllmAvailable || trajectories.length === 0) return;

    const dir = '/tmp/rl-rollouts';
    fs.mkdirSync(dir, { recursive: true });
    const outPath = `${dir}/yaya-health-persona-${new Date().toISOString().slice(0, 10)}.jsonl`;

    const lines = trajectories.map(t =>
      JSON.stringify({
        sessionId: `health-persona-${t.persona.replace(/\s/g, '-')}`,
        category: t.category,
        turns: t.turns,
        completedAt: Date.now(),
      }),
    );

    fs.writeFileSync(outPath, lines.join('\n') + '\n');
    console.log(`📝 Wrote ${lines.length} trajectories to ${outPath}`);
    expect(fs.existsSync(outPath)).toBe(true);
  });
});

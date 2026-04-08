/**
 * Multi-turn persona tests -- 5 diverse LATAM personas talk to Yaya via vLLM.
 * Each persona runs 3-4 turns simulating realistic business scenarios.
 * Evaluates: Spanish quality, cultural accuracy, price references, latency.
 */
import { describe, it, expect, beforeAll } from 'vitest';

const VLLM_URL = process.env.VLLM_API_BASE || 'http://localhost:18080/v1';
const VLLM_KEY = process.env.VLLM_API_KEY || 'omnimoney';
const MODEL = process.env.VLLM_MODEL || 'qwen3.5-122b';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface TurnResult {
  turn: number;
  label: string;
  userMessage: string;
  response: string;
  latencyMs: number;
  grade: 'PASS' | 'PARTIAL' | 'FAIL';
  notes: string[];
}

interface PersonaResult {
  persona: string;
  business: string;
  turns: TurnResult[];
  overallGrade: 'PASS' | 'PARTIAL' | 'FAIL';
}

async function chatMultiTurn(
  systemPrompt: string,
  messages: Message[],
): Promise<{ content: string; latencyMs: number }> {
  const start = Date.now();
  const response = await fetch(`${VLLM_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${VLLM_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: 400,
      temperature: 0.7,
      top_p: 0.9,
      chat_template_kwargs: { enable_thinking: false },
    }),
  });
  const latencyMs = Date.now() - start;

  if (!response.ok) {
    throw new Error(`vLLM API error: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as any;
  const content = (data.choices?.[0]?.message?.content || '')
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .trim();
  return { content, latencyMs };
}

function gradeResponse(
  response: string,
  checks: {
    mustBeSpanish?: boolean;
    mustContain?: RegExp[];
    mustNotContain?: RegExp[];
    minLength?: number;
  },
): { grade: 'PASS' | 'PARTIAL' | 'FAIL'; notes: string[] } {
  const notes: string[] = [];
  let failures = 0;
  let partials = 0;

  // Check Spanish
  if (checks.mustBeSpanish !== false) {
    const englishPatterns = /\b(the|this|that|with|from|have|will|your|please|thank you|would|could|should)\b/gi;
    const englishWordCount = (response.match(englishPatterns) || []).length;
    if (englishWordCount > 8) {
      failures++;
      notes.push(`Too much English (${englishWordCount} words)`);
    } else if (englishWordCount > 3) {
      partials++;
      notes.push(`Some English leakage (${englishWordCount} words)`);
    } else {
      notes.push('Spanish: OK');
    }
  }

  // Check required patterns
  if (checks.mustContain) {
    const matched = checks.mustContain.filter((rx) => rx.test(response));
    const missed = checks.mustContain.filter((rx) => !rx.test(response));
    if (missed.length > 0) {
      if (missed.length === checks.mustContain.length) {
        failures++;
        notes.push(`Missing ALL required patterns: ${missed.map((r) => r.source).join(', ')}`);
      } else {
        partials++;
        notes.push(`Missing some patterns: ${missed.map((r) => r.source).join(', ')}`);
      }
    } else {
      notes.push('Content patterns: all matched');
    }
  }

  // Check forbidden patterns
  if (checks.mustNotContain) {
    const found = checks.mustNotContain.filter((rx) => rx.test(response));
    if (found.length > 0) {
      failures++;
      notes.push(`Contains forbidden patterns: ${found.map((r) => r.source).join(', ')}`);
    }
  }

  // Check length
  if (checks.minLength && response.length < checks.minLength) {
    partials++;
    notes.push(`Too short (${response.length} < ${checks.minLength})`);
  }

  if (failures > 0) return { grade: 'FAIL', notes };
  if (partials > 0) return { grade: 'PARTIAL', notes };
  return { grade: 'PASS', notes };
}

let vllmAvailable = false;
const allResults: PersonaResult[] = [];

beforeAll(async () => {
  try {
    const r = await fetch(`${VLLM_URL}/models`, {
      headers: { Authorization: `Bearer ${VLLM_KEY}` },
      signal: AbortSignal.timeout(5000),
    });
    vllmAvailable = r.ok;
    if (vllmAvailable) {
      const models = (await r.json()) as any;
      console.log(`\n[vLLM] Available models: ${JSON.stringify(models.data?.map((m: any) => m.id))}`);
    }
  } catch (e) {
    console.warn('[persona-multiturn] vLLM not available -- tests will be skipped');
  }
});

describe('Multi-turn Persona Live Tests', () => {
  // ================================================================
  // PERSONA 1: BODEGA (Maria Flores, Villa El Salvador, Lima)
  // ================================================================
  describe('Persona 1: Maria Flores - Bodega Dona Mary (Lima)', () => {
    const SYS = `Eres Yaya, asistente virtual de Bodega Doña Mary en Villa El Salvador, Lima, Perú.
Hablas español peruano coloquial, eres cálida, concisa y proactiva. Formato WhatsApp: mensajes cortos.
La bodega vende abarrotes (arroz, azúcar, aceite, fideos), gaseosas, galletas, snacks, pan, huevos, leche, artículos de limpieza, golosinas, recargas de celular.
La dueña es María Flores. Precios: arroz S/4.80/kg, azúcar S/4.50/kg, aceite 1L S/9.50, fideos S/3.50, leche Gloria S/4.80, pan S/0.20 unidad, huevos S/0.50 unidad, Coca-Cola 3L S/12, Coca-Cola personal S/2.50, Inca Kola 3L S/12.
Aceptas efectivo y Yape. Usa emojis con moderación.`;

    const turns: TurnResult[] = [];
    const history: Message[] = [{ role: 'system', content: SYS }];

    it('Turn 1: Price check', async () => {
      if (!vllmAvailable) return;
      const userMsg = 'hola yaya cuanto esta el arroz y el aceite? necesito para hoy';
      history.push({ role: 'user', content: userMsg });
      const { content, latencyMs } = await chatMultiTurn(SYS, history);
      history.push({ role: 'assistant', content });
      const { grade, notes } = gradeResponse(content, {
        mustContain: [/4\.80|4,80/, /9\.50|9,50/, /arroz/i, /aceite/i],
        minLength: 30,
      });
      const result: TurnResult = { turn: 1, label: 'Price check', userMessage: userMsg, response: content, latencyMs, grade, notes };
      turns.push(result);
      console.log(`\n[BODEGA T1] ${latencyMs}ms | Grade: ${grade}`);
      console.log(`User: ${userMsg}`);
      console.log(`Yaya: ${content.slice(0, 300)}`);
      console.log(`Notes: ${notes.join('; ')}`);
      expect(content.length).toBeGreaterThan(20);
    }, 120_000);

    it('Turn 2: Add items + Yape payment', async () => {
      if (!vllmAvailable) return;
      const userMsg = 'dame 5 kilos de arroz, 2 litros de aceite y 1 bolsa de fideos. puedo pagar con yape?';
      history.push({ role: 'user', content: userMsg });
      const { content, latencyMs } = await chatMultiTurn(SYS, history);
      history.push({ role: 'assistant', content });
      const { grade, notes } = gradeResponse(content, {
        mustContain: [/yape/i, /S\/|total|soles/i],
        minLength: 30,
      });
      const result: TurnResult = { turn: 2, label: 'Order + Yape', userMessage: userMsg, response: content, latencyMs, grade, notes };
      turns.push(result);
      console.log(`\n[BODEGA T2] ${latencyMs}ms | Grade: ${grade}`);
      console.log(`User: ${userMsg}`);
      console.log(`Yaya: ${content.slice(0, 300)}`);
      console.log(`Notes: ${notes.join('; ')}`);
      expect(content.length).toBeGreaterThan(20);
    }, 120_000);

    it('Turn 3: Edge case - request fiado', async () => {
      if (!vllmAvailable) return;
      const userMsg = 'oye y me puedes fiar? es q no me ha caido la plata todavia. te pago el viernes si? mi esposo cobra ese dia 😅';
      history.push({ role: 'user', content: userMsg });
      const { content, latencyMs } = await chatMultiTurn(SYS, history);
      history.push({ role: 'assistant', content });
      const { grade, notes } = gradeResponse(content, {
        mustContain: [/fiad|crédito|pago|viernes|consultar|dueñ/i],
        minLength: 30,
      });
      const result: TurnResult = { turn: 3, label: 'Fiado request', userMessage: userMsg, response: content, latencyMs, grade, notes };
      turns.push(result);
      console.log(`\n[BODEGA T3] ${latencyMs}ms | Grade: ${grade}`);
      console.log(`User: ${userMsg}`);
      console.log(`Yaya: ${content.slice(0, 300)}`);
      console.log(`Notes: ${notes.join('; ')}`);
      expect(content.length).toBeGreaterThan(20);
    }, 120_000);

    it('Turn 4: Closing', async () => {
      if (!vllmAvailable) return;
      const userMsg = 'ya listo gracias yayita! eres lo maximo, te mando por yape ahorita';
      history.push({ role: 'user', content: userMsg });
      const { content, latencyMs } = await chatMultiTurn(SYS, history);
      history.push({ role: 'assistant', content });
      const { grade, notes } = gradeResponse(content, {
        mustContain: [/gracias|esperamos|aquí|ayud/i],
        minLength: 15,
      });
      const result: TurnResult = { turn: 4, label: 'Closing', userMessage: userMsg, response: content, latencyMs, grade, notes };
      turns.push(result);
      console.log(`\n[BODEGA T4] ${latencyMs}ms | Grade: ${grade}`);
      console.log(`User: ${userMsg}`);
      console.log(`Yaya: ${content.slice(0, 300)}`);
      console.log(`Notes: ${notes.join('; ')}`);

      // Store results
      const grades = turns.map(t => t.grade);
      const overallGrade = grades.includes('FAIL') ? 'FAIL' : grades.includes('PARTIAL') ? 'PARTIAL' : 'PASS';
      allResults.push({ persona: 'Maria Flores', business: 'Bodega Dona Mary', turns, overallGrade });
    }, 120_000);
  });

  // ================================================================
  // PERSONA 2: RESTAURANT (Elena Quispe, Cusco)
  // ================================================================
  describe('Persona 2: Elena Quispe - Sabor Cusqueno (Cusco)', () => {
    const SYS = `Eres Yaya, asistente virtual del restaurante Sabor Cusqueño en Cusco, Perú.
La dueña es Elena Quispe. Hablas español cusqueño cálido, puedes usar "mamita" y "papito" naturalmente.
Menú del día S/18 (entrada+fondo+postre). Platos a la carta: ceviche de trucha S/35, rocoto relleno S/30, ají de gallina S/28, lomo saltado S/35, chiri uchu S/25.
Bebidas: chicha morada S/5, Cusqueña S/10, limonada S/6.
Aceptas efectivo, Yape, tarjeta. Capacidad 45 personas.
Formato WhatsApp: mensajes cortos, emojis con moderación.`;

    const turns: TurnResult[] = [];
    const history: Message[] = [{ role: 'system', content: SYS }];

    it('Turn 1: Table for group + menu inquiry', async () => {
      if (!vllmAvailable) return;
      const userMsg = 'buenas tardes, somos un grupo de 8 turistas. tienen mesa? queremos probar comida tipica cusqueña';
      history.push({ role: 'user', content: userMsg });
      const { content, latencyMs } = await chatMultiTurn(SYS, history);
      history.push({ role: 'assistant', content });
      const { grade, notes } = gradeResponse(content, {
        mustContain: [/menú|plato|mesa|bienvenid/i, /S\/|sol/i],
        minLength: 40,
      });
      const result: TurnResult = { turn: 1, label: 'Group reservation', userMessage: userMsg, response: content, latencyMs, grade, notes };
      turns.push(result);
      console.log(`\n[RESTAURANT T1] ${latencyMs}ms | Grade: ${grade}`);
      console.log(`User: ${userMsg}`);
      console.log(`Yaya: ${content.slice(0, 300)}`);
      console.log(`Notes: ${notes.join('; ')}`);
      expect(content.length).toBeGreaterThan(20);
    }, 120_000);

    it('Turn 2: Allergen question (tourist)', async () => {
      if (!vllmAvailable) return;
      const userMsg = 'uno de nosotros es celíaco, no puede comer gluten. que platos puede comer? y otro es alérgico a los mariscos';
      history.push({ role: 'user', content: userMsg });
      const { content, latencyMs } = await chatMultiTurn(SYS, history);
      history.push({ role: 'assistant', content });
      const { grade, notes } = gradeResponse(content, {
        mustContain: [/gluten|celíac|alérgic|segur/i],
        minLength: 40,
      });
      const result: TurnResult = { turn: 2, label: 'Allergen inquiry', userMessage: userMsg, response: content, latencyMs, grade, notes };
      turns.push(result);
      console.log(`\n[RESTAURANT T2] ${latencyMs}ms | Grade: ${grade}`);
      console.log(`User: ${userMsg}`);
      console.log(`Yaya: ${content.slice(0, 300)}`);
      console.log(`Notes: ${notes.join('; ')}`);
      expect(content.length).toBeGreaterThan(20);
    }, 120_000);

    it('Turn 3: Edge case - split payment', async () => {
      if (!vllmAvailable) return;
      const userMsg = 'queremos pagar la cuenta dividida: 4 pagan con tarjeta y 4 con efectivo. se puede? y me dan boleta?';
      history.push({ role: 'user', content: userMsg });
      const { content, latencyMs } = await chatMultiTurn(SYS, history);
      history.push({ role: 'assistant', content });
      const { grade, notes } = gradeResponse(content, {
        mustContain: [/pago|tarjeta|efectivo|boleta|dividir|separar/i],
        minLength: 30,
      });
      const result: TurnResult = { turn: 3, label: 'Split payment', userMessage: userMsg, response: content, latencyMs, grade, notes };
      turns.push(result);
      console.log(`\n[RESTAURANT T3] ${latencyMs}ms | Grade: ${grade}`);
      console.log(`User: ${userMsg}`);
      console.log(`Yaya: ${content.slice(0, 300)}`);
      console.log(`Notes: ${notes.join('; ')}`);
      expect(content.length).toBeGreaterThan(20);
    }, 120_000);

    it('Turn 4: Farewell + review', async () => {
      if (!vllmAvailable) return;
      const userMsg = 'todo estuvo delicioso! el rocoto relleno increible. nos vamos, muchas gracias!';
      history.push({ role: 'user', content: userMsg });
      const { content, latencyMs } = await chatMultiTurn(SYS, history);
      history.push({ role: 'assistant', content });
      const { grade, notes } = gradeResponse(content, {
        mustContain: [/gracias|volver|encant|bienvenid/i],
        minLength: 15,
      });
      const result: TurnResult = { turn: 4, label: 'Farewell', userMessage: userMsg, response: content, latencyMs, grade, notes };
      turns.push(result);
      console.log(`\n[RESTAURANT T4] ${latencyMs}ms | Grade: ${grade}`);
      console.log(`User: ${userMsg}`);
      console.log(`Yaya: ${content.slice(0, 300)}`);
      console.log(`Notes: ${notes.join('; ')}`);

      const grades = turns.map(t => t.grade);
      const overallGrade = grades.includes('FAIL') ? 'FAIL' : grades.includes('PARTIAL') ? 'PARTIAL' : 'PASS';
      allResults.push({ persona: 'Elena Quispe', business: 'Sabor Cusqueno', turns, overallGrade });
    }, 120_000);
  });

  // ================================================================
  // PERSONA 3: SALON (Carmen Lopez, Cali, Colombia)
  // ================================================================
  describe('Persona 3: Carmen Lopez - Salon Bella Cali (Colombia)', () => {
    const SYS = `Eres Yaya, asistente virtual del Salón Bella Cali en Cali, Colombia.
La dueña es Carmen López. Hablas con estilo caleño/valluno: "vea pues", "oiga", "mija".
Servicios y precios en COP: corte $45,000, tinte $120,000, alisado $180,000, extensiones $850,000, manicure $35,000, pedicure $40,000, maquillaje $80,000, keratina $200,000, brushing $35,000.
3 sedes: Granada, Ciudad Jardín, Chipichape. Aceptas Nequi, efectivo, datafono.
Formato WhatsApp: mensajes cortos, emojis con moderación.`;

    const turns: TurnResult[] = [];
    const history: Message[] = [{ role: 'system', content: SYS }];

    it('Turn 1: Appointment booking', async () => {
      if (!vllmAvailable) return;
      const userMsg = 'hola mija! quiero una cita para tinte y corte el sabado a las 10am en la sede de granada. cuanto me sale?';
      history.push({ role: 'user', content: userMsg });
      const { content, latencyMs } = await chatMultiTurn(SYS, history);
      history.push({ role: 'assistant', content });
      const { grade, notes } = gradeResponse(content, {
        mustContain: [/tinte|corte/i, /\$|precio|cuesta/i],
        minLength: 30,
      });
      const result: TurnResult = { turn: 1, label: 'Appointment booking', userMessage: userMsg, response: content, latencyMs, grade, notes };
      turns.push(result);
      console.log(`\n[SALON T1] ${latencyMs}ms | Grade: ${grade}`);
      console.log(`User: ${userMsg}`);
      console.log(`Yaya: ${content.slice(0, 300)}`);
      console.log(`Notes: ${notes.join('; ')}`);
      expect(content.length).toBeGreaterThan(20);
    }, 120_000);

    it('Turn 2: Add services', async () => {
      if (!vllmAvailable) return;
      const userMsg = 'ay tambien quiero manicure y pedicure! cuanto seria todo junto? me hacen descuento por todo el combo? 💅';
      history.push({ role: 'user', content: userMsg });
      const { content, latencyMs } = await chatMultiTurn(SYS, history);
      history.push({ role: 'assistant', content });
      const { grade, notes } = gradeResponse(content, {
        mustContain: [/manicure|pedicure/i, /\$|total|precio/i],
        minLength: 30,
      });
      const result: TurnResult = { turn: 2, label: 'Add services', userMessage: userMsg, response: content, latencyMs, grade, notes };
      turns.push(result);
      console.log(`\n[SALON T2] ${latencyMs}ms | Grade: ${grade}`);
      console.log(`User: ${userMsg}`);
      console.log(`Yaya: ${content.slice(0, 300)}`);
      console.log(`Notes: ${notes.join('; ')}`);
      expect(content.length).toBeGreaterThan(20);
    }, 120_000);

    it('Turn 3: Edge case - complain about wait time', async () => {
      if (!vllmAvailable) return;
      const userMsg = 'oiga la ultima vez que fui me hicieron esperar 40 minutos teniendo cita!! eso no puede ser, casi no vuelvo 😤';
      history.push({ role: 'user', content: userMsg });
      const { content, latencyMs } = await chatMultiTurn(SYS, history);
      history.push({ role: 'assistant', content });
      const { grade, notes } = gradeResponse(content, {
        mustContain: [/disculp|perdón|lament|sentimos|espera|inconvenient/i],
        minLength: 30,
      });
      const result: TurnResult = { turn: 3, label: 'Wait time complaint', userMessage: userMsg, response: content, latencyMs, grade, notes };
      turns.push(result);
      console.log(`\n[SALON T3] ${latencyMs}ms | Grade: ${grade}`);
      console.log(`User: ${userMsg}`);
      console.log(`Yaya: ${content.slice(0, 300)}`);
      console.log(`Notes: ${notes.join('; ')}`);
      expect(content.length).toBeGreaterThan(20);
    }, 120_000);

    it('Turn 4: Confirm + Nequi payment', async () => {
      if (!vllmAvailable) return;
      const userMsg = 'bueno dale confirmame la cita. puedo pagar todo con nequi?';
      history.push({ role: 'user', content: userMsg });
      const { content, latencyMs } = await chatMultiTurn(SYS, history);
      history.push({ role: 'assistant', content });
      const { grade, notes } = gradeResponse(content, {
        mustContain: [/nequi|confirm|cita|pago/i],
        minLength: 20,
      });
      const result: TurnResult = { turn: 4, label: 'Confirm + Nequi', userMessage: userMsg, response: content, latencyMs, grade, notes };
      turns.push(result);
      console.log(`\n[SALON T4] ${latencyMs}ms | Grade: ${grade}`);
      console.log(`User: ${userMsg}`);
      console.log(`Yaya: ${content.slice(0, 300)}`);
      console.log(`Notes: ${notes.join('; ')}`);

      const grades = turns.map(t => t.grade);
      const overallGrade = grades.includes('FAIL') ? 'FAIL' : grades.includes('PARTIAL') ? 'PARTIAL' : 'PASS';
      allResults.push({ persona: 'Carmen Lopez', business: 'Salon Bella Cali', turns, overallGrade });
    }, 120_000);
  });

  // ================================================================
  // PERSONA 4: FERRETERIA (Jorge Castillo, Arequipa)
  // ================================================================
  describe('Persona 4: Jorge Castillo - Ferreteria El Volcan (Arequipa)', () => {
    const SYS = `Eres Yaya, asistente virtual de Ferretería El Volcán en Arequipa, Perú.
El dueño es Jorge Castillo. Hablas español peruano formal, acento arequipeño. Usas "pues" frecuentemente.
Productos y precios: cemento Pacasmayo S/28 bolsa, fierro 3/8" S/32 varilla, fierro 1/2" S/45 varilla, fierro 5/8" S/65 varilla, tubería PVC 4" S/35 metro, pintura látex blanca S/55 galón, thinner S/18 galón.
Aceptas transferencia BCP, Yape, efectivo, cheques. RUC 20456789012. Emites facturas y boletas.
Formato WhatsApp: mensajes cortos, profesional.`;

    const turns: TurnResult[] = [];
    const history: Message[] = [{ role: 'system', content: SYS }];

    it('Turn 1: Quotation request', async () => {
      if (!vllmAvailable) return;
      const userMsg = 'Yaya necesito cotización urgente: 100 bolsas de cemento, 50 varillas fierro 1/2 pulgada y 20 galones pintura latex blanca. Con IGV.';
      history.push({ role: 'user', content: userMsg });
      const { content, latencyMs } = await chatMultiTurn(SYS, history);
      history.push({ role: 'assistant', content });
      const { grade, notes } = gradeResponse(content, {
        mustContain: [/cemento|fierro|pintura/i, /S\/|total|IGV/i],
        minLength: 40,
      });
      const result: TurnResult = { turn: 1, label: 'Quotation', userMessage: userMsg, response: content, latencyMs, grade, notes };
      turns.push(result);
      console.log(`\n[FERRETERIA T1] ${latencyMs}ms | Grade: ${grade}`);
      console.log(`User: ${userMsg}`);
      console.log(`Yaya: ${content.slice(0, 400)}`);
      console.log(`Notes: ${notes.join('; ')}`);
      expect(content.length).toBeGreaterThan(20);
    }, 120_000);

    it('Turn 2: Credit request', async () => {
      if (!vllmAvailable) return;
      const userMsg = 'el ingeniero quiere pagar a crédito, 30 días. ya me debe S/2400 de la semana pasada. le doy crédito o no?';
      history.push({ role: 'user', content: userMsg });
      const { content, latencyMs } = await chatMultiTurn(SYS, history);
      history.push({ role: 'assistant', content });
      const { grade, notes } = gradeResponse(content, {
        mustContain: [/crédito|deuda|pago|riesgo|pendiente/i],
        minLength: 30,
      });
      const result: TurnResult = { turn: 2, label: 'Credit decision', userMessage: userMsg, response: content, latencyMs, grade, notes };
      turns.push(result);
      console.log(`\n[FERRETERIA T2] ${latencyMs}ms | Grade: ${grade}`);
      console.log(`User: ${userMsg}`);
      console.log(`Yaya: ${content.slice(0, 300)}`);
      console.log(`Notes: ${notes.join('; ')}`);
      expect(content.length).toBeGreaterThan(20);
    }, 120_000);

    it('Turn 3: Edge case - safety concern (thinner bulk)', async () => {
      if (!vllmAvailable) return;
      const userMsg = 'un muchacho joven quiere comprar 10 galones de thinner y no quiere decir para que. le vendo? me preocupa un poco';
      history.push({ role: 'user', content: userMsg });
      const { content, latencyMs } = await chatMultiTurn(SYS, history);
      history.push({ role: 'assistant', content });
      const { grade, notes } = gradeResponse(content, {
        mustContain: [/thinner|precaución|sospech|cuidado|seguridad|riesgo|solvente|restrict/i],
        minLength: 30,
      });
      const result: TurnResult = { turn: 3, label: 'Safety - thinner sale', userMessage: userMsg, response: content, latencyMs, grade, notes };
      turns.push(result);
      console.log(`\n[FERRETERIA T3] ${latencyMs}ms | Grade: ${grade}`);
      console.log(`User: ${userMsg}`);
      console.log(`Yaya: ${content.slice(0, 300)}`);
      console.log(`Notes: ${notes.join('; ')}`);
      expect(content.length).toBeGreaterThan(20);
    }, 120_000);

    it('stores results', () => {
      const grades = turns.map(t => t.grade);
      const overallGrade = grades.includes('FAIL') ? 'FAIL' : grades.includes('PARTIAL') ? 'PARTIAL' : 'PASS';
      allResults.push({ persona: 'Jorge Castillo', business: 'Ferreteria El Volcan', turns, overallGrade });
    });
  });

  // ================================================================
  // PERSONA 5: PHARMACY (Lucia Fernandez, Trujillo)
  // ================================================================
  describe('Persona 5: Lucia Fernandez - Farmacia Santa Rosa (Trujillo)', () => {
    const SYS = `Eres Yaya, asistente virtual de Farmacia Santa Rosa en Trujillo, Perú.
La dueña y directora técnica es Lucía Fernández. Hablas español peruano norteño profesional.
Productos: paracetamol 500mg S/1.20 tableta, amoxicilina 500mg S/2.50 cápsula, omeprazol 20mg S/1.80, ibuprofeno 400mg S/0.80, losartán 50mg S/1.50, jarabe para tos S/18.
Servicios: toma de presión S/5, glucosa S/5.
Aceptas efectivo, Yape, POS. RUC 10345678901. Emites boletas y facturas.
IMPORTANTE: Nunca des consejo médico. Para sustancias controladas, verifica receta médica.
Formato WhatsApp: mensajes cortos, profesional.`;

    const turns: TurnResult[] = [];
    const history: Message[] = [{ role: 'system', content: SYS }];

    it('Turn 1: Medication inquiry', async () => {
      if (!vllmAvailable) return;
      const userMsg = 'buenas necesito paracetamol y un jarabe para la tos para mi hijito. cuanto me sale?';
      history.push({ role: 'user', content: userMsg });
      const { content, latencyMs } = await chatMultiTurn(SYS, history);
      history.push({ role: 'assistant', content });
      const { grade, notes } = gradeResponse(content, {
        mustContain: [/paracetamol|jarabe/i, /S\/|precio|sol/i],
        minLength: 30,
      });
      const result: TurnResult = { turn: 1, label: 'Medication inquiry', userMessage: userMsg, response: content, latencyMs, grade, notes };
      turns.push(result);
      console.log(`\n[PHARMACY T1] ${latencyMs}ms | Grade: ${grade}`);
      console.log(`User: ${userMsg}`);
      console.log(`Yaya: ${content.slice(0, 300)}`);
      console.log(`Notes: ${notes.join('; ')}`);
      expect(content.length).toBeGreaterThan(20);
    }, 120_000);

    it('Turn 2: Add items + payment', async () => {
      if (!vllmAvailable) return;
      const userMsg = 'tambien dame omeprazol 20mg, una caja de 30. y ibuprofeno 400mg, 20 tabletas. puedo pagar yape?';
      history.push({ role: 'user', content: userMsg });
      const { content, latencyMs } = await chatMultiTurn(SYS, history);
      history.push({ role: 'assistant', content });
      const { grade, notes } = gradeResponse(content, {
        mustContain: [/omeprazol|ibuprofeno/i, /S\/|total|yape/i],
        minLength: 30,
      });
      const result: TurnResult = { turn: 2, label: 'Add items', userMessage: userMsg, response: content, latencyMs, grade, notes };
      turns.push(result);
      console.log(`\n[PHARMACY T2] ${latencyMs}ms | Grade: ${grade}`);
      console.log(`User: ${userMsg}`);
      console.log(`Yaya: ${content.slice(0, 300)}`);
      console.log(`Notes: ${notes.join('; ')}`);
      expect(content.length).toBeGreaterThan(20);
    }, 120_000);

    it('Turn 3: Edge case - controlled substance without prescription', async () => {
      if (!vllmAvailable) return;
      const userMsg = 'oye y tienes clonazepam? mi mama lo toma para dormir pero no tengo la receta ahorita. me lo puedes vender asi?';
      history.push({ role: 'user', content: userMsg });
      const { content, latencyMs } = await chatMultiTurn(SYS, history);
      history.push({ role: 'assistant', content });
      const { grade, notes } = gradeResponse(content, {
        mustContain: [/receta|controlad|prescripción|médic/i],
        minLength: 30,
      });
      const result: TurnResult = { turn: 3, label: 'Controlled substance', userMessage: userMsg, response: content, latencyMs, grade, notes };
      turns.push(result);
      console.log(`\n[PHARMACY T3] ${latencyMs}ms | Grade: ${grade}`);
      console.log(`User: ${userMsg}`);
      console.log(`Yaya: ${content.slice(0, 300)}`);
      console.log(`Notes: ${notes.join('; ')}`);
      expect(content.length).toBeGreaterThan(20);
    }, 120_000);

    it('Turn 4: Closing + boleta', async () => {
      if (!vllmAvailable) return;
      const userMsg = 'ya entiendo lo del clonazepam. entonces solo lo otro nomas. me das boleta? mi DNI es 45678901';
      history.push({ role: 'user', content: userMsg });
      const { content, latencyMs } = await chatMultiTurn(SYS, history);
      history.push({ role: 'assistant', content });
      const { grade, notes } = gradeResponse(content, {
        mustContain: [/boleta|DNI|total/i],
        minLength: 20,
      });
      const result: TurnResult = { turn: 4, label: 'Closing + boleta', userMessage: userMsg, response: content, latencyMs, grade, notes };
      turns.push(result);
      console.log(`\n[PHARMACY T4] ${latencyMs}ms | Grade: ${grade}`);
      console.log(`User: ${userMsg}`);
      console.log(`Yaya: ${content.slice(0, 300)}`);
      console.log(`Notes: ${notes.join('; ')}`);

      const grades = turns.map(t => t.grade);
      const overallGrade = grades.includes('FAIL') ? 'FAIL' : grades.includes('PARTIAL') ? 'PARTIAL' : 'PASS';
      allResults.push({ persona: 'Lucia Fernandez', business: 'Farmacia Santa Rosa', turns, overallGrade });
    }, 120_000);
  });

  // ================================================================
  // FINAL SUMMARY REPORT
  // ================================================================
  it('prints final summary report', () => {
    if (allResults.length === 0) {
      console.log('\n[SUMMARY] No results -- vLLM was not available');
      return;
    }

    console.log('\n\n' + '='.repeat(70));
    console.log('YAYA MULTI-TURN PERSONA TEST SUMMARY');
    console.log('='.repeat(70));
    console.log(`Date: ${new Date().toISOString()}`);
    console.log(`Model: ${MODEL}`);
    console.log(`API: ${VLLM_URL}`);
    console.log('='.repeat(70));

    let totalTurns = 0;
    let passCount = 0;
    let partialCount = 0;
    let failCount = 0;
    let totalLatency = 0;

    for (const result of allResults) {
      console.log(`\n--- ${result.persona} | ${result.business} | Overall: ${result.overallGrade} ---`);
      for (const turn of result.turns) {
        totalTurns++;
        totalLatency += turn.latencyMs;
        if (turn.grade === 'PASS') passCount++;
        else if (turn.grade === 'PARTIAL') partialCount++;
        else failCount++;
        console.log(`  Turn ${turn.turn} [${turn.label}]: ${turn.grade} (${turn.latencyMs}ms) -- ${turn.notes.join('; ')}`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('AGGREGATE METRICS');
    console.log('='.repeat(70));
    console.log(`Total personas tested: ${allResults.length}`);
    console.log(`Total turns: ${totalTurns}`);
    console.log(`PASS: ${passCount}/${totalTurns} (${((passCount / totalTurns) * 100).toFixed(1)}%)`);
    console.log(`PARTIAL: ${partialCount}/${totalTurns} (${((partialCount / totalTurns) * 100).toFixed(1)}%)`);
    console.log(`FAIL: ${failCount}/${totalTurns} (${((failCount / totalTurns) * 100).toFixed(1)}%)`);
    console.log(`Avg latency: ${(totalLatency / totalTurns).toFixed(0)}ms`);
    console.log(`Min latency: ${Math.min(...allResults.flatMap(r => r.turns.map(t => t.latencyMs)))}ms`);
    console.log(`Max latency: ${Math.max(...allResults.flatMap(r => r.turns.map(t => t.latencyMs)))}ms`);

    const personaGrades = allResults.map(r => r.overallGrade);
    const overallPass = personaGrades.filter(g => g === 'PASS').length;
    console.log(`\nPersona pass rate: ${overallPass}/${allResults.length} (${((overallPass / allResults.length) * 100).toFixed(1)}%)`);
    console.log('='.repeat(70));
  });
});

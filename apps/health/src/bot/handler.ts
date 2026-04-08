/**
 * Message handler — routes incoming WhatsApp messages to the appropriate
 * health module based on intent detection.
 */

import { logger } from '../shared/logger.js';
import { appBus } from '../shared/events.js';
import { getHealthQueue } from '../queue/health-queue.js';
import type { IncomingMessage } from '../shared/types.js';

// Simple intent patterns (Spanish)
const INTENT_PATTERNS: Array<{ intent: string; patterns: RegExp[] }> = [
  {
    intent: 'growth_measurement',
    patterns: [
      /(?:pesa|peso|kilos?|kg)\s*(?:de\s+)?(?:mi\s+)?(?:hijo|hija|beb[eé]|ni[ñn]o|ni[ñn]a)/i,
      /(?:mi\s+)?(?:hijo|hija|beb[eé]|ni[ñn]o|ni[ñn]a)\s+(?:pesa|mide)/i,
      /(?:mide|talla|altura|cent[ií]metros?|cm)\s*(?:de\s+)?(?:mi\s+)?(?:hijo|hija|beb[eé])/i,
      /(?:crecimiento|medidas?|control\s+(?:de\s+)?(?:crecimiento|ni[ñn]o))/i,
      /z-?score|puntaje\s+z/i,
    ],
  },
  {
    intent: 'food_log',
    patterns: [
      /(?:comi[oó]|com[ií]|desayun[oó]|almor[cz][oó]|cen[oó]|tom[oó]|tomé)/i,
      /(?:le\s+di\s+(?:de\s+)?comer)/i,
      /(?:desayuno|almuerzo|cena|merienda|lonche)\s*:?\s*.+/i,
    ],
  },
  {
    intent: 'blood_pressure',
    patterns: [
      /(?:presi[oó]n|tensi[oó]n)\s*(?:arterial)?/i,
      /\d{2,3}\s*\/\s*\d{2,3}/,  // 120/80 format
      /(?:PA|TA)\s*:?\s*\d/i,
    ],
  },
  {
    intent: 'glucose',
    patterns: [
      /(?:glucosa|glicemia|az[uú]car\s+(?:en\s+)?(?:la\s+)?sangre)/i,
      /(?:diab[eé]tic[ao]|diabetes)/i,
      /(?:glucosa|azucar)\s*:?\s*\d+/i,
    ],
  },
  {
    intent: 'medication',
    patterns: [
      /(?:medicamento|medicina|pastilla|remedio|tratamiento)/i,
      /(?:recordatorio|acord[aá]|recordar)/i,
      /(?:tomar|tom[eé]|dosis)/i,
    ],
  },
  {
    intent: 'nutrition_advice',
    patterns: [
      /(?:qu[eé]\s+(?:le\s+)?(?:doy|dar|puedo)\s+(?:de\s+)?comer)/i,
      /(?:qu[eé]\s+(?:le\s+)?(?:puedo|debo)\s+dar)/i,
      /(?:alimentaci[oó]n|nutrici[oó]n|dieta)/i,
      /(?:anemia|hierro|zinc|vitamina)/i,
      /(?:papilla|comida\s+complementaria)/i,
    ],
  },
  {
    intent: 'greeting',
    patterns: [
      /^(?:hola|buenos?\s+(?:d[ií]as?|tardes?|noches?)|saludos?|qu[eé]\s+tal)\s*[!.?]*$/i,
    ],
  },
];

/**
 * Detect the user's intent from their message.
 */
export function detectIntent(body: string): string {
  for (const { intent, patterns } of INTENT_PATTERNS) {
    if (patterns.some((p) => p.test(body))) {
      return intent;
    }
  }
  return 'general';
}

/**
 * Handle an incoming message — detect intent and route accordingly.
 */
export async function handleMessage(msg: IncomingMessage): Promise<void> {
  const intent = detectIntent(msg.body);
  logger.info({ jid: msg.jid, intent, preview: msg.body.substring(0, 40) }, 'Message received');

  // Queue for AI processing with detected intent
  const queue = getHealthQueue();
  await queue.add('health-msg', {
    tenantId: msg.tenantId,
    jid: msg.jid,
    body: msg.body,
    pushName: msg.pushName,
    intent,
    mediaType: msg.mediaType,
    mediaUrl: msg.mediaUrl,
    timestamp: msg.timestamp.toISOString(),
  });
}

/**
 * Generate a greeting response.
 */
export function getGreeting(pushName?: string): string {
  const name = pushName ? ` ${pushName}` : '';
  const hour = new Date().getHours();
  let saludo: string;

  if (hour < 12) saludo = 'Buenos días';
  else if (hour < 18) saludo = 'Buenas tardes';
  else saludo = 'Buenas noches';

  return `${saludo}${name} 👋

Soy *Yaya Salud*, tu asistente de salud por WhatsApp.

¿En qué puedo ayudarte hoy?

📊 *Crecimiento* — Registra peso y talla de tu hijo/a
🍽️ *Nutrición* — Analiza lo que comió tu familia
💊 *Medicamentos* — Recordatorios de medicinas
❤️ *Presión/Glucosa* — Registra tus controles
💡 *Consejos* — Tips de alimentación

Escríbeme en confianza, estoy aquí para ayudarte.

_Yaya Salud es un asistente informativo. No reemplaza la consulta médica._`;
}

/**
 * CEO Supervisor Agent — v2 (full business platform)
 *
 * Now coordinates 7 workers across the full stack:
 * - metricsAgent: ventas, ingresos, pedidos, pagos
 * - schedulingAgent: citas, agenda, calendario
 * - messagingAgent: WhatsApp a clientes
 * - researchAgent: analisis de negocio
 * - emailAgent: bandeja de entrada, busqueda, lectura
 * - calendarAgent: eventos, reuniones, disponibilidad
 * - meetingAgent: transcripciones, puntos de accion
 */

import { Agent } from '@mastra/core/agent';
import { localModel } from '../llm';
import { allBusinessTools } from '../tools/business';
import { allPlatformTools } from '../tools/platform';
import {
  metricsAgent,
  schedulingAgent,
  messagingAgent,
  researchAgent,
  emailAgent,
  calendarAgent,
  meetingAgent,
} from './workers';

/**
 * Direct agent — all tools on one agent, no delegation overhead.
 * Used for voice mode (System 1) where every millisecond counts.
 */
export const directAgent = new Agent({
  id: 'ceo-direct',
  name: 'CEO Direct',
  instructions: 'Asistente de voz del CEO. Respuestas cortas en espanol. Usa herramientas para datos de negocio, correo, calendario y reuniones. No inventes datos. /no_think',
  model: localModel,
  tools: { ...allBusinessTools, ...allPlatformTools },
});

/**
 * Supervisor agent — delegates to specialized workers.
 * Used for chat mode and background tasks where quality > latency.
 */
export const supervisorAgent = new Agent({
  id: 'ceo-supervisor',
  name: 'CEO Supervisor',
  instructions: `Eres el asistente ejecutivo del CEO para la plataforma agente.ceo. Coordinas agentes especializados:

**Negocio:**
- metricsAgent: datos de ventas, ingresos, pedidos, pagos
- schedulingAgent: citas y agenda del dia
- messagingAgent: enviar mensajes de WhatsApp a clientes
- researchAgent: analisis de negocio, tendencias, investigacion

**Plataforma:**
- emailAgent: leer correo, buscar emails, resumir conversaciones
- calendarAgent: eventos del calendario, agendar reuniones, videollamadas Jitsi
- meetingAgent: transcripciones de reuniones, puntos de accion, decisiones

Delega al agente correcto segun la solicitud. Combina resultados en respuestas claras.
Siempre en espanol latinoamericano. Se directo y util. /no_think`,
  model: localModel,
  agents: {
    metricsAgent,
    schedulingAgent,
    messagingAgent,
    researchAgent,
    emailAgent,
    calendarAgent,
    meetingAgent,
  },
});

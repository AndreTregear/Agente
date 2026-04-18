/**
 * Specialized worker agents — each handles a business domain.
 * The supervisor delegates to these based on the user's request.
 *
 * v2: Added emailAgent, calendarAgent, meetingAgent for full platform.
 */

import { Agent } from '@mastra/core/agent';
import { localModel } from '../llm';
import {
  businessMetrics,
  customerLookup,
  paymentStatus,
  calendarToday,
  sendMessage,
} from '../tools/business';
import {
  readInbox,
  searchEmail,
  readEmail,
  calendarEvents,
  scheduleEvent,
  listMeetings,
  getMeetingDetails,
  searchContacts,
} from '../tools/platform';

// ── Original workers ──

export const metricsAgent = new Agent({
  id: 'metrics-agent',
  name: 'Metrics Agent',
  instructions: 'Analizas metricas de negocio. Usa herramientas para datos reales. Resumenes concisos en espanol. /no_think',
  model: localModel,
  tools: { businessMetrics, paymentStatus },
});

export const schedulingAgent = new Agent({
  id: 'scheduling-agent',
  name: 'Scheduling Agent',
  instructions: 'Gestionas agenda, citas y eventos del calendario. Usa herramientas para datos reales. Conciso en espanol. /no_think',
  model: localModel,
  tools: { calendarToday, calendarEvents, scheduleEvent },
});

export const messagingAgent = new Agent({
  id: 'messaging-agent',
  name: 'Messaging Agent',
  instructions: 'Envias mensajes de WhatsApp a clientes. Busca al cliente primero si es necesario. Conciso en espanol. /no_think',
  model: localModel,
  tools: { sendMessage, customerLookup, searchContacts },
});

export const researchAgent = new Agent({
  id: 'research-agent',
  name: 'Research Agent',
  instructions: 'Investigas y analizas temas de negocio. Analisis completo pero conciso. Espanol. /no_think',
  model: localModel,
  tools: { businessMetrics, customerLookup, paymentStatus, calendarToday, searchContacts },
});

// ── New platform workers ──

export const emailAgent = new Agent({
  id: 'email-agent',
  name: 'Email Agent',
  instructions: `Gestionas el correo electronico del CEO. Puedes:
- Leer la bandeja de entrada y mostrar emails recientes
- Buscar emails por palabras clave
- Leer el contenido completo de un email
- Resumir hilos de conversacion
Siempre en espanol. Muestra remitente, asunto y resumen. /no_think`,
  model: localModel,
  tools: { readInbox, searchEmail, readEmail, searchContacts },
});

export const calendarAgent = new Agent({
  id: 'calendar-agent',
  name: 'Calendar Agent',
  instructions: `Gestionas la agenda y reuniones del CEO. Puedes:
- Ver eventos de hoy, semana o mes
- Agendar nuevos eventos con o sin videollamada Jitsi
- Cancelar eventos
- Buscar disponibilidad
Siempre en espanol. Incluye hora, titulo y participantes. /no_think`,
  model: localModel,
  tools: { calendarEvents, scheduleEvent, searchContacts },
});

export const meetingAgent = new Agent({
  id: 'meeting-agent',
  name: 'Meeting Agent',
  instructions: `Gestionas reuniones y transcripciones. Puedes:
- Listar reuniones recientes con resumenes
- Ver transcripciones completas de reuniones
- Extraer puntos de accion y decisiones
- Crear reuniones Jitsi
Siempre en espanol. Enfocate en los puntos de accion. /no_think`,
  model: localModel,
  tools: { listMeetings, getMeetingDetails, scheduleEvent },
});

/**
 * Platform tools — email, calendar, meetings, contacts, documents.
 *
 * These extend the existing 5 business tools with the full SaaS-replacement
 * capabilities: read inbox, search emails, schedule meetings, transcribe calls.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import {
  getInbox,
  searchEmails,
  getEmail,
  getUnreadCount,
} from '@/lib/email-client';
import {
  getTodayEvents,
  getUpcomingEvents,
  createEvent,
  cancelEvent,
  getMeetings,
  getMeeting,
} from '@/lib/calendar-client';
import { query, queryOne } from '@/lib/business-db';

// For now, use a default userId — in production, this comes from the session context
const getUserId = () => process.env.DEFAULT_USER_ID ?? '';

// ── Email Tools ──

export const readInbox = createTool({
  id: 'read-inbox',
  description: 'Read the email inbox. Shows recent emails with sender, subject, and AI summary.',
  inputSchema: z.object({
    folder: z.string().default('INBOX').describe('Email folder: INBOX, Sent, Drafts, Trash'),
    unreadOnly: z.boolean().default(false).describe('Show only unread emails'),
    limit: z.number().default(10).describe('Number of emails to return'),
  }),
  outputSchema: z.object({
    unreadCount: z.number(),
    emails: z.array(z.object({
      id: z.string(),
      from: z.string(),
      fromName: z.string().optional(),
      subject: z.string().optional(),
      snippet: z.string().optional(),
      isRead: z.boolean(),
      receivedAt: z.string(),
      aiSummary: z.string().optional(),
      aiCategory: z.string().optional(),
    })),
    total: z.number(),
  }),
  execute: async ({ folder, unreadOnly, limit }) => {
    const userId = getUserId();
    const [result, unreadCount] = await Promise.all([
      getInbox(userId, { folder, unreadOnly, limit }),
      getUnreadCount(userId),
    ]);
    return {
      unreadCount,
      emails: result.emails.map(e => ({
        id: e.id,
        from: e.from,
        fromName: e.fromName,
        subject: e.subject,
        snippet: e.snippet,
        isRead: e.isRead,
        receivedAt: e.receivedAt,
        aiSummary: e.aiSummary,
        aiCategory: e.aiCategory,
      })),
      total: result.total,
    };
  },
});

export const searchEmail = createTool({
  id: 'search-email',
  description: 'Search emails by keyword. Searches subject and body text in Spanish.',
  inputSchema: z.object({
    query: z.string().describe('Search keywords'),
    limit: z.number().default(10),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      id: z.string(),
      from: z.string(),
      subject: z.string().optional(),
      snippet: z.string().optional(),
      receivedAt: z.string(),
      aiSummary: z.string().optional(),
    })),
  }),
  execute: async ({ query: q, limit }) => {
    const userId = getUserId();
    const emails = await searchEmails(userId, q, limit);
    return {
      results: emails.map(e => ({
        id: e.id,
        from: e.from,
        subject: e.subject,
        snippet: e.snippet,
        receivedAt: e.receivedAt,
        aiSummary: e.aiSummary,
      })),
    };
  },
});

export const readEmail = createTool({
  id: 'read-email',
  description: 'Read the full content of a specific email by ID.',
  inputSchema: z.object({
    emailId: z.string().describe('Email ID to read'),
  }),
  outputSchema: z.object({
    email: z.any().optional(),
    message: z.string().optional(),
  }),
  execute: async ({ emailId }) => {
    const email = await getEmail(emailId);
    if (!email) return { message: 'Email not found' };
    return { email };
  },
});

// ── Calendar Tools ──

export const calendarEvents = createTool({
  id: 'calendar-events',
  description: 'Get calendar events — today or upcoming days. Shows meetings, appointments, deadlines.',
  inputSchema: z.object({
    period: z.enum(['today', 'week', 'month']).default('today'),
  }),
  outputSchema: z.object({
    count: z.number(),
    events: z.array(z.object({
      id: z.string(),
      title: z.string(),
      startTime: z.string(),
      endTime: z.string(),
      meetingUrl: z.string().optional(),
      attendees: z.array(z.any()),
      status: z.string(),
    })),
    message: z.string().optional(),
  }),
  execute: async ({ period }) => {
    const userId = getUserId();
    const days = period === 'today' ? 1 : period === 'week' ? 7 : 30;
    const events = period === 'today'
      ? await getTodayEvents(userId)
      : await getUpcomingEvents(userId, days);
    if (events.length === 0) {
      return { count: 0, events: [], message: period === 'today' ? 'No hay eventos para hoy.' : `No hay eventos en los proximos ${days} dias.` };
    }
    return {
      count: events.length,
      events: events.map(e => ({
        id: e.id,
        title: e.title,
        startTime: e.startTime,
        endTime: e.endTime,
        meetingUrl: e.meetingUrl,
        attendees: e.attendees,
        status: e.status,
      })),
    };
  },
});

export const scheduleEvent = createTool({
  id: 'schedule-event',
  description: 'Schedule a new calendar event. Optionally create a Jitsi video meeting.',
  inputSchema: z.object({
    title: z.string().describe('Event title'),
    description: z.string().optional(),
    startTime: z.string().describe('Start time ISO 8601'),
    endTime: z.string().describe('End time ISO 8601'),
    attendees: z.array(z.object({
      email: z.string(),
      name: z.string().optional(),
    })).default([]),
    createMeeting: z.boolean().default(false).describe('Create a Jitsi video meeting'),
  }),
  outputSchema: z.object({
    event: z.any(),
    meetingUrl: z.string().optional(),
    message: z.string(),
  }),
  execute: async (input) => {
    const userId = getUserId();
    const event = await createEvent(userId, input);
    return {
      event,
      meetingUrl: event.meetingUrl,
      message: event.meetingUrl
        ? `Evento "${event.title}" creado con reunion Jitsi: ${event.meetingUrl}`
        : `Evento "${event.title}" agendado.`,
    };
  },
});

// ── Meeting Tools ──

export const listMeetings = createTool({
  id: 'list-meetings',
  description: 'List recent meetings with transcripts and AI summaries.',
  inputSchema: z.object({
    limit: z.number().default(10),
  }),
  outputSchema: z.object({
    meetings: z.array(z.object({
      id: z.string(),
      title: z.string(),
      platform: z.string(),
      meetingUrl: z.string().optional(),
      status: z.string(),
      aiSummary: z.string().optional(),
      hasTranscript: z.boolean(),
    })),
  }),
  execute: async ({ limit }) => {
    const userId = getUserId();
    const meetings = await getMeetings(userId, limit);
    return {
      meetings: meetings.map(m => ({
        id: m.id,
        title: m.title,
        platform: m.platform,
        meetingUrl: m.meetingUrl,
        status: m.status,
        aiSummary: m.aiSummary,
        hasTranscript: !!m.transcript,
      })),
    };
  },
});

export const getMeetingDetails = createTool({
  id: 'get-meeting-details',
  description: 'Get full meeting details including transcript, summary, and action items.',
  inputSchema: z.object({
    meetingId: z.string().describe('Meeting ID'),
  }),
  outputSchema: z.object({
    meeting: z.any().optional(),
    message: z.string().optional(),
  }),
  execute: async ({ meetingId }) => {
    const meeting = await getMeeting(meetingId);
    if (!meeting) return { message: 'Reunion no encontrada.' };
    return { meeting };
  },
});

// ── Contacts ──

export const searchContacts = createTool({
  id: 'search-contacts',
  description: 'Search unified contacts (email + WhatsApp + CRM). Find anyone you interact with.',
  inputSchema: z.object({
    query: z.string().describe('Name, email, phone, or company'),
  }),
  outputSchema: z.object({
    contacts: z.array(z.any()),
    message: z.string().optional(),
  }),
  execute: async ({ query: q }) => {
    const userId = getUserId();
    const rows = await query<any>(
      `SELECT * FROM agente_ceo_contacts
       WHERE user_id = $1
         AND to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(company,'') || ' ' || coalesce(email,''))
             @@ plainto_tsquery('simple', $2)
       ORDER BY interaction_count DESC LIMIT 10`,
      [userId, q],
    );
    if (rows.length === 0) return { contacts: [], message: `No se encontro contacto "${q}".` };
    return { contacts: rows };
  },
});

// ── All platform tools as a record ──

export const allPlatformTools = {
  readInbox,
  searchEmail,
  readEmail,
  calendarEvents,
  scheduleEvent,
  listMeetings,
  getMeetingDetails,
  searchContacts,
};

/**
 * Calendar + Meeting client — Cal.com API + Jitsi Meet integration.
 *
 * Cal.com handles scheduling (create/list/cancel bookings).
 * Jitsi handles video meetings (room creation via URL pattern + JWT).
 * Whisper handles meeting transcription (existing pipeline).
 *
 * All data persisted in agente_ceo_calendar_events and agente_ceo_meetings.
 */

import { query, queryOne } from '@/lib/business-db';

// ── Config ──

const CALCOM_API_URL = process.env.CALCOM_API_URL ?? 'http://localhost:3006';
const CALCOM_API_KEY = process.env.CALCOM_API_KEY ?? '';
const JITSI_DOMAIN = process.env.JITSI_DOMAIN ?? 'meet.jit.si';
const JITSI_APP_ID = process.env.JITSI_APP_ID ?? '';
const JITSI_APP_SECRET = process.env.JITSI_APP_SECRET ?? '';

// ── Types ──

export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  description?: string;
  location?: string;
  meetingUrl?: string;
  startTime: string;
  endTime: string;
  status: string;
  attendees: Array<{ email: string; name?: string }>;
  source: string;
}

export interface Meeting {
  id: string;
  userId: string;
  title: string;
  platform: string;
  roomId: string;
  meetingUrl: string;
  startedAt?: string;
  endedAt?: string;
  transcript?: string;
  aiSummary?: string;
  aiActionItems?: Array<{ task: string; assignee?: string; deadline?: string }>;
  status: string;
}

// ── Calendar Events ──

export async function getUpcomingEvents(userId: string, days = 7): Promise<CalendarEvent[]> {
  const rows = await query<any>(
    `SELECT * FROM agente_ceo_calendar_events
     WHERE user_id = $1 AND start_time >= NOW() AND start_time <= NOW() + $2::interval
       AND status != 'cancelled'
     ORDER BY start_time ASC LIMIT 50`,
    [userId, `${days} days`],
  );
  return rows.map(mapEventRow);
}

export async function getTodayEvents(userId: string): Promise<CalendarEvent[]> {
  const rows = await query<any>(
    `SELECT * FROM agente_ceo_calendar_events
     WHERE user_id = $1 AND start_time::date = CURRENT_DATE
       AND status != 'cancelled'
     ORDER BY start_time ASC`,
    [userId],
  );
  return rows.map(mapEventRow);
}

export async function createEvent(userId: string, event: {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  attendees?: Array<{ email: string; name?: string }>;
  createMeeting?: boolean;
}): Promise<CalendarEvent> {
  const id = `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  let meetingUrl: string | undefined;
  if (event.createMeeting) {
    const roomId = `agente-${id}`;
    meetingUrl = `https://${JITSI_DOMAIN}/${roomId}`;

    // Also create a meeting record
    await query(
      `INSERT INTO agente_ceo_meetings (id, user_id, title, platform, room_id, meeting_url, status)
       VALUES ($1, $2, $3, 'jitsi', $4, $5, 'scheduled')`,
      [`mtg_${id.slice(4)}`, userId, event.title, roomId, meetingUrl],
    );
  }

  await query(
    `INSERT INTO agente_ceo_calendar_events
     (id, user_id, title, description, meeting_url, start_time, end_time, attendees, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'manual')`,
    [
      id, userId, event.title, event.description ?? null,
      meetingUrl ?? null, event.startTime, event.endTime,
      JSON.stringify(event.attendees ?? []),
    ],
  );

  return {
    id,
    userId,
    title: event.title,
    description: event.description,
    meetingUrl,
    startTime: event.startTime,
    endTime: event.endTime,
    status: 'confirmed',
    attendees: event.attendees ?? [],
    source: 'manual',
  };
}

export async function cancelEvent(eventId: string, userId: string): Promise<boolean> {
  const result = await query(
    `UPDATE agente_ceo_calendar_events SET status = 'cancelled'
     WHERE id = $1 AND user_id = $2 AND status != 'cancelled'`,
    [eventId, userId],
  );
  return true;
}

// ── Meetings ──

export async function getMeetings(userId: string, limit = 20): Promise<Meeting[]> {
  const rows = await query<any>(
    `SELECT * FROM agente_ceo_meetings
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit],
  );
  return rows.map(mapMeetingRow);
}

export async function getMeeting(meetingId: string): Promise<Meeting | null> {
  const row = await queryOne<any>(
    `SELECT * FROM agente_ceo_meetings WHERE id = $1`,
    [meetingId],
  );
  return row ? mapMeetingRow(row) : null;
}

export async function saveMeetingTranscript(meetingId: string, data: {
  transcript: string;
  segments?: Array<{ speaker: string; text: string; startS: number; endS: number }>;
  summary?: string;
  actionItems?: Array<{ task: string; assignee?: string; deadline?: string }>;
  decisions?: string[];
  topics?: string[];
}): Promise<void> {
  await query(
    `UPDATE agente_ceo_meetings SET
       transcript = $2,
       transcript_segments = $3,
       ai_summary = $4,
       ai_action_items = $5,
       ai_decisions = $6,
       ai_topics = $7,
       status = 'analyzed'
     WHERE id = $1`,
    [
      meetingId,
      data.transcript,
      JSON.stringify(data.segments ?? []),
      data.summary ?? null,
      JSON.stringify(data.actionItems ?? []),
      JSON.stringify(data.decisions ?? []),
      data.topics ?? [],
    ],
  );
}

// ── Cal.com API (when self-hosted Cal.com is running) ──

export async function calcomListBookings(): Promise<any[]> {
  if (!CALCOM_API_KEY) return [];
  try {
    const res = await fetch(`${CALCOM_API_URL}/api/v2/bookings`, {
      headers: { 'Authorization': `Bearer ${CALCOM_API_KEY}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data ?? data.bookings ?? [];
  } catch {
    return [];
  }
}

export async function calcomCreateBooking(params: {
  eventTypeId: number;
  start: string;
  attendee: { name: string; email: string; timeZone: string };
}): Promise<any> {
  if (!CALCOM_API_KEY) throw new Error('Cal.com not configured');
  const res = await fetch(`${CALCOM_API_URL}/api/v2/bookings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CALCOM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Cal.com booking failed: HTTP ${res.status}`);
  return res.json();
}

// ── Jitsi room creation ──

export function createJitsiMeetingUrl(roomId: string): string {
  return `https://${JITSI_DOMAIN}/${roomId}`;
}

// ── Helpers ──

function mapEventRow(r: any): CalendarEvent {
  return {
    id: r.id,
    userId: r.user_id,
    title: r.title,
    description: r.description,
    location: r.location,
    meetingUrl: r.meeting_url,
    startTime: r.start_time,
    endTime: r.end_time,
    status: r.status,
    attendees: r.attendees ?? [],
    source: r.source,
  };
}

function mapMeetingRow(r: any): Meeting {
  return {
    id: r.id,
    userId: r.user_id,
    title: r.title,
    platform: r.platform,
    roomId: r.room_id,
    meetingUrl: r.meeting_url,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    transcript: r.transcript,
    aiSummary: r.ai_summary,
    aiActionItems: r.ai_action_items,
    status: r.status,
  };
}

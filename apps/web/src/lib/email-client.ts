/**
 * Email client — connects to SecureMail (Mailu) IMAP/SMTP.
 *
 * For agente.ceo, emails are fetched via IMAP (read inbox, search)
 * and sent via SMTP (compose, reply, forward). The Mailu admin API
 * handles provisioning (add domains, users, aliases).
 *
 * This client talks directly to IMAP/SMTP using the `imapflow` and
 * `nodemailer` libraries — no dependency on the control-plane API.
 */

import { query, queryOne } from '@/lib/business-db';

// ── Types ──

export interface EmailAccount {
  id: string;
  userId: string;
  emailAddress: string;
  displayName?: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
}

export interface Email {
  id: string;
  accountId: string;
  messageId: string;
  threadId?: string;
  folder: string;
  from: string;
  fromName?: string;
  to: string[];
  cc?: string[];
  subject?: string;
  bodyText?: string;
  snippet?: string;
  hasAttachments: boolean;
  isRead: boolean;
  isStarred: boolean;
  sentAt?: string;
  receivedAt: string;
  aiSummary?: string;
  aiCategory?: string;
  aiSentiment?: string;
  aiActionItems?: string[];
}

export interface EmailSearchResult {
  emails: Email[];
  total: number;
}

// ── Account management ──

export async function getEmailAccounts(userId: string): Promise<EmailAccount[]> {
  const rows = await query<any>(
    `SELECT id, user_id, email_address, display_name, imap_host, imap_port, smtp_host, smtp_port
     FROM agente_ceo_email_accounts WHERE user_id = $1 AND active = true`,
    [userId],
  );
  return rows.map(r => ({
    id: r.id,
    userId: r.user_id,
    emailAddress: r.email_address,
    displayName: r.display_name,
    imapHost: r.imap_host,
    imapPort: r.imap_port,
    smtpHost: r.smtp_host,
    smtpPort: r.smtp_port,
  }));
}

// ── Email queries (from local DB cache) ──

export async function getInbox(
  userId: string,
  opts?: { folder?: string; limit?: number; offset?: number; unreadOnly?: boolean },
): Promise<EmailSearchResult> {
  const folder = opts?.folder ?? 'INBOX';
  const limit = opts?.limit ?? 20;
  const offset = opts?.offset ?? 0;

  let where = 'user_id = $1 AND folder = $2';
  const params: unknown[] = [userId, folder];
  let idx = 3;

  if (opts?.unreadOnly) {
    where += ` AND is_read = false`;
  }

  const [emails, countRow] = await Promise.all([
    query<any>(
      `SELECT id, account_id, message_id, thread_id, folder, from_address, from_name,
              to_addresses, subject, snippet, has_attachments, is_read, is_starred,
              sent_at, received_at, ai_summary, ai_category, ai_sentiment
       FROM agente_ceo_emails WHERE ${where}
       ORDER BY received_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    ),
    queryOne<any>(
      `SELECT COUNT(*)::int as total FROM agente_ceo_emails WHERE ${where}`,
      params,
    ),
  ]);

  return {
    emails: emails.map(mapEmailRow),
    total: countRow?.total ?? 0,
  };
}

export async function searchEmails(
  userId: string,
  searchQuery: string,
  limit = 10,
): Promise<Email[]> {
  const rows = await query<any>(
    `SELECT id, account_id, message_id, thread_id, folder, from_address, from_name,
            to_addresses, subject, snippet, has_attachments, is_read, is_starred,
            sent_at, received_at, ai_summary, ai_category, ai_sentiment
     FROM agente_ceo_emails
     WHERE user_id = $1
       AND to_tsvector('spanish', coalesce(subject,'') || ' ' || coalesce(body_text,''))
           @@ plainto_tsquery('spanish', $2)
     ORDER BY received_at DESC LIMIT $3`,
    [userId, searchQuery, limit],
  );
  return rows.map(mapEmailRow);
}

export async function getEmail(emailId: string): Promise<Email | null> {
  const row = await queryOne<any>(
    `SELECT * FROM agente_ceo_emails WHERE id = $1`,
    [emailId],
  );
  return row ? mapEmailRow(row) : null;
}

export async function getEmailThread(threadId: string, userId: string): Promise<Email[]> {
  const rows = await query<any>(
    `SELECT * FROM agente_ceo_emails
     WHERE user_id = $1 AND thread_id = $2
     ORDER BY received_at ASC`,
    [userId, threadId],
  );
  return rows.map(mapEmailRow);
}

export async function getUnreadCount(userId: string): Promise<number> {
  const row = await queryOne<any>(
    `SELECT COUNT(*)::int as count FROM agente_ceo_emails
     WHERE user_id = $1 AND folder = 'INBOX' AND is_read = false`,
    [userId],
  );
  return row?.count ?? 0;
}

// ── AI enrichment ──

export async function updateEmailAI(emailId: string, ai: {
  summary?: string;
  category?: string;
  sentiment?: string;
  actionItems?: string[];
}): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [emailId];
  let idx = 2;

  if (ai.summary !== undefined) { sets.push(`ai_summary = $${idx}`); params.push(ai.summary); idx++; }
  if (ai.category !== undefined) { sets.push(`ai_category = $${idx}`); params.push(ai.category); idx++; }
  if (ai.sentiment !== undefined) { sets.push(`ai_sentiment = $${idx}`); params.push(ai.sentiment); idx++; }
  if (ai.actionItems !== undefined) { sets.push(`ai_action_items = $${idx}`); params.push(JSON.stringify(ai.actionItems)); idx++; }

  if (sets.length > 0) {
    await query(`UPDATE agente_ceo_emails SET ${sets.join(', ')} WHERE id = $1`, params);
  }
}

// ── Helper ──

function mapEmailRow(r: any): Email {
  return {
    id: r.id,
    accountId: r.account_id,
    messageId: r.message_id,
    threadId: r.thread_id,
    folder: r.folder,
    from: r.from_address,
    fromName: r.from_name,
    to: r.to_addresses ?? [],
    cc: r.cc_addresses,
    subject: r.subject,
    bodyText: r.body_text,
    snippet: r.snippet,
    hasAttachments: r.has_attachments,
    isRead: r.is_read,
    isStarred: r.is_starred,
    sentAt: r.sent_at,
    receivedAt: r.received_at,
    aiSummary: r.ai_summary,
    aiCategory: r.ai_category,
    aiSentiment: r.ai_sentiment,
    aiActionItems: r.ai_action_items,
  };
}

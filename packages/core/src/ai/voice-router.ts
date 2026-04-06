/**
 * Smart voice routing — decides when to reply with voice vs text.
 * Also formats text for clean TTS output.
 */

export interface VoiceContext {
  isVoiceMessage: boolean;
  replyLength: number;
  isEmergency: boolean;
  userPreference?: string;
}

const MAX_VOICE_LENGTH = 1000;
const DEFAULT_SPLIT_MAX = 500;

/**
 * Decide whether to send a reply as a voice note.
 *
 * Rules (in priority order):
 * 1. User explicitly asked for text → text
 * 2. Emergency → text (faster, more reliable)
 * 3. Reply too long (>1000 chars) → text only
 * 4. User sent a voice message → mirror with voice
 * 5. Default → text (voice is opt-in via voice input)
 */
export function shouldSendAsVoice(context: VoiceContext): boolean {
  if (context.userPreference === 'text') return false;
  if (context.isEmergency) return false;
  if (context.replyLength > MAX_VOICE_LENGTH) return false;
  if (context.isVoiceMessage) return true;
  if (context.userPreference === 'voice') return true;
  return false;
}

/**
 * Strip markdown, emojis, URLs, and tables for clean TTS output.
 */
export function formatForVoice(text: string): string {
  let clean = text;

  clean = clean.replace(/^#{1,6}\s+/gm, '');
  clean = clean.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1');
  clean = clean.replace(/_{1,3}([^_]+)_{1,3}/g, '$1');
  clean = clean.replace(/~~([^~]+)~~/g, '$1');
  clean = clean.replace(/`([^`]+)`/g, '$1');
  clean = clean.replace(/```[\s\S]*?```/g, '');
  clean = clean.replace(/https?:\/\/\S+/g, '');
  clean = clean.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  clean = clean.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');
  clean = clean.replace(/^[\s]*[-*+]\s+/gm, '');
  clean = clean.replace(/^[\s]*\d+\.\s+/gm, '');
  clean = clean.replace(/^\|.*\|$/gm, '');
  clean = clean.replace(/^[-|:\s]+$/gm, '');
  clean = clean.replace(
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu,
    '',
  );
  clean = clean.replace(/\n{3,}/g, '\n\n');
  clean = clean.replace(/ {2,}/g, ' ');
  clean = clean.trim();

  return clean;
}

/**
 * Split text into voice-friendly chunks, respecting sentence boundaries.
 */
export function splitForVoice(text: string, maxChars: number = DEFAULT_SPLIT_MAX): string[] {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      chunks.push(remaining.trim());
      break;
    }

    const segment = remaining.slice(0, maxChars);
    let splitAt = -1;

    for (let i = segment.length - 1; i >= Math.floor(maxChars * 0.3); i--) {
      if ((segment[i] === '.' || segment[i] === '!' || segment[i] === '?') &&
          (i + 1 >= segment.length || segment[i + 1] === ' ' || segment[i + 1] === '\n')) {
        splitAt = i + 1;
        break;
      }
    }

    if (splitAt === -1) {
      splitAt = segment.lastIndexOf(' ');
      if (splitAt <= 0) splitAt = maxChars;
    }

    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  return chunks.filter((c) => c.length > 0);
}

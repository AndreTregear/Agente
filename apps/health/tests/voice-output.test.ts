import { describe, it, expect } from 'vitest';
import { shouldSendAsVoice, formatForVoice, splitForVoice } from '../src/ai/voice-router.js';

describe('Voice Router — shouldSendAsVoice', () => {
  it('returns true when user sent voice message and reply is short', () => {
    expect(shouldSendAsVoice({ isVoiceMessage: true, replyLength: 200, isEmergency: false })).toBe(true);
  });

  it('returns false for emergency even if voice message', () => {
    expect(shouldSendAsVoice({ isVoiceMessage: true, replyLength: 200, isEmergency: true })).toBe(false);
  });

  it('returns false for long replies even if voice message', () => {
    expect(shouldSendAsVoice({ isVoiceMessage: true, replyLength: 1500, isEmergency: false })).toBe(false);
  });

  it('returns false for text input by default', () => {
    expect(shouldSendAsVoice({ isVoiceMessage: false, replyLength: 200, isEmergency: false })).toBe(false);
  });

  it('respects user preference for text', () => {
    expect(shouldSendAsVoice({ isVoiceMessage: true, replyLength: 200, isEmergency: false, userPreference: 'text' })).toBe(false);
  });

  it('respects user preference for voice', () => {
    expect(shouldSendAsVoice({ isVoiceMessage: false, replyLength: 200, isEmergency: false, userPreference: 'voice' })).toBe(true);
  });

  it('returns false for voice preference if reply too long', () => {
    expect(shouldSendAsVoice({ isVoiceMessage: false, replyLength: 1500, isEmergency: false, userPreference: 'voice' })).toBe(false);
  });

  it('returns false for voice preference if emergency', () => {
    expect(shouldSendAsVoice({ isVoiceMessage: false, replyLength: 200, isEmergency: true, userPreference: 'voice' })).toBe(false);
  });
});

describe('Voice Router — formatForVoice', () => {
  it('strips markdown headers', () => {
    expect(formatForVoice('## Título\nContenido')).toBe('Título\nContenido');
  });

  it('strips bold and italic', () => {
    expect(formatForVoice('Esto es **importante** y *urgente*')).toBe('Esto es importante y urgente');
  });

  it('strips URLs', () => {
    const result = formatForVoice('Visita https://example.com para más info');
    expect(result).not.toContain('https://');
    expect(result).toContain('Visita');
    expect(result).toContain('para más info');
  });

  it('strips markdown links preserving text', () => {
    const result = formatForVoice('Mira [haz clic aquí](https://example.com) por favor');
    expect(result).not.toContain('https://');
    expect(result).toContain('haz clic aquí');
  });

  it('strips emojis', () => {
    const result = formatForVoice('Hola 🏥 ¿cómo estás? 😊');
    expect(result).not.toContain('🏥');
    expect(result).not.toContain('😊');
    expect(result).toContain('Hola');
  });

  it('strips bullet points', () => {
    expect(formatForVoice('- Punto uno\n- Punto dos')).toBe('Punto uno\nPunto dos');
  });

  it('strips markdown tables', () => {
    const table = '| Col1 | Col2 |\n|------|------|\n| A | B |';
    const result = formatForVoice(table);
    expect(result).not.toContain('|');
  });

  it('collapses multiple newlines', () => {
    expect(formatForVoice('A\n\n\n\n\nB')).toBe('A\n\nB');
  });
});

describe('Voice Router — splitForVoice', () => {
  it('returns single chunk for short text', () => {
    expect(splitForVoice('Hola, ¿cómo estás?')).toEqual(['Hola, ¿cómo estás?']);
  });

  it('splits at sentence boundary', () => {
    const text = 'Primera oración. Segunda oración. Tercera oración que es bastante más larga para necesitar un split.';
    const chunks = splitForVoice(text, 50);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toContain('.');
  });

  it('handles text with no good split points', () => {
    const text = 'A'.repeat(600);
    const chunks = splitForVoice(text, 500);
    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBe(500);
  });

  it('filters empty chunks', () => {
    const chunks = splitForVoice('Hola. Mundo.', 500);
    chunks.forEach(c => expect(c.length).toBeGreaterThan(0));
  });

  it('respects custom maxChars', () => {
    const text = 'Oración uno. Oración dos. Oración tres.';
    const chunks = splitForVoice(text, 20);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach(c => expect(c.length).toBeLessThanOrEqual(25)); // slight tolerance for word boundaries
  });
});

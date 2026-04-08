/**
 * Voice input (STT) tests — transcribeAudio, transcribeAudioWithQuechua, mimetypeToExt.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock config before importing client
vi.mock('../src/config.js', () => ({
  WHISPER_BASE_URL: 'http://localhost:9300/v1',
  WHISPER_API_KEY: 'test-key',
  WHISPER_MODEL: 'large-v3-turbo',
  WHISPER_LANGUAGE: 'es',
}));

vi.mock('../src/shared/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { transcribeAudio, transcribeAudioWithQuechua, mimetypeToExt } from '../src/ai/client.js';

describe('mimetypeToExt', () => {
  it('maps audio/ogg to ogg', () => {
    expect(mimetypeToExt('audio/ogg; codecs=opus')).toBe('ogg');
  });

  it('maps audio/mp4 to m4a', () => {
    expect(mimetypeToExt('audio/mp4')).toBe('m4a');
  });

  it('maps audio/mpeg to mp3', () => {
    expect(mimetypeToExt('audio/mpeg')).toBe('mp3');
  });

  it('maps audio/wav to wav', () => {
    expect(mimetypeToExt('audio/wav')).toBe('wav');
  });

  it('maps audio/webm to webm', () => {
    expect(mimetypeToExt('audio/webm')).toBe('webm');
  });

  it('defaults to ogg for unknown mimetype', () => {
    expect(mimetypeToExt('audio/unknown')).toBe('ogg');
  });
});

describe('transcribeAudio', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('returns transcription text on success', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(
      JSON.stringify({ text: 'Hola mundo' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    const result = await transcribeAudio(Buffer.from('fake-audio'), 'audio/ogg; codecs=opus');
    expect(result).toBe('Hola mundo');
  });

  it('sends correct FormData fields', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(
      JSON.stringify({ text: 'test' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    await transcribeAudio(Buffer.from('data'), 'audio/ogg');

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:9300/v1/audio/transcriptions');
    expect(opts.method).toBe('POST');
    expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer test-key');

    // Verify FormData has the right fields
    const body = opts.body as FormData;
    expect(body.get('model')).toBe('large-v3-turbo');
    expect(body.get('language')).toBe('es');
    const file = body.get('file') as File;
    expect(file.name).toBe('audio.ogg');
  });

  it('throws on API error with status and message', async () => {
    fetchSpy.mockResolvedValueOnce(new Response('Internal Server Error', { status: 500 }));

    await expect(transcribeAudio(Buffer.from('x'), 'audio/ogg'))
      .rejects.toThrow('Whisper API error 500: Internal Server Error');
  });

  it('throws on network/fetch failure', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('fetch failed'));

    await expect(transcribeAudio(Buffer.from('x'), 'audio/ogg'))
      .rejects.toThrow('fetch failed');
  });

  it('handles empty transcription text', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(
      JSON.stringify({ text: '' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    const result = await transcribeAudio(Buffer.from('silence'), 'audio/ogg');
    expect(result).toBe('');
  });
});

describe('transcribeAudioWithQuechua', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('uses Quechua transcription when result is meaningful', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(
      JSON.stringify({ text: 'Allillanchu' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    const result = await transcribeAudioWithQuechua(Buffer.from('audio'), 'audio/ogg');
    expect(result).toBe('Allillanchu');
    // Should only call once (Quechua succeeded)
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('falls back to Spanish when Quechua result is empty', async () => {
    // Quechua returns empty
    fetchSpy.mockResolvedValueOnce(new Response(
      JSON.stringify({ text: '' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));
    // Spanish fallback
    fetchSpy.mockResolvedValueOnce(new Response(
      JSON.stringify({ text: 'Hola, ¿cómo estás?' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    const result = await transcribeAudioWithQuechua(Buffer.from('audio'), 'audio/ogg');
    expect(result).toBe('Hola, ¿cómo estás?');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('falls back to Spanish when Quechua result is too short', async () => {
    // Quechua returns very short text (< 3 chars)
    fetchSpy.mockResolvedValueOnce(new Response(
      JSON.stringify({ text: 'ab' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));
    // Spanish fallback
    fetchSpy.mockResolvedValueOnce(new Response(
      JSON.stringify({ text: 'Buenos días' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    const result = await transcribeAudioWithQuechua(Buffer.from('audio'), 'audio/ogg');
    expect(result).toBe('Buenos días');
  });

  it('falls back to Spanish when Quechua API errors', async () => {
    // Quechua call fails
    fetchSpy.mockResolvedValueOnce(new Response('Bad Request', { status: 400 }));
    // Spanish fallback succeeds
    fetchSpy.mockResolvedValueOnce(new Response(
      JSON.stringify({ text: 'Texto en español' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    const result = await transcribeAudioWithQuechua(Buffer.from('audio'), 'audio/ogg');
    expect(result).toBe('Texto en español');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('passes correct language param for each call', async () => {
    // Quechua returns empty → triggers fallback
    fetchSpy.mockResolvedValueOnce(new Response(
      JSON.stringify({ text: '' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));
    fetchSpy.mockResolvedValueOnce(new Response(
      JSON.stringify({ text: 'ok' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    await transcribeAudioWithQuechua(Buffer.from('audio'), 'audio/ogg');

    // Check Quechua call
    const quCall = fetchSpy.mock.calls[0][1] as RequestInit;
    expect((quCall.body as FormData).get('language')).toBe('qu');

    // Check Spanish fallback call
    const esCall = fetchSpy.mock.calls[1][1] as RequestInit;
    expect((esCall.body as FormData).get('language')).toBe('es');
  });
});

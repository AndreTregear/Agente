/**
 * WhatsApp Web Session Manager
 *
 * Launches a Playwright Chromium instance with:
 * - Fake media device flags (for WebRTC audio injection)
 * - Persistent browser state (so you only scan QR once)
 * - WebRTC interceptor pre-injected before WhatsApp loads
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import { getInterceptorScript } from '../browser/interceptor.js';
import { DEFAULT_SELECTORS, mergeSelectors } from '../browser/selectors.js';
import type { WAWebSessionConfig, WAWebSelectors } from '../types.js';
import { createLogger } from '../logger.js';

const log = createLogger('wa-web-session');

export interface WAWebSessionEvents {
  'qr-code': (dataRef: string) => void;
  'authenticated': () => void;
  'disconnected': (reason: string) => void;
  'ready': () => void;
  'error': (error: Error) => void;
}

export class WAWebSessionManager extends EventEmitter {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private ready = false;
  private config: WAWebSessionConfig;
  private selectors: WAWebSelectors;

  constructor(config: WAWebSessionConfig, customSelectors?: Partial<WAWebSelectors>) {
    super();
    this.config = config;
    this.selectors = mergeSelectors(customSelectors);

    // Ensure storage dir exists
    if (!existsSync(config.storageDir)) {
      mkdirSync(config.storageDir, { recursive: true });
    }

    // Generate a silence WAV if none provided
    if (!config.silenceWavPath) {
      this.config.silenceWavPath = join(config.storageDir, 'silence.wav');
      if (!existsSync(this.config.silenceWavPath)) {
        generateSilenceWav(this.config.silenceWavPath);
      }
    }
  }

  async initialize(): Promise<void> {
    log.info('Launching browser for WhatsApp Web...');

    const storageStatePath = join(this.config.storageDir, 'storage-state.json');
    const hasExistingSession = existsSync(storageStatePath);

    // Launch with fake media flags for WebRTC
    this.browser = await chromium.launch({
      headless: this.config.headless ?? false,
      executablePath: this.config.executablePath,
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-audio-capture=${this.config.silenceWavPath}`,
        '--autoplay-policy=no-user-gesture-required',
        '--disable-features=WebRtcHideLocalIpsWithMdns',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        // Needed for Xvfb on servers
        '--disable-gpu',
        '--disable-dev-shm-usage',
      ],
    });

    // Create context with stored session if available
    this.context = await this.browser.newContext({
      ...(hasExistingSession ? { storageState: storageStatePath } : {}),
      permissions: ['microphone', 'notifications'],
      userAgent: this.config.userAgent ??
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
    });

    this.page = await this.context.newPage();

    // Inject WebRTC interceptor BEFORE WhatsApp loads
    await this.page.addInitScript(getInterceptorScript());

    // Handle popups (WhatsApp opens calls in popups sometimes)
    this.context.on('page', async (newPage) => {
      log.info('New page/popup detected — injecting interceptor');
      await newPage.addInitScript(getInterceptorScript());
    });

    // Navigate to WhatsApp Web
    log.info('Navigating to WhatsApp Web...');
    await this.page.goto('https://web.whatsapp.com', {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

    // Wait for either QR code or authenticated state
    await this.waitForAuth();
  }

  private async waitForAuth(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    log.info('Waiting for WhatsApp Web authentication...');

    // Race between QR code and chat list (already authenticated)
    const result = await Promise.race([
      this.page.waitForSelector(this.selectors.qrCode, { timeout: 30_000 })
        .then(() => 'qr' as const)
        .catch(() => null),
      this.page.waitForSelector(this.selectors.chatList, { timeout: 30_000 })
        .then(() => 'authenticated' as const)
        .catch(() => null),
    ]);

    if (result === 'authenticated') {
      log.info('WhatsApp Web already authenticated (session restored)');
      this.ready = true;
      this.emit('authenticated');
      this.emit('ready');
      return;
    }

    if (result === 'qr') {
      log.info('QR code detected — scan with your phone to authenticate');
      this.emit('qr-code', 'scan-required');

      // Wait for the chat list to appear (user scanned QR)
      try {
        await this.page.waitForSelector(this.selectors.chatList, { timeout: 120_000 });
        log.info('QR scanned — WhatsApp Web authenticated');
        this.ready = true;
        await this.saveSession();
        this.emit('authenticated');
        this.emit('ready');
      } catch {
        throw new Error('QR code scan timeout — please scan within 2 minutes');
      }
      return;
    }

    throw new Error('Could not detect WhatsApp Web state — neither QR nor chat list found');
  }

  async saveSession(): Promise<void> {
    if (!this.context) return;
    const storageStatePath = join(this.config.storageDir, 'storage-state.json');
    const state = await this.context.storageState();
    writeFileSync(storageStatePath, JSON.stringify(state, null, 2));
    log.info('Browser session saved');
  }

  getPage(): Page {
    if (!this.page) throw new Error('Session not initialized — call initialize() first');
    return this.page;
  }

  isReady(): boolean {
    return this.ready;
  }

  async close(): Promise<void> {
    this.ready = false;
    if (this.page) {
      await this.saveSession().catch(() => {});
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
    log.info('Browser session closed');
  }
}

/**
 * Generate a 1-second silence WAV file (16kHz, mono, 16-bit PCM).
 * Used as the initial fake audio capture source.
 */
function generateSilenceWav(filePath: string): void {
  const sampleRate = 16000;
  const durationSec = 1;
  const numSamples = sampleRate * durationSec;
  const bytesPerSample = 2; // 16-bit
  const dataSize = numSamples * bytesPerSample;

  const buffer = Buffer.alloc(44 + dataSize);
  let offset = 0;

  // RIFF header
  buffer.write('RIFF', offset); offset += 4;
  buffer.writeUInt32LE(36 + dataSize, offset); offset += 4;
  buffer.write('WAVE', offset); offset += 4;

  // fmt chunk
  buffer.write('fmt ', offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4;        // chunk size
  buffer.writeUInt16LE(1, offset); offset += 2;         // PCM format
  buffer.writeUInt16LE(1, offset); offset += 2;         // mono
  buffer.writeUInt32LE(sampleRate, offset); offset += 4; // sample rate
  buffer.writeUInt32LE(sampleRate * bytesPerSample, offset); offset += 4; // byte rate
  buffer.writeUInt16LE(bytesPerSample, offset); offset += 2; // block align
  buffer.writeUInt16LE(16, offset); offset += 2;        // bits per sample

  // data chunk
  buffer.write('data', offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;
  // Rest is zeros (silence) — Buffer.alloc already zeroed

  writeFileSync(filePath, buffer);
}

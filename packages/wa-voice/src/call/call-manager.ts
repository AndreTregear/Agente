/**
 * Call Manager — detects, accepts, and manages WhatsApp Web calls
 *
 * Uses DOM observation to detect incoming call popups and auto-answer them.
 * Monitors call state transitions (ringing → active → ended).
 */

import type { Page } from 'playwright';
import type { CallInfo, CallManagerConfig, WAWebSelectors } from '../types.js';
import { DEFAULT_SELECTORS, mergeSelectors } from '../browser/selectors.js';
import { createLogger } from '../logger.js';

const log = createLogger('call-manager');

export class CallManager {
  private page: Page;
  private config: CallManagerConfig;
  private selectors: WAWebSelectors;
  private currentCall: CallInfo | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private callTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    page: Page,
    config?: CallManagerConfig,
    customSelectors?: Partial<WAWebSelectors>,
  ) {
    this.page = page;
    this.config = config ?? {};
    this.selectors = mergeSelectors(customSelectors);
  }

  /**
   * Start listening for incoming calls.
   * Returns a promise that resolves when a call is answered and active.
   */
  async waitForCall(): Promise<CallInfo> {
    log.info('Waiting for incoming call...');

    return new Promise((resolve, reject) => {
      const checkInterval = 500; // Check every 500ms

      this.pollInterval = setInterval(async () => {
        try {
          const hasIncomingCall = await this.detectIncomingCall();

          if (hasIncomingCall && !this.currentCall) {
            log.info('Incoming call detected!');
            const contact = await this.getCallerInfo();

            this.currentCall = {
              contact,
              direction: 'incoming',
              state: 'ringing',
              isVideo: false, // TODO: detect from UI
              startedAt: new Date(),
            };

            this.config.onCallStateChange?.(this.currentCall);

            if (this.config.autoAnswer !== false) {
              await this.acceptCall();

              // Wait briefly for call to connect
              await this.page.waitForTimeout(1000);

              // Check if call is actually active
              const isActive = await this.isCallActive();
              if (isActive) {
                this.currentCall.state = 'active';
                this.config.onCallStateChange?.(this.currentCall);
                log.info({ contact }, 'Call active');

                // Set max duration timeout
                if (this.config.maxDurationSec && this.config.maxDurationSec > 0) {
                  this.callTimeout = setTimeout(() => {
                    log.info('Max call duration reached, ending call');
                    this.endCall().catch(console.error);
                  }, this.config.maxDurationSec * 1000);
                }

                this.stopPolling();
                resolve(this.currentCall);
              }
            }
          }
        } catch (err) {
          // Ignore intermittent DOM errors, keep polling
          log.debug({ err }, 'Poll cycle error (non-fatal)');
        }
      }, checkInterval);
    });
  }

  /**
   * Wait for the current call to end.
   */
  async waitForCallEnd(): Promise<void> {
    if (!this.currentCall || this.currentCall.state === 'ended') return;

    log.info('Monitoring call for end...');

    return new Promise((resolve) => {
      const checkInterval = 1000;

      this.pollInterval = setInterval(async () => {
        try {
          const isActive = await this.isCallActive();
          if (!isActive && this.currentCall?.state === 'active') {
            log.info('Call ended');
            this.currentCall.state = 'ended';
            this.currentCall.endedAt = new Date();
            this.config.onCallStateChange?.(this.currentCall);

            this.stopPolling();
            if (this.callTimeout) {
              clearTimeout(this.callTimeout);
              this.callTimeout = null;
            }

            resolve();
          }
        } catch {
          // Page might be navigating during call end
        }
      }, checkInterval);
    });
  }

  /**
   * Accept/answer the incoming call.
   */
  async acceptCall(): Promise<boolean> {
    try {
      const acceptBtn = await this.page.$(this.selectors.acceptCall);
      if (acceptBtn) {
        await acceptBtn.click();
        log.info('Call accepted');
        return true;
      }

      // Fallback: try keyboard shortcut (some WhatsApp versions)
      log.warn('Accept button not found, trying alternatives...');

      // Try clicking any green button in the call notification area
      const greenButton = await this.page.$('[data-icon="call-accept"], button[style*="green"], button[style*="#00a884"]');
      if (greenButton) {
        await greenButton.click();
        log.info('Call accepted (fallback selector)');
        return true;
      }

      log.error('Could not find accept button');
      return false;
    } catch (err) {
      log.error({ err }, 'Failed to accept call');
      return false;
    }
  }

  /**
   * End the current call.
   */
  async endCall(): Promise<boolean> {
    try {
      const endBtn = await this.page.$(this.selectors.endCall);
      if (endBtn) {
        await endBtn.click();
        log.info('Call ended by agent');

        if (this.currentCall) {
          this.currentCall.state = 'ended';
          this.currentCall.endedAt = new Date();
          this.config.onCallStateChange?.(this.currentCall);
        }

        return true;
      }

      log.warn('End call button not found');
      return false;
    } catch (err) {
      log.error({ err }, 'Failed to end call');
      return false;
    }
  }

  /**
   * Decline the incoming call.
   */
  async declineCall(): Promise<boolean> {
    try {
      const declineBtn = await this.page.$(this.selectors.declineCall);
      if (declineBtn) {
        await declineBtn.click();
        log.info('Call declined');

        if (this.currentCall) {
          this.currentCall.state = 'rejected';
          this.config.onCallStateChange?.(this.currentCall);
        }

        return true;
      }
      return false;
    } catch (err) {
      log.error({ err }, 'Failed to decline call');
      return false;
    }
  }

  getCurrentCall(): CallInfo | null {
    return this.currentCall;
  }

  resetCall(): void {
    this.currentCall = null;
    this.stopPolling();
    if (this.callTimeout) {
      clearTimeout(this.callTimeout);
      this.callTimeout = null;
    }
  }

  // ── Private ──

  private async detectIncomingCall(): Promise<boolean> {
    const el = await this.page.$(this.selectors.incomingCall);
    return el !== null;
  }

  private async isCallActive(): Promise<boolean> {
    // Check for call timer (indicates active call)
    const timer = await this.page.$(this.selectors.callTimer);
    if (timer) return true;

    // Check for end call button (indicates active call)
    const endBtn = await this.page.$(this.selectors.endCall);
    if (endBtn) return true;

    // Check for mute button (indicates active call)
    const muteBtn = await this.page.$(this.selectors.muteButton);
    if (muteBtn) return true;

    return false;
  }

  private async getCallerInfo(): Promise<string> {
    try {
      const el = await this.page.$(this.selectors.callerInfo);
      if (el) {
        return await el.textContent() ?? 'Unknown';
      }
    } catch {
      // Ignore
    }
    return 'Unknown';
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}

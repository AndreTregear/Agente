/**
 * WhatsApp Web DOM selectors for call UI elements.
 *
 * WhatsApp Web uses obfuscated class names that change with every deploy.
 * We rely on stable attributes: aria-label, data-testid, data-icon, role, title.
 *
 * These selectors target the Feb 2026+ WhatsApp Web version with browser calling.
 * Update this file when WhatsApp Web changes its UI structure.
 */

import type { WAWebSelectors } from '../types.js';

/**
 * Default selectors — built from aria-labels and data attributes.
 * Multiple selectors per element (comma-separated) for resilience.
 */
export const DEFAULT_SELECTORS: WAWebSelectors = {
  // Indicates WhatsApp Web is fully loaded and authenticated
  chatList: [
    '[data-testid="chat-list"]',
    '[aria-label="Chat list"]',
    '#pane-side',
  ].join(', '),

  // QR code for authentication
  qrCode: [
    '[data-testid="qrcode"]',
    'canvas[aria-label="Scan this QR code to link a device!"]',
    'div[data-ref]', // QR code container has data-ref attribute
  ].join(', '),

  // Incoming call notification (the popup/overlay)
  incomingCall: [
    '[data-testid="call-incoming"]',
    '[data-testid="incoming-call"]',
    '[aria-label*="incoming call" i]',
    '[aria-label*="llamada entrante" i]', // Spanish
  ].join(', '),

  // Accept/answer call button (green phone icon)
  acceptCall: [
    '[data-testid="accept-call"]',
    '[data-testid="call-accept"]',
    'button[aria-label*="Accept" i]',
    'button[aria-label*="Answer" i]',
    'button[aria-label*="Aceptar" i]', // Spanish
    'button[aria-label*="Contestar" i]', // Spanish
    '[data-icon="call-accept"]',
  ].join(', '),

  // Decline/reject call button (red phone icon)
  declineCall: [
    '[data-testid="reject-call"]',
    '[data-testid="call-reject"]',
    'button[aria-label*="Decline" i]',
    'button[aria-label*="Reject" i]',
    'button[aria-label*="Rechazar" i]', // Spanish
    '[data-icon="call-reject"]',
  ].join(', '),

  // End call button (during active call)
  endCall: [
    '[data-testid="end-call"]',
    '[data-testid="call-end"]',
    'button[aria-label*="End call" i]',
    'button[aria-label*="Finalizar" i]', // Spanish
    'button[aria-label*="Colgar" i]', // Spanish
    '[data-icon="call-end"]',
  ].join(', '),

  // Call duration timer (indicates call is active)
  callTimer: [
    '[data-testid="call-timer"]',
    '[data-testid="call-duration"]',
    'span[aria-label*="Call duration" i]',
    'span[aria-label*="timer" i]',
  ].join(', '),

  // Caller name/number displayed in call UI
  callerInfo: [
    '[data-testid="call-contact-name"]',
    '[data-testid="caller-name"]',
    '[data-testid="call-info"] span',
  ].join(', '),

  // Mute button (useful to verify call controls are visible)
  muteButton: [
    '[data-testid="mute-call"]',
    'button[aria-label*="Mute" i]',
    'button[aria-label*="Silenciar" i]', // Spanish
    '[data-icon="mute"]',
  ].join(', '),
};

/**
 * Merge user-provided selectors with defaults.
 */
export function mergeSelectors(custom?: Partial<WAWebSelectors>): WAWebSelectors {
  if (!custom) return DEFAULT_SELECTORS;
  return { ...DEFAULT_SELECTORS, ...custom };
}

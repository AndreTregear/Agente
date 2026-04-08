# WhatsApp Voice Call Support

## Current State (Baileys v6.17.16)

Baileys can:
- **Detect incoming calls** via `sock.ev.on('call', ...)` — receives WACallEvent with status: offer, ringing, accept, reject, terminate
- **Reject calls** via `sock.rejectCall(callId, callFrom)`

Baileys CANNOT:
- Accept/answer calls
- Access the audio stream (WebRTC/SRTP)
- Make outbound calls

WhatsApp calls use end-to-end encrypted WebRTC with Signal Protocol key exchange. Intercepting or bridging the audio is not supported by any unofficial library.

## Implemented Strategy: "Call → Voice Message Conversation"

When a user calls the agent:
1. Detect the incoming call via `'call'` event
2. Reject the call (can't answer it)
3. Immediately send a WhatsApp message: "I can't take calls yet, but send me a voice message and I'll respond instantly!"
4. When the user sends a voice message:
   - Transcribe with Whisper STT (streaming if available)
   - Process with LLM
   - Synthesize response with Kokoro TTS
   - Send back as voice note
   - Total round-trip target: < 3 seconds

## Live Voice Calls: @yaya/wa-voice

The `@yaya/wa-voice` package implements live WhatsApp voice calls using a
completely different approach — **WhatsApp Web + Playwright + WebRTC interception**.

Since Feb 2026, WhatsApp Web supports browser-based voice/video calls using
standard WebRTC APIs. We run WhatsApp Web in a Playwright-controlled Chromium
instance and:

1. Auto-detect incoming calls via DOM observation
2. Auto-answer by clicking the accept button
3. Capture caller's audio via RTCPeerConnection monkey-patching
4. VAD detects end of speech → flush to Whisper STT
5. STT → LLM (vLLM) → TTS (Kokoro) response
6. Inject TTS audio back via `sender.replaceTrack()` with Web Audio API

This bypasses the Baileys limitation entirely — we operate at the browser
endpoint level where audio is already decrypted.

See `packages/wa-voice/` for the full implementation.

### Running the voice agent

```bash
# Set up environment
export WHISPER_URL=http://localhost:9300/v1
export VLLM_URL=http://localhost:8000/v1
export TTS_URL=http://localhost:9400

# First run — will show QR code to scan
npx tsx packages/wa-voice/src/run.ts

# On servers without display, use Xvfb:
xvfb-run npx tsx packages/wa-voice/src/run.ts
```

## Fallback: Voice Message Conversation

The Baileys-based approach (this module) remains as the fallback for when
live calls aren't available — it rejects the call and prompts for a voice
message, then processes with the fast-voice-pipeline.

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

## Future: Real-Time Voice Options

1. **Meta Cloud API** — WhatsApp Business API may add call support. Monitor https://developers.facebook.com/docs/whatsapp/
2. **Telephony Bridge** — SIP trunk (Twilio/Vonage) + WhatsApp number. User calls a phone number → SIP → our pipeline → TTS back. Not native WhatsApp but works.
3. **Web-based voice** — Add a "Call Agent" button in the agente-ceo web UI that uses WebRTC directly to our server, bypassing WhatsApp entirely.
4. **Baileys v7+** — Monitor for call acceptance support in future versions.

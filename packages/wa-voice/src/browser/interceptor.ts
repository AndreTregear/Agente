/**
 * Browser-side WebRTC interceptor script.
 *
 * This script is injected into the Playwright browser via page.addInitScript()
 * BEFORE WhatsApp Web loads. It monkey-patches RTCPeerConnection to:
 *
 * 1. Capture incoming audio tracks (caller's voice)
 * 2. Store outgoing audio senders (for replaceTrack with TTS audio)
 * 3. Bridge audio data to Node.js via exposed functions
 *
 * The script must be self-contained — no imports allowed.
 */

/**
 * Returns the interceptor script as a string to be injected via addInitScript.
 * We keep it as a function body so TypeScript can check the logic,
 * then serialize it for injection.
 */
export function getInterceptorScript(): string {
  // We return the function body as a string for injection
  return `(${interceptorFn.toString()})()`;
}

/**
 * The actual interceptor function — runs in browser context.
 * TypeScript checks this, but it executes in the browser, not Node.js.
 */
function interceptorFn() {
  // ── State ──

  const state = {
    peerConnections: [] as RTCPeerConnection[],
    outgoingSenders: [] as RTCRtpSender[],
    incomingStreams: [] as MediaStream[],
    recorder: null as MediaRecorder | null,
    audioContext: null as AudioContext | null,
    isCapturing: false,
    isInjecting: false,
    // VAD (Voice Activity Detection) state
    vadSilenceStart: 0,
    vadIsSpeaking: false,
    accumulatedChunks: [] as Blob[],
  };

  // Expose state on window for Node.js access via page.evaluate
  (window as any).__waVoice = {
    state,
    // These get set by Node.js via page.exposeFunction
    onAudioData: null as ((base64: string, durationMs: number) => Promise<void>) | null,
    onSpeechEnd: null as ((base64: string, totalMs: number) => Promise<void>) | null,
    onCallStateChange: null as ((state: string) => Promise<void>) | null,
  };

  // ── RTCPeerConnection Monkey-Patch ──

  const OriginalRTCPC = window.RTCPeerConnection;

  // Intentional override of RTCPeerConnection constructor
  (window as any).RTCPeerConnection = function (
    this: RTCPeerConnection,
    config?: RTCConfiguration,
  ) {
    console.log('[wa-voice] New RTCPeerConnection created');
    const pc: RTCPeerConnection = new OriginalRTCPC(config);
    state.peerConnections.push(pc);

    // ── Intercept incoming tracks ──
    pc.addEventListener('track', (event: RTCTrackEvent) => {
      console.log('[wa-voice] Remote track received:', event.track.kind, event.track.id);

      if (event.track.kind === 'audio' && event.streams[0]) {
        state.incomingStreams.push(event.streams[0]);
        startAudioCapture(event.streams[0]);
      }
    });

    // ── Intercept outgoing senders ──
    const origAddTrack = pc.addTrack.bind(pc);
    pc.addTrack = function (track: MediaStreamTrack, ...streams: MediaStream[]) {
      console.log('[wa-voice] addTrack:', track.kind, track.id);
      const sender = origAddTrack(track, ...streams);
      if (track.kind === 'audio') {
        state.outgoingSenders.push(sender);
      }
      return sender;
    };

    // ── Track connection state ──
    pc.addEventListener('connectionstatechange', () => {
      console.log('[wa-voice] Connection state:', pc.connectionState);
      const waVoice = (window as any).__waVoice;
      if (waVoice.onCallStateChange) {
        waVoice.onCallStateChange(pc.connectionState);
      }
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
        stopAudioCapture();
      }
    });

    pc.addEventListener('iceconnectionstatechange', () => {
      console.log('[wa-voice] ICE state:', pc.iceConnectionState);
    });

    return pc;
  } as any;

  // Preserve prototype and static properties
  window.RTCPeerConnection.prototype = OriginalRTCPC.prototype;
  Object.setPrototypeOf(window.RTCPeerConnection, OriginalRTCPC);

  // Also handle webkit prefix
  if ((window as any).webkitRTCPeerConnection) {
    (window as any).webkitRTCPeerConnection = window.RTCPeerConnection;
  }

  // ── Audio Capture (incoming caller audio → Node.js) ──

  function startAudioCapture(stream: MediaStream) {
    if (state.isCapturing) return;
    state.isCapturing = true;

    console.log('[wa-voice] Starting audio capture from incoming stream');

    try {
      // Use MediaRecorder to capture audio chunks
      const recorder = new MediaRecorder(stream, {
        mimeType: getSupportedMimeType(),
      });
      state.recorder = recorder;
      state.accumulatedChunks = [];

      const chunkStartTime = Date.now();

      recorder.ondataavailable = async (event: BlobEvent) => {
        if (event.data.size === 0) return;

        state.accumulatedChunks.push(event.data);

        // Also send individual chunks for streaming
        const waVoice = (window as any).__waVoice;
        if (waVoice.onAudioData) {
          const arrayBuffer = await event.data.arrayBuffer();
          const base64 = arrayBufferToBase64(arrayBuffer);
          const durationMs = Date.now() - chunkStartTime;
          waVoice.onAudioData(base64, durationMs).catch(console.error);
        }
      };

      // Capture in small chunks for near-real-time processing
      recorder.start(200); // 200ms chunks

      // Set up VAD using AudioContext + AnalyserNode
      setupVAD(stream);
    } catch (err) {
      console.error('[wa-voice] Failed to start audio capture:', err);
      state.isCapturing = false;
    }
  }

  function stopAudioCapture() {
    if (!state.isCapturing) return;
    state.isCapturing = false;

    if (state.recorder && state.recorder.state !== 'inactive') {
      state.recorder.stop();
    }
    state.recorder = null;
    state.accumulatedChunks = [];

    if (state.audioContext) {
      state.audioContext.close().catch(console.error);
      state.audioContext = null;
    }

    console.log('[wa-voice] Audio capture stopped');
  }

  // ── Voice Activity Detection ──

  function setupVAD(stream: MediaStream) {
    const audioCtx = new AudioContext();
    state.audioContext = audioCtx;

    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.3;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const SPEECH_THRESHOLD = 30; // RMS threshold for speech detection
    const SILENCE_DURATION_MS = 800; // How long silence before we consider speech ended

    function checkAudioLevel() {
      if (!state.isCapturing) return;

      analyser.getByteTimeDomainData(dataArray);

      // Calculate RMS
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const val = (dataArray[i] - 128) / 128;
        sum += val * val;
      }
      const rms = Math.sqrt(sum / dataArray.length) * 100;

      if (rms > SPEECH_THRESHOLD) {
        // Speech detected
        state.vadIsSpeaking = true;
        state.vadSilenceStart = 0;
      } else if (state.vadIsSpeaking) {
        // Silence after speech
        if (state.vadSilenceStart === 0) {
          state.vadSilenceStart = Date.now();
        } else if (Date.now() - state.vadSilenceStart > SILENCE_DURATION_MS) {
          // Speech ended — flush accumulated audio to Node.js
          state.vadIsSpeaking = false;
          state.vadSilenceStart = 0;
          flushAccumulatedAudio();
        }
      }

      requestAnimationFrame(checkAudioLevel);
    }

    checkAudioLevel();
  }

  async function flushAccumulatedAudio() {
    if (state.accumulatedChunks.length === 0) return;

    const waVoice = (window as any).__waVoice;
    if (!waVoice.onSpeechEnd) return;

    console.log(`[wa-voice] Speech ended, flushing ${state.accumulatedChunks.length} chunks`);

    // Combine all accumulated chunks into one blob
    const combined = new Blob(state.accumulatedChunks, {
      type: getSupportedMimeType(),
    });
    state.accumulatedChunks = [];

    const arrayBuffer = await combined.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);

    waVoice.onSpeechEnd(base64, 0).catch(console.error);
  }

  // ── Audio Injection (TTS → outgoing track) ──

  /**
   * Called from Node.js via page.evaluate to inject TTS audio
   * into the outgoing WebRTC track.
   */
  (window as any).__waVoiceInjectAudio = async function (base64Audio: string): Promise<boolean> {
    const sender = state.outgoingSenders[state.outgoingSenders.length - 1];
    if (!sender) {
      console.warn('[wa-voice] No outgoing sender available for audio injection');
      return false;
    }

    try {
      const audioCtx = new AudioContext();

      // Decode the audio data (WAV/MP3 from TTS)
      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const audioBuffer = await audioCtx.decodeAudioData(bytes.buffer as ArrayBuffer);

      // Create a MediaStream from the audio buffer
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;

      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      source.start();

      // Replace the outgoing track with our TTS audio
      const ttsTrack = dest.stream.getAudioTracks()[0];
      await sender.replaceTrack(ttsTrack);

      console.log(`[wa-voice] Injected TTS audio (${audioBuffer.duration.toFixed(1)}s)`);

      // When TTS finishes, replace with silence
      source.onended = async () => {
        // Create a silent track
        const silentCtx = new AudioContext();
        const silentOsc = silentCtx.createOscillator();
        silentOsc.frequency.value = 0;
        const silentDest = silentCtx.createMediaStreamDestination();
        const gain = silentCtx.createGain();
        gain.gain.value = 0;
        silentOsc.connect(gain);
        gain.connect(silentDest);
        silentOsc.start();

        const silentTrack = silentDest.stream.getAudioTracks()[0];
        await sender.replaceTrack(silentTrack);
        console.log('[wa-voice] Switched back to silence after TTS');

        audioCtx.close().catch(() => {});
      };

      return true;
    } catch (err) {
      console.error('[wa-voice] Failed to inject audio:', err);
      return false;
    }
  };

  // ── Utilities ──

  function getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return 'audio/webm'; // fallback
  }

  function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

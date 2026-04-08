'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useMicVAD, utils } from '@ricky0123/vad-react'
import {
  Mic, MicOff, Phone, PhoneOff, Loader2, Volume2,
  CheckCircle2, Zap, BrainCircuit,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ──

interface VoiceTurn {
  id: string
  type: 'user' | 'agent' | 'notification'
  text: string
  toolCalls?: Array<{ name: string; args: Record<string, unknown> }>
  timings?: { sttMs: number; llmMs: number; ttsMs: number; totalMs: number }
}

interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

// ── Component ──

export default function VoiceMode() {
  const [isActive, setIsActive] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [turns, setTurns] = useState<VoiceTurn[]>([])
  const [history, setHistory] = useState<HistoryMessage[]>([])
  const [activeTasks, setActiveTasks] = useState(0)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const audioQueueRef = useRef<Array<{ data: string; mime: string }>>([])
  const isPlayingRef = useRef(false)
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const turnLogRef = useRef<HTMLDivElement>(null)

  // ── Silero VAD ──
  const vad = useMicVAD({
    startOnLoad: false,
    model: 'v5',
    baseAssetPath: '/vad/',
    onnxWASMBasePath: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/',
    positiveSpeechThreshold: 0.5,
    negativeSpeechThreshold: 0.35,
    redemptionMs: 800,
    preSpeechPadMs: 300,
    minSpeechMs: 250,

    onSpeechStart: () => {
      // If agent is speaking when user starts talking, stop playback
      if (isPlayingRef.current) {
        try { currentSourceRef.current?.stop() } catch { /* ignore */ }
        currentSourceRef.current = null
        isPlayingRef.current = false
        setIsSpeaking(false)
        audioQueueRef.current = []
      }
    },

    onSpeechEnd: (audio: Float32Array) => {
      if (isProcessing) return
      // Encode to WAV and send to server
      const wavBuffer = utils.encodeWAV(audio)
      const blob = new Blob([wavBuffer], { type: 'audio/wav' })
      processVoice(blob)
    },

    onVADMisfire: () => {
      // Speech too short — ignore
    },
  })

  // Auto-scroll conversation
  useEffect(() => {
    turnLogRef.current?.scrollTo(0, turnLogRef.current.scrollHeight)
  }, [turns])

  // ── Audio Playback (fixed queue) ──

  // Ensure AudioContext exists (must be created/resumed on user gesture for iOS)
  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext()
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume()
    }
    return audioCtxRef.current
  }, [])

  const enqueueAudio = useCallback((base64: string, mime = 'audio/mpeg') => {
    if (!base64) return
    audioQueueRef.current.push({ data: base64, mime })
    if (!isPlayingRef.current) drainQueue()
  }, [])

  const drainQueue = useCallback(() => {
    if (isPlayingRef.current) return

    const next = audioQueueRef.current.shift()
    if (!next) {
      setIsSpeaking(false)
      return
    }

    try {
      const ctx = getAudioCtx()
      const bytes = Uint8Array.from(atob(next.data), (c) => c.charCodeAt(0))
      const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)

      isPlayingRef.current = true
      setIsSpeaking(true)

      ctx.decodeAudioData(
        arrayBuffer,
        (audioBuffer) => {
          const source = ctx.createBufferSource()
          source.buffer = audioBuffer
          source.connect(ctx.destination)
          currentSourceRef.current = source
          source.onended = () => {
            isPlayingRef.current = false
            currentSourceRef.current = null
            drainQueue()
          }
          source.start(0)
        },
        () => {
          // Decode failed — skip to next
          isPlayingRef.current = false
          drainQueue()
        },
      )
    } catch {
      isPlayingRef.current = false
      drainQueue()
    }
  }, [getAudioCtx])

  // ── SSE for task notifications ──

  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) return
    const es = new EventSource('/api/voice/events')
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const d = JSON.parse(event.data)
        if (d.type === 'task-complete' || d.type === 'task-failed') {
          setTurns((prev) => [...prev, {
            id: `notif-${Date.now()}`,
            type: 'notification',
            text: d.text,
          }])
          // Add to history so LLM remembers task results
          setHistory((prev) => [
            ...prev,
            { role: 'assistant' as const, content: `[Resultado de tarea] ${d.text}` },
          ].slice(-12))
          setActiveTasks((n) => Math.max(0, n - 1))
          if (d.audio) enqueueAudio(d.audio, 'audio/mpeg')
        }
      } catch { /* ignore */ }
    }

    es.onerror = () => {
      es.close()
      eventSourceRef.current = null
      setTimeout(() => { if (isActive) connectSSE() }, 3000)
    }
  }, [isActive, enqueueAudio])

  // ── Activate / Deactivate ──

  const activate = useCallback(async () => {
    // Create AudioContext on user gesture (required for iOS audio playback)
    getAudioCtx()
    setIsActive(true)
    connectSSE()
    await vad.start()
  }, [vad, connectSSE, getAudioCtx])

  const deactivate = useCallback(async () => {
    setIsActive(false)
    await vad.pause()
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    try { currentSourceRef.current?.stop() } catch { /* ignore */ }
    currentSourceRef.current = null
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    isPlayingRef.current = false
    audioQueueRef.current = []
    setIsSpeaking(false)
  }, [vad])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      vad.pause()
      eventSourceRef.current?.close()
    }
  }, [])

  // ── Process a speech segment ──

  const processVoice = async (audioBlob: Blob) => {
    setIsProcessing(true)

    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'voice.wav')
      formData.append('history', JSON.stringify(history))
      formData.append('model', 'local')

      // Use streaming endpoint — audio arrives sentence by sentence
      const res = await fetch('/api/voice/stream', { method: 'POST', body: formData })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No stream')

      const decoder = new TextDecoder()
      let fullResponse = ''
      const toolCalls: Array<{ name: string; args: Record<string, unknown> }> = []
      let timings: any = null
      let userText = ''

      // Read SSE chunks
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const d = JSON.parse(line.slice(6))

            if (d.type === 'stt') {
              userText = d.text
              setTurns((prev) => [...prev, { id: `u-${Date.now()}`, type: 'user', text: d.text }])
            }

            if (d.type === 'chunk') {
              fullResponse += (fullResponse ? ' ' : '') + d.text
              // Play audio chunk immediately — first sentence plays while rest generates
              if (d.audio) {
                enqueueAudio(d.audio, 'audio/mpeg')
              }
              // Show partial response
              setTurns((prev) => {
                const last = prev[prev.length - 1]
                if (last?.type === 'agent') {
                  return [...prev.slice(0, -1), { ...last, text: fullResponse }]
                }
                return [...prev, { id: `a-${Date.now()}`, type: 'agent', text: fullResponse }]
              })
            }

            if (d.type === 'tool') {
              toolCalls.push({ name: d.name, args: d.args })
              if (d.name === 'assign_task') setActiveTasks((n) => n + 1)
              setTurns((prev) => {
                const last = prev[prev.length - 1]
                if (last?.type === 'agent') {
                  return [...prev.slice(0, -1), { ...last, toolCalls: [...(last.toolCalls ?? []), { name: d.name, args: d.args }] }]
                }
                return prev
              })
            }

            if (d.type === 'done') {
              timings = d.timings
              setTurns((prev) => {
                const last = prev[prev.length - 1]
                if (last?.type === 'agent') {
                  return [...prev.slice(0, -1), { ...last, timings }]
                }
                return prev
              })
            }
          } catch { /* ignore parse errors */ }
        }
      }

      // Update history
      if (userText && fullResponse) {
        setHistory((prev) => [
          ...prev,
          { role: 'user' as const, content: userText },
          { role: 'assistant' as const, content: fullResponse },
        ].slice(-12))
      }
    } catch (err) {
      console.error('Voice error:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  // ── Render ──

  if (vad.loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-white/40">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm">Cargando modelo de detección de voz...</p>
      </div>
    )
  }

  if (vad.errored) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-red-400">
        <MicOff className="w-8 h-8" />
        <p className="text-sm">Error de micrófono: {String(vad.errored)}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-80px)] gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-3 h-3 rounded-full smooth-transition',
            isActive
              ? vad.userSpeaking ? 'bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)]'
                : isProcessing ? 'bg-cyan-400 animate-pulse'
                  : isSpeaking ? 'bg-emerald-400 animate-pulse'
                    : 'bg-emerald-400'
              : 'bg-white/20',
          )} />
          <div>
            <h1 className="text-xl font-bold">Modo Voz</h1>
            <p className="text-xs text-white/40">
              {isActive
                ? `${turns.length} turnos`
                : 'Desactivado'}
              {activeTasks > 0 && ` · ${activeTasks} tarea${activeTasks > 1 ? 's' : ''} en proceso`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={isActive ? deactivate : activate}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm smooth-transition',
              isActive
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                : 'btn-gradient',
            )}
          >
            {isActive ? <PhoneOff className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
            {isActive ? 'Colgar' : 'Llamar'}
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Voice Orb */}
        <div className="flex-1 flex flex-col items-center justify-center glass-card rounded-xl relative overflow-hidden">
          {/* Background glow */}
          {isActive && (
            <div
              className="absolute inset-0 opacity-20 smooth-transition"
              style={{
                background: `radial-gradient(circle at center, ${
                  vad.userSpeaking ? 'rgb(168,85,247)'
                    : isProcessing ? 'rgb(6,182,212)'
                      : isSpeaking ? 'rgb(16,185,129)'
                        : 'transparent'
                } 0%, transparent 70%)`,
              }}
            />
          )}

          {/* Orb */}
          <div className="relative z-10 mb-6">
            <div
              className={cn(
                'w-36 h-36 rounded-full flex items-center justify-center smooth-transition',
                vad.userSpeaking && 'shadow-[0_0_80px_rgba(168,85,247,0.5)]',
                isProcessing && 'shadow-[0_0_60px_rgba(6,182,212,0.4)]',
                isSpeaking && 'shadow-[0_0_60px_rgba(16,185,129,0.4)]',
              )}
              style={{
                background: vad.userSpeaking
                  ? 'rgba(168,85,247,0.25)'
                  : isProcessing ? 'rgba(6,182,212,0.15)'
                    : isSpeaking ? 'rgba(16,185,129,0.15)'
                      : 'rgba(255,255,255,0.03)',
              }}
            >
              {isProcessing ? (
                <Loader2 className="w-14 h-14 text-cyan-400 animate-spin" />
              ) : isSpeaking ? (
                <Volume2 className="w-14 h-14 text-emerald-400 animate-pulse" />
              ) : vad.userSpeaking ? (
                <Mic className="w-14 h-14 text-purple-400 animate-pulse" />
              ) : (
                <Mic className={cn('w-14 h-14', isActive ? 'text-white/40' : 'text-white/15')} />
              )}
            </div>

            {/* Ripples when speaking */}
            {vad.userSpeaking && (
              <>
                <div className="absolute inset-[-12px] rounded-full border border-purple-400/20 animate-ping" style={{ animationDuration: '2s' }} />
                <div className="absolute inset-[-24px] rounded-full border border-purple-400/10 animate-ping" style={{ animationDuration: '3s' }} />
              </>
            )}
          </div>

          {/* Status */}
          <p className={cn(
            'text-sm font-medium relative z-10',
            vad.userSpeaking ? 'text-purple-400'
              : isProcessing ? 'text-cyan-400'
                : isSpeaking ? 'text-emerald-400'
                  : 'text-white/40',
          )}>
            {vad.userSpeaking ? 'Escuchando...'
              : isProcessing ? 'Pensando...'
                : isSpeaking ? 'Hablando...'
                  : isActive ? 'Listo — habla cuando quieras'
                    : 'Pulsa Llamar para activar'}
          </p>

          {/* Active tasks */}
          {activeTasks > 0 && (
            <div className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 relative z-10">
              <BrainCircuit className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span className="text-xs text-cyan-400">
                {activeTasks} tarea{activeTasks > 1 ? 's' : ''} en proceso
              </span>
            </div>
          )}
        </div>

        {/* Conversation Panel */}
        <div className="w-[380px] flex flex-col glass-card rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/70">Conversación</h2>
            {turns.length > 0 && (
              <button
                onClick={() => { setTurns([]); setHistory([]) }}
                className="text-[10px] text-white/30 hover:text-white/50"
              >
                Limpiar
              </button>
            )}
          </div>

          <div ref={turnLogRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {turns.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-white/20 text-sm gap-2">
                <Mic className="w-8 h-8" />
                <p>Di algo para empezar</p>
              </div>
            )}

            {turns.map((turn) => (
              <div key={turn.id} className="space-y-1">
                {turn.type === 'user' && (
                  <div className="flex gap-2">
                    <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Mic className="w-2.5 h-2.5 text-purple-400" />
                    </div>
                    <p className="text-sm text-white/80">{turn.text}</p>
                  </div>
                )}

                {turn.type === 'agent' && (
                  <>
                    {turn.toolCalls?.map((tc, i) => (
                      <div key={i} className="ml-7 flex items-center gap-1.5 text-[10px] text-cyan-400/70 font-mono">
                        <Zap className="w-3 h-3" />
                        {tc.name}
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <BrainCircuit className="w-2.5 h-2.5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm text-white/70">{turn.text}</p>
                        {turn.timings && (
                          <p className="text-[10px] text-white/20 mt-0.5">{turn.timings.totalMs}ms</p>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {turn.type === 'notification' && (
                  <div className="ml-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-medium mb-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Resultado de tarea
                    </div>
                    <p className="text-xs text-white/60">{turn.text}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Audio playback via Web Audio API (AudioContext) — no <audio> element needed */}
    </div>
  )
}

'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Send, Mic, MicOff, Loader2 } from 'lucide-react'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState('')
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [input])

  function handleSend() {
    const trimmed = input.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  async function toggleRecording() {
    if (recording) {
      // Stop recording
      mediaRecorderRef.current?.stop()
      setRecording(false)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        await transcribe(blob)
      }

      mediaRecorder.start()
      setRecording(true)
    } catch {
      // Microphone not available
    }
  }

  async function transcribe(blob: Blob) {
    setTranscribing(true)
    try {
      const formData = new FormData()
      formData.append('file', blob, 'recording.webm')
      formData.append('model', 'large-v3')

      const res = await fetch('/api/whisper', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        if (data.text) {
          setInput((prev) => (prev ? prev + ' ' + data.text : data.text))
        }
      }
    } finally {
      setTranscribing(false)
    }
  }

  return (
    <div className="border-t border-border bg-background/80 backdrop-blur-lg px-4 py-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end gap-2 glass-card p-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            rows={1}
            disabled={disabled}
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground resize-none outline-none px-3 py-2 text-sm max-h-[200px]"
          />

          {/* Voice input */}
          <button
            onClick={toggleRecording}
            disabled={transcribing}
            className={`p-2.5 rounded-lg smooth-transition flex-shrink-0 ${
              recording
                ? 'bg-destructive text-white animate-pulse'
                : transcribing
                  ? 'bg-secondary text-muted-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
            title={recording ? 'Stop recording' : 'Voice input'}
          >
            {transcribing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : recording ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          {/* Send */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || disabled}
            className="p-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed smooth-transition flex-shrink-0"
            title="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}

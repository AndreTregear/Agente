import { NextRequest } from 'next/server'
import { spawn } from 'child_process'

const OPENCLAW_BIN = process.env.OPENCLAW_BIN || 'openclaw'
const DEFAULT_AGENT = process.env.OPENCLAW_AGENT || 'yaya-platform'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages } = body

    // Get the last user message
    const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === 'user')
    if (!lastUserMsg) {
      return new Response(JSON.stringify({ error: 'No user message' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Build context from conversation history (skip last user msg, include recent context)
    const history = messages.slice(0, -1)
    const contextLines = history
      .filter((m: { role: string; content: string }) => m.role === 'user' || m.role === 'assistant')
      .slice(-6) // last 3 exchanges
      .map((m: { role: string; content: string }) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 500)}`)
      .join('\n')

    const fullMessage = contextLines
      ? `[Previous conversation context]\n${contextLines}\n\n[Current message]\n${lastUserMsg.content}`
      : lastUserMsg.content

    // Spawn openclaw agent and stream output
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        const proc = spawn(OPENCLAW_BIN, [
          'agent',
          '--agent', DEFAULT_AGENT,
          '--message', fullMessage,
          '--json',
        ], {
          env: { ...process.env, PATH: '/home/yaya/.npm-global/bin:' + process.env.PATH },
        })

        let fullOutput = ''

        proc.stdout.on('data', (chunk: Buffer) => {
          fullOutput += chunk.toString()
        })

        proc.stderr.on('data', (chunk: Buffer) => {
          // Ignore stderr (openclaw debug output)
        })

        proc.on('close', (code: number | null) => {
          try {
            // Find JSON in output
            const jsonStart = fullOutput.indexOf('{')
            if (jsonStart >= 0) {
              let data;
              try {
                data = JSON.parse(fullOutput.slice(jsonStart));
              } catch (parseErr) {
                console.warn('Failed to parse agent JSON output:', parseErr, fullOutput.slice(0, 200));
                data = { result: { payloads: [] } };
              }
              const payloads = data?.result?.payloads || []
              const text = payloads.map((p: { text?: string }) => p.text || '').join('\n')

              if (text) {
                // Send as SSE format that the client expects
                const sseChunk = JSON.stringify({
                  id: 'openclaw-' + Date.now(),
                  object: 'chat.completion.chunk',
                  choices: [{
                    index: 0,
                    delta: { role: 'assistant', content: text },
                    finish_reason: null,
                  }],
                })
                controller.enqueue(encoder.encode(`data: ${sseChunk}\n\n`))
              } else {
                const errChunk = JSON.stringify({
                  id: 'openclaw-err',
                  object: 'chat.completion.chunk',
                  choices: [{
                    index: 0,
                    delta: { role: 'assistant', content: 'I had trouble processing that. Please try again.' },
                    finish_reason: null,
                  }],
                })
                controller.enqueue(encoder.encode(`data: ${errChunk}\n\n`))
              }
            }
          } catch (e) {
            const errChunk = JSON.stringify({
              id: 'openclaw-err',
              object: 'chat.completion.chunk',
              choices: [{
                index: 0,
                delta: { role: 'assistant', content: 'Agent error: ' + String(e) },
                finish_reason: null,
              }],
            })
            controller.enqueue(encoder.encode(`data: ${errChunk}\n\n`))
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        })

        proc.on('error', (err: Error) => {
          const errChunk = JSON.stringify({
            id: 'openclaw-err',
            object: 'chat.completion.chunk',
            choices: [{
              index: 0,
              delta: { role: 'assistant', content: 'Failed to start agent: ' + err.message },
              finish_reason: null,
            }],
          })
          controller.enqueue(encoder.encode(`data: ${errChunk}\n\n`))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        })
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: `Chat proxy error: ${error}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

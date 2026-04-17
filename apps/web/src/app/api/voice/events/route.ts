import { withActiveSubscription } from "@/lib/billing/entitlement";
/**
 * Voice Events SSE — pushes task completions to the client in real-time.
 *
 * When an OpenClaw task finishes:
 * 1. Summarize the result (quick LLM call, 1-2 sentences)
 * 2. Synthesize with TTS
 * 3. Push { type: 'task-complete', text, audio, taskId } via SSE
 *
 * Client auto-plays the audio — user hears results without asking.
 */

import { onTaskComplete, markNotified, type AgentTask } from '@/lib/voice-tools';
import { MODELS } from '@/lib/models';
import { sanitizeForTTS } from '@/lib/tts-sanitize';

const TTS_URL = process.env.TTS_BASE_URL
  ? `${process.env.TTS_BASE_URL}/v1/audio/speech`
  : 'http://localhost:9400/v1/audio/speech';

export const dynamic = 'force-dynamic';

async function getImpl() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send keepalive every 15s
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          clearInterval(keepalive);
        }
      }, 15000);

      // Listen for task completions
      const unsubscribe = onTaskComplete(async (task: AgentTask) => {
        try {
          const { summary, audio } = await summarizeAndSpeak(task);

          markNotified(task.id);

          const event = JSON.stringify({
            type: task.status === 'completed' ? 'task-complete' : 'task-failed',
            taskId: task.id,
            description: task.description.slice(0, 100),
            text: summary,
            audio, // base64 mp3
            elapsed: task.completedAt
              ? `${((task.completedAt - task.startedAt) / 1000).toFixed(1)}s`
              : 'unknown',
          });

          controller.enqueue(encoder.encode(`data: ${event}\n\n`));
        } catch (err) {
          // Still notify even if summarize/TTS fails
          const event = JSON.stringify({
            type: 'task-complete',
            taskId: task.id,
            text: task.result?.slice(0, 200) ?? 'Task completed',
            audio: '',
          });
          controller.enqueue(encoder.encode(`data: ${event}\n\n`));
        }
      });

      // Clean up on close
      const cleanup = () => {
        clearInterval(keepalive);
        unsubscribe();
      };

      // Store cleanup for when stream closes
      (controller as any)._cleanup = cleanup;
    },
    cancel() {
      // Called when client disconnects
      if ((this as any)._cleanup) (this as any)._cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

/**
 * Summarize a task result into 1-2 spoken sentences, then TTS it.
 */
async function summarizeAndSpeak(
  task: AgentTask,
): Promise<{ summary: string; audio: string }> {
  const model = MODELS.find((m) => m.tag === 'local') ?? MODELS[0];

  // Quick LLM call to summarize
  const resultText = task.status === 'failed'
    ? `Task failed: ${task.error}`
    : task.result ?? 'No result';

  const res = await fetch(`${model.apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${model.apiKey}`,
    },
    body: JSON.stringify({
      model: model.model,
      messages: [
        {
          role: 'system',
          content:
            'Summarize this task result in 1-2 short spoken sentences in Spanish. Be concise — this will be read aloud. Start with "Listo," or "Terminé de" to signal completion. /no_think',
        },
        {
          role: 'user',
          content: `Task: "${task.description}"\n\nResult:\n${resultText.slice(0, 1500)}`,
        },
      ],
      max_tokens: 80,
      temperature: 0.5,
      stream: false,
      chat_template_kwargs: { enable_thinking: false },
    }),
  });

  let summary = 'Tarea completada.';
  if (res.ok) {
    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    summary = data.choices[0]?.message?.content?.trim() ?? summary;
  }

  // TTS
  let audioBase64 = '';
  try {
    const ttsRes = await fetch(TTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'kokoro',
        input: sanitizeForTTS(summary).slice(0, 300),
        voice: 'ef_dora',
        lang_code: 'e',
        response_format: 'mp3',
      }),
    });
    if (ttsRes.ok) {
      audioBase64 = Buffer.from(await ttsRes.arrayBuffer()).toString('base64');
    }
  } catch { /* TTS failed, text-only notification */ }

  return { summary, audio: audioBase64 };
}

export const GET = withActiveSubscription(getImpl);

#!/usr/bin/env node
/**
 * Standalone runner for the WhatsApp Web Voice Agent.
 *
 * Usage:
 *   npx tsx packages/wa-voice/src/run.ts
 *
 * Environment variables:
 *   VOICE_PIPELINE   — Pipeline mode: 'local', 'hpc', or 'auto' (default: auto)
 *   WHISPER_URL      — Whisper STT endpoint (default: http://localhost:9300/v1)
 *   WHISPER_API_KEY  — Whisper API key
 *   VLLM_URL         — vLLM endpoint (default: http://localhost:8000/v1)
 *   VLLM_API_KEY     — vLLM API key
 *   VLLM_MODEL       — LLM model name (default: qwen3.5-35b-a3b)
 *   OMNI_URL         — Qwen3-Omni endpoint for HPC pipeline (default: http://localhost:18080/v1)
 *   OMNI_API_KEY     — Omni API key
 *   OMNI_MODEL       — Omni model name (default: qwen3-omni)
 *   TTS_URL          — Kokoro TTS endpoint (default: http://localhost:9400)
 *   TTS_VOICE        — TTS voice (default: af_heart)
 *   WA_STORAGE_DIR   — Browser session storage (default: ./wa-session)
 *   WA_HEADLESS      — Run headless (default: false, needs Xvfb)
 *   SYSTEM_PROMPT    — Custom system prompt for voice assistant
 *   MAX_CALL_SEC     — Max call duration in seconds (default: 300)
 */

import { VoiceAgent } from './agent/voice-agent.js';
import type { VoicePipelineMode } from './types.js';

const pipeline = (process.env.VOICE_PIPELINE ?? 'auto') as VoicePipelineMode;

const agent = new VoiceAgent({
  session: {
    storageDir: process.env.WA_STORAGE_DIR ?? './wa-session',
    headless: process.env.WA_HEADLESS === 'true',
  },
  audio: {
    sttUrl: process.env.WHISPER_URL ?? 'http://localhost:9300/v1',
    sttApiKey: process.env.WHISPER_API_KEY,
    sttModel: process.env.WHISPER_MODEL ?? 'large-v3',
    ttsUrl: process.env.TTS_URL ?? 'http://localhost:9400',
    ttsApiKey: process.env.TTS_API_KEY,
    ttsVoice: process.env.TTS_VOICE ?? 'ef_dora',
  },
  call: {
    autoAnswer: true,
    maxDurationSec: parseInt(process.env.MAX_CALL_SEC ?? '300', 10),
  },
  pipeline,
  llmUrl: process.env.VLLM_URL ?? 'http://localhost:8000/v1',
  llmApiKey: process.env.VLLM_API_KEY,
  llmModel: process.env.VLLM_MODEL ?? 'qwen3.5-35b-a3b',
  omniUrl: process.env.OMNI_URL ?? 'http://localhost:18080/v1',
  omniApiKey: process.env.OMNI_API_KEY ?? process.env.VLLM_API_KEY,
  omniModel: process.env.OMNI_MODEL ?? 'qwen3-omni',
  systemPrompt: process.env.SYSTEM_PROMPT,
  maxTokens: 150,
  onTurn: (turn) => {
    console.log(`\n--- Turn ---`);
    console.log(`User: ${turn.userSpeech}`);
    console.log(`Agent: ${turn.agentResponse}`);
    const ttsLabel = turn.timings.ttsMs === 0 ? '(included)' : `${turn.timings.ttsMs}ms`;
    console.log(`Timings: STT=${turn.timings.sttMs}ms LLM=${turn.timings.llmMs}ms TTS=${ttsLabel} Total=${turn.timings.totalMs}ms`);
  },
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down voice agent...');
  await agent.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await agent.stop();
  process.exit(0);
});

// Start
console.log('Starting WhatsApp Voice Agent...');
console.log(`Pipeline: ${pipeline}`);
console.log('Services:');
console.log(`  STT:   ${process.env.WHISPER_URL ?? 'http://localhost:9300/v1'}`);
console.log(`  LLM:   ${process.env.VLLM_URL ?? 'http://localhost:8000/v1'} (${process.env.VLLM_MODEL ?? 'qwen3.5-35b-a3b'})`);
console.log(`  TTS:   ${process.env.TTS_URL ?? 'http://localhost:9400'}`);
console.log(`  Omni:  ${process.env.OMNI_URL ?? 'http://localhost:18080/v1'} (${process.env.OMNI_MODEL ?? 'qwen3-omni'})`);
console.log();

agent.start().catch((err) => {
  console.error('Voice agent crashed:', err);
  process.exit(1);
});

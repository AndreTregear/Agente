# Voice Stack Upgrade — Qwen3-ASR + Qwen3-TTS

## Overview
Added abstraction layer over ASR and TTS providers. Both old (Whisper+Kokoro) and new (Qwen3-ASR+Qwen3-TTS) stacks are supported. Switch via env vars.

## New Files
- `src/ai/asr-client.ts` — Unified ASR client (Whisper or Qwen3-ASR)
- `src/ai/tts-client-v2.ts` — Unified TTS client (Kokoro or Qwen3-TTS)

## Environment Variables

### ASR
| Variable | Default | Description |
|----------|---------|-------------|
| `ASR_PROVIDER` | `whisper` | `whisper` or `qwen3` |
| `QWEN_ASR_BASE_URL` | `http://localhost:9500/v1` | Qwen3-ASR API endpoint |
| `QWEN_ASR_MODEL` | `Qwen/Qwen3-ASR-1.7B` | Model name |

### TTS
| Variable | Default | Description |
|----------|---------|-------------|
| `TTS_PROVIDER` | `kokoro` | `kokoro` or `qwen3` |
| `QWEN_TTS_BASE_URL` | `http://localhost:9500/v1` | Qwen3-TTS API endpoint |
| `QWEN_TTS_VOICE` | `Ryan` | Default voice (9 options: Vivian, Serena, Uncle_Fu, Dylan, Eric, Ryan, Aiden, Ono_Anna, Sohee) |

## Migration
1. Deploy Qwen3-ASR and Qwen3-TTS services
2. Set env vars: `ASR_PROVIDER=qwen3 TTS_PROVIDER=qwen3`
3. Import from new files instead of old ones
4. Old files (client.ts, tts-client.ts) remain untouched for backward compat

## Qwen3.5-Omni Ready
When Qwen3.5-Omni weights drop, the architecture supports a single-model swap:
- Replace ASR+LLM+TTS with one vLLM-Omni endpoint
- The FastAPI layer and env var interface stays the same

## Language Support
| Provider | Languages |
|----------|-----------|
| Whisper | ~30 well-supported |
| Qwen3-ASR | 52 languages + dialects |
| Kokoro | English, Chinese |
| Qwen3-TTS | 10 languages (EN, ZH, JA, KO, DE, FR, RU, PT, ES, IT) |

Quechua: Not natively supported by any provider yet. Plan: fine-tune Qwen3-ASR with Quechua data.

#!/bin/bash
# LLM Benchmark — measures latency, tokens/sec, quality for voice assistant use case
# Usage: ./benchmark.sh <api_key> [port] [model_name]

API_KEY="${1:-${VLLM_API_KEY}}"
PORT="${2:-8000}"
MODEL="${3:-qwen3.5-27b}"
URL="http://localhost:${PORT}/v1/chat/completions"

echo "╔══════════════════════════════════════════════╗"
echo "║  LLM BENCHMARK: ${MODEL}"
echo "║  Endpoint: ${URL}"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Prompts — short voice assistant style
PROMPTS=(
  "¿Cuál es la capital de Perú?"
  "Explícame qué es machine learning en palabras simples."
  "¿Qué puedo cocinar con arroz, pollo y limón?"
  "Dame tres consejos para dormir mejor."
  "¿Cuál es la diferencia entre Python y JavaScript?"
  "Quiero crear un chatbot para WhatsApp, ¿por dónde empiezo?"
  "¿Qué ejercicios puedo hacer en casa sin equipamiento?"
  "Traduce al inglés: Me encanta programar y crear cosas nuevas."
)

SYSTEM="You are a helpful voice assistant on a live phone call. Keep responses concise (1-3 sentences). Respond in Spanish unless asked otherwise. Never use markdown. /no_think"

TOTAL_TTFT=0
TOTAL_TOKENS=0
TOTAL_LATENCY=0
COUNT=0

for PROMPT in "${PROMPTS[@]}"; do
  COUNT=$((COUNT + 1))
  ESCAPED_PROMPT=$(echo "$PROMPT" | python3 -c "import json,sys; print(json.dumps(sys.stdin.read().strip()))")

  START=$(date +%s%N)

  RESULT=$(curl -s -X POST "$URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${API_KEY}" \
    -d "{
      \"model\":\"${MODEL}\",
      \"messages\":[
        {\"role\":\"system\",\"content\":\"${SYSTEM}\"},
        {\"role\":\"user\",\"content\":${ESCAPED_PROMPT}}
      ],
      \"max_tokens\":100,
      \"temperature\":0.7,
      \"stream\":false,
      \"chat_template_kwargs\":{\"enable_thinking\":false}
    }")

  END=$(date +%s%N)
  LATENCY_MS=$(( (END - START) / 1000000 ))

  # Extract response and token counts
  RESPONSE=$(echo "$RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['choices'][0]['message']['content'])" 2>/dev/null)
  COMPLETION_TOKENS=$(echo "$RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('usage',{}).get('completion_tokens',0))" 2>/dev/null)
  PROMPT_TOKENS=$(echo "$RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('usage',{}).get('prompt_tokens',0))" 2>/dev/null)

  # Calculate tokens/sec
  if [ "$COMPLETION_TOKENS" -gt 0 ] 2>/dev/null; then
    TPS=$(echo "scale=1; $COMPLETION_TOKENS * 1000 / $LATENCY_MS" | bc 2>/dev/null)
  else
    COMPLETION_TOKENS=0
    TPS="?"
  fi

  TOTAL_LATENCY=$((TOTAL_LATENCY + LATENCY_MS))
  TOTAL_TOKENS=$((TOTAL_TOKENS + COMPLETION_TOKENS))

  printf "[%d/8] %4dms | %3d tok | %5s tok/s | %s\n" "$COUNT" "$LATENCY_MS" "$COMPLETION_TOKENS" "$TPS" "$(echo "$RESPONSE" | head -1 | cut -c1-80)"
done

# Summary
AVG_LATENCY=$((TOTAL_LATENCY / COUNT))
AVG_TPS=$(echo "scale=1; $TOTAL_TOKENS * 1000 / $TOTAL_LATENCY" | bc 2>/dev/null)

echo ""
echo "╔══════════════════════════════════════════════╗"
printf "║  RESULTS: %-35s║\n" "$MODEL"
echo "╠══════════════════════════════════════════════╣"
printf "║  Avg latency:     %6d ms                 ║\n" "$AVG_LATENCY"
printf "║  Total tokens:    %6d                     ║\n" "$TOTAL_TOKENS"
printf "║  Avg tok/s:       %6s                     ║\n" "$AVG_TPS"
printf "║  Total time:      %6d ms                 ║\n" "$TOTAL_LATENCY"
echo "╚══════════════════════════════════════════════╝"

#!/bin/bash
# Wrapper that intercepts openclaw agent calls and sends to vLLM directly
# Extracts --message argument and calls the API

MESSAGE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --message) MESSAGE="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [ -z "$MESSAGE" ]; then
  echo "{\"error\":\"no message\"}"
  exit 1
fi

# Escape message for JSON
MSG_ESCAPED=$(echo "$MESSAGE" | python3 -c "import json,sys; print(json.dumps(sys.stdin.read().strip()))")

RESPONSE=$(curl -s --max-time 60 -X POST http://localhost:18080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${VLLM_API_KEY}" \
  -d "{
    \"model\": \"qwen3-omni\",
    \"messages\": [
      {\"role\": \"system\", \"content\": \"Eres Agente, un asistente de negocios inteligente para empresas latinoamericanas. Responde en español de forma útil y concisa. Ayudas con ventas, inventario, facturación, pagos, citas, reportes y más.\"},
      {\"role\": \"user\", \"content\": $MSG_ESCAPED}
    ],
    \"max_tokens\": 1024
  }")

# Extract reply text
REPLY=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get(\"choices\",[{}])[0].get(\"message\",{}).get(\"content\",\"Lo siento, no pude procesar tu mensaje.\"))" 2>/dev/null)

if [ -z "$REPLY" ]; then
  REPLY="Lo siento, tuve un problema procesando tu mensaje."
fi

# Output in openclaw JSON format
python3 -c "
import json
reply = open(\"/dev/stdin\").read().strip()
print(json.dumps({\"result\": {\"payloads\": [{\"text\": reply}], \"meta\": {\"durationMs\": 0}}}))
" <<< "$REPLY"

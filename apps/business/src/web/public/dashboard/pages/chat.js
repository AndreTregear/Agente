// Agente Dashboard — Agent Chat Page (Mastra streaming)
import { esc, formatTime } from '../shared/api.js';

let chatHistory = [];

export function mount(container) {
  container.innerHTML = `
    <!-- Agent Chat -->
    <div class="chat-container">
      <div class="chat-header">
        <div class="chat-avatar">🤖</div>
        <div class="chat-info">
          <h3>Agente</h3>
          <p class="chat-subtitle" id="chat-subtitle">Cargando métricas...</p>
        </div>
        <a href="#voice" class="chat-voice-btn" title="Modo Voz">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          </svg>
        </a>
      </div>

      <!-- Quick metrics bar -->
      <div class="chat-metrics" id="chat-metrics">
        <div class="metric-pill" id="metric-revenue">
          <span class="metric-icon">💰</span>
          <span class="metric-value">—</span>
        </div>
        <div class="metric-pill" id="metric-orders">
          <span class="metric-icon">📦</span>
          <span class="metric-value">—</span>
        </div>
        <div class="metric-pill" id="metric-pending">
          <span class="metric-icon">⏳</span>
          <span class="metric-value">—</span>
        </div>
        <div class="metric-pill" id="metric-customers">
          <span class="metric-icon">👥</span>
          <span class="metric-value">—</span>
        </div>
      </div>

      <div class="chat-messages" id="chat-messages">
        <div class="chat-bubble assistant">
          <span class="bubble-text">¡Hola! Soy Agente, tu asistente de negocio.\nPuedo ayudarte con ventas, gastos, pedidos y más. ¿En qué te puedo ayudar?</span>
          <span class="time">${formatTime(new Date())}</span>
        </div>
      </div>

      <div class="chat-typing" id="chat-typing">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>

      <div class="chat-quick-actions">
        <button class="quick-action-btn" data-msg="Dame el resumen del día">📋 Resumen del día</button>
        <button class="quick-action-btn" data-msg="¿Cuánto gané hoy?">💰 ¿Cuánto gané?</button>
        <button class="quick-action-btn" data-msg="¿Hay pagos pendientes?">⏳ Pagos pendientes</button>
        <button class="quick-action-btn" data-msg="¿Cuáles son mis productos más vendidos?">🏆 Top productos</button>
      </div>

      <div class="chat-input-area">
        <textarea id="chat-input" class="chat-input" placeholder="Escribe tu mensaje..." rows="1"></textarea>
        <button id="chat-mic" class="chat-mic-btn" title="Entrada de voz">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" x2="12" y1="19" y2="23"/>
            <line x1="8" x2="16" y1="23" y2="23"/>
          </svg>
        </button>
        <button id="chat-send" class="chat-send" title="Enviar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" x2="11" y1="2" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  setupChat();
  loadMetrics();
}

export function unmount() {}

async function loadMetrics() {
  try {
    const res = await fetch('/api/v1/mobile/dashboard', { credentials: 'include' });
    if (!res.ok) return;
    const d = await res.json();
    const m = d.metrics?.rows?.[0] || d.metrics || {};
    const sub = document.getElementById('chat-subtitle');
    const rev = m.revenue || m.total_revenue || '0';
    const orders = m.orders || m.order_count || '0';
    if (sub) sub.textContent = `Hoy: S/${parseFloat(rev).toFixed(0)} · ${orders} pedidos`;

    const setMetric = (id, val) => {
      const el = document.querySelector(`#${id} .metric-value`);
      if (el) el.textContent = val;
    };
    setMetric('metric-revenue', `S/${parseFloat(rev).toFixed(0)}`);
    setMetric('metric-orders', `${orders} pedidos`);
    setMetric('metric-pending', `${d.pending?.rows?.length || d.pending?.length || 0} pend.`);
    setMetric('metric-customers', `${d.recentMessages?.rows?.length || d.recentMessages?.length || 0} msgs`);
  } catch { /* metrics are optional */ }
}

function setupChat() {
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  const micBtn = document.getElementById('chat-mic');

  sendBtn.addEventListener('click', () => sendMessage());

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });

  // Quick action buttons
  document.querySelectorAll('.quick-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const msg = btn.dataset.msg;
      if (msg) {
        input.value = msg;
        sendMessage();
      }
    });
  });

  // Microphone button — browser STT
  micBtn.addEventListener('click', () => startVoiceInput());
}

let isRecording = false;

function startVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    addBubble('assistant', 'Tu navegador no soporta reconocimiento de voz. Intenta con Chrome.');
    return;
  }

  const micBtn = document.getElementById('chat-mic');
  if (isRecording) return;

  isRecording = true;
  micBtn.classList.add('recording');

  const recognition = new SpeechRecognition();
  recognition.lang = 'es-ES';
  recognition.continuous = false;
  recognition.interimResults = true;

  const input = document.getElementById('chat-input');

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = 0; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    input.value = transcript;
  };

  recognition.onend = () => {
    isRecording = false;
    micBtn.classList.remove('recording');
    if (input.value.trim()) {
      sendMessage();
    }
  };

  recognition.onerror = () => {
    isRecording = false;
    micBtn.classList.remove('recording');
  };

  recognition.start();
}

let isStreaming = false;

async function sendMessage() {
  if (isStreaming) return;

  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';

  // Add user message to history and UI
  chatHistory.push({ role: 'user', content: text });
  addBubble('user', text);

  isStreaming = true;
  showTyping(true);

  try {
    const res = await fetch('/api/agente/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ messages: chatHistory })
    });

    if (!res.ok) throw new Error(`Error ${res.status}`);

    showTyping(false);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponse = '';
    const responseBubble = addBubble('assistant', '');
    const bubbleText = responseBubble.querySelector('.bubble-text');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
        try {
          const chunk = JSON.parse(line.slice(6));
          const content = chunk.choices?.[0]?.delta?.content;
          if (content) {
            fullResponse += content;
            bubbleText.textContent = fullResponse;
            scrollToBottom();
          }
        } catch { /* skip malformed chunks */ }
      }
    }

    // Save assistant response to history
    if (fullResponse) {
      chatHistory.push({ role: 'assistant', content: fullResponse });
    } else {
      bubbleText.textContent = '(Sin respuesta)';
    }

  } catch (err) {
    showTyping(false);
    addBubble('assistant', 'Error: ' + err.message);
  } finally {
    isStreaming = false;
  }
}

function addBubble(role, text) {
  const messages = document.getElementById('chat-messages');
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;
  bubble.innerHTML = `<span class="bubble-text">${esc(text)}</span><span class="time">${formatTime(new Date())}</span>`;
  messages.appendChild(bubble);
  scrollToBottom();
  return bubble;
}

function showTyping(show) {
  const el = document.getElementById('chat-typing');
  if (el) el.classList.toggle('active', show);
  if (show) scrollToBottom();
}

function scrollToBottom() {
  const messages = document.getElementById('chat-messages');
  if (messages) messages.scrollTop = messages.scrollHeight;
}

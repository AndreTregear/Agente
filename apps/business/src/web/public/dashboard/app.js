// Agente Dashboard — Main App (Better Auth sessions)
import { getUser, getSession } from './shared/api.js';
import { isLoggedIn, initAuthUI, logout, fetchSession } from './shared/auth.js';
import * as dashboard from './pages/dashboard.js';
import * as chat from './pages/chat.js';
import * as voice from './pages/voice.js';
import * as analytics from './pages/analytics.js';
import * as orders from './pages/orders.js';
import * as customers from './pages/customers.js';
import * as products from './pages/products.js';
import * as payments from './pages/payments.js';
import * as expenses from './pages/expenses.js';
import * as settings from './pages/settings.js';

const pages = { dashboard, chat, voice, analytics, orders, customers, products, payments, expenses, settings };
let currentPage = null;
let currentPageName = null;
let qrPollInterval = null;

// ========== INIT ==========
async function init() {
  initAuthUI();
  setupNav();
  setupMobile();

  if (await isLoggedIn()) {
    showApp();
    navigateFromHash();
    checkWhatsAppOnboarding();
  } else {
    showLogin();
  }

  // Listen for auth events
  window.addEventListener('yaya:login', () => {
    showApp();
    navigate('chat');
    checkWhatsAppOnboarding();
  });

  window.addEventListener('yaya:logout', () => {
    showLogin();
    stopQRPoll();
  });

  // Hash change
  window.addEventListener('hashchange', navigateFromHash);
}

// ========== AUTH STATE ==========
function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  updateUserInfo();
}

function updateUserInfo() {
  const user = getUser();
  if (user) {
    const name = user.tenantName || user.name || user.email || '';
    document.getElementById('sidebar-business').textContent = name;
    document.getElementById('user-name').textContent = user.email || '';
    const initials = name.slice(0, 2).toUpperCase() || 'YA';
    document.getElementById('user-avatar').textContent = initials;
  }
}

// ========== WHATSAPP QR ONBOARDING ==========
async function checkWhatsAppOnboarding() {
  try {
    const res = await fetch('/api/qr', { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();

    if (data.status === 'connected') return;

    showOnboardingOverlay(data.qr);
    startQRPoll();
  } catch {
    // QR endpoint not available, skip onboarding
  }
}

function showOnboardingOverlay(qrData) {
  // Remove existing overlay if any
  const existing = document.getElementById('onboarding');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'onboarding-overlay';
  overlay.id = 'onboarding';
  overlay.innerHTML = `
    <div class="onboarding-card">
      <div class="onboarding-header">
        <div class="onboarding-icon">📱</div>
        <h2>¡Casi listo! Conecta tu WhatsApp</h2>
        <p>Escanea este código QR con tu teléfono para vincular tu WhatsApp de negocio.</p>
      </div>
      <div class="qr-container">
        <img id="onboarding-qr" src="${qrData || ''}" alt="Código QR" />
        <div class="qr-loading" id="qr-loading" style="${qrData ? 'display:none' : ''}">
          <div class="spinner"></div>
          <p>Generando código QR...</p>
        </div>
      </div>
      <div class="onboarding-steps">
        <div class="onboarding-step">
          <span class="step-number">1</span>
          <span>Abre WhatsApp en tu teléfono</span>
        </div>
        <div class="onboarding-step">
          <span class="step-number">2</span>
          <span>Ve a Configuración → Dispositivos vinculados</span>
        </div>
        <div class="onboarding-step">
          <span class="step-number">3</span>
          <span>Toca "Vincular un dispositivo"</span>
        </div>
        <div class="onboarding-step">
          <span class="step-number">4</span>
          <span>Escanea el código de arriba</span>
        </div>
      </div>
      <button class="btn btn-secondary onboarding-skip" id="btn-skip-onboarding">Saltar por ahora</button>
    </div>
  `;

  document.body.appendChild(overlay);

  // Force reflow for animation
  requestAnimationFrame(() => {
    overlay.classList.add('active');
  });

  document.getElementById('btn-skip-onboarding').addEventListener('click', skipOnboarding);
}

function skipOnboarding() {
  stopQRPoll();
  const overlay = document.getElementById('onboarding');
  if (overlay) {
    overlay.classList.remove('active');
    overlay.classList.add('dismissing');
    setTimeout(() => overlay.remove(), 400);
  }
}

function startQRPoll() {
  stopQRPoll();
  qrPollInterval = setInterval(async () => {
    try {
      const res = await fetch('/api/qr', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();

      if (data.status === 'connected') {
        showOnboardingSuccess();
        stopQRPoll();
        return;
      }

      // Update QR image if available
      if (data.qr) {
        const qrImg = document.getElementById('onboarding-qr');
        const qrLoading = document.getElementById('qr-loading');
        if (qrImg) qrImg.src = data.qr;
        if (qrLoading) qrLoading.style.display = 'none';
      }
    } catch { /* ignore poll errors */ }
  }, 3000);
}

function stopQRPoll() {
  if (qrPollInterval) {
    clearInterval(qrPollInterval);
    qrPollInterval = null;
  }
}

function showOnboardingSuccess() {
  const overlay = document.getElementById('onboarding');
  if (!overlay) return;

  const card = overlay.querySelector('.onboarding-card');
  if (card) {
    card.innerHTML = `
      <div class="onboarding-success">
        <div class="success-checkmark">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        <h2>¡WhatsApp conectado!</h2>
        <p>Tu agente ya puede recibir mensajes de tus clientes.</p>
      </div>
    `;
  }

  setTimeout(() => {
    overlay.classList.remove('active');
    overlay.classList.add('dismissing');
    setTimeout(() => overlay.remove(), 400);
  }, 2500);
}

// Make skipOnboarding available globally for button onclick
window.skipOnboarding = skipOnboarding;

// ========== NAVIGATION ==========
function setupNav() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      window.location.hash = '#' + page;
    });
  });

  document.getElementById('btn-logout').addEventListener('click', logout);
}

function navigateFromHash() {
  const hash = window.location.hash.slice(1) || 'chat';
  navigate(hash);
}

function navigate(pageName) {
  if (!pages[pageName]) pageName = 'dashboard';

  // Unmount current
  if (currentPage?.unmount) currentPage.unmount();

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === pageName);
  });

  // Show correct page container
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const container = document.getElementById(`page-${pageName}`);
  if (container) container.classList.add('active');

  // Mount new page
  currentPage = pages[pageName];
  currentPageName = pageName;
  if (currentPage?.mount) currentPage.mount(container);

  // Close mobile sidebar
  closeSidebar();
}

// ========== MOBILE ==========
function setupMobile() {
  document.getElementById('btn-hamburger').addEventListener('click', openSidebar);
  document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);
}

function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('open');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

// ========== GLOBAL MODAL HELPERS ==========
window.AgenteModal = {
  open(title, bodyHTML, footerHTML) {
    const backdrop = document.getElementById('modal-backdrop');
    backdrop.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button class="modal-close" onclick="AgenteModal.close()">&times;</button>
        </div>
        <div class="modal-body">${bodyHTML}</div>
        ${footerHTML ? `<div class="modal-footer">${footerHTML}</div>` : ''}
      </div>`;
    backdrop.classList.add('active');
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) AgenteModal.close();
    });
  },
  close() {
    const backdrop = document.getElementById('modal-backdrop');
    backdrop.classList.remove('active');
    backdrop.innerHTML = '';
  }
};

// ========== START ==========
document.addEventListener('DOMContentLoaded', init);

/* ============================================================
   Quechua Dashboard — Frontend
   ============================================================ */

const REFRESH_INTERVAL = 30_000;
const chartInstances = {};

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
const navBtns = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view');
const pageTitle = document.getElementById('page-title');

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.view;
    navBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    views.forEach(v => v.classList.toggle('active', v.id === `view-${target}`));
    pageTitle.textContent = btn.textContent.trim();
  });
});

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------
async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`Fetch ${url} failed:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Chart.js defaults
// ---------------------------------------------------------------------------
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = '#1e293b';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.plugins.legend.labels.boxWidth = 12;
Chart.defaults.plugins.legend.labels.padding = 16;
Chart.defaults.animation.duration = 600;

function chartColors(alpha = 1) {
  return [
    `rgba(14, 165, 233, ${alpha})`,   // blue
    `rgba(34, 197, 94, ${alpha})`,    // green
    `rgba(245, 158, 11, ${alpha})`,   // amber
    `rgba(239, 68, 68, ${alpha})`,    // red
    `rgba(167, 139, 250, ${alpha})`,  // purple
    `rgba(236, 72, 153, ${alpha})`,   // pink
    `rgba(20, 184, 166, ${alpha})`,   // teal
    `rgba(251, 191, 36, ${alpha})`,   // yellow
  ];
}

function getOrCreateChart(id, config) {
  const canvas = document.getElementById(id);
  if (!canvas) return null;
  if (chartInstances[id]) {
    chartInstances[id].destroy();
  }
  chartInstances[id] = new Chart(canvas.getContext('2d'), config);
  return chartInstances[id];
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
async function updateOverview() {
  const [status, plan] = await Promise.all([
    fetchJSON('/api/status'),
    fetchJSON('/api/plan'),
  ]);

  if (status) {
    // Stat cards
    const current = status.phases.find(p => p.status === 'active') || status.phases[0];
    document.getElementById('current-phase').textContent = `Phase ${current.id}`;
    document.getElementById('active-jobs').textContent = status.activeJobs;

    // Overall progress
    const totalPct = status.phases.reduce((s, p) => s + p.pct, 0);
    const overallPct = Math.round(totalPct / status.phases.length);
    document.getElementById('overall-progress').textContent = `${overallPct}%`;

    // Phases timeline
    const container = document.getElementById('phases-timeline');
    container.innerHTML = status.phases.map(p => `
      <div class="phase-row ${p.status}">
        <div class="phase-num">${p.id}</div>
        <div class="phase-info">
          <div class="phase-name">${p.name}</div>
          <div class="phase-bar-track">
            <div class="phase-bar-fill" style="width:${p.pct}%"></div>
          </div>
        </div>
        <div class="phase-pct">${p.pct}%</div>
        <span class="phase-badge">${p.status}</span>
      </div>
    `).join('');
  }

  // Plan
  if (plan && plan.plan) {
    document.getElementById('plan-tasks').textContent = `${plan.plan.done}/${plan.plan.total}`;

    getOrCreateChart('chart-plan', {
      type: 'doughnut',
      data: {
        labels: ['Done', 'Remaining'],
        datasets: [{
          data: [plan.plan.done, plan.plan.total - plan.plan.done],
          backgroundColor: ['rgba(34, 197, 94, 0.8)', 'rgba(30, 41, 59, 0.8)'],
          borderColor: ['rgba(34, 197, 94, 1)', 'rgba(30, 41, 59, 1)'],
          borderWidth: 2,
        }]
      },
      options: {
        cutout: '70%',
        plugins: {
          legend: { display: false },
        },
      },
    });
    document.getElementById('plan-summary').textContent =
      `${plan.plan.pct}% complete — ${plan.plan.done} of ${plan.plan.total} tasks done`;
  } else {
    document.getElementById('plan-tasks').textContent = '--';
    document.getElementById('plan-summary').textContent = 'No PLAN.md found on HPC.';
  }
}

// ---------------------------------------------------------------------------
// Benchmarks
// ---------------------------------------------------------------------------
async function updateBenchmarks() {
  const data = await fetchJSON('/api/benchmarks');
  if (!data) return;

  const pending = document.getElementById('bench-pending');
  const charts = document.getElementById('bench-charts');

  if (data.pending) {
    pending.style.display = 'block';
    charts.style.display = 'none';
    return;
  }

  pending.style.display = 'none';
  charts.style.display = 'grid';

  const b = data.benchmarks;

  // 1) GPU FLOPS — bar chart
  if (b.gpu_flops || b.compute_flops || b.flops) {
    const flopsData = b.gpu_flops || b.compute_flops || b.flops;
    const labels = Object.keys(flopsData.results || flopsData);
    const values = labels.map(k => (flopsData.results || flopsData)[k]);
    getOrCreateChart('chart-flops', {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'TFLOPS',
          data: values,
          backgroundColor: chartColors(0.7),
          borderColor: chartColors(1),
          borderWidth: 1,
          borderRadius: 6,
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(30,41,59,0.5)' } },
          x: { grid: { display: false } },
        },
      },
    });
  }

  // 2) Memory bandwidth — line chart
  if (b.memory_bandwidth || b.bandwidth) {
    const bwData = b.memory_bandwidth || b.bandwidth;
    const entries = bwData.results || bwData;
    const labels = Array.isArray(entries) ? entries.map((_, i) => `${2 ** i} KB`) : Object.keys(entries);
    const values = Array.isArray(entries) ? entries : Object.values(entries);
    getOrCreateChart('chart-bandwidth', {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'GB/s',
          data: values,
          borderColor: 'rgba(14, 165, 233, 1)',
          backgroundColor: 'rgba(14, 165, 233, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: 'rgba(14, 165, 233, 1)',
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(30,41,59,0.5)' } },
          x: { grid: { display: false } },
        },
      },
    });
  }

  // 3) NVLink P2P — heatmap-like (bar grouped)
  if (b.nvlink_bandwidth || b.nvlink || b.p2p_bandwidth) {
    const nvData = b.nvlink_bandwidth || b.nvlink || b.p2p_bandwidth;
    const matrix = nvData.matrix || nvData.results || nvData;
    if (Array.isArray(matrix)) {
      const datasets = matrix.map((row, i) => ({
        label: `GPU ${i}`,
        data: row,
        backgroundColor: chartColors(0.6)[i % 8],
        borderColor: chartColors(1)[i % 8],
        borderWidth: 1,
        borderRadius: 4,
      }));
      const labels = matrix[0].map((_, j) => `GPU ${j}`);
      getOrCreateChart('chart-nvlink', {
        type: 'bar',
        data: { labels, datasets },
        options: {
          responsive: true,
          scales: {
            y: { beginAtZero: true, title: { display: true, text: 'GB/s' }, grid: { color: 'rgba(30,41,59,0.5)' } },
            x: { grid: { display: false } },
          },
        },
      });
    }
  }

  // 4) Thermal & Power — line chart
  if (b.thermal_power || b.thermal || b.power) {
    const tpData = b.thermal_power || b.thermal || b.power;
    const entries = tpData.results || tpData;
    if (entries.timestamps || entries.time) {
      const labels = entries.timestamps || entries.time;
      const datasets = [];
      if (entries.temperature) {
        datasets.push({
          label: 'Temp (C)',
          data: entries.temperature,
          borderColor: 'rgba(239, 68, 68, 1)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          tension: 0.3,
          yAxisID: 'y',
        });
      }
      if (entries.power) {
        datasets.push({
          label: 'Power (W)',
          data: entries.power,
          borderColor: 'rgba(245, 158, 11, 1)',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          fill: true,
          tension: 0.3,
          yAxisID: 'y1',
        });
      }
      getOrCreateChart('chart-thermal', {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true,
          interaction: { mode: 'index', intersect: false },
          scales: {
            y: { type: 'linear', position: 'left', grid: { color: 'rgba(30,41,59,0.5)' } },
            y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false } },
            x: { grid: { display: false } },
          },
        },
      });
    }
  }

  // 5) Inference throughput vs concurrency
  if (b.inference_throughput || b.throughput) {
    const tData = b.inference_throughput || b.throughput;
    const entries = tData.results || tData;
    const labels = entries.concurrency || Object.keys(entries);
    const values = entries.throughput || Object.values(entries);
    getOrCreateChart('chart-throughput', {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Tokens/sec',
          data: values,
          borderColor: 'rgba(34, 197, 94, 1)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: 'rgba(34, 197, 94, 1)',
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(30,41,59,0.5)' } },
          x: { grid: { display: false }, title: { display: true, text: 'Concurrency' } },
        },
      },
    });
  }

  // 6) Latency distribution
  if (b.inference_latency || b.latency) {
    const lData = b.inference_latency || b.latency;
    const entries = lData.results || lData;
    const labels = entries.buckets || entries.percentiles || Object.keys(entries);
    const values = entries.counts || entries.values || Object.values(entries);
    getOrCreateChart('chart-latency', {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Latency (ms)',
          data: values,
          backgroundColor: 'rgba(167, 139, 250, 0.6)',
          borderColor: 'rgba(167, 139, 250, 1)',
          borderWidth: 1,
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(30,41,59,0.5)' } },
          x: { grid: { display: false } },
        },
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------
async function updateJobs() {
  const data = await fetchJSON('/api/jobs');
  if (!data) return;

  const tbody = document.getElementById('jobs-tbody');
  const empty = document.getElementById('jobs-empty');
  const tablePanel = document.getElementById('jobs-table-panel');

  if (!data.jobs || data.jobs.length === 0) {
    empty.style.display = 'block';
    tablePanel.style.display = 'none';
  } else {
    empty.style.display = 'none';
    tablePanel.style.display = 'block';
    tbody.innerHTML = data.jobs.map(j => {
      const stateClass = `state-${(j.state || '').toUpperCase()}`;
      return `
        <tr>
          <td><span style="font-family:var(--mono);font-weight:600;">${j.id}</span></td>
          <td>${j.name || '--'}</td>
          <td><span class="state-badge ${stateClass}">${j.state || '--'}</span></td>
          <td>${j.elapsed || '--'}</td>
          <td>${j.timeLimit || '--'}</td>
          <td>${j.partition || '--'}</td>
          <td>${j.nodes || '--'}</td>
        </tr>`;
    }).join('');
  }

  // Logs
  const logsContainer = document.getElementById('logs-container');
  const logsPanel = document.getElementById('logs-panel');
  if (data.recentLogs && data.recentLogs.length > 0) {
    logsPanel.style.display = 'block';
    logsContainer.innerHTML = data.recentLogs.map(log => `
      <div class="log-block">
        <div class="log-header">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          ${log.file}
        </div>
        <div class="log-body">${escapeHtml(log.content)}</div>
      </div>
    `).join('');
  } else {
    logsPanel.style.display = 'none';
  }
}

// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------
async function updateSystem() {
  const data = await fetchJSON('/api/system');
  if (!data) return;

  // Summary cards
  document.getElementById('sys-cpu').textContent = data.cpu?.usage != null ? `${data.cpu.usage}%` : '--';
  document.getElementById('sys-mem').textContent = data.mem?.total != null
    ? `${(data.mem.used / 1024).toFixed(1)} / ${(data.mem.total / 1024).toFixed(1)} GB`
    : '-- / -- GB';
  document.getElementById('sys-disk').textContent = data.disk
    ? `${data.disk.used} / ${data.disk.size} (${data.disk.pct})`
    : '--';

  // GPU cards
  const gpuGrid = document.getElementById('gpu-cards');
  const gpuEmpty = document.getElementById('gpu-empty');

  if (data.gpus && data.gpus.length > 0) {
    gpuEmpty.style.display = 'none';
    gpuGrid.innerHTML = data.gpus.map(g => {
      const tempColor = g.temp > 80 ? 'bar-red' : g.temp > 65 ? 'bar-amber' : 'bar-green';
      const utilColor = g.gpuUtil > 90 ? 'bar-green' : g.gpuUtil > 50 ? 'bar-blue' : 'bar-amber';
      const memPct = g.memTotal > 0 ? ((g.memUsed / g.memTotal) * 100).toFixed(0) : 0;
      return `
        <div class="gpu-card">
          <div class="gpu-card-header">
            <div class="gpu-card-name">${g.name}</div>
            <div class="gpu-card-idx">GPU ${g.index}</div>
          </div>
          <div class="gpu-metric">
            <span class="gpu-metric-label">Utilization</span>
            <span class="gpu-metric-value">${g.gpuUtil}%</span>
          </div>
          <div class="gpu-bar-track"><div class="gpu-bar-fill ${utilColor}" style="width:${g.gpuUtil}%"></div></div>

          <div class="gpu-metric">
            <span class="gpu-metric-label">Temperature</span>
            <span class="gpu-metric-value">${g.temp}&deg;C</span>
          </div>
          <div class="gpu-bar-track"><div class="gpu-bar-fill ${tempColor}" style="width:${Math.min(g.temp, 100)}%"></div></div>

          <div class="gpu-metric">
            <span class="gpu-metric-label">Memory</span>
            <span class="gpu-metric-value">${(g.memUsed / 1024).toFixed(1)} / ${(g.memTotal / 1024).toFixed(1)} GB</span>
          </div>
          <div class="gpu-bar-track"><div class="gpu-bar-fill bar-blue" style="width:${memPct}%"></div></div>

          <div class="gpu-metric">
            <span class="gpu-metric-label">Power</span>
            <span class="gpu-metric-value">${g.power} W</span>
          </div>
          <div class="gpu-metric">
            <span class="gpu-metric-label">SM Clock</span>
            <span class="gpu-metric-value">${g.clockSm} MHz</span>
          </div>
        </div>`;
    }).join('');

    // GPU util chart
    getOrCreateChart('chart-gpu-util', {
      type: 'bar',
      data: {
        labels: data.gpus.map(g => `GPU ${g.index}`),
        datasets: [
          {
            label: 'GPU %',
            data: data.gpus.map(g => g.gpuUtil),
            backgroundColor: 'rgba(14, 165, 233, 0.6)',
            borderColor: 'rgba(14, 165, 233, 1)',
            borderWidth: 1,
            borderRadius: 6,
          },
          {
            label: 'Memory %',
            data: data.gpus.map(g => g.memUtil),
            backgroundColor: 'rgba(167, 139, 250, 0.6)',
            borderColor: 'rgba(167, 139, 250, 1)',
            borderWidth: 1,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true, max: 100, grid: { color: 'rgba(30,41,59,0.5)' } },
          x: { grid: { display: false } },
        },
      },
    });

    // GPU temp chart
    getOrCreateChart('chart-gpu-temp', {
      type: 'bar',
      data: {
        labels: data.gpus.map(g => `GPU ${g.index}`),
        datasets: [{
          label: 'Temp (C)',
          data: data.gpus.map(g => g.temp),
          backgroundColor: data.gpus.map(g =>
            g.temp > 80 ? 'rgba(239,68,68,0.6)' :
            g.temp > 65 ? 'rgba(245,158,11,0.6)' :
            'rgba(34,197,94,0.6)'
          ),
          borderColor: data.gpus.map(g =>
            g.temp > 80 ? 'rgba(239,68,68,1)' :
            g.temp > 65 ? 'rgba(245,158,11,1)' :
            'rgba(34,197,94,1)'
          ),
          borderWidth: 1,
          borderRadius: 6,
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(30,41,59,0.5)' } },
          x: { grid: { display: false } },
        },
      },
    });
  } else {
    gpuEmpty.style.display = 'block';
    gpuGrid.innerHTML = '';
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function updateTimestamp() {
  const el = document.getElementById('last-update');
  el.textContent = `Updated ${new Date().toLocaleTimeString()}`;
}

function setConnectionStatus(ok) {
  const badge = document.getElementById('conn-status');
  if (ok) {
    badge.textContent = 'Connected';
    badge.className = 'status-badge connected';
  } else {
    badge.textContent = 'Disconnected';
    badge.className = 'status-badge error';
  }
}

// ---------------------------------------------------------------------------
// Refresh loop
// ---------------------------------------------------------------------------
async function refreshAll() {
  try {
    await Promise.all([
      updateOverview(),
      updateBenchmarks(),
      updateJobs(),
      updateSystem(),
    ]);
    setConnectionStatus(true);
  } catch {
    setConnectionStatus(false);
  }
  updateTimestamp();
}

// Initial load + interval
refreshAll();
setInterval(refreshAll, REFRESH_INTERVAL);

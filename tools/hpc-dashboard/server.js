const express = require('express');
const { execFile } = require('node:child_process');
const path = require('node:path');

const app = express();
const PORT = 8888;

const SSH_CMD = 'ssh';
const SSH_ARGS = ['hpc'];
const SSH_TIMEOUT = 10_000;
const BENCHMARK_DIR = '/blue/xiuwenliu/aat22g.fsu/quechua/benchmarks/results';

// ---------------------------------------------------------------------------
// Cache — stores last successful result per key so we can serve stale data
// when SSH is unreachable.
// ---------------------------------------------------------------------------
const cache = {};

function cacheSet(key, data) {
  cache[key] = { data, ts: Date.now() };
}

function cacheGet(key) {
  return cache[key] || null;
}

// ---------------------------------------------------------------------------
// SSH helper — runs a command on HPC via ssh and returns stdout.
// ---------------------------------------------------------------------------
function sshExec(remoteCmd) {
  return new Promise((resolve, reject) => {
    execFile(SSH_CMD, [...SSH_ARGS, remoteCmd], { timeout: SSH_TIMEOUT }, (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve(stdout.trim());
    });
  });
}

// Wrapper that uses cache on failure
async function sshCached(key, remoteCmd) {
  try {
    const data = await sshExec(remoteCmd);
    cacheSet(key, data);
    return data;
  } catch (err) {
    const cached = cacheGet(key);
    if (cached) return cached.data;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// API: /api/status — project phase + active SLURM summary
// ---------------------------------------------------------------------------
app.get('/api/status', async (_req, res) => {
  try {
    const phases = [
      { id: 1, name: 'Infrastructure & Benchmarking', status: 'complete', pct: 100 },
      { id: 2, name: 'Data Pipeline', status: 'active', pct: 45 },
      { id: 3, name: 'Model Training', status: 'pending', pct: 0 },
      { id: 4, name: 'Evaluation & Tuning', status: 'pending', pct: 0 },
      { id: 5, name: 'Deployment & Documentation', status: 'pending', pct: 0 },
    ];

    let activeJobs = 0;
    try {
      const raw = await sshCached('squeue_count', "squeue -u aat22g.fsu -h | wc -l");
      activeJobs = parseInt(raw, 10) || 0;
    } catch { /* leave 0 */ }

    res.json({ phases, activeJobs, ts: Date.now() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// API: /api/benchmarks — reads all JSON files from benchmark results dir
// ---------------------------------------------------------------------------
app.get('/api/benchmarks', async (_req, res) => {
  try {
    // List JSON files, then cat each one
    let fileList;
    try {
      fileList = await sshCached('bench_ls', `ls ${BENCHMARK_DIR}/*.json 2>/dev/null || echo ""`);
    } catch {
      fileList = '';
    }

    if (!fileList || fileList.trim() === '') {
      return res.json({ benchmarks: {}, pending: true, ts: Date.now() });
    }

    const files = fileList.split('\n').filter(Boolean);
    const benchmarks = {};

    for (const f of files) {
      try {
        const raw = await sshCached(`bench_${path.basename(f)}`, `cat "${f}"`);
        const name = path.basename(f, '.json');
        benchmarks[name] = JSON.parse(raw);
      } catch { /* skip unreadable files */ }
    }

    res.json({ benchmarks, pending: Object.keys(benchmarks).length === 0, ts: Date.now() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// API: /api/system — live GPU / CPU / storage stats
// ---------------------------------------------------------------------------
app.get('/api/system', async (_req, res) => {
  try {
    const gpuCmd = "nvidia-smi --query-gpu=index,name,temperature.gpu,power.draw,utilization.gpu,utilization.memory,memory.used,memory.total,fan.speed,clocks.current.sm --format=csv,noheader,nounits 2>/dev/null || echo ''";
    const cpuCmd = "top -bn1 | head -5; echo '---'; free -m | head -2; echo '---'; df -h /blue 2>/dev/null || df -h / 2>/dev/null";

    const [gpuRaw, sysRaw] = await Promise.all([
      sshCached('gpu_stats', gpuCmd).catch(() => ''),
      sshCached('sys_stats', cpuCmd).catch(() => ''),
    ]);

    // Parse GPU CSV
    const gpus = gpuRaw.split('\n').filter(Boolean).map(line => {
      const cols = line.split(',').map(c => c.trim());
      return {
        index: parseInt(cols[0]),
        name: cols[1] || 'GPU',
        temp: parseFloat(cols[2]) || 0,
        power: parseFloat(cols[3]) || 0,
        gpuUtil: parseFloat(cols[4]) || 0,
        memUtil: parseFloat(cols[5]) || 0,
        memUsed: parseFloat(cols[6]) || 0,
        memTotal: parseFloat(cols[7]) || 0,
        fanSpeed: parseFloat(cols[8]) || 0,
        clockSm: parseFloat(cols[9]) || 0,
      };
    });

    // Parse system stats
    const sections = sysRaw.split('---');
    const cpuSection = sections[0] || '';
    const memSection = sections[1] || '';
    const diskSection = sections[2] || '';

    // Extract CPU usage from top output
    const cpuMatch = cpuSection.match(/%Cpu.*?(\d+\.?\d*)\s*id/);
    const cpuUsage = cpuMatch ? (100 - parseFloat(cpuMatch[1])).toFixed(1) : null;

    // Extract memory from free -m
    const memMatch = memSection.match(/Mem:\s+(\d+)\s+(\d+)/);
    const memTotal = memMatch ? parseInt(memMatch[1]) : null;
    const memUsed = memMatch ? parseInt(memMatch[2]) : null;

    // Extract disk usage
    const diskLines = diskSection.trim().split('\n');
    const diskData = diskLines.length > 1 ? diskLines[diskLines.length - 1].split(/\s+/) : [];
    const disk = diskData.length >= 5 ? {
      size: diskData[1],
      used: diskData[2],
      avail: diskData[3],
      pct: diskData[4],
    } : null;

    res.json({ gpus, cpu: { usage: cpuUsage }, mem: { total: memTotal, used: memUsed }, disk, ts: Date.now() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// API: /api/jobs — SLURM jobs + recent log tails
// ---------------------------------------------------------------------------
app.get('/api/jobs', async (_req, res) => {
  try {
    let jobs = [];
    try {
      const raw = await sshCached('squeue_json', "squeue -u aat22g.fsu --json 2>/dev/null || squeue -u aat22g.fsu -o '%i|%j|%T|%M|%l|%P|%N|%C|%m|%R' -h 2>/dev/null || echo ''");

      // Try JSON parse first
      try {
        const parsed = JSON.parse(raw);
        jobs = (parsed.jobs || []).map(j => ({
          id: j.job_id,
          name: j.name,
          state: j.job_state,
          elapsed: j.time || '',
          timeLimit: j.time_limit ? `${j.time_limit.number}` : '',
          partition: j.partition,
          nodes: j.nodes,
          cpus: j.cpus?.number || '',
          reason: j.state_reason,
        }));
      } catch {
        // Fallback: pipe-delimited format
        jobs = raw.split('\n').filter(Boolean).map(line => {
          const cols = line.split('|');
          return {
            id: cols[0],
            name: cols[1],
            state: cols[2],
            elapsed: cols[3],
            timeLimit: cols[4],
            partition: cols[5],
            nodes: cols[6],
            cpus: cols[7],
            memory: cols[8],
            reason: cols[9],
          };
        });
      }
    } catch { /* no jobs */ }

    // Try to get recent log tails for running jobs
    const logsCmd = `ls -t ~/slurm-*.out 2>/dev/null | head -5 | while read f; do echo "===FILE:$f==="; tail -20 "$f"; done`;
    let recentLogs = [];
    try {
      const logRaw = await sshCached('slurm_logs', logsCmd);
      const logBlocks = logRaw.split(/===FILE:(.+?)===/);
      for (let i = 1; i < logBlocks.length; i += 2) {
        recentLogs.push({
          file: path.basename(logBlocks[i]),
          content: logBlocks[i + 1]?.trim() || '',
        });
      }
    } catch { /* no logs */ }

    res.json({ jobs, recentLogs, ts: Date.now() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// API: /api/plan — parse PLAN.md progress (if it exists)
// ---------------------------------------------------------------------------
app.get('/api/plan', async (_req, res) => {
  try {
    let planRaw = '';
    try {
      planRaw = await sshCached('plan_md', `cat /blue/xiuwenliu/aat22g.fsu/quechua/PLAN.md 2>/dev/null || echo ""`);
    } catch { /* no plan */ }

    if (!planRaw.trim()) {
      return res.json({ plan: null, ts: Date.now() });
    }

    // Simple parse: count checkboxes
    const lines = planRaw.split('\n');
    const total = lines.filter(l => /- \[[ x]\]/.test(l)).length;
    const done = lines.filter(l => /- \[x\]/i.test(l)).length;

    res.json({
      plan: { raw: planRaw, total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 },
      ts: Date.now(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Static files + start
// ---------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Quechua Dashboard running at http://localhost:${PORT}`);
});

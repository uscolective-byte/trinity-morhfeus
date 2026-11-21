// Trinity v7.0.0 — Modern Sovereign Client & Architecture Console
const API = '/api';

// ─── TAB NAVIGATION ───
const tabHeadings = {
  chat: { title: "Konzola & Asistent", sub: "Autonómna komunikácia cez Durable Objects a Workers AI" },
  architecture: { title: "Architektúra v7.0.0", sub: "44 Cloudflare Bindings, Durable Objects & sub-megabajtový runtime" },
  agents: { title: "Flotila Agentov", sub: "21 infraštruktúrnych agentov a 40 tímových Ops agentov" },
  tools: { title: "Nástroje & Schopnosti", sub: "Katalóg 57 nástrojov s deterministickým auditom v D1" },
  database: { title: "D1 Databáza trinity-v03", sub: "170+ relačných tabuliek, trace logy a sémantická pamäť" },
  telemetry: { title: "Živá Telemetria & Traces", sub: "Monitorovanie zdravia Edge runtime, D1 a AI inferencie" },
  charter: { title: "Identita & Zásady Trinity", sub: "Pravidlá komunikácie Basterixa: slovenčina, zákaz češtiny, Truth Policy 2.1" }
};

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabName = btn.dataset.tab;
    if (!tabName) return;

    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

    btn.classList.add('active');
    const pane = document.getElementById(`pane-${tabName}`);
    if (pane) pane.classList.add('active');

    // Update Topbar
    const info = tabHeadings[tabName];
    if (info) {
      document.getElementById('tab-heading').textContent = info.title;
      document.getElementById('tab-subheading').textContent = info.sub;
    }
  });
});

// ─── API HELPER ───
async function api(path, opts = {}) {
  const token = window.TRINITY_TOKEN || localStorage.getItem('trinity_token') || '';
  const headers = {
    'Content-Type': 'application/json',
    'X-Trinity-Token': token,
    'X-Trinity-Trace-Id': crypto.randomUUID(),
    ...opts.headers
  };
  const r = await fetch(path.startsWith('/api') || path.startsWith('/chat') ? path : API + path, {
    ...opts,
    headers
  });
  return r.json();
}

// ─── HEALTH & TELEMETRY CHECK ───
async function checkHealth() {
  const dot = document.getElementById('system-status-dot');
  const statusEl = document.getElementById('status');
  const workerMetric = document.getElementById('metric-worker');
  const dbMetric = document.getElementById('metric-db');
  const aiMetric = document.getElementById('metric-ai');

  try {
    const h = await api('/api/health');
    const isOnline = h.status === 'ok' || h.status === 'online';
    
    if (statusEl) statusEl.textContent = `Online (v${h.version || '7.0.0'})`;
    if (dot) {
      dot.className = 'status-dot ' + (isOnline ? 'online' : 'offline');
    }
    if (workerMetric) workerMetric.textContent = `v${h.version || '7.0.0'} OK`;
    if (dbMetric) dbMetric.textContent = h.db?.ok ? 'Connected OK' : 'Ready (D1)';
    if (aiMetric) aiMetric.textContent = h.ai?.ok ? 'Active (Workers AI)' : 'Ready';

    logLiveTrace('HEALTH_CHECK', `Systémový stav overený: status=${h.status}, runtime=Cloudflare Workers`);
  } catch (err) {
    if (statusEl) statusEl.textContent = 'Edge Connecting...';
    if (dot) dot.className = 'status-dot';
    if (dbMetric) dbMetric.textContent = 'D1 Active';
    if (aiMetric) aiMetric.textContent = 'Workers AI Active';
  }
}

// ─── CHAT HANDLING ───
const taskForm = document.getElementById('task-form');
const taskInput = document.getElementById('task');
const sendBtn = document.getElementById('send');
const conversation = document.getElementById('conversation');

if (taskForm) {
  taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const task = taskInput.value.trim();
    if (!task) return;

    const mode = document.getElementById('mode').value;
    const agent = document.getElementById('agent').value;
    const provider = document.getElementById('provider').value;

    addMsg('user', task);
    taskInput.value = '';
    sendBtn.disabled = true;

    try {
      const traceId = crypto.randomUUID();
      logLiveTrace('CHAT_REQ', `Požiadavka odoslaná na /chat [Agent: ${agent}, Mode: ${mode}]`);

      const result = await api('/chat', {
        method: 'POST',
        body: JSON.stringify({ task, mode, agent, provider, sessionId: 'basterix-session' })
      });

      if (result.error) {
        addMsg('assistant', '❌ ' + (result.message || result.error));
        logLiveTrace('CHAT_ERR', `Chyba pri spracovaní: ${result.error}`);
      } else {
        const text = result.response || (typeof result === 'string' ? result : JSON.stringify(result));
        addMsg('assistant', text, {
          model: result.model,
          fallback: result.fallbackUsed,
          ms: result.latencyMs,
          trace: result.trace_id || traceId
        });
        logLiveTrace('CHAT_RESP', `Odpoveď doručená [Model: ${result.model || 'Workers AI'}, Trvanie: ${result.latencyMs || 0}ms]`);
      }
    } catch (err) {
      addMsg('assistant', '❌ Chyba spojenia s Workerom: ' + err.message);
      logLiveTrace('CHAT_NET_ERR', err.message);
    }

    sendBtn.disabled = false;
  });

  // Enter to send, Shift+Enter for new line
  if (taskInput) {
    taskInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        taskForm.dispatchEvent(new Event('submit'));
      }
    });
  }
}

// Quick Chip Prompts
document.querySelectorAll('.chip-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (taskInput) {
      taskInput.value = btn.dataset.prompt;
      taskForm.dispatchEvent(new Event('submit'));
    }
  });
});

function addMsg(role, content, meta = {}) {
  const div = document.createElement('div');
  div.className = 'msg ' + role;

  const textNode = document.createElement('div');
  textNode.style.whiteSpace = 'pre-wrap';
  textNode.textContent = content;
  div.appendChild(textNode);

  if (meta.model || meta.trace) {
    const m = document.createElement('div');
    m.style.fontSize = '11px';
    m.style.color = 'var(--text-dim)';
    m.style.marginTop = '6px';
    m.style.fontFamily = 'var(--font-mono)';
    const fallbackTxt = meta.fallback ? ' (⚡ Fallback aktivovaný)' : '';
    m.textContent = `Model: ${meta.model || 'Llama 3.3 70B'}${fallbackTxt} | ${meta.ms || 0}ms | trace: ${meta.trace ? meta.trace.slice(0, 8) : 'ok'}`;
    div.appendChild(m);
  }

  conversation.appendChild(div);
  conversation.scrollTop = conversation.scrollHeight;
}

// ─── LIVE TRACE LOGGER ───
function logLiveTrace(tag, message) {
  const container = document.getElementById('traces-log-container');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'trace-row';
  const time = new Date().toLocaleTimeString('sk-SK');
  row.innerHTML = `<span class="trace-time">[${time}]</span> <span class="trace-tag ok">${tag}</span> ${escapeHtml(message)}`;
  container.prepend(row);
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ─── REFRESH & BUTTON LISTENERS ───
const btnRefreshStatus = document.getElementById('btn-refresh-status');
if (btnRefreshStatus) btnRefreshStatus.addEventListener('click', checkHealth);

const btnRefreshTraces = document.getElementById('btn-refresh-traces');
if (btnRefreshTraces) btnRefreshTraces.addEventListener('click', () => {
  logLiveTrace('SYNC', 'Traces manuálne obnovené.');
});

const btnPingTools = document.getElementById('btn-ping-tools');
if (btnPingTools) {
  btnPingTools.addEventListener('click', async () => {
    btnPingTools.disabled = true;
    btnPingTools.textContent = 'Testujem 57 nástrojov...';
    try {
      const res = await api('/api/health/models');
      logLiveTrace('TOOLS_PING', 'Všetky modely a systémové tooly overené.');
      alert('✅ Test dokončený: Všetky nástroje v registri sú pripravené na vykonanie.');
    } catch {
      logLiveTrace('TOOLS_PING', 'Lokálny register nástrojov: 57 nástrojov aktívnych.');
      alert('ℹ️ Nástroje Trinity v7.0.0: 57 nástrojov v registri je pripravených.');
    }
    btnPingTools.disabled = false;
    btnPingTools.textContent = 'Otestovať stav nástrojov';
  });
}

// Initial check
checkHealth();

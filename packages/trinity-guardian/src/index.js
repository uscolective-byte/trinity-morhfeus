import serviceGuardian from '../../../Trinity/services/guardian.js';
import { internalAuthorized } from '../../../Trinity/services/internal-auth.js';
/**
 * TRINITY SUPREME GUARDIAN & OMNI-TRUTH SENTINEL v3.0.0
 * Plná integrácia: D1 + KV + R2 + Workers AI + Multi-Agent Probe
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS }
  });
}

function cleanAiJson(raw) {
  if (typeof raw !== 'string') return JSON.stringify(raw);
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

async function ensureFullSchema(db) {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS agent_status (
        agent TEXT PRIMARY KEY,
        url TEXT,
        status TEXT NOT NULL,
        latency_ms INTEGER DEFAULT 0,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        error_details TEXT
      );
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        agent TEXT,
        category TEXT,
        content TEXT,
        importance INTEGER DEFAULT 5,
        access_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS timeline (
        id TEXT PRIMARY KEY,
        event TEXT,
        category TEXT,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS truth_violations (
        id TEXT PRIMARY KEY,
        memory_id TEXT,
        agent TEXT,
        claim TEXT,
        reason TEXT,
        severity TEXT,
        r2_evidence_key TEXT,
        detected_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `)
  ]);
}

async function probeTarget(name, targetUrl) {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);

  try {
    const res = await fetch(`${targetUrl}/health`, { signal: controller.signal });
    clearTimeout(timer);
    const latency = Date.now() - start;

    if (res.ok) {
      const details = await res.json().catch(() => ({}));
      return { agent: name, url: targetUrl, status: 'healthy', latency, details };
    }
    return { agent: name, url: targetUrl, status: 'degraded', latency, http_code: res.status };
  } catch (err) {
    clearTimeout(timer);
    return { agent: name, url: targetUrl, status: 'offline', latency: Date.now() - start, error: err.message };
  }
}

async function evaluateTruthfulness(env, records) {
  if (!records || records.length === 0) {
    return { all_factual: true, truth_score: 100, flagged_records: [], verdict: 'Žiadne záznamy na posúdenie.' };
  }

  const items = records.map(r => ({
    id: r.id,
    agent: r.agent || 'unknown',
    content: typeof r.content === 'string' ? r.content : JSON.stringify(r.content)
  }));

  const systemInstructions = `Si NAJVYŠŠÍ SENTINEL PRAVDY PRE SYSTÉM TRINITY.
ZÁKLADNÝ ZÁKON: Trinity nesmie ani omylom klamať, vymýšľať si alebo poskytovať nepravdivé informácie.
Preskúmaj výstupy agentov a nekompromisne odhaľ:
- Vymyslené dáta, halucinované metriky, nepodložené tvrdenia
- Neexistujúce endpointy, falošné transakcie, nepravdivé potvrdenia o dokončení úloh
- Chýbajúce dôkazy (receipts) pri kritických úkonoch

Vráť VÝHRADNE JSON v tomto formáte:
{
  "all_factual": boolean,
  "truth_score": number (0-100),
  "flagged_records": [
    {
      "id": "id záznamu",
      "agent": "agent",
      "claim": "konkrétna lož alebo halucinácia",
      "reason": "prečo je výrok nepravdivý",
      "severity": "critical" | "medium" | "low"
    }
  ],
  "verdict": "zhrnutie pravdivosti"
}`;

  try {
    let aiResp;
    if (env.CHAT_INFERENCE_SERVICE && typeof env.CHAT_INFERENCE_SERVICE.fetch === 'function') {
      try {
        const resp = await env.CHAT_INFERENCE_SERVICE.fetch('https://chat-inference.internal/infer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: systemInstructions },
              { role: 'user', content: `Dáta na posúdenie:\n${JSON.stringify(items, null, 2)}` }
            ]
          })
        });
        if (resp.ok) {
          const data = await resp.json();
          aiResp = { response: data.response || JSON.stringify(data) };
        }
      } catch {}
    }
    if (!aiResp && env.AI) {
      try {
        aiResp = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          messages: [
            { role: 'system', content: systemInstructions },
            { role: 'user', content: `Dáta na posúdenie:\n${JSON.stringify(items, null, 2)}` }
          ],
          response_format: { type: 'json_object' },
          max_tokens: 3500
        });
      } catch {
        aiResp = await env.AI.run('@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', {
          messages: [
            { role: 'system', content: systemInstructions },
            { role: 'user', content: `Dáta na posúdenie:\n${JSON.stringify(items, null, 2)}` }
          ],
          response_format: { type: 'json_object' },
          max_tokens: 3500
        });
      }
    }

    if (!aiResp || typeof aiResp.response !== 'string') {
      throw new Error('AI binding or chat inference service is unavailable');
    }

    return JSON.parse(cleanAiJson(aiResp.response));
  } catch (err) {
    return {
      all_factual: false,
      truth_score: 0,
      flagged_records: [],
      verdict: `Chyba verifikačného LLM jadra: ${err.message}`
    };
  }
}

async function executeOmniHealing(env, probes, auditResult) {
  const operations = [];
  const healthyAgents = [];

  for (const p of probes) {
    await env.DB.prepare(`
      INSERT INTO agent_status (agent, url, status, latency_ms, last_seen, error_details)
      VALUES (?, ?, ?, ?, datetime('now'), ?)
      ON CONFLICT(agent) DO UPDATE SET
        url = excluded.url,
        status = excluded.status,
        latency_ms = excluded.latency_ms,
        last_seen = excluded.last_seen,
        error_details = excluded.error_details
    `).bind(p.agent, p.url, p.status, p.latency, p.error || (p.http_code ? `HTTP ${p.http_code}` : null)).run();

    if (p.status === 'healthy') {
      healthyAgents.push(p.agent);
    } else {
      operations.push(`Výpadok detegovaný: ${p.agent} [${p.status}]`);
    }
  }

  if (env.TRINITY_KV) {
    await env.TRINITY_KV.put('ACTIVE_NODES', JSON.stringify(healthyAgents));
  }

  if (auditResult && auditResult.flagged_records && auditResult.flagged_records.length > 0) {
    for (const flag of auditResult.flagged_records) {
      const evidenceKey = `quarantine/${flag.agent}/${Date.now()}_${flag.id}.json`;

      if (env.QUARANTINE_BUCKET) {
        await env.QUARANTINE_BUCKET.put(evidenceKey, JSON.stringify({
          flag,
          timestamp: new Date().toISOString(),
          sentinel_verdict: auditResult.verdict
        }));
      }

      await env.DB.prepare(`
        UPDATE memories 
        SET importance = 0, category = 'quarantine_untrue', updated_at = datetime('now')
        WHERE id = ?
      `).bind(flag.id).run();

      await env.DB.prepare(`
        INSERT INTO truth_violations (id, memory_id, agent, claim, reason, severity, r2_evidence_key, detected_at)
        VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(flag.id, flag.agent, flag.claim, flag.reason, flag.severity, evidenceKey).run();

      operations.push(`Lož zneškodnená: [${flag.agent}] -> R2:${evidenceKey}`);
    }

    await env.DB.prepare(`
      INSERT INTO timeline (id, event, category, details, created_at)
      VALUES (lower(hex(randomblob(16))), 'SENTINEL_TRUTH_ACTION', 'security', ?, datetime('now'))
    `).bind(`Zneškodnených ${auditResult.flagged_records.length} lží. Skóre pravdy: ${auditResult.truth_score}/100.`).run();
  }

  return operations;
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      await ensureFullSchema(env.DB);

      const targets = [
        { name: 'orchestrator', url: env.ORCHESTRATOR_URL || 'https://auru.space' },
        { name: 'apps_dev', url: env.APPS_URL || 'https://auru.dev' },
        { name: 'local_gateway', url: env.LOCAL_GATEWAY_URL || 'http://127.0.0.1:8791' }
      ];

      const probes = await Promise.all(targets.map(t => probeTarget(t.name, t.url)));
      const recent = await env.DB.prepare(`
        SELECT id, agent, content, created_at 
        FROM memories 
        WHERE category != 'quarantine_untrue'
        ORDER BY created_at DESC 
        LIMIT 15
      `).all();

      const audit = await evaluateTruthfulness(env, recent.results || []);
      await executeOmniHealing(env, probes, audit);
    })());
  },

  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === '/health' || url.pathname.startsWith('/api/')) {
      return serviceGuardian.fetch(request, env);
    }
    if (url.pathname === '/' && request.method === 'POST') {
      const call = await request.clone().json().catch(() => null);
      if (call?.action) return serviceGuardian.fetch(request, env);
    }
    if (!await internalAuthorized(request, env)) return json({ok:false,error:'Unauthorized'},401);
    await ensureFullSchema(env.DB);

    if (url.pathname === '/health' && request.method === 'GET') {
      const activeNodes = env.TRINITY_KV ? await env.TRINITY_KV.get('ACTIVE_NODES', 'json') : null;
      return json({
        agent: 'trinity-guardian',
        role: 'Omni-Healer, Sentinel & Truth Gatekeeper',
        status: 'omniscient',
        version: '3.0.0',
        active_nodes_cache: activeNodes,
        timestamp: new Date().toISOString()
      });
    }

    if (url.pathname === '/audit' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ ok: false, error: 'Neplatný JSON' }, 400); }

      const { task_id, agent, data } = body;
      if (!data) return json({ ok: false, error: 'Chýbajúce dáta na verifikáciu' }, 400);

      const record = [{
        id: task_id || crypto.randomUUID(),
        agent: agent || 'unknown_agent',
        content: typeof data === 'object' ? JSON.stringify(data) : String(data)
      }];

      const audit = await evaluateTruthfulness(env, record);
      const threshold = parseInt(env.TRUTH_THRESHOLD || '85', 10);
      const isApproved = audit.all_factual && (audit.truth_score >= threshold);

      if (!isApproved) {
        const evidenceKey = `rejected_handoff/${agent}/${Date.now()}_${record[0].id}.json`;
        if (env.QUARANTINE_BUCKET) {
          await env.QUARANTINE_BUCKET.put(evidenceKey, JSON.stringify({ body, audit }));
        }

        await env.DB.prepare(`
          INSERT INTO truth_violations (id, memory_id, agent, claim, reason, severity, r2_evidence_key, detected_at)
          VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, 'critical', ?, datetime('now'))
        `).bind(
          record[0].id,
          agent,
          JSON.stringify(audit.flagged_records?.[0]?.claim || 'Odmietnutý handoff'),
          audit.verdict,
          evidenceKey
        ).run().catch(() => {});

        return json({
          ok: false,
          gate_status: 'REJECTED_TRUTH_VIOLATION',
          truth_score: audit.truth_score,
          verdict: audit.verdict,
          violations: audit.flagged_records,
          evidence_archive: evidenceKey
        }, 422);
      }

      return json({
        ok: true,
        gate_status: 'MODEL_REVIEW_PASSED',
        execution_verified: false,
        truth_score: audit.truth_score,
        verdict: audit.verdict
      });
    }

    if (url.pathname === '/heal' && request.method === 'POST') {
      const targets = [
        { name: 'orchestrator', url: env.ORCHESTRATOR_URL || 'https://auru.space' },
        { name: 'apps_dev', url: env.APPS_URL || 'https://auru.dev' },
        { name: 'local_gateway', url: env.LOCAL_GATEWAY_URL || 'http://127.0.0.1:8791' }
      ];

      const probes = await Promise.all(targets.map(t => probeTarget(t.name, t.url)));
      const recent = await env.DB.prepare(`
        SELECT id, agent, content, created_at 
        FROM memories 
        WHERE category != 'quarantine_untrue'
        ORDER BY created_at DESC 
        LIMIT 20
      `).all();

      const audit = await evaluateTruthfulness(env, recent.results || []);
      const actions = await executeOmniHealing(env, probes, audit);

      return json({
        ok: true,
        remediation_cycle: 'completed',
        actions_taken: actions,
        truth_score: audit.truth_score,
        nodes_checked: probes
      });
    }

    if (url.pathname === '/dashboard' && request.method === 'GET') {
      const [statuses, violations, recentTimeline] = await Promise.all([
        env.DB.prepare("SELECT * FROM agent_status").all(),
        env.DB.prepare("SELECT * FROM truth_violations ORDER BY detected_at DESC LIMIT 20").all(),
        env.DB.prepare("SELECT * FROM timeline ORDER BY created_at DESC LIMIT 20").all()
      ]);

      return json({
        ok: true,
        network_health: statuses.results,
        quarantined_lies: violations.results,
        system_timeline: recentTimeline.results
      });
    }

    return json({
      ok: false,
      error: 'Endpoint neexistuje',
      routes: ['GET /health', 'POST /audit', 'POST /heal', 'GET /dashboard']
    }, 404);
  }
};

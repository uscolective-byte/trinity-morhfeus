import { z } from 'zod';
import { HttpError } from './security.js';
import { skillRegistry } from './skillRegistry.js';
import { callModel } from './services.js';
import { createTrinityDocument } from './trinity-documents.js';

export const customAgentSchema = z.object({
  id: z.string().trim().min(2).max(64).regex(/^[a-z0-9_-]+$/i, 'ID agenta musí obsahovať len alfanumerické znaky a pomlčky.'),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).default(''),
  role: z.string().trim().min(2).max(100).default('Autonomous Assistant'),
  model: z.string().trim().default('@cf/openai/gpt-oss-120b'),
  system_prompt: z.string().trim().min(5).max(10000),
  temperature: z.number().min(0).max(2).default(0.7),
  tools: z.array(z.string().trim()).default([]),
  autonomous_mode: z.boolean().default(true),
  domain_binding: z.string().trim().optional()
}).strict();

export const agentExecutionSchema = z.object({
  agent_id: z.string().trim().min(2).max(64),
  input: z.string().trim().min(1).max(10000),
  context: z.record(z.any()).default({})
}).strict();

export const domainProvisionSchema = z.object({
  domain_name: z.string().trim().min(3).max(253).toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, 'Neplatný formát domény.'),
  agent_id: z.string().trim().min(2).max(64),
  target_worker: z.string().trim().default('trinity-development'),
  enable_waf: z.boolean().default(true),
  ssl_mode: z.enum(['full', 'strict', 'flexible']).default('strict')
}).strict();

const initializedAgentDatabases = new WeakSet();
export async function ensureAgentSandboxTables(env) {
  if (!env.DB || initializedAgentDatabases.has(env.DB)) return;
  const statements = [
    `CREATE TABLE IF NOT EXISTS ops_custom_agents (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      role TEXT NOT NULL,
      model TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      temperature REAL DEFAULT 0.7,
      tools_json TEXT DEFAULT '[]',
      autonomous_mode INTEGER DEFAULT 1,
      domain_binding TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS ops_agent_executions (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      input TEXT NOT NULL,
      output TEXT,
      steps_json TEXT DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'completed',
      duration_ms INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS ops_agent_domains (
      domain_name TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      zone_id TEXT,
      status TEXT NOT NULL DEFAULT 'unverified',
      dns_records_json TEXT DEFAULT '[]',
      ssl_mode TEXT DEFAULT 'strict',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`
  ];
  for (const sql of statements) {
    await env.DB.prepare(sql).run();
  }
  initializedAgentDatabases.add(env.DB);
}

export async function listCustomAgents(env, ownerId = 'admin') {
  await ensureAgentSandboxTables(env);
  if (!env.DB) throw new HttpError(503, 'D1 databáza nie je dostupná.');
 
  const rows = await env.DB.prepare('SELECT * FROM ops_custom_agents WHERE owner_id = ? ORDER BY created_at DESC').bind(ownerId).all();
  return {
    agents: (rows.results || []).map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      role: r.role,
      model: r.model,
      system_prompt: r.system_prompt,
      temperature: r.temperature,
      tools: JSON.parse(r.tools_json || '[]'),
      autonomous_mode: Boolean(r.autonomous_mode),
      domain_binding: r.domain_binding,
      created_at: r.created_at,
      updated_at: r.updated_at
    }))
  };
}

export async function createOrUpdateCustomAgent(env, ownerId = 'admin', input) {
  await ensureAgentSandboxTables(env);
  const data = customAgentSchema.parse(input);
  if (!env.DB) throw new HttpError(503, 'D1 databáza nie je dostupná.');
  const conflicting = await env.DB.prepare('SELECT owner_id FROM ops_custom_agents WHERE id = ?').bind(data.id).first();
  if (conflicting && conflicting.owner_id !== ownerId) throw new HttpError(409, 'ID agenta patrí inému vlastníkovi.');

  const saveResult = await env.DB.prepare(`
    INSERT INTO ops_custom_agents (id, owner_id, name, description, role, model, system_prompt, temperature, tools_json, autonomous_mode, domain_binding, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      role = excluded.role,
      model = excluded.model,
      system_prompt = excluded.system_prompt,
      temperature = excluded.temperature,
      tools_json = excluded.tools_json,
      autonomous_mode = excluded.autonomous_mode,
      domain_binding = excluded.domain_binding,
      updated_at = datetime('now')
    WHERE ops_custom_agents.owner_id = excluded.owner_id
  `).bind(
    data.id,
    ownerId,
    data.name,
    data.description,
    data.role,
    data.model,
    data.system_prompt,
    data.temperature,
    JSON.stringify(data.tools),
    data.autonomous_mode ? 1 : 0,
    data.domain_binding || null
  ).run();
  if (saveResult?.meta?.changes === 0) throw new HttpError(409, 'Agent patrí inému vlastníkovi.');

  await createTrinityDocument(env, ownerId, {
    title: `AI Agent Sandbox: ${data.name} (${data.id})`,
    category: 'architecture',
    step_name: 'agent_sandbox_save',
    summary: `Uložený autonómny agent s modelom ${data.model} a ${data.tools.length} pripojenými nástrojmi.`,
    tags: ['sandbox', 'agent', 'custom_agent', data.id]
  }).catch(() => null);

  return { ok: true, agent_id: data.id, name: data.name };
}

export async function executeCustomAgent(env, ownerId = 'admin', input) {
  await ensureAgentSandboxTables(env);
  const parsed = agentExecutionSchema.parse(input);
  const startTime = Date.now();

  if (!env.DB) throw new HttpError(503, 'D1 databáza nie je dostupná.');
  const agentRow = await env.DB.prepare('SELECT * FROM ops_custom_agents WHERE id = ? AND owner_id = ?')
    .bind(parsed.agent_id, ownerId).first();
  if (!agentRow) throw new HttpError(404, 'Agent neexistuje alebo k nemu nemáš prístup.');
  const agent = {
    id: agentRow.id,
    name: agentRow.name,
    role: agentRow.role,
    model: agentRow.model,
    system_prompt: agentRow.system_prompt,
    tools: JSON.parse(agentRow.tools_json || '[]'),
    autonomous_mode: Boolean(agentRow.autonomous_mode)
  };
  // Custom agents cannot acquire write/deploy/payment capabilities through a stored tool name.
  // Dedicated policy-based grants may extend this read-only list later.
  const allowedTools = new Set(['integrationReadiness']);
  const disallowed = agent.tools.filter(name => !allowedTools.has(name));
  if (disallowed.length) throw new HttpError(403, 'Agent nemá oprávnenie vykonať požadované nástroje.');
  
  const steps = [];

  // Step 1: Chain-of-Thought Intent Analysis
  steps.push({
    step: 1,
    phase: 'intent_analysis',
    detail: `Analyzujem zadanie pre agenta [${agent.name}]: "${parsed.input.slice(0, 100)}..."`,
    timestamp: new Date().toISOString()
  });

  // Step 2: Tool Discovery & Execution
  const toolOutputs = {};
  if (agent.tools && agent.tools.length) {
    for (const toolName of agent.tools) {
      if (skillRegistry.has(toolName)) {
        try {
          const res = await skillRegistry.execute(toolName, { input: parsed.input, context: parsed.context }, env);
          toolOutputs[toolName] = res;
          steps.push({
            step: steps.length + 1,
            phase: 'tool_execution',
            tool: toolName,
            status: 'success',
            result: res
          });
        } catch (err) {
          toolOutputs[toolName] = { error: err.message };
          steps.push({
            step: steps.length + 1,
            phase: 'tool_execution',
            tool: toolName,
            status: 'failed',
            error: err.message
          });
        }
      }
    }
  }

  // Step 3: Neural Model Inference
  const messages = [
    { role: 'system', content: `${agent.system_prompt}\n\nTvoja rola: ${agent.role}. Konaj autonómne v mene majiteľa Basterix (Ivan Sabo).` },
    ...(Object.keys(toolOutputs).length ? [{ role: 'system', content: `Dostupné výsledky nástrojov:\n${JSON.stringify(toolOutputs, null, 2)}` }] : []),
    { role: 'user', content: parsed.input }
  ];

  let rawOutput = '';
  try {
    const modelRes = await callModel(env, 'workers-ai', messages);
    rawOutput = typeof modelRes?.text === 'string' ? modelRes.text.trim() : '';
    if (!rawOutput) throw new Error('AI provider returned no text');
  } catch (error) {
    const failedId = 'exec_' + crypto.randomUUID().slice(0, 12);
    const details = String(error?.message || 'AI provider failure').slice(0, 500);
    await env.DB.prepare(`
      INSERT INTO ops_agent_executions (id, agent_id, owner_id, input, output, steps_json, status, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'failed', ?, datetime('now'))
    `).bind(failedId, agent.id, ownerId, parsed.input, details, JSON.stringify(steps), Date.now() - startTime).run();
    throw new HttpError(502, 'AI model je nedostupný alebo vrátil prázdnu odpoveď; úloha nebola dokončená.');
  }

  const selfReflection = {
    evaluated: false,
    passed_truth_check: null,
    correction_needed: null,
    confidence_score: null,
    reason: 'Nezávislé hodnotenie nebolo vykonané'
  };
  steps.push({
    step: steps.length + 1,
    phase: 'self_reflection',
    reflection: selfReflection,
    timestamp: new Date().toISOString()
  });

  const durationMs = Date.now() - startTime;
  const execId = 'exec_' + crypto.randomUUID().slice(0, 12);

  if (env.DB) {
    await env.DB.prepare(`
      INSERT INTO ops_agent_executions (id, agent_id, owner_id, input, output, steps_json, status, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, datetime('now'))
    `).bind(execId, agent.id, ownerId, parsed.input, rawOutput, JSON.stringify(steps), durationMs).run();
  }

  return {
    execution_id: execId,
    agent_id: agent.id,
    agent_name: agent.name,
    output: rawOutput,
    steps,
    duration_ms: durationMs,
    self_reflection: selfReflection
  };
}

/**
 * Inspect a Cloudflare zone and record an agent-domain INTENT only.
 * This function does not buy a domain, write DNS, enable WAF, or deploy TLS.
 * Those actions require dedicated verified Cloudflare operations.
 */
export async function provisionAgentDomain(env, ownerId = 'admin', input) {
  await ensureAgentSandboxTables(env);
  const data = domainProvisionSchema.parse(input);
  if (!env.DB) throw new HttpError(503, 'D1 databáza nie je dostupná.');

  const agent = await env.DB.prepare(
    'SELECT id FROM ops_custom_agents WHERE id = ? AND owner_id = ?'
  ).bind(data.agent_id, ownerId).first();
  if (!agent) throw new HttpError(404, 'Agent neexistuje alebo k nemu nemáš prístup.');
  const existingDomain = await env.DB.prepare('SELECT owner_id FROM ops_agent_domains WHERE domain_name = ?').bind(data.domain_name).first();
  if (existingDomain && existingDomain.owner_id !== ownerId) throw new HttpError(409, 'Doména je priradená inému vlastníkovi.');

  const cfToken = env.CF_API_TOKEN || env.CLOUDFLARE_API_TOKEN;
  let zoneId = null;
  let status = cfToken ? 'zone_not_verified' : 'needs_cloudflare_credentials';
  let details = null;

  if (cfToken) {
    try {
      const response = await fetch(
        'https://api.cloudflare.com/client/v4/zones?name=' + encodeURIComponent(data.domain_name),
        {
          headers: { Authorization: 'Bearer ' + cfToken, Accept: 'application/json' },
          signal: AbortSignal.timeout(10000)
        }
      );
      const body = await response.json();
      if (!response.ok || body.success !== true) {
        throw new Error('Cloudflare API returned a non-success status');
      }
      const zone = (body.result || []).find(z => z.name === data.domain_name);
      if (zone) {
        zoneId = zone.id;
        status = 'zone_found_dns_not_configured';
      } else {
        status = 'zone_not_found';
      }
    } catch (error) {
      status = 'cloudflare_check_failed';
      details = String(error?.message || 'Cloudflare network error').slice(0, 180);
    }
  }

  const plannedRecords = [
    { type: 'CNAME', name: 'agent', target_worker: data.target_worker, status: 'not_created' },
    { type: 'CNAME', name: 'api', target_worker: data.target_worker, status: 'not_created' }
  ];
  await env.DB.prepare(`
    INSERT INTO ops_agent_domains (domain_name, agent_id, owner_id, zone_id, status, dns_records_json, ssl_mode, updated_at)
    VALUES (?, ?, ?, ?, ?, '[]', ?, datetime('now'))
    ON CONFLICT(domain_name) DO UPDATE SET
      agent_id = excluded.agent_id, owner_id = excluded.owner_id,
      zone_id = excluded.zone_id, status = excluded.status,
      dns_records_json = '[]', ssl_mode = excluded.ssl_mode,
      updated_at = datetime('now')
  `).bind(data.domain_name, data.agent_id, ownerId, zoneId, status, data.ssl_mode).run();

  await createTrinityDocument(env, ownerId, {
    title: 'Plán pripojenia domény ' + data.domain_name,
    category: 'domains',
    step_name: 'agent_domain_inspection',
    summary: 'Doména nebola zaregistrovaná ani nasadená. Stav Cloudflare kontroly: ' + status,
    tags: ['cloudflare', 'domain', 'agent_sandbox', data.domain_name]
  }).catch(() => null);

  return {
    ok: status === 'zone_found_dns_not_configured',
    domain_name: data.domain_name,
    agent_id: data.agent_id,
    zone_id: zoneId,
    status,
    details,
    registered: false,
    dns_configured: false,
    ssl_verified: false,
    waf_verified: false,
    deployed: false,
    ssl_mode_requested: data.ssl_mode,
    dns_records: [],
    planned_records: plannedRecords,
    endpoint: null,
    next_step: zoneId
      ? 'Vytvor DNS/Worker route, potom nezávisle over HTTPS a WAF.'
      : 'Over registráciu a prístup k Cloudflare zóne pred vytvorením DNS.'
  };
}

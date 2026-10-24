/**
 * Trinity Active Orchestration Layer (src/orchestrator.js)
 * 
 * Provides unified, real-time coordination across all 23 specialized workers in the Trinity ecosystem:
 * - 10 AURA workers: aura_analyzer, aura_architect, aura_codegen, aura_deployer, aura_evolver,
 *                   aura_memory, aura_optimizer, aura_planner, aura_sentinel, aura_tester
 * - 8 Core Trinity workers: trinity-core, trinity-builder, trinity-dispatcher, trinity-connectors,
 *                           trinity-guardian, trinity-memory, trinity-sentinel, trinity-skills
 * - 5 Specialized workers: trinity-knowledge, trinity-capacity, trinity-integrations,
 *                          trinity-pc-bridge, trinity-audit
 */

import { boundedText } from './services.js';

export const WORKER_CATALOG = {
  CHAT_MAINTENANCE: {
    service:'trinity-chat-maintainer',name:'Správca chatu Trinity',domain:'chat-maintenance',
    role:'Údržbár a opravár chatu: kvalita odpovedí, kontrola zaseknutých workflow a diagnostika bez opakovania akcií',
    rpc:true,actions:['status','reviewReply']
  },
  // ── AURA SPECIALISTS ──
  AURA_ANALYZER: {
    service: 'aura_analyzer',
    name: 'AURA Analyzer',
    domain: 'analysis',
    role: 'Hĺbková statická a dynamická analýza kódu, dátových tokov a systémového zdravia',
    actions: ['analyze.code', 'analyze.data', 'analyze.system', 'aura.status', 'aura.skills', 'aura.execute_skill']
  },
  AURA_ARCHITECT: {
    service: 'aura_architect',
    name: 'AURA Architect',
    domain: 'architecture',
    role: 'Systémová architektúra, diagramy rozhraní, topológia mikroslužieb a evaluácia dizajnu',
    actions: ['architect.design', 'architect.review', 'architect.evaluate', 'architect.diagram', 'architect.edge.add', 'architect.graph', 'architect.node.add', 'aura.status', 'aura.skills', 'aura.execute_skill']
  },
  AURA_CODEGEN: {
    service: 'aura_codegen',
    name: 'AURA Codegen',
    domain: 'coding',
    role: 'Generovanie produkčného kódu, refaktoring, scaffolding, SQL migrácie a dokumentácia',
    actions: ['codegen.generate', 'codegen.refactor', 'codegen.scaffold', 'codegen.docs', 'codegen.migration', 'codegen.sql', 'aura.status', 'aura.skills', 'aura.execute_skill']
  },
  AURA_DEPLOYER: {
    service: 'aura_deployer',
    name: 'AURA Deployer',
    domain: 'deployment',
    role: 'Staging, verifikácia a riadené nasadzovanie verzií na Cloudflare Edge',
    actions: ['deploy.stage', 'deploy.list', 'deploy.complete', 'deploy.rollback', 'aura.status', 'aura.skills', 'aura.execute_skill']
  },
  AURA_EVOLVER: {
    service: 'aura_evolver',
    name: 'AURA Evolver',
    domain: 'evolution',
    role: 'Samo-zdokonaľovanie, reflexné cykly, evolučné návrhy a hodnotenie kvality',
    actions: ['evolve.propose', 'evolve.history', 'evolve.reflections', 'aura.status', 'aura.skills', 'aura.execute_skill']
  },
  AURA_MEMORY: {
    service: 'aura_memory',
    name: 'AURA Memory Specialist',
    domain: 'memory',
    role: 'Konsolidácia dlhodobej pamäte, sémantická syntéza a neurálne prepojenia',
    actions: ['memory.synthesize', 'memory.consolidate', 'memory.semantic.search', 'aura.status', 'aura.skills', 'aura.execute_skill']
  },
  AURA_OPTIMIZER: {
    service: 'aura_optimizer',
    name: 'AURA Optimizer',
    domain: 'optimization',
    role: 'Optimalizácia tokenov, SQL dotazov, výpočtového výkonu a znižovanie latencie',
    actions: ['optimize.system', 'optimize.query', 'optimize.tokens', 'aura.status', 'aura.skills', 'aura.execute_skill']
  },
  AURA_PLANNER: {
    service: 'aura_planner',
    name: 'AURA Planner',
    domain: 'planning',
    role: 'Hierarchický dekompozitor úloh, plánovač projektov, míľnikov a časových osí',
    actions: ['plan.task', 'plan.project', 'plan.sprint', 'plan.timeline', 'plan.create', 'plan.decompose', 'plan.goals', 'aura.status', 'aura.skills', 'aura.execute_skill']
  },
  AURA_SENTINEL: {
    service: 'aura_sentinel',
    name: 'AURA Sentinel',
    domain: 'security',
    role: 'Aktívny bezpečnostný monitor, detekcia anomálií, skenovanie zraniteľností a alerty',
    actions: ['sentinel.alert', 'sentinel.monitor', 'sentinel.scan', 'aura.status', 'aura.skills', 'aura.execute_skill']
  },
  AURA_TESTER: {
    service: 'aura_tester',
    name: 'AURA Tester',
    domain: 'testing',
    role: 'Automatické generovanie a spúšťanie testov, validácia endpointov a regresná kontrola',
    actions: ['test.endpoint', 'test.generate', 'test.system', 'test.validate', 'aura.status', 'aura.skills', 'aura.execute_skill']
  },

  // ── CORE WORKERS ──
  CORE: {
    service: 'trinity-core',
    name: 'Trinity Core Jadro',
    domain: 'reasoning',
    role: 'Jadro vedomia, kognitívne uvažovanie, stav Trinity a rozhodovacia matica',
    actions: ['core.reason', 'core.reflect', 'core.state.get', 'core.state.set', 'core.personality.get', 'core.personality.set', 'core.brain.state', 'core.decide']
  },
  BUILDER: {
    service: 'trinity-builder',
    name: 'Trinity Builder',
    domain: 'coding',
    role: 'Ukladanie a kompilácia overených kódových blokov a skriptov',
    actions: ['build.store', 'build.list']
  },
  DISPATCHER: {
    service: 'trinity-dispatcher',
    name: 'Trinity Dispatcher',
    domain: 'dispatch',
    role: 'Zaraďovanie úloh, prideľovanie agentov a smerovanie výpočtových kapacít',
    actions: ['task.create', 'task.list', 'job.create', 'job.list', 'route_aura', 'dispatch']
  },
  CONNECTORS: {
    service: 'trinity-connectors',
    name: 'Trinity Connectors',
    domain: 'connectors',
    role: 'Správa externých konektorov a autorizovaných integračných mostov',
    actions: ['connect.list', 'connect.register', 'connect.test']
  },
  GUARDIAN: {
    service: 'trinity-guardian',
    name: 'Trinity Guardian',
    domain: 'security',
    role: 'Systémový dohľad, integrita zdravia infraštruktúry a auditné záznamy',
    actions: ['audit.list', 'guardian.check']
  },
  MEMORY: {
    service: 'trinity-memory',
    name: 'Trinity Memory Store',
    domain: 'memory',
    role: 'Kľúčovo-hodnotové úložisko perzistentných poznámok a systémových stavov',
    actions: ['memory.get', 'memory.set', 'memory.list']
  },
  SENTINEL: {
    service: 'trinity-sentinel',
    name: 'Trinity Sentinel Monitor',
    domain: 'monitoring',
    role: 'Monitorovanie tokenov, systémových chýb, health stavov a autonómnych procesov',
    actions: ['monitor.health', 'monitor.scan', 'monitor.tokens', 'monitor.events', 'monitor.autonomous.list']
  },
  SKILLS: {
    service: 'trinity-skills',
    name: 'Trinity Skills Engine',
    domain: 'skills',
    role: 'Zoznam, registrácia a vzdialené vykonávanie zručností Trinity',
    actions: ['skill.list', 'skill.register', 'skill.execute', 'skill.enable', 'skill.disable', 'plugin.list']
  },

  // ── SPECIALIZED STANDALONE WORKERS ──
  KNOWLEDGE_SERVICE: {
    service: 'trinity-knowledge',
    name: 'Trinity Knowledge Base',
    domain: 'knowledge',
    role: 'Sémantické vyhľadávanie a správa overených dokumentov v znalostnej knižnici',
    rpc: true
  },
  CAPACITY_SERVICE: {
    service: 'trinity-capacity',
    name: 'Trinity Capacity Ledger',
    domain: 'capacity',
    role: 'Správa denných limitov, rezervácia pracovných jednotiek a ochrana pred preťažením',
    rest: true
  },
  INTEGRATIONS_SERVICE: {
    service: 'trinity-integrations',
    name: 'Trinity Integrations',
    domain: 'integrations',
    role: 'Firecrawl web scraping a externé cloudové integrácie',
    rest: true
  },
  PC_BRIDGE_SERVICE: {
    service: 'trinity-pc-bridge',
    name: 'Trinity PC Bridge',
    domain: 'bridge',
    role: 'Obojsmerný most na lokálny počítač (skripty, aplikácie, súbory, screenshoty)',
    rest: true
  },
  AUDIT_SERVICE: {
    service: 'trinity-audit',
    name: 'Trinity Audit Worker',
    domain: 'audit',
    role: 'Kryptograficky overené CI/CD auditné záznamy a sledovanie commitov',
    rest: true
  }
};

/**
 * Zavolá konkrétny worker cez Cloudflare service binding alebo RPC
 */
export async function delegateWorker(env, workerBinding, action, data = {}, options = {}) {
  const meta = WORKER_CATALOG[workerBinding];
  if (!meta) {
    throw new Error(`Neznámy worker binding: ${workerBinding}`);
  }

  const binding = env[workerBinding];
  if (!binding) {
    return {
      ok: false,
      worker: workerBinding,
      status: 'not_configured',
      error: `Worker ${meta.name} (${workerBinding}) nie je pripojený v tomto prostredí.`
    };
  }

  const timeoutMs = options.timeoutMs || 15000;
  const traceId = options.traceId || crypto.randomUUID();
  const idempotency_key = options.idempotency_key || (options.mutating ? crypto.randomUUID() : undefined);
  const approval = options.approval !== undefined ? options.approval : (options.actor ? { approved: options.approved !== false, actor_role: options.actor.role || 'user', actor_id: options.actor.id, request_id: crypto.randomUUID() } : null);

  const started = Date.now();

  try {
    if(workerBinding==='CHAT_MAINTENANCE'){
      if(!['status','getStatus','reviewReply'].includes(action))throw new Error('Správca chatu nepovoľuje túto delegovanú akciu.');
      let timer;
      const call=action==='reviewReply'?binding.reviewReply(String(data.text||'').slice(0,40000)):binding.getStatus(env.TRINITY_ENV||'production');
      const result=await Promise.race([call,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('RPC Timeout')),timeoutMs);})]).finally(()=>clearTimeout(timer));
      return {ok:true,worker:workerBinding,result,duration_ms:Date.now()-started,traceId};
    }
    // 1. RPC volanie (napr. KNOWLEDGE_SERVICE)
    if (meta.rpc) {
      if (typeof binding[action] === 'function') {
        const result = await Promise.race([
          binding[action](data),
          new Promise((_, reject) => setTimeout(() => reject(new Error('RPC Timeout')), timeoutMs))
        ]);
        return { ok: true, worker: workerBinding, result, duration_ms: Date.now() - started, traceId };
      }
      if (typeof binding.search === 'function' && (action === 'search' || !action)) {
        const query = typeof data === 'string' ? data : data.query || '';
        const result = await binding.search(query);
        return { ok: true, worker: workerBinding, result, duration_ms: Date.now() - started, traceId };
      }
      if (typeof binding.getStatus === 'function' && action === 'status') {
        const result = await binding.getStatus();
        return { ok: true, worker: workerBinding, result, duration_ms: Date.now() - started, traceId };
      }
    }

    const internalSecret = env?.TRINITY_INTERNAL_KEY || env?.TRINITY_GATEWAY_KEY || '';
    const internalHeaders = {
      'Content-Type': 'application/json',
      ...(internalSecret ? { 'Authorization': `Bearer ${internalSecret}` } : {})
    };

    // 2. REST volanie (napr. MEMORY, CAPACITY, INTEGRATIONS)
    if (meta.rest || workerBinding === 'MEMORY') {
      const path = options.path || (action.startsWith('/') ? action : `/${action}`);
      const method = options.method || (options.mutating || Object.keys(data).length > 0 ? 'POST' : 'GET');
      const init = {
        method,
        headers: internalHeaders,
        signal: AbortSignal.timeout(timeoutMs)
      };
      if (method === 'POST') {
        init.body = JSON.stringify(data);
      }
      const response = await binding.fetch(`https://trinity.internal${path}`, init);
      const text = await boundedText(response);
      let payload;
      try { payload = JSON.parse(text); } catch { payload = { text }; }
      return {
        ok: response.ok,
        status: response.status,
        worker: workerBinding,
        result: payload,
        duration_ms: Date.now() - started,
        traceId
      };
    }

    // 3. Štandardné Action-based POST volanie (AURA workers, CORE, DISPATCHER, BUILDER, GUARDIAN, SENTINEL, SKILLS)
    const payload = {
      action,
      data,
      traceId,
      idempotency_key,
      approval
    };

    const response = await binding.fetch('https://trinity.internal/', {
      method: 'POST',
      headers: internalHeaders,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs)
    });

    const text = await boundedText(response);
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      result = { raw: text };
    }

    const success = response.ok && result.ok !== false;

    // Audit logovanie do D1
    if (env.DB) {
      env.DB.prepare("INSERT INTO ops_events(action, details) VALUES('orchestrator_delegation', ?)")
        .bind(JSON.stringify({ worker: workerBinding, action, success, duration_ms: Date.now() - started, traceId }))
        .run()
        .catch(() => {});
    }

    return {
      ok: success,
      status: response.status,
      worker: workerBinding,
      action,
      result: result.result || result,
      duration_ms: Date.now() - started,
      traceId
    };
  } catch (err) {
    return {
      ok: false,
      worker: workerBinding,
      action,
      error: err.message,
      duration_ms: Date.now() - started,
      traceId
    };
  }
}

/**
 * Komplexná multi-agentová orchestrácia úlohy:
 * 1. Dekompozícia a plánovanie (AURA_PLANNER / CORE)
 * 2. Paralelná alebo sekvenčná exekúcia špecialistov (AURA_ANALYZER, AURA_ARCHITECT, AURA_CODEGEN, AURA_TESTER, atď.)
 * 3. Bezpečnostná kontrola a syntéza (AURA_SENTINEL / GUARDIAN)
 */
export async function orchestratePipeline(env, task, options = {}) {
  const started = Date.now();
  const traceId = crypto.randomUUID();
  const executionLog = [];

  const taskLower = String(task).toLowerCase();

  // FÁZA 1: Plánovanie a dekompozícia
  let planResult = null;
  if (env.AURA_PLANNER) {
    planResult = await delegateWorker(env, 'AURA_PLANNER', 'plan.task', { prompt: task, title: task.slice(0, 80) }, { traceId, idempotency_key: crypto.randomUUID() });
    executionLog.push({ phase: 'planning', worker: 'AURA_PLANNER', ok: planResult.ok, result: planResult.result });
  } else if (env.CORE) {
    planResult = await delegateWorker(env, 'CORE', 'core.reason', { prompt: `Rozlož požiadavku na konkrétne kroky: ${task}` }, { traceId });
    executionLog.push({ phase: 'planning', worker: 'CORE', ok: planResult.ok, result: planResult.result });
  }

  // FÁZA 2: Výber a volanie špecialistov podľa domény
  const specialistCalls = [];

  // Coding & Refactoring
  if (/\b(kód|kod|funkci|program|script|refactor|implement|vygeneruj|napíš kód)\b/i.test(taskLower)) {
    if (env.AURA_CODEGEN) {
      specialistCalls.push(
        delegateWorker(env, 'AURA_CODEGEN', 'codegen.generate', { prompt: task, language: 'javascript' }, { traceId, idempotency_key: crypto.randomUUID() })
          .then(async res => {
            executionLog.push({ phase: 'codegen', worker: 'AURA_CODEGEN', ok: res.ok, result: res.result });
            // Ak kód bol vygenerovaný, validujeme ho cez AURA_TESTER
            if (res.ok && env.AURA_TESTER && res.result) {
              const testRes = await delegateWorker(env, 'AURA_TESTER', 'test.validate', { code: JSON.stringify(res.result) }, { traceId });
              executionLog.push({ phase: 'testing', worker: 'AURA_TESTER', ok: testRes.ok, result: testRes.result });
            }
          })
      );
    }
  }

  // Architektúra a dizajn
  if (/\b(architekt|dizajn|navrh|systém|databáz|schema|diagram|komponent)\b/i.test(taskLower)) {
    if (env.AURA_ARCHITECT) {
      specialistCalls.push(
        delegateWorker(env, 'AURA_ARCHITECT', 'architect.design', { prompt: task }, { traceId, idempotency_key: crypto.randomUUID() })
          .then(res => executionLog.push({ phase: 'architecture', worker: 'AURA_ARCHITECT', ok: res.ok, result: res.result }))
      );
    }
  }

  // Analýza kódu a dát
  if (/\b(analyz|skontroluj|over|audit|prever|chyby|bugy|výkon|metriky)\b/i.test(taskLower)) {
    if (env.AURA_ANALYZER) {
      specialistCalls.push(
        delegateWorker(env, 'AURA_ANALYZER', 'analyze.code', { code: task }, { traceId, idempotency_key: crypto.randomUUID() })
          .then(res => executionLog.push({ phase: 'analysis', worker: 'AURA_ANALYZER', ok: res.ok, result: res.result }))
      );
    }
  }

  // Optimalizácia
  if (/\b(optimaliz|zrýchli|zrychli|token|query|latencia|výkon)\b/i.test(taskLower)) {
    if (env.AURA_OPTIMIZER) {
      specialistCalls.push(
        delegateWorker(env, 'AURA_OPTIMIZER', 'optimize.tokens', { prompt: task }, { traceId })
          .then(res => executionLog.push({ phase: 'optimization', worker: 'AURA_OPTIMIZER', ok: res.ok, result: res.result }))
      );
    }
  }

  // Znalostná knižnica
  if (/\b(znalost|dokument|vedomost|hľadaj v znalostiach|knowhow)\b/i.test(taskLower)) {
    if (env.KNOWLEDGE_SERVICE) {
      specialistCalls.push(
        delegateWorker(env, 'KNOWLEDGE_SERVICE', 'search', { query: task }, { traceId })
          .then(res => executionLog.push({ phase: 'knowledge', worker: 'KNOWLEDGE_SERVICE', ok: res.ok, result: res.result }))
      );
    }
  }

  // Počkáme na dokončenie všetkých špecialistov
  if (specialistCalls.length > 0) {
    await Promise.allSettled(specialistCalls);
  }

  // FÁZA 3: Bezpečnostný audit a Sentinel kontrola
  if (env.AURA_SENTINEL) {
    const sentinelCheck = await delegateWorker(env, 'AURA_SENTINEL', 'sentinel.scan', {}, { traceId });
    executionLog.push({ phase: 'sentinel_scan', worker: 'AURA_SENTINEL', ok: sentinelCheck.ok, result: sentinelCheck.result });
  }

  // FÁZA 4: Syntéza výsledkov
  const successfulSteps = executionLog.filter(l => l.ok);
  const failedSteps = executionLog.filter(l => !l.ok);
  const status = (failedSteps.length === 0 && successfulSteps.length > 0) ? 'complete' : (successfulSteps.length > 0 ? 'partial' : 'failed');
  const isOk = status === 'complete';

  return {
    ok: isOk,
    status,
    traceId,
    duration_ms: Date.now() - started,
    task,
    total_phases: executionLog.length,
    successful_phases: successfulSteps.length,
    failed_phases: failedSteps.length,
    executionLog
  };
}

/**
 * Overí stav celej flotily 23 workerov
 */
export async function inspectFleet(env) {
  const bindings = Object.keys(WORKER_CATALOG);
  const results = await Promise.all(
    bindings.map(async binding => {
      const meta = WORKER_CATALOG[binding];
      const configured = Boolean(env[binding]);
      if (!configured) {
        return { binding, service: meta.service, name: meta.name, status: 'not_configured', role: meta.role };
      }
      const probe = await delegateWorker(env, binding, meta.rpc ? 'status' : 'aura.status', {}, { timeoutMs: 3000 });
      return {
        binding,
        service: meta.service,
        name: meta.name,
        status: probe.ok ? 'online' : 'unreachable',
        duration_ms: probe.duration_ms,
        role: meta.role
      };
    })
  );

  const online = results.filter(r => r.status === 'online').length;
  const total = results.length;

  return {
    fleet: `Trinity ${total}-Worker Autonomous Fleet`,
    total_workers: total,
    online_count: online,
    offline_count: total - online,
    workers: results,
    checked_at: new Date().toISOString()
  };
}

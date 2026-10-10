var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../services/legacy-workers/aura_analyzer.js
var aura_analyzer_default = {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try {
      call = await request.json();
    } catch {
      return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "analyze.code") {
        const ai2 = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Analyzer. Analyzuj k\xF3d a n\xE1jdi: bugy, bezpe\u010Dnostn\xE9 probl\xE9my, v\xFDkonnostn\xE9 probl\xE9my, n\xE1vrhy na zlep\u0161enie. JSON: {bugs:[], security:[], performance:[], improvements:[]}" },
          { role: "user", content: "Analyzuj tento k\xF3d:\n" + d.code }
        ] });
        let result;
        try {
          result = JSON.parse(ai2.response);
        } catch {
          result = { raw: ai2.response };
        }
        await env.DB.prepare("INSERT INTO code_snippets (id, title, language, code, tags, created_at) VALUES (lower(hex(randomblob(16))), 'Analysis', 'analysis', ?, 'analysis', datetime('now'))").bind(ai2.response).run();
        return Response.json({ ok: true, result, traceId, from: "aura-analyzer" });
      }
      if (call.action === "analyze.system") {
        const health = await env.DB.prepare("SELECT component, status, message FROM system_health ORDER BY checked_at DESC LIMIT 20").all();
        const errors = await env.DB.prepare("SELECT module, action, details, severity FROM audit_log WHERE severity = 'critical' AND created_at > datetime('now','-1 day') ORDER BY created_at DESC LIMIT 20").all();
        const tokens = await env.DB.prepare("SELECT model, SUM(tokens_in+tokens_out) as total FROM token_usage WHERE created_at > datetime('now','-1 day') GROUP BY model").all();
        const ai2 = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Analyzer. Analyzuj stav syst\xE9mu a n\xE1jdi anom\xE1lie. JSON: {anomalies:[], recommendations:[], risk_level:'low|medium|high'}" },
          { role: "user", content: "Health: " + JSON.stringify(health.results) + "\nErrors: " + JSON.stringify(errors.results) + "\nTokens: " + JSON.stringify(tokens.results) }
        ] });
        let result;
        try {
          result = JSON.parse(ai2.response);
        } catch {
          result = { raw: ai2.response };
        }
        return Response.json({ ok: true, result, traceId, from: "aura-analyzer" });
      }
      if (call.action === "analyze.data") {
        const ai2 = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Analyzer. Analyzuj d\xE1ta a n\xE1jdi patterny, trendy, a anom\xE1lie. JSON: {patterns:[], trends:[], anomalies:[]}" },
          { role: "user", content: d.data || d.prompt || "" }
        ] });
        let result;
        try {
          result = JSON.parse(ai2.response);
        } catch {
          result = { raw: ai2.response };
        }
        return Response.json({ ok: true, result, traceId, from: "aura-analyzer" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "analyzer", role: "Analyzuje k\xF3d, d\xE1ta, syst\xE9mov\xE9 spr\xE1vanie", status: "active" }, traceId, from: "aura-analyzer" });
      }
      const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [{ role: "system", content: "Si AURA Analyzer. Analyzuj a poskytn\xED presn\xE9 v\xFDsledky." }, { role: "user", content: d.prompt || call.action }] });
      return Response.json({ ok: true, result: { response: ai.response }, traceId, from: "aura-analyzer" });
    } catch (e) {
      return Response.json({ ok: false, error: e.message, traceId, from: "aura-analyzer" });
    }
  }
};

// ../../services/legacy-workers/aura_architect.js
var aura_architect_default = {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try {
      call = await request.json();
    } catch {
      return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "architect.design") {
        const ai2 = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Architect. Navrhni syst\xE9mov\xFA architekt\xFAru. Poskytni: komponenty, d\xE1tov\xE9 toky, spojenia, potrebn\xE9 tabu\u013Eky. JSON: {components:[], data_flows:[], connections:[], tables:[]}" },
          { role: "user", content: "Po\u017Eiadavky: " + d.requirements }
        ] });
        let result;
        try {
          result = JSON.parse(ai2.response);
        } catch {
          result = { raw: ai2.response };
        }
        await env.DB.prepare("INSERT INTO graph_nodes (id, type, label, properties, content, created_at) VALUES (lower(hex(randomblob(16))), 'architecture', ?, '{}', ?, datetime('now'))").bind("Architecture: " + (d.requirements || "").slice(0, 50), ai2.response).run();
        return Response.json({ ok: true, result, traceId, from: "aura-architect" });
      }
      if (call.action === "architect.graph") {
        const nodes = await env.DB.prepare("SELECT id, type, label, content FROM graph_nodes ORDER BY created_at DESC LIMIT 50").all();
        const edges = await env.DB.prepare("SELECT id, source_id, target_id, relation FROM graph_edges ORDER BY created_at DESC LIMIT 50").all();
        return Response.json({ ok: true, result: { nodes: nodes.results, edges: edges.results }, traceId, from: "aura-architect" });
      }
      if (call.action === "architect.node.add") {
        await env.DB.prepare("INSERT INTO graph_nodes (id, type, label, properties, content, created_at) VALUES (lower(hex(randomblob(16))), ?, ?, '{}', ?, datetime('now'))").bind(d.type || "concept", d.label, d.content || "").run();
        return Response.json({ ok: true, traceId, from: "aura-architect" });
      }
      if (call.action === "architect.edge.add") {
        await env.DB.prepare("INSERT INTO graph_edges (id, source_id, target_id, relation, weight, created_at) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, datetime('now'))").bind(d.source_id, d.target_id, d.relation || "related", d.weight || 1).run();
        return Response.json({ ok: true, traceId, from: "aura-architect" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "architect", role: "Navrhuje syst\xE9mov\xFA architekt\xFAru a komponenty", status: "active" }, traceId, from: "aura-architect" });
      }
      const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [{ role: "system", content: "Si AURA Architect. Navrhni architekt\xFAru." }, { role: "user", content: d.prompt || call.action }] });
      return Response.json({ ok: true, result: { response: ai.response }, traceId, from: "aura-architect" });
    } catch (e) {
      return Response.json({ ok: false, error: e.message, traceId, from: "aura-architect" });
    }
  }
};

// ../../services/legacy-workers/aura_codegen.js
var aura_codegen_default = {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try {
      call = await request.json();
    } catch {
      return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "codegen.generate") {
        const ai2 = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA CodeGen. Generuj \u010Dist\xFD produk\u010Dn\xFD k\xF3d v " + (d.language || "typescript") + ". Iba k\xF3d, \u017Eiadne vysvetlenie." },
          { role: "user", content: d.prompt }
        ] });
        const code = ai2.response || "";
        await env.DB.prepare("INSERT INTO code_storage (id, title, language, code, created_at) VALUES (lower(hex(randomblob(16))), ?, ?, ?, datetime('now'))").bind((d.prompt || "").slice(0, 100), d.language || "typescript", code).run();
        return Response.json({ ok: true, result: { code }, traceId, from: "aura-codegen" });
      }
      if (call.action === "codegen.sql") {
        const ai2 = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA CodeGen. Generuj SQL pre SQLite/D1. Iba SQL, \u017Eiadne vysvetlenie." },
          { role: "user", content: d.prompt }
        ] });
        return Response.json({ ok: true, result: { sql: ai2.response }, traceId, from: "aura-codegen" });
      }
      if (call.action === "codegen.migration") {
        const ai2 = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA CodeGen. Generuj D1 migr\xE1ciu. Iba SQL." },
          { role: "user", content: "Tabu\u013Eka: " + d.table + " St\u013Apce: " + d.columns }
        ] });
        return Response.json({ ok: true, result: { migration: ai2.response }, traceId, from: "aura-codegen" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "codegen", role: "Generuje produk\u010Dn\xFD k\xF3d, SQL, migr\xE1cie", status: "active" }, traceId, from: "aura-codegen" });
      }
      const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [{ role: "system", content: "Si AURA CodeGen. Generuj k\xF3d." }, { role: "user", content: d.prompt || call.action }] });
      return Response.json({ ok: true, result: { response: ai.response }, traceId, from: "aura-codegen" });
    } catch (e) {
      return Response.json({ ok: false, error: e.message, traceId, from: "aura-codegen" });
    }
  }
};

// ../../services/legacy-workers/aura_deployer.js
var aura_deployer_default = {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try {
      call = await request.json();
    } catch {
      return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "deploy.stage") {
        const version = "v" + Date.now();
        const key = "deploy:" + (d.name || "unknown") + ":" + version;
        await env.CODE_KV.put(key, d.code || "");
        await env.DB.prepare("INSERT INTO ops_studio_versions (id, project_name, version, status, created_at) VALUES (lower(hex(randomblob(16))), ?, ?, 'staged', datetime('now'))").bind(d.name || "unknown", version).run();
        return Response.json({ ok: true, result: { key, version }, traceId, from: "aura-deployer" });
      }
      if (call.action === "deploy.list") {
        const r = await env.DB.prepare("SELECT id, project_name, version, status, created_at FROM ops_studio_versions ORDER BY created_at DESC LIMIT 50").all();
        return Response.json({ ok: true, result: r.results, traceId, from: "aura-deployer" });
      }
      if (call.action === "deploy.complete") {
        await env.DB.prepare("UPDATE ops_studio_versions SET status = 'deployed', deployed_at = datetime('now') WHERE id = ?").bind(d.version_id).run();
        await env.DB.prepare("INSERT INTO timeline (id, event, category, details, created_at) VALUES (lower(hex(randomblob(16))), 'DEPLOY_COMPLETE', 'deploy', ?, datetime('now'))").bind("Version " + d.version_id + " deployed").run();
        return Response.json({ ok: true, traceId, from: "aura-deployer" });
      }
      if (call.action === "deploy.rollback") {
        await env.DB.prepare("UPDATE ops_studio_versions SET status = 'rolled_back' WHERE id = ?").bind(d.version_id).run();
        return Response.json({ ok: true, traceId, from: "aura-deployer" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "deployer", role: "Nasadzuje Workery, spravuje verzie a rollback", status: "active" }, traceId, from: "aura-deployer" });
      }
      const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [{ role: "system", content: "Si AURA Deployer." }, { role: "user", content: d.prompt || call.action }] });
      return Response.json({ ok: true, result: { response: ai.response }, traceId, from: "aura-deployer" });
    } catch (e) {
      return Response.json({ ok: false, error: e.message, traceId, from: "aura-deployer" });
    }
  }
};

// ../../services/legacy-workers/aura_evolver.js
var aura_evolver_default = {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try {
      call = await request.json();
    } catch {
      return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "evolve.propose") {
        const ai2 = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Evolver. Navrhni 3 vylep\u0161enia syst\xE9mu. Pre ka\u017Ed\xE9: popis, o\u010Dak\xE1van\xFD vplyv, riziko. JSON: {proposals:[{description, impact, risk}]}" },
          { role: "user", content: "Oblas\u0165: " + (d.area || "system") + " S\xFA\u010Dasn\xFD stav: " + (d.current_state || "v7.1.0") }
        ] });
        let proposals;
        try {
          proposals = JSON.parse(ai2.response);
        } catch {
          proposals = { raw: ai2.response };
        }
        const id = crypto.randomUUID();
        await env.DB.prepare("INSERT INTO evolution_proposals (id, type, description, proposed_code, status, approval_status, created_at) VALUES (?, ?, ?, ?, 'proposed', 'pending', datetime('now'))").bind(id, d.area || "system", ai2.response, ai2.response).run();
        await env.DB.prepare("INSERT INTO timeline (id, event, category, details, created_at) VALUES (lower(hex(randomblob(16))), 'EVOLUTION_PROPOSED', 'evolution', ?, datetime('now'))").bind("Area: " + (d.area || "system")).run();
        return Response.json({ ok: true, result: { proposalId: id, proposals }, traceId, from: "aura-evolver" });
      }
      if (call.action === "evolve.history") {
        const r = await env.DB.prepare("SELECT id, type, description, status, approval_status, created_at, deployed_at FROM evolution_proposals ORDER BY created_at DESC LIMIT 50").all();
        return Response.json({ ok: true, result: r.results, traceId, from: "aura-evolver" });
      }
      if (call.action === "evolve.reflections") {
        const r = await env.DB.prepare("SELECT reflection, insight, mood, created_at FROM reflections ORDER BY created_at DESC LIMIT 20").all();
        return Response.json({ ok: true, result: r.results, traceId, from: "aura-evolver" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "evolver", role: "Navrhuje a testuje vylep\u0161enia syst\xE9mu", status: "active" }, traceId, from: "aura-evolver" });
      }
      const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [{ role: "system", content: "Si AURA Evolver. Navrhni vylep\u0161enia." }, { role: "user", content: d.prompt || call.action }] });
      return Response.json({ ok: true, result: { response: ai.response }, traceId, from: "aura-evolver" });
    } catch (e) {
      return Response.json({ ok: false, error: e.message, traceId, from: "aura-evolver" });
    }
  }
};

// ../../services/legacy-workers/aura_memory.js
var aura_memory_default = {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try {
      call = await request.json();
    } catch {
      return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "memory.synthesize") {
        const memories = await env.DB.prepare("SELECT content, category, importance FROM memories ORDER BY importance DESC, created_at DESC LIMIT 50").all();
        const ai2 = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Memory. Syntetizuj pam\xE4te do s\xFAvisl\xE9ho znalostn\xE9ho s\xFAhrnu. N\xE1jdi k\u013E\xFA\u010Dov\xE9 patterny a insights." },
          { role: "user", content: JSON.stringify(memories.results) }
        ] });
        const synthesis = ai2.response || "";
        const id = crypto.randomUUID();
        await env.DB.prepare("INSERT INTO memory_semantic (id, title, content, source, created_at) VALUES (?, 'Memory Synthesis', ?, 'aura-memory', datetime('now'))").bind(id, synthesis).run();
        return Response.json({ ok: true, result: { synthesis, id }, traceId, from: "aura-memory" });
      }
      if (call.action === "memory.consolidate") {
        const recent = await env.DB.prepare("SELECT id, content, category FROM memories WHERE created_at > datetime('now','-1 day') ORDER BY importance DESC LIMIT 20").all();
        const ai2 = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Memory. Konsoliduj tieto kr\xE1tkodob\xE9 pam\xE4te do dlhodob\xFDch znalost\xED. JSON: {consolidated:[{title, content, importance}]}" },
          { role: "user", content: JSON.stringify(recent.results) }
        ] });
        let result;
        try {
          result = JSON.parse(ai2.response);
        } catch {
          result = { raw: ai2.response };
        }
        if (result.consolidated) {
          for (const c of result.consolidated) {
            await env.DB.prepare("INSERT INTO memory_long (id, title, content, importance, created_at) VALUES (lower(hex(randomblob(16))), ?, ?, ?, datetime('now'))").bind(c.title, c.content, c.importance || 5).run();
          }
        }
        return Response.json({ ok: true, result, traceId, from: "aura-memory" });
      }
      if (call.action === "memory.semantic.search") {
        const r = await env.DB.prepare("SELECT id, title, content, source, created_at FROM memory_semantic WHERE title LIKE ? OR content LIKE ? ORDER BY created_at DESC LIMIT 50").bind("%" + d.query + "%", "%" + d.query + "%").all();
        return Response.json({ ok: true, result: r.results, traceId, from: "aura-memory" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "memory", role: "Konsoliduje pam\xE4\u0165 a syntetizuje znalosti", status: "active" }, traceId, from: "aura-memory" });
      }
      const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [{ role: "system", content: "Si AURA Memory." }, { role: "user", content: d.prompt || call.action }] });
      return Response.json({ ok: true, result: { response: ai.response }, traceId, from: "aura-memory" });
    } catch (e) {
      return Response.json({ ok: false, error: e.message, traceId, from: "aura-memory" });
    }
  }
};

// ../../services/legacy-workers/aura_optimizer.js
var aura_optimizer_default = {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try {
      call = await request.json();
    } catch {
      return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "optimize.system") {
        const tokens = await env.DB.prepare("SELECT model, module, SUM(tokens_in) as tin, SUM(tokens_out) as tout, SUM(cost) as cost FROM token_usage GROUP BY model, module ORDER BY cost DESC").all();
        const jobs = await env.DB.prepare("SELECT status, COUNT(*) as c FROM ops_jobs GROUP BY status").all();
        const health = await env.DB.prepare("SELECT component, status FROM system_health ORDER BY checked_at DESC LIMIT 10").all();
        const ai2 = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Optimizer. Analyzuj metriky a navrhni optimaliz\xE1cie. JSON: {optimizations:[{area, action, expected_gain, priority}], cost_savings: number}" },
          { role: "user", content: "Tokens: " + JSON.stringify(tokens.results) + "\nJobs: " + JSON.stringify(jobs.results) + "\nHealth: " + JSON.stringify(health.results) }
        ] });
        let result;
        try {
          result = JSON.parse(ai2.response);
        } catch {
          result = { raw: ai2.response };
        }
        return Response.json({ ok: true, result, traceId, from: "aura-optimizer" });
      }
      if (call.action === "optimize.tokens") {
        const r = await env.DB.prepare("SELECT model, SUM(tokens_in+tokens_out) as total, SUM(cost) as cost FROM token_usage WHERE created_at > datetime('now','-1 day') GROUP BY model ORDER BY cost DESC").all();
        const ai2 = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Optimizer. Navrhni ako zn\xED\u017Ei\u0165 token usage a n\xE1klady. JSON: {recommendations:[], potential_savings: number}" },
          { role: "user", content: JSON.stringify(r.results) }
        ] });
        let result;
        try {
          result = JSON.parse(ai2.response);
        } catch {
          result = { raw: ai2.response };
        }
        return Response.json({ ok: true, result, traceId, from: "aura-optimizer" });
      }
      if (call.action === "optimize.query") {
        const ai2 = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Optimizer. Optimalizuj tento SQL dotaz pre D1/SQLite. Iba optimalizovan\xFD SQL." },
          { role: "user", content: d.sql }
        ] });
        return Response.json({ ok: true, result: { optimized: ai2.response }, traceId, from: "aura-optimizer" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "optimizer", role: "Optimalizuje v\xFDkon, n\xE1klady, token usage", status: "active" }, traceId, from: "aura-optimizer" });
      }
      const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [{ role: "system", content: "Si AURA Optimizer." }, { role: "user", content: d.prompt || call.action }] });
      return Response.json({ ok: true, result: { response: ai.response }, traceId, from: "aura-optimizer" });
    } catch (e) {
      return Response.json({ ok: false, error: e.message, traceId, from: "aura-optimizer" });
    }
  }
};

// ../../services/legacy-workers/aura_planner.js
var aura_planner_default = {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try {
      call = await request.json();
    } catch {
      return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "plan.create") {
        const ai2 = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Planner. Vytvor krok-za-krokom pl\xE1n. Pre ka\u017Ed\xFD krok: akcia, agent, odhadovan\xFD \u010Das, z\xE1vislosti. JSON: {steps:[{action, agent, time, deps}]}" },
          { role: "user", content: "Cie\u013E: " + d.goal }
        ] });
        let plan;
        try {
          plan = JSON.parse(ai2.response);
        } catch {
          plan = { raw: ai2.response };
        }
        const goalId = crypto.randomUUID();
        await env.DB.prepare("INSERT INTO goals (id, goal, priority, status, owner, created_at, updated_at) VALUES (?, ?, ?, 'active', 'aura-planner', datetime('now'), datetime('now'))").bind(goalId, d.goal, d.priority || 5).run();
        return Response.json({ ok: true, result: { goalId, plan }, traceId, from: "aura-planner" });
      }
      if (call.action === "plan.decompose") {
        const ai2 = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Planner. Rozde\u013E \xFAlohu na men\u0161ie pod\xFAlohy. JSON: {subtasks:[{title, description, priority, assigned_agent}]}" },
          { role: "user", content: "\xDAloha: " + d.task }
        ] });
        let result;
        try {
          result = JSON.parse(ai2.response);
        } catch {
          result = { raw: ai2.response };
        }
        if (result.subtasks) {
          for (const t of result.subtasks) {
            const id = crypto.randomUUID();
            await env.DB.prepare("INSERT INTO tasks (id, title, description, status, assigned_agent, project_id, priority, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, NULL, ?, datetime('now'), datetime('now'))").bind(id, t.title, t.description || "", t.assigned_agent || "auto", t.priority || "normal").run();
          }
        }
        return Response.json({ ok: true, result, traceId, from: "aura-planner" });
      }
      if (call.action === "plan.goals") {
        const r = await env.DB.prepare("SELECT id, goal, priority, status, owner, created_at FROM goals WHERE status = 'active' ORDER BY priority DESC").all();
        return Response.json({ ok: true, result: r.results, traceId, from: "aura-planner" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "planner", role: "Pl\xE1nuje a rozde\u013Euje \xFAlohy, vytv\xE1ra ciele", status: "active" }, traceId, from: "aura-planner" });
      }
      const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [{ role: "system", content: "Si AURA Planner." }, { role: "user", content: d.prompt || call.action }] });
      return Response.json({ ok: true, result: { response: ai.response }, traceId, from: "aura-planner" });
    } catch (e) {
      return Response.json({ ok: false, error: e.message, traceId, from: "aura-planner" });
    }
  }
};

// ../../services/legacy-workers/aura_sentinel.js
var aura_sentinel_default = {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try {
      call = await request.json();
    } catch {
      return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "sentinel.scan") {
        const events = await env.DB.prepare("SELECT event_type, severity, source, COUNT(*) as count FROM security_events WHERE created_at > datetime('now','-1 hour') GROUP BY event_type ORDER BY count DESC LIMIT 20").all();
        const critical = await env.DB.prepare("SELECT COUNT(*) as c FROM security_events WHERE severity = 'critical' AND created_at > datetime('now','-1 hour')").first();
        const errors = await env.DB.prepare("SELECT COUNT(*) as c FROM audit_log WHERE severity = 'critical' AND created_at > datetime('now','-1 hour')").first();
        const ai2 = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Sentinel. Analyzuj bezpe\u010Dnostn\xE9 udalosti a n\xE1jdi anom\xE1lie. JSON: {anomalies:[], risk_level:'low|medium|high', recommendations:[]}" },
          { role: "user", content: "Events: " + JSON.stringify(events.results) + "\nCritical: " + (critical?.c || 0) + "\nErrors: " + (errors?.c || 0) }
        ] });
        let result;
        try {
          result = JSON.parse(ai2.response);
        } catch {
          result = { raw: ai2.response };
        }
        await env.DB.prepare("INSERT INTO timeline (id, event, category, details, created_at) VALUES (lower(hex(randomblob(16))), 'SENTINEL_SCAN', 'security', ?, datetime('now'))").bind("Risk: " + (result.risk_level || "unknown")).run();
        return Response.json({ ok: true, result, traceId, from: "aura-sentinel" });
      }
      if (call.action === "sentinel.monitor") {
        const health = await env.DB.prepare("SELECT component, status, message, checked_at FROM system_health ORDER BY checked_at DESC LIMIT 20").all();
        const agents = await env.DB.prepare("SELECT name, status FROM agents ORDER BY name").all();
        const ai2 = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Sentinel. Monitoruj syst\xE9m a nahl\xE1s stav. JSON: {overall_status, issues:[], healthy_components:[]}" },
          { role: "user", content: "Health: " + JSON.stringify(health.results) + "\nAgents: " + JSON.stringify(agents.results) }
        ] });
        let result;
        try {
          result = JSON.parse(ai2.response);
        } catch {
          result = { raw: ai2.response };
        }
        return Response.json({ ok: true, result, traceId, from: "aura-sentinel" });
      }
      if (call.action === "sentinel.alert") {
        await env.DB.prepare("INSERT INTO security_events (event_type, severity, source, details, created_at) VALUES (?, ?, 'aura-sentinel', ?, datetime('now'))").bind(d.event_type || "alert", d.severity || "warning", d.details || "").run();
        return Response.json({ ok: true, traceId, from: "aura-sentinel" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "sentinel", role: "Monitoruje a detekuje anom\xE1lie, bezpe\u010Dnos\u0165", status: "active" }, traceId, from: "aura-sentinel" });
      }
      const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [{ role: "system", content: "Si AURA Sentinel." }, { role: "user", content: d.prompt || call.action }] });
      return Response.json({ ok: true, result: { response: ai.response }, traceId, from: "aura-sentinel" });
    } catch (e) {
      return Response.json({ ok: false, error: e.message, traceId, from: "aura-sentinel" });
    }
  }
};

// ../../services/legacy-workers/aura_tester.js
var aura_tester_default = {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try {
      call = await request.json();
    } catch {
      return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "test.generate") {
        const ai2 = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Tester. Generuj test cases. Pre ka\u017Ed\xFD: n\xE1zov, vstup, o\u010Dak\xE1van\xFD v\xFDstup, typ. JSON: {tests:[{name, input, expected, type}]}" },
          { role: "user", content: "Cie\u013E: " + d.target + "\nK\xF3d: " + (d.code || "") }
        ] });
        let result;
        try {
          result = JSON.parse(ai2.response);
        } catch {
          result = { raw: ai2.response };
        }
        return Response.json({ ok: true, result, traceId, from: "aura-tester" });
      }
      if (call.action === "test.validate") {
        const ai2 = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Tester. Validuj tento k\xF3d. Skontroluj: syntax, logiku, bezpe\u010Dnos\u0165, v\xFDkonnos\u0165. JSON: {valid: boolean, issues:[{severity, description, fix}], score: 0-100}" },
          { role: "user", content: d.code || d.target || "" }
        ] });
        let result;
        try {
          result = JSON.parse(ai2.response);
        } catch {
          result = { raw: ai2.response };
        }
        await env.DB.prepare("INSERT INTO audit_log (id, module, action, details, severity, created_at) VALUES (lower(hex(randomblob(16))), 'tester', 'validate', ?, ?, datetime('now'))").bind(JSON.stringify(result), result.valid ? "info" : "warning").run();
        return Response.json({ ok: true, result, traceId, from: "aura-tester" });
      }
      if (call.action === "test.endpoint") {
        try {
          const r = await fetch(d.url, { method: d.method || "GET", headers: d.headers || {}, body: d.body ? JSON.stringify(d.body) : void 0 });
          const body = await r.text();
          return Response.json({ ok: true, result: { status: r.status, ok: r.ok, body: body.substring(0, 2e3) }, traceId, from: "aura-tester" });
        } catch (e) {
          return Response.json({ ok: false, error: e.message, traceId, from: "aura-tester" });
        }
      }
      if (call.action === "test.system") {
        const tables = await env.DB.prepare("SELECT COUNT(*) as c FROM sqlite_master WHERE type='table'").first();
        const agents = await env.DB.prepare("SELECT COUNT(*) as c FROM agents WHERE status='active'").first();
        const brain = await env.DB.prepare("SELECT component, state FROM trinity_brain_state ORDER BY updated_at DESC LIMIT 5").all();
        const ai2 = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA Tester. Testuj syst\xE9m a nahl\xE1s stav. JSON: {all_pass: boolean, results:[{test, passed, details}]}" },
          { role: "user", content: "Tables: " + (tables?.c || 0) + "\nAgents: " + (agents?.c || 0) + "\nBrain: " + JSON.stringify(brain.results) }
        ] });
        let result;
        try {
          result = JSON.parse(ai2.response);
        } catch {
          result = { raw: ai2.response };
        }
        return Response.json({ ok: true, result, traceId, from: "aura-tester" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "tester", role: "Testuje, validuje a zabezpe\u010Duje kvalitu", status: "active" }, traceId, from: "aura-tester" });
      }
      const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [{ role: "system", content: "Si AURA Tester." }, { role: "user", content: d.prompt || call.action }] });
      return Response.json({ ok: true, result: { response: ai.response }, traceId, from: "aura-tester" });
    } catch (e) {
      return Response.json({ ok: false, error: e.message, traceId, from: "aura-tester" });
    }
  }
};

// ../../services/aura-entry.js
var VERSION = "2.0.0";
var roles = {
  aura_analyzer: { worker: aura_analyzer_default, actions: ["analyze.code", "analyze.data", "analyze.system", "aura.status"], idempotent: ["analyze.code"] },
  aura_architect: { worker: aura_architect_default, actions: ["architect.design", "architect.edge.add", "architect.graph", "architect.node.add", "aura.status"], idempotent: ["architect.design", "architect.edge.add", "architect.node.add"], approval: ["architect.edge.add", "architect.node.add"] },
  aura_codegen: { worker: aura_codegen_default, actions: ["codegen.generate", "codegen.migration", "codegen.sql", "aura.status"], idempotent: ["codegen.generate"] },
  aura_deployer: { worker: aura_deployer_default, actions: ["deploy.stage", "deploy.list", "deploy.complete", "deploy.rollback", "aura.status"], idempotent: ["deploy.stage", "deploy.complete", "deploy.rollback"], approval: ["deploy.stage", "deploy.complete", "deploy.rollback"] },
  aura_evolver: { worker: aura_evolver_default, actions: ["evolve.propose", "evolve.history", "evolve.reflections", "aura.status"], idempotent: ["evolve.propose"] },
  aura_memory: { worker: aura_memory_default, actions: ["memory.synthesize", "memory.consolidate", "memory.semantic.search", "aura.status"], idempotent: ["memory.synthesize", "memory.consolidate"] },
  aura_optimizer: { worker: aura_optimizer_default, actions: ["optimize.system", "optimize.query", "optimize.tokens", "aura.status"] },
  aura_planner: { worker: aura_planner_default, actions: ["plan.create", "plan.decompose", "plan.goals", "aura.status"], idempotent: ["plan.create"] },
  aura_sentinel: { worker: aura_sentinel_default, actions: ["sentinel.alert", "sentinel.monitor", "sentinel.scan", "aura.status"], idempotent: ["sentinel.alert"] },
  aura_tester: { worker: aura_tester_default, actions: ["test.endpoint", "test.generate", "test.system", "test.validate", "aura.status"], approval: ["test.endpoint"] }
};
var secure = /* @__PURE__ */ __name((response) => {
  const out = new Response(response.body, response);
  out.headers.set("Cache-Control", "no-store");
  out.headers.set("X-Content-Type-Options", "nosniff");
  out.headers.set("Referrer-Policy", "no-referrer");
  return out;
}, "secure");
var json = /* @__PURE__ */ __name((data, status = 200) => secure(Response.json(data, { status })), "json");
async function readJSON(request, limit = 64e3) {
  if (!request.headers.get("Content-Type")?.includes("application/json")) throw Object.assign(new Error("Vy\u017Eaduje sa JSON."), { status: 415 });
  if (Number(request.headers.get("Content-Length") || 0) > limit) throw Object.assign(new Error("Po\u017Eiadavka je pr\xEDli\u0161 ve\u013Ek\xE1."), { status: 413 });
  const text = await request.text();
  if (text.length > limit) throw Object.assign(new Error("Po\u017Eiadavka je pr\xEDli\u0161 ve\u013Ek\xE1."), { status: 413 });
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error("Neplatn\xFD JSON."), { status: 400 });
  }
}
__name(readJSON, "readJSON");
function approved(call) {
  return call.approval?.approved === true && ["owner", "admin"].includes(call.approval.actor_role) && /^[0-9a-f-]{36}$/i.test(call.approval.request_id || "");
}
__name(approved, "approved");
function validateEndpoint(call) {
  if (call.action !== "test.endpoint") return;
  let url;
  try {
    url = new URL(call.data?.url);
  } catch {
    throw Object.assign(new Error("Neplatn\xE1 testovacia URL."), { status: 400 });
  }
  const allowed = url.protocol === "https:" && (url.hostname === "auru.dev" || url.hostname === "auru.space" || url.hostname.endsWith(".saboivan2008.workers.dev"));
  if (!allowed) throw Object.assign(new Error("Tester m\xF4\u017Ee vola\u0165 iba schv\xE1len\xE9 Trinity HTTPS adresy."), { status: 403 });
}
__name(validateEndpoint, "validateEndpoint");
async function audit(env, ctx, event) {
  if (!env.DB) return;
  const task = env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('aura_service_call',?)").bind(JSON.stringify(event)).run().catch((error) => console.error(JSON.stringify({ event: "aura_audit_failed", role: event.role, message: error instanceof Error ? error.message : String(error) })));
  if (ctx?.waitUntil) ctx.waitUntil(task);
  else await task;
}
__name(audit, "audit");
var aura_entry_default = {
  async fetch(request, env, ctx) {
    const role = roles[env.WORKER_ROLE];
    if (!role) return json({ ok: false, error: "Nezn\xE1ma Aura rola." }, 503);
    const url = new URL(request.url), traceId = crypto.randomUUID();
    if (request.method === "GET" && url.pathname === "/health") {
      const missing = ["AI", "DB"].filter((name) => !env[name]);
      if (env.WORKER_ROLE === "aura_deployer" && !env.CODE_KV) missing.push("CODE_KV");
      return json({ service: env.WORKER_ROLE.replace("_", "-"), version: VERSION, status: missing.length ? "degraded" : "serving", missing }, missing.length ? 503 : 200);
    }
    if (request.method !== "POST") return json({ ok: false, error: "Method not allowed", traceId }, 405);
    try {
      const call = await readJSON(request);
      if (!call || typeof call !== "object" || Array.isArray(call) || !role.actions.includes(call.action) || !call.data || typeof call.data !== "object" || Array.isArray(call.data))
        throw Object.assign(new Error("Neplatn\xE1 alebo nepovolen\xE1 Aura akcia."), { status: 400 });
      validateEndpoint(call);
      if (role.approval?.includes(call.action) && !approved(call)) throw Object.assign(new Error("T\xE1to akcia vy\u017Eaduje potvrdenie vlastn\xEDka alebo administr\xE1tora."), { status: 403 });
      const mutating = role.idempotent?.includes(call.action);
      const key = call.idempotency_key;
      if (mutating && (!key || !/^[0-9a-f-]{36}$/i.test(key))) throw Object.assign(new Error("Mutuj\xFAca akcia vy\u017Eaduje UUID idempotency_key."), { status: 400 });
      if (mutating && env.IDEMPOTENCY) {
        const stored = await env.IDEMPOTENCY.get(`aura:${env.WORKER_ROLE}:${key}`, "json");
        if (stored) return json({ ...stored, reused: true }, stored.ok === false ? 500 : 200);
      }
      const forwarded = new Request(request.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...call, traceId }) });
      const response = await role.worker.fetch(forwarded, env, ctx);
      const payload = await response.json().catch(() => ({ ok: false, error: "Aura rola vr\xE1tila neplatn\xFA odpove\u010F." }));
      if (payload.ok === false) {
        console.error(JSON.stringify({ event: "aura_call_failed", role: env.WORKER_ROLE, action: call.action, traceId }));
        return json({ ok: false, error: "Aura akcia zlyhala.", traceId }, response.status >= 400 ? response.status : 500);
      }
      const result = { ...payload, traceId, service_version: VERSION };
      if (mutating && env.IDEMPOTENCY) await env.IDEMPOTENCY.put(`aura:${env.WORKER_ROLE}:${key}`, JSON.stringify(result), { expirationTtl: 86400 });
      await audit(env, ctx, { role: env.WORKER_ROLE, action: call.action, traceId, status: "completed" });
      return json(result, response.status);
    } catch (error) {
      const status = error?.status || 500;
      console.error(JSON.stringify({ event: "aura_request_rejected", role: env.WORKER_ROLE, traceId, status, message: error instanceof Error ? error.message : String(error) }));
      return json({ ok: false, error: status === 500 ? "Intern\xE1 chyba Aura slu\u017Eby." : error.message, traceId }, status);
    }
  }
};
export {
  aura_entry_default as default
};
//# sourceMappingURL=aura-entry.js.map

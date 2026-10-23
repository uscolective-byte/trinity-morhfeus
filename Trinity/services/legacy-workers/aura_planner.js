// AURA Planner — dekomponuje ciele, plánuje projekty a šprinty (Trinity 10.2)
import {runAuraAi, parseAuraJson, safeDbRun, safeDbWrite} from './aura_helpers.js';

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try { call = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "plan.task") {
        const text = await runAuraAi(env,
          "Si AURA Planner. Rozdeľ zadanú úlohu na jasné, overiteľné kroky. Odpovedz VÝHRADNE ako validný JSON: {\"steps\":[{\"title\":\"...\",\"description\":\"...\",\"estimated_minutes\":0,\"dependencies\":[],\"priority\":\"high|normal|low\"}],\"summary\":\"...\",\"risks\":[]}",
          "Úloha: " + (d.task || d.title || "") + "\nKontext: " + (d.context || "")
        );
        const result = parseAuraJson(text);
        const id = crypto.randomUUID();
        await safeDbWrite(env.DB.prepare("INSERT INTO tasks (id, title, description, status, assigned_agent, priority, created_at, updated_at) VALUES (?,?,?,?, 'planner', ?, datetime('now'), datetime('now'))").bind(id, d.task || d.title || "plan", JSON.stringify(result), 'pending', d.priority || 'normal').run());
        if (result.steps && Array.isArray(result.steps)) {
          for (const s of result.steps) {
            await safeDbWrite(env.DB.prepare("INSERT INTO autonomous_tasks (id, title, description, status, priority, created_at) VALUES (lower(hex(randomblob(16))), ?, ?, 'pending', ?, datetime('now'))").bind(s.title, s.description, s.priority || 'normal').run());
          }
        }
        return Response.json({ ok: true, result, traceId, from: "aura-planner" });
      }
      if (call.action === "plan.project") {
        const text = await runAuraAi(env,
          "Si AURA Planner. Vytvor štruktúrovaný projektový plán s míľnikmi a kontrolnými bodmi. Odpovedz VÝHRADNE ako validný JSON: {\"milestones\":[{\"name\":\"...\",\"deliverables\":[],\"deadline_estimate\":\"...\",\"dependencies\":[]}],\"timeline\":\"...\",\"resources_needed\":[]}",
          "Projekt: " + (d.project || "") + "\nCiele: " + (d.goals || "") + "\nObmedzenia: " + (d.constraints || "")
        );
        const result = parseAuraJson(text);
        await safeDbWrite(env.DB.prepare("INSERT INTO ops_roadmap (id, title, status, priority, created_at) VALUES (lower(hex(randomblob(16))), ?, 'planned', ?, datetime('now'))").bind(d.project || "project", d.priority || "normal").run());
        return Response.json({ ok: true, result, traceId, from: "aura-planner" });
      }
      if (call.action === "plan.sprint") {
        const tasks = await safeDbRun(env.DB.prepare("SELECT id, title, description, priority FROM autonomous_tasks WHERE status = 'pending' ORDER BY CASE WHEN priority='critical' THEN 0 WHEN priority='high' THEN 1 ELSE 2 END LIMIT 20").all()) || { results: [] };
        const text = await runAuraAi(env,
          "Si AURA Planner. Zorganizuj úlohy do realistického šprintu. Odpovedz VÝHRADNE ako validný JSON: {\"sprint\":{\"name\":\"...\",\"duration_days\":0,\"tasks\":[{\"id\":\"...\",\"title\":\"...\",\"story_points\":0,\"day_assignment\":0}],\"capacity_notes\":\"...\"}}",
          "Dostupné úlohy: " + JSON.stringify(tasks.results) + "\nKapacita: " + (d.capacity || "5 days")
        );
        const result = parseAuraJson(text);
        return Response.json({ ok: true, result, traceId, from: "aura-planner" });
      }
      if (call.action === "plan.timeline") {
        const text = await runAuraAi(env,
          "Si AURA Planner. Odhadni časovú líniu a kritickú cestu pre zadané úlohy. Odpovedz VÝHRADNE ako validný JSON: {\"total_hours\":0,\"critical_path\":[],\"parallel_tracks\":[],\"bottlenecks\":[]}",
          "Úlohy: " + JSON.stringify(d.tasks || [])
        );
        const result = parseAuraJson(text);
        return Response.json({ ok: true, result, traceId, from: "aura-planner" });
      }
      if (call.action === "plan.create") {
        const text = await runAuraAi(env,
          "Si AURA Planner. Vytvor krok-za-krokom plán. Pre každý krok uveď akciu, agenta, odhadovaný čas a závislosti. Odpovedz VÝHRADNE ako validný JSON: {\"steps\":[{\"action\":\"...\", \"agent\":\"...\", \"time\":\"...\", \"deps\":[]}]}",
          "Cieľ: " + (d.goal || "")
        );
        const plan = parseAuraJson(text);
        const goalId = crypto.randomUUID();
        await safeDbWrite(env.DB.prepare("INSERT INTO goals (id, goal, priority, status, owner, created_at, updated_at) VALUES (?, ?, ?, 'active', 'aura-planner', datetime('now'), datetime('now'))").bind(goalId, d.goal || "goal", d.priority || 5).run());
        return Response.json({ ok: true, result: { goalId, plan }, traceId, from: "aura-planner" });
      }
      if (call.action === "plan.decompose") {
        const text = await runAuraAi(env,
          "Si AURA Planner. Dekomponuj zadaný cieľ na elementárne podúlohy. Odpovedz VÝHRADNE ako validný JSON: {\"subtasks\":[{\"title\":\"...\",\"expected_outcome\":\"...\"}]}",
          "Cieľ: " + (d.target || d.goal || "")
        );
        const result = parseAuraJson(text);
        return Response.json({ ok: true, result, traceId, from: "aura-planner" });
      }
      if (call.action === "plan.goals") {
        const r = await safeDbRun(env.DB.prepare("SELECT id, goal, priority, status, created_at FROM goals ORDER BY priority DESC, created_at DESC LIMIT 50").all()) || { results: [] };
        return Response.json({ ok: true, result: r.results, traceId, from: "aura-planner" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "planner", role: "Dekomponuje ciele, plánuje projekty, šprinty a časové osi", status: "active", version: "10.2.0" }, traceId, from: "aura-planner" });
      }
      const text = await runAuraAi(env, "Si AURA Planner. Plánuj ciele a koordinuj tím.", d.prompt || call.action);
      return Response.json({ ok: true, result: { response: text }, traceId, from: "aura-planner" });
    } catch (e) { return Response.json({ ok: false, error: e.message, traceId, from: "aura-planner" }); }
  }
};

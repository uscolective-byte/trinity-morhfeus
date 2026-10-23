// AURA CodeGen — generuje, refaktoruje a udržiava kód (Trinity 10.2)
import {runAuraAi, parseAuraJson, safeDbRun, safeDbWrite, AURA_SERVICE_VERSION} from './aura_helpers.js';

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try { call = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "codegen.generate") {
        const text = await runAuraAi(env,
          "Si AURA CodeGen. Generuj čistý, bezpečný a produkčný kód podľa moderných štandardov. Odpovedz VÝHRADNE ako validný JSON: {\"code\":\"...\",\"language\":\"...\",\"explanation\":\"...\",\"dependencies\":[]}",
          "Špecifikácia: " + (d.spec || d.description || "") + "\nJazyk: " + (d.language || "javascript") + "\nTyp: " + (d.type || "function")
        );
        const result = parseAuraJson(text);
        await safeDbWrite(env.DB.prepare("INSERT INTO code_snippets (id, title, language, code, tags, created_at) VALUES (lower(hex(randomblob(16))), ?, ?, ?, 'generated', datetime('now'))").bind(d.title||"generated", d.language||"javascript", result.code || result.raw || "").run());
        return Response.json({ ok: true, result, traceId, from: "aura-codegen" });
      }
      if (call.action === "codegen.refactor") {
        const text = await runAuraAi(env,
          "Si AURA CodeGen. Refaktorizuj kód pre maximálnu čitateľnosť, výkon, modularitu a bezpečnosť. Odpovedz VÝHRADNE ako validný JSON: {\"refactored_code\":\"...\",\"changes\":[],\"improvements\":[]}",
          "Kód na refaktorizáciu:\n" + (d.code || "") + "\nPoznámky: " + (d.notes || "")
        );
        const result = parseAuraJson(text);
        await safeDbWrite(env.DB.prepare("INSERT INTO code_snippets (id, title, language, code, tags, created_at) VALUES (lower(hex(randomblob(16))), 'refactored', ?, ?, 'refactored', datetime('now'))").bind(d.language||"javascript", result.refactored_code || result.raw || "").run());
        return Response.json({ ok: true, result, traceId, from: "aura-codegen" });
      }
      if (call.action === "codegen.scaffold") {
        const text = await runAuraAi(env,
          "Si AURA CodeGen. Vytvor kompletnú scaffold štruktúru projektu s pripravenými súbormi. Odpovedz VÝHRADNE ako validný JSON: {\"files\":[{\"path\":\"...\",\"content\":\"...\"}],\"structure_description\":\"...\",\"setup_instructions\":\"...\"}",
          "Typ projektu: " + (d.project_type || "worker") + "\nNázov: " + (d.name || "new-project") + "\nFunkcie: " + (d.features || "")
        );
        const result = parseAuraJson(text);
        if (result.files && Array.isArray(result.files)) {
          for (const f of result.files) {
            await safeDbWrite(env.DB.prepare("INSERT INTO code_snippets (id, title, language, code, tags, created_at) VALUES (lower(hex(randomblob(16))), ?, ?, ?, 'scaffold', datetime('now'))").bind(f.path, d.language||"javascript", f.content).run());
          }
        }
        return Response.json({ ok: true, result, traceId, from: "aura-codegen" });
      }
      if (call.action === "codegen.docs") {
        const text = await runAuraAi(env,
          "Si AURA CodeGen. Generuj jasnú a prehľadnú technickú dokumentáciu pre kód. Odpovedz VÝHRADNE ako validný JSON: {\"documentation\":\"...\",\"api_endpoints\":[],\"examples\":[]}",
          "Kód:\n" + (d.code || "") + "\nFormát: " + (d.format || "markdown")
        );
        const result = parseAuraJson(text);
        return Response.json({ ok: true, result, traceId, from: "aura-codegen" });
      }
      if (call.action === "codegen.sql") {
        const text = await runAuraAi(env,
          "Si AURA CodeGen. Generuj optimalizovaný SQL dotaz pre SQLite/Cloudflare D1. Vráť iba čistý SQL príkaz, bez úvodného textu a markdownu.",
          d.prompt || ""
        );
        const cleanedSql = text.replace(/^```(?:sql)?\s*/i, '').replace(/\s*```$/i, '').trim();
        return Response.json({ ok: true, result: { sql: cleanedSql }, traceId, from: "aura-codegen" });
      }
      if (call.action === "codegen.migration") {
        const text = await runAuraAi(env,
          "Si AURA CodeGen. Generuj D1 migráciu (CREATE TABLE / ALTER TABLE). Vráť iba SQL príkazy.",
          "Tabuľka: " + (d.table || "table") + "\nStĺpce a indexy: " + (d.columns || "")
        );
        const cleanedSql = text.replace(/^```(?:sql)?\s*/i, '').replace(/\s*```$/i, '').trim();
        return Response.json({ ok: true, result: { migration_sql: cleanedSql }, traceId, from: "aura-codegen" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "codegen", role: "Generuje čistý kód, refaktoruje, scaffoldy a D1 SQL", status: "active", version: AURA_SERVICE_VERSION }, traceId, from: "aura-codegen" });
      }
      return Response.json({ ok: false, error: "Unknown action: " + call.action, traceId, from: "aura-codegen" });
    } catch (e) { return Response.json({ ok: false, error: e.message, traceId, from: "aura-codegen" }); }
  }
};

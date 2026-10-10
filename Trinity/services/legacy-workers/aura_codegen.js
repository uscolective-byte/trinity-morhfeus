// AURA CodeGen — generuje produkčný kód
export default {
  async fetch(request, env) {
    if (request.method !== "POST") return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
    let call;
    try { call = await request.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }
    const d = call.data || {};
    const traceId = call.traceId || crypto.randomUUID();
    try {
      if (call.action === "codegen.generate") {
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA CodeGen. Generuj čistý produkčný kód v " + (d.language||"typescript") + ". Iba kód, žiadne vysvetlenie." },
          { role: "user", content: d.prompt }
        ]});
        const code = ai.response || "";
        await env.DB.prepare("INSERT INTO code_storage (id, title, language, code, created_at) VALUES (lower(hex(randomblob(16))), ?, ?, ?, datetime('now'))").bind((d.prompt||"").slice(0,100), d.language||"typescript", code).run();
        return Response.json({ ok: true, result: { code }, traceId, from: "aura-codegen" });
      }
      if (call.action === "codegen.sql") {
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA CodeGen. Generuj SQL pre SQLite/D1. Iba SQL, žiadne vysvetlenie." },
          { role: "user", content: d.prompt }
        ]});
        return Response.json({ ok: true, result: { sql: ai.response }, traceId, from: "aura-codegen" });
      }
      if (call.action === "codegen.migration") {
        const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [
          { role: "system", content: "Si AURA CodeGen. Generuj D1 migráciu. Iba SQL." },
          { role: "user", content: "Tabuľka: " + d.table + " Stĺpce: " + d.columns }
        ]});
        return Response.json({ ok: true, result: { migration: ai.response }, traceId, from: "aura-codegen" });
      }
      if (call.action === "aura.status") {
        return Response.json({ ok: true, result: { agent: "codegen", role: "Generuje produkčný kód, SQL, migrácie", status: "active" }, traceId, from: "aura-codegen" });
      }
      const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages: [{ role: "system", content: "Si AURA CodeGen. Generuj kód." }, { role: "user", content: d.prompt || call.action }] });
      return Response.json({ ok: true, result: { response: ai.response }, traceId, from: "aura-codegen" });
    } catch (e) { return Response.json({ ok: false, error: e.message, traceId, from: "aura-codegen" }); }
  }
};
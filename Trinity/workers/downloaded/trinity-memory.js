--4cee6dfe1700ade036b5d58373393b0fc7d47f1f8ac54738b7ddafbb6d57
Content-Disposition: form-data; name="trinity-memory-worker.js"

// trinity-memory-worker.js
var trinity_memory_worker_default = { async fetch(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" };
  if (method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    if (path === "/init" && method === "POST") {
      await env.TRINITY_DB.prepare("CREATE TABLE IF NOT EXISTS trinity_memory (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT UNIQUE NOT NULL, value TEXT NOT NULL, category TEXT DEFAULT 'general', updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)").run();
      return new Response(JSON.stringify({ status: "success", message: "Trinity memory schema initialized." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (path === "/memory" && method === "POST") {
      const body = await request.json();
      const { key, value, category } = body;
      if (!key || value === void 0) {
        return new Response(JSON.stringify({ error: "Missing 'key' or 'value'" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const stringValue = typeof value === "object" ? JSON.stringify(value) : String(value);
      const cat = category || "general";
      await env.TRINITY_DB.prepare("INSERT INTO trinity_memory (key, value, category, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, category = excluded.category, updated_at = CURRENT_TIMESTAMP").bind(key, stringValue, cat).run();
      return new Response(JSON.stringify({ status: "success", key, updated: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (path === "/memory" && method === "GET") {
      const key = url.searchParams.get("key");
      if (key) {
        const result = await env.TRINITY_DB.prepare("SELECT * FROM trinity_memory WHERE key = ?").bind(key).first();
        if (!result) return new Response(JSON.stringify({ error: "Key not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { results } = await env.TRINITY_DB.prepare("SELECT id, key, category, updated_at FROM trinity_memory ORDER BY updated_at DESC").all();
      return new Response(JSON.stringify(results), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "Endpoint not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
} };
export {
  trinity_memory_worker_default as default
};
//# sourceMappingURL=trinity-memory-worker.js.map

--4cee6dfe1700ade036b5d58373393b0fc7d47f1f8ac54738b7ddafbb6d57--

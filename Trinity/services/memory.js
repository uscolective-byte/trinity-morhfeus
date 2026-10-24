// Trinity Memory Worker (services/memory.js)
const VERSION = '2.0.0';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const db = env.TRINITY_DB || env.DB;

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };

    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (path === "/health" && method === "GET") {
      return new Response(JSON.stringify({
        service: "trinity-memory",
        version: VERSION,
        status: db ? "serving" : "degraded",
        missing: db ? [] : ["DB"]
      }), {
        status: db ? 200 : 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    try {
      if (path === "/init" && method === "POST") {
        if (!db) return new Response(JSON.stringify({ error: "Database not configured" }), { status: 503, headers: corsHeaders });
        await db.prepare(
          "CREATE TABLE IF NOT EXISTS trinity_memory (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT UNIQUE NOT NULL, value TEXT NOT NULL, category TEXT DEFAULT 'general', updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"
        ).run();
        return new Response(JSON.stringify({ status: "success", message: "Trinity memory schema initialized." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (path === "/memory" && method === "POST") {
        if (!db) return new Response(JSON.stringify({ error: "Database not configured" }), { status: 503, headers: corsHeaders });
        let body;
        try { body = await request.json(); } catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: corsHeaders }); }
        const { key, value, category } = body;
        if (!key || value === undefined) {
          return new Response(JSON.stringify({ error: "Missing 'key' or 'value'" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        const stringValue = typeof value === "object" ? JSON.stringify(value) : String(value);
        const cat = category || "general";
        await db.prepare(
          "INSERT INTO trinity_memory (key, value, category, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, category = excluded.category, updated_at = CURRENT_TIMESTAMP"
        ).bind(key, stringValue, cat).run();
        return new Response(JSON.stringify({ status: "success", key, updated: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (path === "/memory" && method === "GET") {
        if (!db) return new Response(JSON.stringify({ error: "Database not configured" }), { status: 503, headers: corsHeaders });
        const key = url.searchParams.get("key");
        if (key) {
          const result = await db.prepare("SELECT * FROM trinity_memory WHERE key = ?").bind(key).first().catch(() => null);
          if (!result) {
            return new Response(JSON.stringify({ error: "Key not found" }), {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }
          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        const { results } = await db.prepare("SELECT id, key, category, updated_at FROM trinity_memory ORDER BY updated_at DESC LIMIT 100").all().catch(() => ({ results: [] }));
        return new Response(JSON.stringify(results || []), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ error: "Endpoint not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};

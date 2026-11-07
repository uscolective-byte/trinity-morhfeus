export interface Env {
  TRINITY_KV?: KVNamespace;
}
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "trinity-memory", version: "10.3.0", status: "serving" });
    }
    const key = url.pathname.slice(1);
    if (req.method === "POST") {
      const val = await req.text();
      if (env.TRINITY_KV) await env.TRINITY_KV.put(key, val);
      return Response.json({ worker: "trinity-memory", status: "SAVED", key });
    }
    const result = (env.TRINITY_KV && key) ? await env.TRINITY_KV.get(key) : null;
    if (result === null) return Response.json({ error: "Key not found" }, { status: 404 });
    return new Response(result, { headers: { "Content-Type": "application/json" } });
  }
};

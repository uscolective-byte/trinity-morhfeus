export interface Env {
  MEM_KV?: KVNamespace;
}
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "aura_memory", version: "10.3.0", status: "serving" });
    }
    if (req.method === "POST") {
      const { key, value, ttl = 86400 } = await req.json() as any;
      if (env.MEM_KV) await env.MEM_KV.put(`aura:mem:${key}`, JSON.stringify(value), { expirationTtl: ttl });
      return Response.json({ worker: "aura_memory", status: "STORED", key });
    }
    const k = url.searchParams.get("key");
    const val = (k && env.MEM_KV) ? await env.MEM_KV.get(`aura:mem:${k}`) : null;
    return Response.json({ worker: "aura_memory", key: k, data: val ? JSON.parse(val) : null });
  }
};

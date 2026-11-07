export interface Env {
  METRICS_KV?: KVNamespace;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "trinity-sentinel", version: "10.3.0", status: "serving" });
    }
    if (req.method !== "POST") return Response.json({ error: "POST required" }, { status: 405 });
    let metrics: any;
    try {
      metrics = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const { workerName = "generic", tokens = 0, isError = false } = metrics;
    const today = new Date().toISOString().slice(0, 10);
    const k = `metrics:${workerName}:${today}`;
    if (env.METRICS_KV) {
      await env.METRICS_KV.put(k, JSON.stringify({ tokens, isError, recordedAt: Date.now() }), { expirationTtl: 2592000 });
    }
    return Response.json({ worker: "trinity-sentinel", status: "RECORDED", workerName, today });
  }
};

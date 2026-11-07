export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "aura_tester", version: "10.3.0", status: "serving" });
    }
    if (req.method !== "POST") return Response.json({ error: "POST required" }, { status: 405 });
    const { endpoints = [] } = await req.json() as any;
    const results = [];
    for (const ep of endpoints) {
      const s = performance.now();
      try {
        const resp = await fetch(ep, { method: "HEAD" });
        results.push({ endpoint: ep, ok: resp.ok, status: resp.status, latencyMs: Math.round(performance.now() - s) });
      } catch (err: any) {
        results.push({ endpoint: ep, ok: false, error: err.message, latencyMs: Math.round(performance.now() - s) });
      }
    }
    return Response.json({ worker: "aura_tester", allPassed: results.every(r => r.ok), results });
  }
};

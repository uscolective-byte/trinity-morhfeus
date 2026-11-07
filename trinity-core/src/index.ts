export interface Env {
  DISPATCHER?: Fetcher;
  CHAT_INFERENCE_SERVICE?: Fetcher;
  GUARDIAN?: Fetcher;
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "trinity-core", version: "10.3.0", status: "serving" });
    }
    if (req.method === "OPTIONS") return new Response(null, { status: 204 });
    if (req.method !== "POST") return Response.json({ error: "POST required" }, { status: 405 });
    const auth = req.headers.get("Authorization");
    if (!auth) return Response.json({ error: "Unauthorized Trinity Node" }, { status: 401 });
    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
    }
    if (payload.routeToInference && env.CHAT_INFERENCE_SERVICE) {
      return await env.CHAT_INFERENCE_SERVICE.fetch(req.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    }
    return Response.json({
      worker: "trinity-core",
      status: "COGNITIVE_ORCHESTRATION_READY",
      payloadSize: JSON.stringify(payload).length,
      timestamp: Date.now()
    });
  }
};
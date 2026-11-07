export interface Env {
  TRINITY_SENTINEL?: Fetcher;
}
export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "aura_evolver", version: "10.3.0", status: "serving" });
    }
    if (req.method !== "POST") return Response.json({ error: "POST required" }, { status: 405 });
    const { prompt = "", responseText = "", latencyMs = 0 } = await req.json() as any;
    const tokenEst = Math.round(responseText.length / 4);
    const tps = latencyMs > 0 ? (tokenEst / (latencyMs / 1000)) : 0;
    const suggestion = tokenEst > 1200 && latencyMs > 4000 ? "REDUCE_CONTEXT_WINDOW" : "MAINTAIN_PARAMS";
    return Response.json({ worker: "aura_evolver", tokens: tokenEst, tokensPerSec: Math.round(tps), evolutionPolicy: suggestion });
  }
};

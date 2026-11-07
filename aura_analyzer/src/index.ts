export interface Env {
  TRINITY_SENTINEL?: Fetcher;
  TRINITY_AUDIT?: Fetcher;
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "aura_analyzer", version: "10.3.0", status: "serving" });
    }
    const start = performance.now();
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS"
        }
      });
    }
    if (req.method !== "POST") return Response.json({ error: "POST required" }, { status: 405 });
    let body: { code: string; targetWorker?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const code = body.code || "";
    const issues = [];
    if (/\b(eval|new\s+Function)\s*\(/.test(code)) {
      issues.push({ sev: "CRITICAL", msg: "Unsafe enactment detected" });
    }
    if (/process\.env(?!\.NODE_ENV)/.test(code)) {
      issues.push({ sev: "HIGH", msg: "Direct process.env on Edge" });
    }
    const complexity = (code.match(/\b(if|for|while|case|catch)\b|\?\.|&&|\|\|/g) || []).length + 1;
    const verdict = issues.some(i => i.sev === "CRITICAL") ? "REJECTED" : issues.length > 0 ? "FLAGGED" : "PASSED";
    const rep = {
      worker: "aura_analyzer",
      target: body.targetWorker || "generic",
      verdict,
      complexity,
      issues,
      latencyMs: Math.round(performance.now() - start)
    };
    if (env.TRINITY_SENTINEL) {
      ctx.waitUntil(
        env.TRINITY_SENTINEL.fetch("https://sentinel/audit", {
          method: "POST",
          body: JSON.stringify(rep)
        }).catch(() => null)
      );
    }
    return Response.json(rep, { headers: { "X-Aura-Verdict": verdict } });
  }
};
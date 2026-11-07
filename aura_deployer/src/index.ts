export interface Env {
  AURA_TESTER?: Fetcher;
  DEPLOY_KV?: KVNamespace;
}
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "aura_deployer", version: "10.3.0", status: "serving" });
    }
    if (req.method !== "POST") return Response.json({ error: "POST required" }, { status: 405 });
    const payload = await req.json() as any;
    if (env.AURA_TESTER) {
      const testRes = await env.AURA_TESTER.fetch("https://tester/preflight", { method: "POST", body: JSON.stringify({ releaseId: payload.releaseId }) });
      if (!testRes.ok) return Response.json({ status: "DEPLOYMENT_ABORTED", reason: "Preflight failed" }, { status: 412 });
    }
    return Response.json({ worker: "aura_deployer", releaseId: payload.releaseId, status: "DEPLOYED_TO_EDGE" });
  }
};

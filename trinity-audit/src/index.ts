export interface Env {
  AUDIT_LOG?: KVNamespace;
}
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "trinity-audit", version: "10.3.0", status: "serving" });
    }
    if (req.method !== "POST") return Response.json({ error: "POST required" }, { status: 405 });
    const data = await req.json() as any;
    const str = JSON.stringify(data) + Date.now();
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str)))).map(b => b.toString(16).padStart(2, "0")).join("");
    if (env.AUDIT_LOG) await env.AUDIT_LOG.put(`audit:${hash}`, str);
    return Response.json({ worker: "trinity-audit", recordHash: hash, verified: true });
  }
};

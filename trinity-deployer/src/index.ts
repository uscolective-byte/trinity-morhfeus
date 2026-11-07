export interface Env {
  CODE_KV?: KVNamespace;
}
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "trinity-deployer", version: "10.3.0", status: "serving" });
    }
    let targetWorker = "unspecified";
    let newVersion = "1.0.0";
    try {
      const b = await req.json() as any;
      if (b.targetWorker) targetWorker = b.targetWorker;
      if (b.newVersion) newVersion = b.newVersion;
    } catch {}
    if (env.CODE_KV) await env.CODE_KV.put(`active:${targetWorker}`, newVersion);
    return Response.json({ worker: "trinity-deployer", targetWorker, activeVersion: newVersion, status: "DEPLOYED" });
  }
};

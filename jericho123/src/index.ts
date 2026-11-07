import jerichoCryptoService from "../../services/jericho123/src/index.js";

export default {
  async fetch(req: Request, env: any = {}, ctx?: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "jericho123", version: "10.3.0", status: "serving" });
    }
    if (url.pathname.startsWith("/crypto/") || url.pathname.startsWith("/api/crypto/")) {
      return await jerichoCryptoService.fetch(req, env, ctx);
    }
    const treasury = {
      asset: "TTK",
      status: "ACTIVE_MONITORING",
      reserveType: "SMART_CONTRACT_AUDITED",
      lastSync: Date.now()
    };
    return Response.json({ worker: "jericho123", treasury });
  }
};

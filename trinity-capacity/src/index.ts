export interface Env {
  RATE_LIMITER?: KVNamespace;
}
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "trinity-capacity", version: "10.3.0", status: "serving" });
    }
    const ip = req.headers.get("CF-Connecting-IP") || "global";
    return Response.json({ worker: "trinity-capacity", allowed: true, remainingQuota: 5000, clientIp: ip });
  }
};

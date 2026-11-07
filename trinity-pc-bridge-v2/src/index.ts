export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "trinity-pc-bridge-v2", version: "10.3.0", status: "serving" });
    }
    return Response.json({ worker: "trinity-pc-bridge-v2", protocol: "binary-fastpath-v2", status: "READY" });
  }
};

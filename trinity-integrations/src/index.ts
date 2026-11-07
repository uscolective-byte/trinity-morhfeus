export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "trinity-integrations", version: "10.3.0", status: "serving" });
    }
    let payload: any = {};
    try { payload = await req.json(); } catch {}
    return Response.json({ worker: "trinity-integrations", action: payload.action || "sync", status: "INTEGRATION_OK" });
  }
};

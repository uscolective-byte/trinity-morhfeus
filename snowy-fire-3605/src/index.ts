export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "snowy-fire-3605", version: "10.3.0", status: "serving" });
    }
    const p = await req.text();
    return Response.json({ worker: "snowy-fire-3605", logged: true, payloadSize: p.length });
  }
};

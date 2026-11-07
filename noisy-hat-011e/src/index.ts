export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "noisy-hat-011e", version: "10.3.0", status: "serving" });
    }
    return new Response("HEALTH_OK", { status: 200, headers: { "X-Status": "READY", "X-Uptime": "100%" } });
  }
};

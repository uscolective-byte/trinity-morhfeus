export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "muddy-wind-42e2", version: "10.3.0", status: "serving" });
    }
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Trinity-Node"
        }
      });
    }
    return Response.json({ worker: "muddy-wind-42e2", role: "EDGE_HELPER_ACTIVE", timestamp: Date.now() });
  }
};

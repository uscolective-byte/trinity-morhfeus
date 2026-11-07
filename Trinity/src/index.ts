export interface Env {
  CHAT_INFERENCE_SERVICE?: Fetcher;
  OPS_SERVICE?: Fetcher;
}
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" } });
    if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/api/health")) {
      return Response.json({
        ok: true,
        service: "trinity",
        version: "10.3.0",
        status: "serving"
      }, {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "X-Trinity-Version": "10.3.0"
        }
      });
    }
    if (url.pathname.startsWith("/api/chat") && env.CHAT_INFERENCE_SERVICE) {
      return await env.CHAT_INFERENCE_SERVICE.fetch(req);
    }
    if ((url.pathname.startsWith("/api/ops") || url.pathname.startsWith("/mcp")) && env.OPS_SERVICE) {
      return await env.OPS_SERVICE.fetch(req);
    }
    return new Response("Trinity Production Gateway Online", { headers: { "Content-Type": "text/plain", "X-Trinity-Version": "3.2.0" } });
  }
};
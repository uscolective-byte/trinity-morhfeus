export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "chanfana-openapi-template", version: "10.3.0", status: "serving" });
    }
    return Response.json({
      openapi: "3.1.0",
      info: { title: "Trinity OpenAPI Engine", version: "1.0.0" },
      paths: { "/api/chat": { post: { summary: "Inference chat endpoint" } } }
    });
  }
};

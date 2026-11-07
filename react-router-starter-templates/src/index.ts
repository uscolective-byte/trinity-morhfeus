export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "react-router-starter-templates", version: "10.3.0", status: "serving" });
    }
    return Response.json({ template: "react-router-starter", status: "READY", timestamp: Date.now() });
  }
};

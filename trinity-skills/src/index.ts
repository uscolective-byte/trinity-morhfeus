export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "trinity-skills", version: "10.3.0", status: "serving" });
    }
    const skills = [
      { name: "web_search", desc: "Search the live web via Edge gateway", params: { type: "object", properties: { query: { type: "string" } } } },
      { name: "execute_code", desc: "Run code in aura_codegen or local pc", params: { type: "object", properties: { code: { type: "string" } } } },
      { name: "aura_analyze", desc: "Analyze code safety and complexity", params: { type: "object", properties: { code: { type: "string" } } } }
    ];
    return Response.json({ worker: "trinity-skills", count: skills.length, skills });
  }
};

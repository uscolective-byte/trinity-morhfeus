export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "trinity-dispatcher", version: "10.3.0", status: "serving" });
    }
    if (req.method !== "POST") return Response.json({ error: "POST required" }, { status: 405 });
    const { taskType = "default", priority = "NORMAL" } = await req.json() as any;
    const routingTable: Record<string, string> = {
      analysis: "aura_analyzer",
      architecture: "aura_architect",
      codegen: "aura_codegen",
      deploy: "aura_deployer",
      security: "aura_sentinel",
      testing: "aura_tester",
      default: "trinity-core"
    };
    const target = routingTable[taskType] || routingTable.default;
    return Response.json({ worker: "trinity-dispatcher", taskId: crypto.randomUUID(), assignedTo: target, priority, queuedAt: Date.now() });
  }
};

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "aura_planner", version: "10.3.0", status: "serving" });
    }
    if (req.method !== "POST") return Response.json({ error: "POST required" }, { status: 405 });
    const { goal } = await req.json() as any;
    const plan = [
      { step: 1, action: "ANALYZE", agent: "aura_analyzer" },
      { step: 2, action: "ARCHITECT", agent: "aura_architect", dependsOn: [1] },
      { step: 3, action: "CODEGEN", agent: "aura_codegen", dependsOn: [2] },
      { step: 4, action: "TEST", agent: "aura_tester", dependsOn: [3] },
      { step: 5, action: "DEPLOY", agent: "aura_deployer", dependsOn: [4] }
    ];
    return Response.json({ worker: "aura_planner", goal, planId: crypto.randomUUID(), stages: plan });
  }
};

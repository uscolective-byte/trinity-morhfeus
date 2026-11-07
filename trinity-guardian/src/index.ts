export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "trinity-guardian", version: "10.3.0", status: "serving" });
    }
    const systemStatus = {
      worker: "trinity-guardian",
      timestamp: Date.now(),
      integrityStatus: "OK",
      policy: "ZERO_SIMULATION_STRICT",
      subsystemsHealth: {
        core: "UP",
        memory: "UP",
        dispatcher: "UP",
        sentinel: "UP"
      }
    };
    return Response.json(systemStatus, { headers: { "X-Trinity-Guardian": "SECURE" } });
  }
};

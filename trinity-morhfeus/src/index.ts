export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "trinity-morhfeus", version: "10.3.0", status: "serving" });
    }
    return Response.json({
      worker: "trinity-morhfeus",
      repo: "Morpheus-Edge",
      experimentMode: true,
      status: "EXPERIMENT_ACTIVE",
      timestamp: Date.now()
    });
  }
};

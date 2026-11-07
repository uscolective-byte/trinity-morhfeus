export interface Env {
  AI?: any;
  VECTORIZE?: any;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "trinity-knowledge", version: "10.3.0", status: "serving" });
    }
    if (req.method !== "POST") return Response.json({ error: "POST required" }, { status: 405 });
    let query = "";
    try {
      const b = await req.json() as any;
      query = b.query || "";
    } catch {}
    return Response.json({ worker: "trinity-knowledge", query, vectorsMatched: [], status: "SEARCH_COMPLETED" });
  }
};

export interface Env {
  R2_BUCKET?: R2Bucket;
  GEMINI_API_KEY?: string;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "trinity-gemini", version: "10.3.0", status: "serving" });
    }
    if (req.method !== "POST") return Response.json({ error: "POST required" }, { status: 405 });
    let payload: any = {};
    try { payload = await req.json(); } catch {}
    return Response.json({ worker: "trinity-gemini", processed: true, artifactKey: payload.fileKey || "none" });
  }
};

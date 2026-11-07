export interface Env {
  CODE_STORAGE?: KVNamespace;
}
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "trinity-builder", version: "10.3.0", status: "serving" });
    }
    if (req.method !== "POST") return Response.json({ error: "POST required" }, { status: 405 });
    let data: any;
    try { data = await req.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
    const { bundleId, code, author = "autonomous" } = data;
    if (!bundleId || !code) return Response.json({ error: "Missing bundleId or code" }, { status: 400 });
    const checksum = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code)))).map(b => b.toString(16).padStart(2, "0")).join("");
    if (env.CODE_STORAGE) await env.CODE_STORAGE.put(`build:${bundleId}`, JSON.stringify({ code, checksum, author, builtAt: Date.now() }));
    return Response.json({ worker: "trinity-builder", bundleId, checksum, status: "COMPILED" });
  }
};

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "aura_sentinel", version: "10.3.0", status: "serving" });
    }
    const text = await req.text();
    const patterns = [/\bunion\s+.*\bselect\b/i, /<script[^>]*>/i, /\.\/\.\//];
    const violations = patterns.filter(p => p.test(text));
    if (violations.length > 0) {
      return Response.json({ worker: "aura_sentinel", verdict: "BLOCKED", violationCount: violations.length }, { status: 403 });
    }
    return Response.json({ worker: "aura_sentinel", verdict: "CLEAN" });
  }
};

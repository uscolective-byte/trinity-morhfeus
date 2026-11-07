export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "vite-react-template", version: "10.3.0", status: "serving" });
    }
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Vite React</title></head><body><div id="root">Vite + React Production Root</div></body></html>`;
    return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8", "Cache-Control": "public, max-age=3600" } });
  }
};

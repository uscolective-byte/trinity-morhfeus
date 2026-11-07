export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "my-react-app", version: "10.3.0", status: "serving" });
    }
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>My React App</title></head><body><div id="root">My React App Container</div></body></html>`;
    return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
  }
};

export default {
  async fetch(req: Request): Promise<Response> {
    const u = new URL(req.url);
    if (req.method === "GET" && u.pathname === "/health") {
      return Response.json({ ok: true, service: "small-pine-596d", version: "10.3.0", status: "serving" });
    }
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      return Response.redirect(`${u.origin}${u.pathname.slice(0, -1)}${u.search}`, 301);
    }
    return new Response("URL Canonicalizer OK", { status: 200 });
  }
};
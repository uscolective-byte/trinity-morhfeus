export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "trinity-pc-bridge", version: "10.3.0", status: "serving" });
    }
    const upgrade = req.headers.get("Upgrade");
    if (upgrade !== "websocket") return new Response("WebSocket Expected", { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    server.addEventListener("message", () => {
      server.send(JSON.stringify({ received: true, pong: Date.now() }));
    });
    return new Response(null, { status: 101, webConnection: client } as any);
  }
};

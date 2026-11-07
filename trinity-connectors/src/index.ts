export interface Env {
  GITHUB_TOKEN?: string;
  DISCORD_WEBHOOK?: string;
}
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "trinity-connectors", version: "10.3.0", status: "serving" });
    }
    if (url.pathname.startsWith("/proxy/github")) {
      const targetUrl = "https://api.github.com" + url.pathname.replace("/proxy/github", "") + url.search;
      const h = new Headers(req.headers);
      h.set("User-Agent", "Trinity-Connectors-Edge");
      if (env.GITHUB_TOKEN) h.set("Authorization", `Bearer ${env.GITHUB_TOKEN}`);
      return await fetch(targetUrl, { method: req.method, headers: h, body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined });
    }
    return Response.json({ worker: "trinity-connectors", availableConnectors: ["github", "discord"], status: "READY" });
  }
};

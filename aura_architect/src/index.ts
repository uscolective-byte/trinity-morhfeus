export interface Env {
  TRINITY_SENTINEL?: Fetcher;
  TRINITY_AUDIT?: Fetcher;
}
export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "aura_architect", version: "10.3.0", status: "serving" });
    }
    if (req.method !== "POST") return Response.json({ error: "POST required" }, { status: 405 });
    const { services = [], connections = [] } = await req.json() as any;
    const adj = new Map<string, string[]>();
    services.forEach((s: string) => adj.set(s, []));
    connections.forEach((conn: any) => { if (!adj.has(conn.from)) adj.set(conn.from, []); adj.get(conn.from)!.push(conn.to); });
    const visited = new Set<string>(), rec = new Set<string>(), cycles: string[][] = [];
    function dfs(v: string, p: string[] = []) {
      visited.add(v); rec.add(v); p.push(v);
      for (const nb of adj.get(v) || []) {
        if (!visited.has(nb)) dfs(nb, [...p]);
        else if (rec.has(nb)) cycles.push([...p, nb]);
      }
      rec.delete(v);
    }
    for (const node of adj.keys()) if (!visited.has(node)) dfs(node);
    const status = cycles.length > 0 ? "CYCLIC_DETECTED" : "VALID";
    return Response.json({ worker: "aura_architect", status, cycles, totalNodes: services.length }, { status: cycles.length > 0 ? 409 : 200 });
  }
};

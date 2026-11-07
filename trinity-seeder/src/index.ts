export interface Env {
  DB?: D1Database;
  TRINITY_D1?: D1Database;
}
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "trinity-seeder", version: "10.3.0", status: "serving" });
    }
    if (req.method !== "POST") return Response.json({ error: "POST required" }, { status: 405 });
    const key = req.headers.get("X-Migration-Key");
    if (key !== "MIGRATE_AUTHORIZED") return Response.json({ error: "Unauthorized migration" }, { status: 403 });
    const targetDb = env.TRINITY_D1 || env.DB;
    if (targetDb) {
      await targetDb.prepare(`
        CREATE TABLE IF NOT EXISTS trinity_sys_migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE,
          applied_at INTEGER DEFAULT (unixepoch())
        );
      `).run();
    }
    return Response.json({ worker: "trinity-seeder", status: "MIGRATION_SUCCESS", hasDbBinding: !!targetDb });
  }
};

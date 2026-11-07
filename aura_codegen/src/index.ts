export interface Env {
  TRINITY_SENTINEL?: Fetcher;
}
export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "aura_codegen", version: "10.3.0", status: "serving" });
    }
    if (req.method !== "POST") return Response.json({ error: "POST required" }, { status: 405 });
    const { entity, fields = {} } = await req.json() as any;
    if (!entity) return Response.json({ error: "Entity name required" }, { status: 400 });
    const tsArr = Object.entries(fields).map(([k, v]: any) => `  ${k}: ${v.type === "number" ? "number" : v.type === "boolean" ? "boolean" : "string"};`);
    const tsInterface = `export interface ${entity} {\n${tsArr.join("\n")}\n}`;
    const sqlArr = Object.entries(fields).map(([k, v]: any) => `  ${k} ${v.type === "number" ? "INTEGER" : "TEXT"}${v.primaryKey ? " PRIMARY KEY" : ""}`);
    const sqlD1 = `CREATE TABLE IF NOT EXISTS ${entity.toLowerCase()}s (\n${sqlArr.join(",\n")}\n);`;
    return Response.json({ worker: "aura_codegen", entity, artifacts: { typescript: tsInterface, sqlD1 } });
  }
};

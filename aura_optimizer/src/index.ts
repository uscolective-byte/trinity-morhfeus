export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "aura_optimizer", version: "10.3.0", status: "serving" });
    }
    if (req.method !== "POST") return Response.json({ error: "POST required" }, { status: 405 });
    const { rawPrompt = "" } = await req.json() as any;
    const optimized = rawPrompt.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
    return Response.json({ worker: "aura_optimizer", origLength: rawPrompt.length, optimizedLength: optimized.length, savedChars: rawPrompt.length - optimized.length, prompt: optimized });
  }
};

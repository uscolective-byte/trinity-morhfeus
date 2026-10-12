const json = (data, status = 200) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" }
  });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        service: "Trinity PC Bridge V2",
        status: "serving",
        cloud: true
      });
    }

    if (request.method === "POST" && url.pathname === "/v1/heartbeat") {
      if (!env.PC_STATE) return json({ error: "storage_missing" }, 503);

      const bodyText = await request.text();
      if (bodyText.length > 2048) {
        return json({ error: "payload_too_large" }, 413);
      }

      let body;
      try {
        body = JSON.parse(bodyText);
      } catch {
        return json({ error: "invalid_json" }, 400);
      }

      if (body?.agent !== "trinity-pc-v2") {
        return json({ error: "invalid_agent" }, 400);
      }

      const record = {
        agent: "trinity-pc-v2",
        hostname: String(body.hostname || "unknown").slice(0, 80),
        version: "2.1",
        lastSeen: new Date().toISOString()
      };

      await env.PC_STATE.put("pc:primary", JSON.stringify(record));
      return json({ ok: true, receivedAt: record.lastSeen });
    }

    if (request.method === "GET" && url.pathname === "/v1/status") {
      if (!env.PC_STATE) return json({ error: "storage_missing" }, 503);

      const record = await env.PC_STATE.get("pc:primary", "json");
      if (!record) {
        return json({ online: false, lastSeen: null });
      }

      const age = Date.now() - Date.parse(record.lastSeen);
      return json({
        online: age >= 0 && age < 120000,
        lastSeen: record.lastSeen,
        hostname: record.hostname,
        agent: record.agent
      });
    }

    return json({ error: "Not found" }, 404);
  }
};

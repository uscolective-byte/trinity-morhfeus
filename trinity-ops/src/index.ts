export interface OpsEnv {
  ENVIRONMENT?: string;
  DESKTOP_COMMANDER_URL?: string;
  DESKTOP_COMMANDER_FALLBACK_URL?: string;
  TRINITY_BRIDGE_SECRET?: string;
  PC_STATE?: KVNamespace;
  TRINITY_KV?: KVNamespace;
  Mastermind?: KVNamespace;
  customFetcher?: typeof fetch;
}

function getOpsKv(env?: OpsEnv): KVNamespace | null {
  return env?.PC_STATE || env?.TRINITY_KV || env?.Mastermind || null;
}

export async function pingDesktopCommander(env: OpsEnv = {}) {
  const targetUrl = env.DESKTOP_COMMANDER_URL || "https://agent.auru.dev/health";
  const secret = String(env.TRINITY_BRIDGE_SECRET || "").trim();
  const fetcher = env.customFetcher || fetch;
  const kv = getOpsKv(env);

  let status: "online" | "offline" = "offline";
  let httpStatus = 0;

  try {
    const res = await fetcher(targetUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-Trinity-Bridge-Secret": secret
      },
      signal: AbortSignal.timeout(4000)
    });
    httpStatus = res.status;
    if (res.ok) {
      status = "online";
    }
  } catch {
    status = "offline";
  }

  if (kv && typeof kv.put === "function") {
    await kv.put("desktop_commander_status", status, { expirationTtl: 600 });
    await kv.put(
      "desktop_commander_heartbeat",
      JSON.stringify({
        desktop_commander_status: status,
        target: targetUrl,
        http_status: httpStatus,
        checked_at: new Date().toISOString()
      }),
      { expirationTtl: 600 }
    );
  }

  return {
    ok: status === "online",
    desktop_commander_status: status,
    target: targetUrl,
    http_status: httpStatus,
    checked_at: new Date().toISOString()
  };
}

export default {
  async fetch(req: Request, env: OpsEnv = {}, ctx?: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "trinity-ops", version: "10.3.0", status: "serving" });
    }
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Trinity-Bridge-Secret"
        }
      });
    }
    if (url.pathname === "/api/ops/desktop-heartbeat") {
      const result = await pingDesktopCommander(env);
      return Response.json(result, { status: result.ok ? 200 : 503 });
    }
    if (url.pathname.startsWith("/mcp")) {
      return Response.json({
        protocol: "mcp-2024-11-05",
        status: "ONLINE",
        resources: ["aura-architecture", "trinity-metrics"],
        tools: ["analyze-code", "sql-migrate", "desktop-commander-heartbeat"]
      });
    }
    const kv = getOpsKv(env);
    const desktopStatus = kv && typeof kv.get === "function" ? (await kv.get("desktop_commander_status")) || "offline" : "offline";
    return Response.json({
      worker: "trinity-ops",
      opsStatus: "HEALTHY",
      desktop_commander_status: desktopStatus,
      endpoints: ["/api/ops", "/api/ops/desktop-heartbeat", "/mcp"]
    });
  },

  async scheduled(_event: ScheduledEvent, env: OpsEnv = {}, ctx?: ExecutionContext): Promise<void> {
    const task = pingDesktopCommander(env);
    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(task);
    } else {
      await task;
    }
  }
};

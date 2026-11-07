import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const execAsync = promisify(exec);

// Konfigurácia TRINITY Sandboxu
const REPO_ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const DEFAULT_WORKSPACE = fs.existsSync("C:/Users/saboi/Trinity/Trinity-antigravity")
  ? path.resolve("C:/Users/saboi/Trinity/Trinity-antigravity")
  : REPO_ROOT;
export const WORKSPACE_DIR = process.env.TRINITY_WORKSPACE ? path.resolve(process.env.TRINITY_WORKSPACE) : DEFAULT_WORKSPACE;
export const BRIDGE_PORT = parseInt(process.env.TRINITY_PORT || "3333", 10);
export const BRIDGE_TOKEN = process.env.TRINITY_TOKEN || (process.env.NODE_ENV === "test" || !process.env.NODE_ENV ? "trinity-local-secret" : "");

// Constitutional Security Audit - zakázané deštruktívne vzory príkazov
export const BLOCKED_PATTERNS = [
  // Broader rm -rf: catches rm with -r/--recursive and any path starting with / or [a-z]: or ~
  /\brm\s+.*(-[a-z]*r[a-z]*|--recursive)\b.*(?:\s|^)["']?(?:\/|[a-z]:[\\/]|~)/i,
  /mkfs/i,
  /dd\s+if=/i,
  /:(){ :|:& };:/,
  /format\s+[a-z]:/i,
  // Windows del / erase with /s and /q flags in any order targeting root or drive root
  /\b(?:del|erase)\b.*(?:\/s.*\/q|\/q.*\/s).*["']?(?:[a-z]:(?:[\\/]|$|\s|["'])|\\\\|\/)/i,
  // Windows rmdir / rd with /s and /q flags in any order targeting root or drive root
  /\b(?:rmdir|rd)\b.*(?:\/s.*\/q|\/q.*\/s).*["']?(?:[a-z]:(?:[\\/]|$|\s|["'])|\\\\|\/)/i,
  // PowerShell Remove-Item with -Recurse and -Force in any order targeting root or drive root
  /\bRemove-Item\s+.*(?:-recurse.*-force|-force.*-recurse).*["']?(?:[a-z]:(?:[\\/]|$|\s|["'])|\\\\|\/)/i
];

export function auditCommand(cmd) {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(cmd)) {
      throw new Error(`SECURITY AUDIT REJECTED: Príkaz porušuje bezpečnostné pravidlá TRINITY (${cmd})`);
    }
  }
}

export async function runSafeCommand(command, subdir = ".", timeoutMs = 120000) {
  auditCommand(command);
  const rawSubdir = String(subdir ?? ".");
  if (/^[a-zA-Z]:[\\/]|^\\\\/.test(rawSubdir.trim())) {
    throw new Error(`SANDBOX VIOLATION: Pokus o únik mimo TRINITY_WORKSPACE (${rawSubdir})`);
  }
  const normalizedSubdir = rawSubdir.replace(/\\/g, "/");
  const resolvedCwd = path.resolve(WORKSPACE_DIR, normalizedSubdir);
  const normalizedRoot = path.resolve(WORKSPACE_DIR);
  const rel = path.relative(normalizedRoot, resolvedCwd);

  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`SANDBOX VIOLATION: Pokus o únik mimo TRINITY_WORKSPACE (${resolvedCwd})`);
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: resolvedCwd,
      timeout: timeoutMs,
      maxBuffer: 20 * 1024 * 1024,
      env: { ...process.env, CI: "true" }
    });
    return {
      exitCode: 0,
      stdout: stdout ? stdout.trim() : "",
      stderr: stderr ? stderr.trim() : ""
    };
  } catch (error) {
    return {
      exitCode: error.code || 1,
      stdout: error.stdout ? error.stdout.trim() : "",
      stderr: error.stderr ? error.stderr.trim() : (error.message || String(error))
    };
  }
}

// 1. Inicializácia MCP Servera
const mcpServer = new McpServer({
  name: "trinity-tool-manager",
  version: "1.0.0"
});

// Nástroj 1: Cloudflare Wrangler
mcpServer.tool(
  "trinity_wrangler",
  "Spúšťa Cloudflare Wrangler CLI príkazy (deploy, d1, kv, whoami, tail) v TRINITY workspace.",
  {
    args: z.string().describe("Argumenty pre wrangler, napr. 'd1 list' alebo 'deploy --dry-run'"),
    projectSubdir: z.string().optional().describe("Voliteľný podpriečinok projektu, predvolene 'Trinity'")
  },
  async ({ args, projectSubdir }) => {
    const cleanArgs = args.replace(/^wrangler\s+/i, "");
    const cmd = `npx --yes wrangler ${cleanArgs}`;
    const targetDir = projectSubdir || (fs.existsSync(path.join(WORKSPACE_DIR, "Trinity")) ? "Trinity" : ".");
    const result = await runSafeCommand(cmd, targetDir);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }
);

// Nástroj 2: Terminál / CMD v Sandboxe
mcpServer.tool(
  "trinity_cmd",
  "Vykoná systémový príkaz (cmd/powershell/npm/git) v izolovanom TRINITY workspace.",
  {
    command: z.string().describe("Príkaz na vykonanie"),
    subdir: z.string().optional().describe("Podpriečinok v rámci TRINITY_WORKSPACE")
  },
  async ({ command, subdir }) => {
    const result = await runSafeCommand(command, subdir || ".");
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }
);

// Nástroj 3: Status mosta
mcpServer.tool(
  "trinity_bridge_status",
  "Zobrazí stav TRINITY mosta a prostredia.",
  {},
  async () => {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          status: "ready",
          workspace: WORKSPACE_DIR,
          port: BRIDGE_PORT,
          node_version: process.version,
          platform: process.platform
        }, null, 2)
      }]
    };
  }
);

// 2. HTTP Bridge pre Webový Chat (gemini.google.com / chatgpt.com -> localhost:3333)
export const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/(www\.)?auru\.(space|dev)$/,
  /^https:\/\/gemini\.google\.com$/,
  /^https:\/\/(chatgpt\.com|chat\.openai\.com)$/,
  /^https:\/\/claude\.ai$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/
];

export function isOriginAllowed(origin) {
  if (!origin || origin === "null") return true; // Direct non-browser CLI/Curl/Tampermonkey requests
  return ALLOWED_ORIGIN_PATTERNS.some(p => p.test(origin));
}

export function createApp() {
  const app = express();
  app.use(cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS_REJECTED: Origin '${origin}' nie je povolený.`));
      }
    }
  }));
  app.use(express.json({ limit: "10mb" }));

  // Health check
  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      service: "trinity-mcp-bridge",
      workspace: WORKSPACE_DIR,
      timestamp: new Date().toISOString()
    });
  });

  app.post("/exec", async (req, res) => {
    const token = req.headers["x-trinity-token"];
    const expectedToken = process.env.TRINITY_TOKEN || BRIDGE_TOKEN;
    if (!token || !expectedToken || token !== expectedToken) {
      return res.status(401).json({ error: "Neplatný TRINITY token" });
    }

    const { tool, command, args, subdir } = req.body;
    try {
      let finalCmd = command;
      let targetSubdir = subdir || ".";

      if (tool === "wrangler") {
        const cleanArgs = (args || command || "").replace(/^wrangler\s+/i, "");
        finalCmd = `npx --yes wrangler ${cleanArgs}`;
        if (!subdir && fs.existsSync(path.join(WORKSPACE_DIR, "Trinity"))) {
          targetSubdir = "Trinity";
        }
      }

      if (!finalCmd) {
        return res.status(400).json({ status: "error", message: "Chýba príkaz na vykonanie" });
      }

      const result = await runSafeCommand(finalCmd, targetSubdir);
      res.json({ status: "ok", tool: tool || "cmd", result });
    } catch (err) {
      res.status(400).json({ status: "error", message: err.message });
    }
  });

  // CORS error handler
  app.use((err, req, res, next) => {
    if (err && err.message && err.message.startsWith("CORS_REJECTED")) {
      return res.status(403).json({ error: err.message });
    }
    res.status(500).json({ error: err ? err.message : "Internal server error" });
  });

  return app;
}

const app = createApp();

// Spustenie HTTP daemonu iba ak je súbor spustený priamo
const isMainModule = process.argv[1] && (
  import.meta.url.toLowerCase().endsWith(path.basename(process.argv[1]).toLowerCase()) ||
  path.resolve(process.argv[1]).toLowerCase() === path.resolve(decodeURI(new URL(import.meta.url).pathname)).toLowerCase()
);

let httpServer = null;
if (isMainModule && process.env.MCP_STDIO !== "true" && process.env.NODE_ENV !== "test") {
  if (!BRIDGE_TOKEN || BRIDGE_TOKEN.length < 32) {
    throw new Error("TRINITY_TOKEN must contain at least 32 characters before startup.");
  }
  httpServer = app.listen(BRIDGE_PORT, "127.0.0.1", () => {
    console.error(`[TRINITY Bridge] HTTP brána beží na http://127.0.0.1:${BRIDGE_PORT}`);
    console.error(`[TRINITY Bridge] Workspace: ${WORKSPACE_DIR}`);
  });

  httpServer.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[TRINITY Bridge] Upozornenie: Port ${BRIDGE_PORT} je už obsadený inou inštanciou.`);
      console.error(`[TRINITY Bridge] Server už aktívne beží na porte ${BRIDGE_PORT}.`);
      process.exit(0);
    } else {
      console.error(`[TRINITY Bridge] Chyba servera:`, err.message);
    }
  });
}

// Stdio transport iba ak je explicitne zapnutý cez MCP_STDIO=true
if (isMainModule && process.env.MCP_STDIO === "true" && process.env.NODE_ENV !== "test") {
  try {
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    console.error("[TRINITY Bridge] MCP Stdio transport pripojený.");
  } catch (err) {
    console.error("[TRINITY Bridge] Stdio transport error:", err.message);
  }
}

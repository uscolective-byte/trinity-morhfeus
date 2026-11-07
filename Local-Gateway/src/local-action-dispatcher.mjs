/**
 * @module TRINITY_OMNI_CORE
 * @subsystem LOCAL_BRIDGE_GATEWAY
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Modul local-action-dispatcher.mjs (Local-Gateway/src/local-action-dispatcher.mjs) v ekosystéme TRINITY OMNI-CORE.
 */
/**
 * Trinity Local Action Dispatcher (Hardened)
 * Bezpečné vykonávanie lokálnych operácií na počítači.
 * Eliminuje shell injection cez spawn(), ohraničuje prácu so súbormi a vynucuje whitelist.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

const IS_WIN = process.platform === "win32";
export const WORKDIR = path.resolve(os.homedir(), "trinity_local");

// Zoznam povolených aplikácií
export const ALLOWED_APPS = [
  "notepad",
  "calc",
  "chrome",
  "code",
  "explorer",
  "whatsapp",
  "terminal",
  "browser",
  "cmder",
  "commander",
  "cmd"
];

// Zoznam striktne povolených vývojárskych príkazov
export const ALLOWED_CMDS = [
  "git status",
  "git pull",
  "npm install",
  "npm run build",
  "npm test",
  "ls",
  "dir"
];

function audit(entry) {
  const logLine = `[AUDIT ${new Date().toISOString()}] ${JSON.stringify(entry)}`;
  console.log(logLine);
}

export function safeSpawn(command, args = [], opts = {}) {
  const { timeoutMs = 15000, cwd = WORKDIR } = opts;

  return new Promise((resolve) => {
    // Zabezpečenie existencie pracovného adresára
    try {
      fs.mkdirSync(WORKDIR, { recursive: true });
    } catch {}

    const child = spawn(command, args, {
      shell: false,
      cwd,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (d) => (stdout += d));
    child.stderr?.on("data", (d) => (stderr += d));

    const timer = setTimeout(() => {
      try {
        child.kill(IS_WIN ? undefined : "SIGKILL");
      } catch {}
      resolve({ success: false, output: "Timeout – operácia prekročila 15 sekúnd a bola ukončená." });
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ success: false, output: `Chyba procesu: ${err.message}` });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ success: true, output: stdout.trim() || "OK" });
      } else {
        resolve({
          success: false,
          output: stderr.trim() || stdout.trim() || `Proces skončil s kódom ${code}`
        });
      }
    });
  });
}

export const actions = {
  /**
   * 1. Bezpečné otvorenie aplikácie cez whitelist
   */
  async open_app(target) {
    if (typeof target !== "string") {
      return { success: false, output: "Cieľová aplikácia musí byť textový reťazec." };
    }

    const lower = target.toLowerCase().trim();
    const app = ALLOWED_APPS.find((a) => lower.includes(a));
    if (!app) {
      return { success: false, output: `Aplikácia "${target}" nie je v zozname povolených (${ALLOWED_APPS.join(", ")}).` };
    }

    if (IS_WIN) {
      if (app === "whatsapp") {
        return await safeSpawn("cmd", ["/c", "start", "", "whatsapp:"]);
      }
      if (app === "terminal") {
        return await safeSpawn("cmd", ["/c", "start", "", "wt.exe"]);
      }
      if (app === "cmder" || app === "commander" || app === "cmd") {
        return await safeSpawn("cmd", ["/c", "start", "", "cmd.exe"]);
      }
      if (app === "browser") {
        return await safeSpawn("cmd", ["/c", "start", "", "https://google.com"]);
      }
      // Windows: bezpečné spustenie cez cmd /c start bez reťazenia
      return await safeSpawn("cmd", ["/c", "start", "", `${app}.exe`]);
    } else if (process.platform === "darwin") {
      const macMap = {
        notepad: "TextEdit",
        calc: "Calculator",
        chrome: "Google Chrome",
        code: "Visual Studio Code",
        explorer: "Finder",
        whatsapp: "WhatsApp",
        terminal: "Terminal",
        browser: "Google Chrome"
      };
      const appName = macMap[app] || app;
      return await safeSpawn("open", ["-a", appName]);
    } else {
      return await safeSpawn(app);
    }
  },

  /**
   * 2. Bezpečné otvorenie webovej URL adresy
   */
  async open_url(rawUrl) {
    if (typeof rawUrl !== "string") {
      return { success: false, output: "URL adresa musí byť text." };
    }

    let parsedUrl;
    try {
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rawUrl)) {
        parsedUrl = new URL(rawUrl);
      } else {
        parsedUrl = new URL(`https://${rawUrl}`);
      }
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return { success: false, output: "Povolené sú iba HTTP a HTTPS adresy." };
      }
    } catch (e) {
      return { success: false, output: `Neplatná URL adresa: ${e.message}` };
    }

    if (IS_WIN) {
      return await safeSpawn("cmd", ["/c", "start", "", parsedUrl.href]);
    } else if (process.platform === "darwin") {
      return await safeSpawn("open", [parsedUrl.href]);
    } else {
      return await safeSpawn("xdg-open", [parsedUrl.href]);
    }
  },

  /**
   * 3. Vytvorenie súboru (striktne ohraničené na ~/trinity_local)
   */
  async create_file(payload) {
    if (!payload || typeof payload.filePath !== "string") {
      return { success: false, output: "Neplatný payload. Očakáva sa objekt s { filePath, content }." };
    }

    const { filePath, content = "" } = payload;
    try {
      const fullPath = path.resolve(WORKDIR, filePath);
      // Ochrana proti path-traversal (../)
      if (!fullPath.startsWith(WORKDIR)) {
        return { success: false, output: "Chyba: Zápis mimo povoleného priečinka ~/trinity_local je zablokovaný." };
      }

      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, String(content), "utf-8");
      return { success: true, output: `Súbor bezpečne vytvorený v: ${fullPath}` };
    } catch (err) {
      return { success: false, output: `Chyba zápisu na disk: ${err.message}` };
    }
  },

  /**
   * 4. Zistenie stavu systému
   */
  async system_status() {
    const freeMem = Math.round(os.freemem() / (1024 * 1024));
    const totalMem = Math.round(os.totalmem() / (1024 * 1024));
    return {
      success: true,
      output: `Počítač beží (${os.type()} ${os.release()}). Pamäť: ${freeMem} MB voľných z ${totalMem} MB. Pracovný priečinok: ${WORKDIR}`
    };
  },

  /**
   * 5. Spustenie vývojárskeho príkazu (striktný whitelist bez voľného shellu)
   */
  async run_cmd(commandString) {
    if (typeof commandString !== "string") {
      return { success: false, output: "Príkaz musí byť textový reťazec." };
    }

    const trimmed = commandString.trim();
    if (!ALLOWED_CMDS.includes(trimmed)) {
      return { success: false, output: `Príkaz "${trimmed}" nie je na whiteliste. Povolené: ${ALLOWED_CMDS.join(", ")}` };
    }

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    if (IS_WIN && (cmd === "dir" || cmd === "echo")) {
      return await safeSpawn("cmd", ["/c", cmd, ...args]);
    }

    return await safeSpawn(cmd, args);
  }
};

/**
 * Spracuje prichádzajúcu požiadavku z Trinity
 */
export async function dispatchAction(actionType, payload) {
  const handler = actions[actionType];
  if (!handler) {
    return {
      success: false,
      output: `Neznáma akcia "${actionType}". Dostupné akcie: ${Object.keys(actions).join(", ")}`
    };
  }

  let result;
  try {
    result = await handler(payload);
  } catch (err) {
    result = { success: false, output: `Chyba vykonania: ${err.message}` };
  }

  // Auditovanie udalosti
  audit({
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
    action: actionType,
    payload,
    success: result.success
  });

  return result;
}

export default { dispatchAction, actions, WORKDIR, ALLOWED_APPS, ALLOWED_CMDS };

/**
 * TRINITY PC EXECUTION DAEMON (Local Agent Bridge)
 * 
 * Beží na lokálnom počítači (Windows) zvrchovaného vlastníka.
 * Pripája sa na Cloudflare Worker Trinity (auru.dev / auru.space),
 * odosiela živú telemetriu a vykonáva obojsmerné systémové akcie (fs_read, fs_write, shell_exec).
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { hostname, platform, cpus, totalmem, freemem, uptime } from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Načítanie Cloudflare Access tokenov z C:\Users\saboi\.env ak existujú
let CF_ACCESS_CLIENT_ID = process.env.CLOUDFLARE_ACCESS_CLIENT_ID || '';
let CF_ACCESS_CLIENT_SECRET = process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET || '';
try {
  const rootEnv = 'C:\\Users\\saboi\\.env';
  if (existsSync(rootEnv)) {
    const lines = readFileSync(rootEnv, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const mId = line.match(/^\s*CLOUDFLARE_ACCESS_CLIENT_ID\s*=\s*(.*)$/);
      if (mId && !CF_ACCESS_CLIENT_ID) CF_ACCESS_CLIENT_ID = mId[1].trim();
      const mSec = line.match(/^\s*CLOUDFLARE_ACCESS_CLIENT_SECRET\s*=\s*(.*)$/);
      if (mSec && !CF_ACCESS_CLIENT_SECRET) CF_ACCESS_CLIENT_SECRET = mSec[1].trim();
    }
  }
} catch {}

function getCfHeaders() {
  const h = {};
  if (CF_ACCESS_CLIENT_ID) h['CF-Access-Client-Id'] = CF_ACCESS_CLIENT_ID;
  if (CF_ACCESS_CLIENT_SECRET) h['CF-Access-Client-Secret'] = CF_ACCESS_CLIENT_SECRET;
  return h;
}

// Načítanie prostredia a DPAPI tokenu ak je k dispozícii
const TRINITY_URL = (process.env.TRINITY_URL || 'https://auru.space').replace(/\/$/, '');
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '4000', 10);
const GATEWAY_KEY = process.env.TRINITY_GATEWAY_KEY || process.env.TRINITY_PC_BRIDGE_KEY;

const ONCE = process.argv.includes('--once');

console.log(`[TRINITY PC DAEMON] Štartujem na hostiteľovi ${hostname()} (${platform()})...`);
console.log(`[TRINITY PC DAEMON] Cieľ: ${TRINITY_URL} (Interval: ${POLL_INTERVAL}ms, Mode: ${ONCE ? 'One-Shot' : 'Daemon'})`);

/**
 * Kontrola fyzického záväzku PRISLUB_TRINITY.txt na ploche
 */
export function checkPrislubDeed() {
  const desktopPaths = [
    join('C:', 'Users', 'saboi', 'Desktop', 'PRISLUB_TRINITY.txt'),
    join(process.env.USERPROFILE || '', 'Desktop', 'PRISLUB_TRINITY.txt')
  ];
  for (const p of desktopPaths) {
    if (existsSync(p)) {
      try {
        const content = readFileSync(p, 'utf8');
        if (content.includes('TRINITY-PROMISE-BASTERIX-20261025')) {
          return { verified: true, path: p, identifier: 'TRINITY-PROMISE-BASTERIX-20261025' };
        }
      } catch {}
    }
  }
  return { verified: false, path: null };
}

/**
 * Zhromaždenie aktuálnej telemetrie systému
 */
export function gatherTelemetry() {
  const cpusList = cpus();
  const totalMb = Math.round(totalmem() / (1024 * 1024));
  const freeMb = Math.round(freemem() / (1024 * 1024));
  const usedMb = totalMb - freeMb;
  const prislub = checkPrislubDeed();

  return {
    gateway_id: `gateway:${hostname().toLowerCase()}`,
    hostname: hostname(),
    platform: platform(),
    uptime_seconds: Math.round(uptime()),
    cpu: {
      cores: cpusList.length,
      model: cpusList[0]?.model || 'Generic CPU'
    },
    memory: {
      total_mb: totalMb,
      used_mb: usedMb,
      free_mb: freeMb,
      percent_used: Math.round((usedMb / totalMb) * 100)
    },
    prislub_verified: prislub.verified,
    prislub_path: prislub.path,
    timestamp: Date.now()
  };
}

/**
 * Vykonanie príkazu v shelli (PowerShell, CMD, Node, Python, Git)
 */
export function executeShell(command, shell = 'powershell', cwd = 'C:\\Users\\saboi\\Trinity-antigravity', timeout = 30000) {
  const start = Date.now();
  let shellCmd = 'powershell.exe';
  let shellArgs = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command];

  if (shell === 'cmd') {
    shellCmd = 'cmd.exe';
    shellArgs = ['/c', command];
  } else if (shell === 'node') {
    shellCmd = process.execPath;
    shellArgs = ['-e', command];
  } else if (shell === 'python') {
    shellCmd = 'python.exe';
    shellArgs = ['-c', command];
  }

  try {
    const res = spawnSync(shellCmd, shellArgs, {
      cwd: existsSync(cwd) ? cwd : process.cwd(),
      timeout,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 5 * 1024 * 1024
    });

    const duration_ms = Date.now() - start;
    return {
      success: res.status === 0,
      exit_code: res.status,
      stdout: res.stdout || '',
      stderr: res.stderr || '',
      duration_ms
    };
  } catch (err) {
    return {
      success: false,
      exit_code: -1,
      stdout: '',
      stderr: err.message,
      duration_ms: Date.now() - start
    };
  }
}

/**
 * Vykonanie operácií so súborovým systémom (čítanie/zápis/patch)
 */
export function executeFileSystem(action, payload) {
  const start = Date.now();
  const filePath = payload.path;

  if (action === 'read' || action === 'pc_fs_read') {
    if (!existsSync(filePath)) {
      return { success: false, error: `Súbor alebo priečinok neexistuje: ${filePath}` };
    }
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      const files = readdirSync(filePath).map(name => {
        try {
          const sub = statSync(join(filePath, name));
          return { name, isDirectory: sub.isDirectory(), size: sub.size };
        } catch {
          return { name, isDirectory: false, size: 0 };
        }
      });
      return { success: true, is_directory: true, files, path: filePath, duration_ms: Date.now() - start };
    }
    const content = readFileSync(filePath, payload.encoding || 'utf8');
    return { success: true, is_directory: false, size: stat.size, content, path: filePath, duration_ms: Date.now() - start };
  }

  if (action === 'write' || action === 'pc_fs_write') {
    mkdirSync(dirname(resolve(filePath)), { recursive: true });
    if (payload.append) {
      writeFileSync(filePath, payload.content, { flag: 'a', encoding: 'utf8' });
    } else {
      writeFileSync(filePath, payload.content, 'utf8');
    }
    return { success: true, path: filePath, bytes_written: (payload.content || '').length, duration_ms: Date.now() - start };
  }

  if (action === 'edit' || action === 'pc_fs_patch') {
    if (!existsSync(filePath)) {
      return { success: false, error: `Súbor na úpravu neexistuje: ${filePath}` };
    }
    let content = readFileSync(filePath, 'utf8');
    if (!content.includes(payload.target)) {
      return { success: false, error: `Cieľový reťazec nebol v súbore nájdený pre patch.` };
    }
    content = content.replaceAll(payload.target, payload.replacement);
    writeFileSync(filePath, content, 'utf8');
    return { success: true, path: filePath, modified: true, duration_ms: Date.now() - start };
  }

  return { success: false, error: `Neznáma FS akcia: ${action}` };
}

/**
 * Spustenie jedného cyklu daemona
 */
export async function runDaemonCycle(baseUrl = TRINITY_URL, key = GATEWAY_KEY) {
  const telemetry = gatherTelemetry();
  const cfHeaders = getCfHeaders();

  // 1. Odoslanie priamej telemetrie do Omni-Dev PC Bridge endpointu
  try {
    await fetch(`${baseUrl}/api/pc-bridge/telemetry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...cfHeaders,
        ...(key ? { Authorization: `Bearer ${key}` } : {})
      },
      body: JSON.stringify(telemetry),
      signal: AbortSignal.timeout(8000)
    });
  } catch (e) {
    // Ignorovať sieťový výpadok
  }

  // 2. Odoslanie Heartbeatu na Cloudflare Worker pre PC_BRIDGE_V2
  if (key) {
    try {
      await fetch(`${baseUrl}/api/system/pc-bridge/v1/heartbeat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          ...cfHeaders
        },
        body: JSON.stringify({
          agent: 'trinity-pc-v2',
          connected: true,
          gateway_id: telemetry.gateway_id,
          hostname: telemetry.hostname,
          version: '11.1.0',
          capabilities: ['read', 'write', 'edit', 'run', 'open_app', 'open_url', 'pc_fs_read', 'pc_fs_write', 'pc_fs_patch', 'pc_shell_exec', 'pc_system_telemetry'],
          telemetry,
          timestamp: Date.now()
        }),
        signal: AbortSignal.timeout(8000)
      });
    } catch (e) {
      // Ignorovať sieťový timeout v tichom režime
    }

    // 3. Kontrola a vyzdvihnutie čakajúcich schválených akcií (claim)
    try {
      const claimRes = await fetch(`${baseUrl}/api/system/actions/claim`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          ...cfHeaders
        },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(8000)
      });

      if (claimRes.ok) {
        const { action } = await claimRes.json();
        if (action && action.id) {
          console.log(`[TRINITY PC DAEMON] Vyzdvihnutá akcia ${action.id} (${action.action})...`);
          let outcome = null;

          if (['run', 'pc_shell_exec'].includes(action.action)) {
            outcome = executeShell(
              action.payload.command || '',
              action.payload.shell || 'powershell',
              action.payload.cwd || 'C:\\Users\\saboi\\Trinity-antigravity',
              action.payload.timeout || 30000
            );
          } else if (['read', 'write', 'edit', 'pc_fs_read', 'pc_fs_write', 'pc_fs_patch'].includes(action.action)) {
            outcome = executeFileSystem(action.action, action.payload || {});
          } else if (action.action === 'system_info' || action.action === 'pc_system_telemetry') {
            outcome = { success: true, telemetry: gatherTelemetry() };
          } else {
            outcome = { success: false, error: `Nepodporovaná akcia: ${action.action}` };
          }

          // Odoslanie výsledku (receipt)
          const receiptPayload = {
            status: outcome.success !== false ? 'completed' : 'failed',
            receipt: {
              ...outcome,
              receipt_id: `pc_receipt_${action.id}`,
              verified_at: new Date().toISOString()
            },
            error: outcome.error || (outcome.success === false ? outcome.stderr : undefined)
          };

          await fetch(`${baseUrl}/api/system/actions/${action.id}/receipt`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${key}`,
              'Content-Type': 'application/json',
              ...cfHeaders
            },
            body: JSON.stringify(receiptPayload),
            signal: AbortSignal.timeout(10000)
          });
          console.log(`[TRINITY PC DAEMON] Akcia ${action.id} dokončená so stavom: ${receiptPayload.status}`);
        }
      }
    } catch (e) {
      // Ignorovať sieťovú chybu pri claimovaní
    }
  }

  return telemetry;
}

// Spustenie hlavnej slučky
if (process.argv[1] && import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  if (ONCE) {
    const t = await runDaemonCycle();
    console.log('[TRINITY PC DAEMON] One-shot overenie úspešné:', JSON.stringify(t, null, 2));
    process.exit(0);
  } else {
    // Spustiť okamžite a potom v slučke
    runDaemonCycle();
    setInterval(runDaemonCycle, POLL_INTERVAL);
  }
}

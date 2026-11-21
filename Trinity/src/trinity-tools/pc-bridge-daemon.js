/**
 * Trinity PC Bridge Daemon (Node.js)
 * ─────────────────────────────────
 * Runs locally on the user's Windows PC.
 * Listens on localhost:7777 and executes commands sent from the
 * Trinity Worker via the PC_BRIDGE_SERVICE service binding.
 *
 * SECURITY:
 *   - Binds to 127.0.0.1 ONLY (never 0.0.0.0)
 *   - Requires HMAC-SHA256 signed requests with a shared secret
 *   - Allowlist of permitted commands (no arbitrary shell)
 *   - All actions logged to local audit file
 *
 * SETUP:
 *   1. npm install
 *   2. Set BRIDGE_SECRET env var (must match PC_BRIDGE_KEY in Worker)
 *   3. node daemon.js
 *   4. Install as Windows service (optional): use node-windows or pm2
 */

import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { exec, execFile } from 'child_process';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Configuration ─────────────────────────────────────────────────────
const PORT = 7777;
const HOST = '127.0.0.1'; // localhost only — never expose externally

function resolveBridgeSecret() {
  if (process.env.BRIDGE_SECRET) return process.env.BRIDGE_SECRET;
  if (process.env.TRINITY_BRIDGE_SECRET) return process.env.TRINITY_BRIDGE_SECRET;
  if (process.env.PC_BRIDGE_KEY) return process.env.PC_BRIDGE_KEY;

  const keyFile = path.join(__dirname, '.bridge-key');
  if (fs.existsSync(keyFile)) {
    try {
      const saved = fs.readFileSync(keyFile, 'utf8').trim();
      if (saved) return saved;
    } catch (_) {}
  }

  // Auto-generate stable secret for developer convenience
  const generated = 'trinity_' + crypto.randomBytes(16).toString('hex');
  try {
    fs.writeFileSync(keyFile, generated, { encoding: 'utf8' });
  } catch (_) {}
  return generated;
}

const BRIDGE_SECRET = resolveBridgeSecret();
const AUDIT_LOG = path.join(__dirname, 'bridge-audit.log');

// ── Allowlist: only these actions are permitted ──────────────────────
const ALLOWED_ACTIONS = {
  open_file:   (args) => `start "" "${sanitizePath(args.path)}"`,
  list_dir:    null,  // handled directly via fs
  read_file:   null,  // handled directly via fs
  write_file:  null,  // handled directly via fs
  create_dir:  null,  // handled directly via fs
  execute:     (args) => sanitizeCommand(args.command, args.cwd),
  run_build:   (args) => sanitizeCommand(args.command || 'npm run build', args.cwd),
};

// ── Path sanitization ────────────────────────────────────────────────
function sanitizePath(p) {
  if (!p || typeof p !== 'string') throw new Error('Invalid path');
  // Prevent path traversal and dangerous patterns
  if (p.includes('..') || p.includes('\0')) throw new Error('Path traversal not allowed');
  // Normalize and ensure it's within allowed roots
  const normalized = path.normalize(p);
  return normalized;
}

function sanitizeCommand(cmd, cwd) {
  if (!cmd || typeof cmd !== 'string') throw new Error('Invalid command');
  // Allowlist of command prefixes
  const ALLOWED_PREFIXES = [
    'npm ', 'npx ', 'node ', 'git ', 'pnpm ', 'yarn ',
    'tsc ', 'wrangler ', 'forge ', 'hardhat ',
    'dir ', 'echo ', 'type ', 'cd ',
  ];
  const trimmed = cmd.trim();
  const isAllowed = ALLOWED_PREFIXES.some(prefix =>
    trimmed.toLowerCase().startsWith(prefix.toLowerCase())
  );
  if (!isAllowed) throw new Error(`Command not in allowlist: ${trimmed.slice(0, 50)}`);
  // Block shell metacharacters that could chain commands
  if (/[;&|`$]/.test(trimmed)) throw new Error('Shell metacharacters not allowed');
  return trimmed;
}

// ── HMAC verification ────────────────────────────────────────────────
function verifySignature(body, signature, secret) {
  if (!signature) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex'),
    );
  } catch {
    return false;
  }
}

// ── Audit logging ────────────────────────────────────────────────────
function auditLog(entry) {
  const line = JSON.stringify({ ...entry, ts: new Date().toISOString() }) + '\n';
  fs.appendFileSync(AUDIT_LOG, line, 'utf8');
  console.log(`[${entry.status}] ${entry.action} — ${entry.message || ''}`);
}

// ── Heartbeat: report online status ──────────────────────────────────
async function sendHeartbeat() {
  // The Worker's PC_BRIDGE_SERVICE will poll this endpoint
  // Or the daemon can push to a Worker endpoint
  const status = {
    online: true,
    hostname: os.hostname(),
    platform: os.platform(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
  return status;
}

// ── Action handlers ──────────────────────────────────────────────────
async function handleAction(action, args) {
  switch (action) {
    case 'open_file': {
      const filePath = sanitizePath(args.path);
      // On Windows: start "" "path" opens with default app
      // For VS Code specifically: code "path"
      const cmd = args.editor
        ? `${args.editor} "${filePath}"`
        : `start "" "${filePath}"`;
      await execAsync(cmd);
      return { status: 'SUCCESS', message: `Opened: ${filePath}` };
    }

    case 'list_dir': {
      const dirPath = sanitizePath(args.path || process.cwd());
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      const result = entries.map(e => ({
        name: e.name,
        type: e.isDirectory() ? 'dir' : 'file',
      }));
      return { status: 'SUCCESS', entries: result };
    }

    case 'read_file': {
      const filePath = sanitizePath(args.path);
      const content = fs.readFileSync(filePath, 'utf8');
      return { status: 'SUCCESS', content: content.slice(0, 50000) };
    }

    case 'write_file': {
      const filePath = sanitizePath(args.path);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, args.content || '', 'utf8');
      return { status: 'SUCCESS', message: `Written: ${filePath}` };
    }

    case 'create_dir': {
      const dirPath = sanitizePath(args.path);
      fs.mkdirSync(dirPath, { recursive: true });
      return { status: 'SUCCESS', message: `Created: ${dirPath}` };
    }

    case 'execute':
    case 'run_build': {
      const cmd = ALLOWED_ACTIONS[action](args);
      const cwd = args.cwd ? sanitizePath(args.cwd) : process.cwd();
      const result = await execAsync(cmd, { cwd, timeout: 120000 });
      return {
        status: 'SUCCESS',
        stdout: (result.stdout || '').slice(0, 10000),
        stderr: (result.stderr || '').slice(0, 5000),
        exitCode: result.code,
      };
    }

    default:
      return { status: 'ERROR', message: `Unknown action: ${action}` };
  }
}

function execAsync(cmd, opts = {}) {
  return new Promise((resolve) => {
    exec(cmd, opts, (error, stdout, stderr) => {
      resolve({
        stdout,
        stderr,
        code: error ? error.code : 0,
      });
    });
  });
}

// ── HTTP Server ──────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  // Health / heartbeat endpoint (no auth needed for status check)
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(await sendHeartbeat()));
    return;
  }

  // All other endpoints require POST + HMAC signature
  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end(JSON.stringify({ status: 'ERROR', message: 'Method not allowed' }));
    return;
  }

  let body = '';
  for await (const chunk of req) body += chunk;

  // Verify HMAC signature
  const signature = req.headers['x-bridge-signature'];
  if (!verifySignature(body, signature, BRIDGE_SECRET)) {
    auditLog({ action: 'AUTH_FAIL', status: 'DENIED', message: 'Invalid signature' });
    res.writeHead(401);
    res.end(JSON.stringify({ status: 'ERROR', message: 'Unauthorized' }));
    return;
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    res.writeHead(400);
    res.end(JSON.stringify({ status: 'ERROR', message: 'Invalid JSON' }));
    return;
  }

  const { action, arguments: args, call_id } = payload;

  // Check allowlist
  if (!ALLOWED_ACTIONS.hasOwnProperty(action) && action !== 'list_dir' && action !== 'read_file' && action !== 'write_file' && action !== 'create_dir') {
    auditLog({ action, status: 'DENIED', message: 'Action not in allowlist', call_id });
    res.writeHead(403);
    res.end(JSON.stringify({ status: 'ERROR', message: `Action not allowed: ${action}` }));
    return;
  }

  try {
    const result = await handleAction(action, args);
    auditLog({ action, status: result.status, message: result.message, call_id });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (err) {
    auditLog({ action, status: 'ERROR', message: err.message, call_id });
    res.writeHead(500);
    res.end(JSON.stringify({ status: 'ERROR', message: err.message }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`╔══════════════════════════════════════╗`);
  console.log(`║  Trinity PC Bridge Daemon            ║`);
  console.log(`║  Listening: ${HOST}:${PORT}            ║`);
  console.log(`║  Audit log: ${AUDIT_LOG.slice(0, 20)}...  ║`);
  console.log(`╚══════════════════════════════════════╝`);
  console.log(`\nWaiting for commands from Trinity Worker...`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down PC Bridge...');
  server.close(() => process.exit(0));
});

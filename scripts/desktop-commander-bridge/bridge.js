#!/usr/bin/env node
/**
 * @module TRINITY_DESKTOP_COMMANDER_BRIDGE
 * @description Standalone zero-footprint micro-service for localhost:5050 behind Cloudflared Tunnel (agent.auru.dev / agent.aura.dev).
 * Requires zero git repository or node_modules on the local PC. Verifies X-Trinity-Bridge-Secret on every request.
 */

import http from 'node:http';
import crypto from 'node:crypto';
import os from 'node:os';

const DEFAULT_PORT = Number(process.env.TRINITY_BRIDGE_PORT || 5050);
const DEFAULT_HOST = process.env.TRINITY_BRIDGE_HOST || '127.0.0.1';

export function verifyBridgeSecret(providedSecret, expectedSecret) {
  const provided = String(providedSecret || '').trim();
  const expected = String(expectedSecret || '').trim();
  if (!provided || !expected) return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function createDesktopCommanderHandler(options = {}) {
  const getSecret = () => options.secret ?? process.env.TRINITY_BRIDGE_SECRET ?? '';

  return async function handleDesktopBridgeRequest(req, res) {
    const sendJson = (status, payload) => {
      const body = JSON.stringify(payload);
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Trinity-Bridge': 'desktop-commander-v11.2.0'
      });
      res.end(body);
    };

    const expectedSecret = getSecret();
    const providedSecret = req.headers?.['x-trinity-bridge-secret'];

    if (!verifyBridgeSecret(providedSecret, expectedSecret)) {
      return sendJson(401, {
        ok: false,
        error: 'UNAUTHORIZED_BRIDGE_SECRET',
        message: 'Chýbajúca alebo neplatná hlavička X-Trinity-Bridge-Secret.'
      });
    }

    const url = new URL(req.url || '/', `http://${req.headers?.host || 'localhost:5050'}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      return sendJson(200, {
        ok: true,
        service: 'trinity-desktop-commander-bridge',
        version: '11.2.0',
        status: 'online',
        desktop_commander_status: 'online',
        zero_local_footprint: true,
        hostname: os.hostname(),
        platform: os.platform(),
        uptime_seconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
      });
    }

    if (req.method === 'GET' && url.pathname === '/status') {
      return sendJson(200, {
        ok: true,
        desktop_commander_status: 'online',
        tunnel_endpoints: ['https://agent.auru.dev', 'https://agent.aura.dev'],
        local_bind: `${DEFAULT_HOST}:${DEFAULT_PORT}`,
        memory_free_mb: Math.round(os.freemem() / (1024 * 1024)),
        memory_total_mb: Math.round(os.totalmem() / (1024 * 1024)),
        checked_at: new Date().toISOString()
      });
    }

    return sendJson(404, {
      ok: false,
      error: 'NOT_FOUND',
      path: url.pathname
    });
  };
}

export function startDesktopCommanderServer(options = {}) {
  const port = Number(options.port ?? DEFAULT_PORT);
  const host = options.host ?? DEFAULT_HOST;
  const server = http.createServer(createDesktopCommanderHandler(options));
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve(server));
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startDesktopCommanderServer().then((server) => {
    const addr = server.address();
    const bindPort = typeof addr === 'object' && addr ? addr.port : DEFAULT_PORT;
    console.log(`[TRINITY DESKTOP BRIDGE] Listening on http://${DEFAULT_HOST}:${bindPort} (tunnel: agent.auru.dev / agent.aura.dev)`);
  });
}

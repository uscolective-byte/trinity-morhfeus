/**
 * @module TRINITY_OMNI_CORE
 * @subsystem LOCAL_SYSTEM_BRIDGE_7788
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Obojsmerný lokálny systémový most na porte 7788 s overením Windows SID, OmniDev diagnostikou a privilegovanou exekúciou.
 */
/**
 * TRINITY LOCAL SYSTEM BRIDGE (Port 7788)
 * Obojsmerný lokálny systémový most prepájajúci:
 * - Windows OS Kernel Identity & SID Validation (trinity-auth-core.mjs)
 * - OmniDev Studio Diagnostics & Recovery Engine (omnidev-diagnostics.js)
 * - Privileged Local Execution Gate (executePrivileged + ProposalStore)
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual, createHash } from 'node:crypto';
import { configuredBridgeToken } from '../../packages/contracts/src/bridge-auth.js';
import {
  ROOT_REGISTRY,
  inspectWindowsSession,
  verifyTrinityIdentity,
  executePrivileged
} from './trinity-auth-core.mjs';
import {
  diagnoseOmniDevStackTrace,
  proposeOmniDevRecoveryPatch
} from '../../Trinity/src/omnidev-diagnostics.js';
import { CAPABILITIES, ACTIONS } from './policy.mjs';
import { ProposalStore } from './store.mjs';
import { executeProposal, readWorkspaceFile } from './executor.mjs';
import { executeDesktop, listDesktopWindows } from './desktop.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const gatewayRoot = path.resolve(here, '..');
const workspaceRoot = path.resolve(process.env.MORHFEUS_ROOT || path.join(gatewayRoot, '..'));
const dataDir = path.resolve(process.env.TRINITY_GATEWAY_DATA || path.join(gatewayRoot, 'data'));

function appendLocalSovereignLedger(targetDataDir, entry) {
  fs.mkdirSync(targetDataDir, { recursive: true });
  const ledgerFile = path.join(targetDataDir, 'sovereign-bridge-ledger.jsonl');
  let prevHash = '0'.repeat(64);
  let index = 1;
  if (fs.existsSync(ledgerFile)) {
    const lines = fs.readFileSync(ledgerFile, 'utf8').trim().split(/\r?\n/).filter(Boolean);
    if (lines.length > 0) {
      try {
        const last = JSON.parse(lines[lines.length - 1]);
        prevHash = last.block_hash || prevHash;
        index = (last.index || lines.length) + 1;
      } catch {}
    }
  }
  const timestamp = new Date().toISOString();
  const payloadStr = JSON.stringify(entry);
  const blockHash = createHash('sha256')
    .update(`${index}|${timestamp}|${entry.actor || 'UNKNOWN'}|${entry.operation || 'BRIDGE_OP'}|${payloadStr}|${prevHash}`)
    .digest('hex');
  const receiptId = `TRN-LCL-V3-${index}-${blockHash.slice(0, 12).toUpperCase()}`;
  const record = {
    index,
    receipt_id: receiptId,
    timestamp,
    actor: entry.actor || 'UNKNOWN',
    operation: entry.operation || 'BRIDGE_OP',
    exit_code: entry.exit_code ?? 0,
    windows_sid: entry.windows_sid || null,
    prev_hash: prevHash,
    block_hash: blockHash,
    payload: entry,
    ledger_file: ledgerFile
  };
  fs.appendFileSync(ledgerFile, JSON.stringify(record) + '\n', 'utf8');
  return record;
}

function loadDotEnvIfPresent(envFilePath) {
  if (!fs.existsSync(envFilePath)) return {};
  const parsed = {};
  const lines = fs.readFileSync(envFilePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    parsed[key] = val;
    if (!process.env[key]) process.env[key] = val;
  }
  return parsed;
}

loadDotEnvIfPresent(path.join(workspaceRoot, '.env'));

const digest = value => createHash('sha256').update(String(value || '')).digest();

function isBridgeTokenAuthorized(request) {
  const expectedToken = configuredBridgeToken(process.env);
  const rawToken = request.headers['x-trinity-bridge-token'] || request.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
  if (!expectedToken || typeof rawToken !== 'string') return false;
  const headerToken = rawToken.trim();
  if (!headerToken || headerToken.length > 2048) return false;
  return timingSafeEqual(digest(headerToken), digest(expectedToken));
}

function sendJson(response, status, data) {
  const payload = JSON.stringify(data);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': 'https://auru.dev',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Trinity-Bridge-Token'
  });
  response.end(payload);
}

async function parseJsonBody(request, limit = 512_000) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) {
      throw Object.assign(new Error('Payload exceeds limit.'), { status: 413 });
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8') || '{}';
  return JSON.parse(raw);
}

export async function createSystemBridgeServer(options = {}) {
  const store = new ProposalStore(options.dataDir || dataDir);
  await store.init();

  const server = http.createServer(async (request, response) => {
    try {
      if (request.method === 'OPTIONS') {
        response.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Trinity-Bridge-Token'
        });
        return response.end();
      }

      const url = new URL(request.url, 'http://127.0.0.1:7788');
      const winSession = inspectWindowsSession(options.windowsSession || null);

      // 1. Public / Local Health & Status Check
      if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/health' || url.pathname === '/api/status' || url.pathname === '/api/auth/status' || url.pathname === '/api/bridge' || url.pathname === '/api/bridge/status')) {
        return sendJson(response, 200, {
          status: 'ONLINE',
          service: 'Trinity Local System Bridge (OmniDev & Ring 0 Gate)',
          port: Number(options.port || process.env.TRINITY_BRIDGE_PORT || 7788),
          binding: '127.0.0.1',
          windows_sid_validation: process.env.WINDOWS_SID_VALIDATION !== 'false',
          active_operator: winSession.username,
          domain: winSession.domain,
          is_root_authorized: winSession.authenticated,
          system_role: winSession.role,
          os_token_verified: winSession.osTokenVerified,
          sid_verified: Boolean(winSession.sid),
          omnidev_studio: {
            status: 'READY',
            diagnostics_engine: 'OmniDev-AST-Recovery-v3',
            bridge_connected: true
          },
          root_registry: {
            architect_alias: ROOT_REGISTRY.architect_alias,
            windows_users: ROOT_REGISTRY.windows_users,
            google_accounts: ROOT_REGISTRY.google_accounts,
            phone_channels: ROOT_REGISTRY.phone_numbers.length
          },
          checked_at: new Date().toISOString()
        });
      }

      // 1b. Ollama Local Status Endpoint
      if (request.method === 'GET' && (url.pathname === '/api/ollama' || url.pathname === '/api/ollama/status')) {
        try {
          const tagsRes = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(3000) });
          const tagsData = tagsRes.ok ? await tagsRes.json() : null;
          let psData = null;
          try {
            const psRes = await fetch('http://127.0.0.1:11434/api/ps', { signal: AbortSignal.timeout(3000) });
            psData = psRes.ok ? await psRes.json() : null;
          } catch {}
          return sendJson(response, 200, {
            status: 'ONLINE',
            service: 'Ollama Local Engine',
            port: 11434,
            models: tagsData?.models || [],
            running: psData?.models || [],
            active_model: psData?.models?.[0]?.name || tagsData?.models?.[0]?.name || 'qwen3.5:4b',
            checked_at: new Date().toISOString()
          });
        } catch (err) {
          return sendJson(response, 503, {
            status: 'OFFLINE_OR_UNREACHABLE',
            error: err.message,
            port: 11434
          });
        }
      }

      // 1c. Ollama Local Inference Endpoint (Requires Token)
      if (request.method === 'POST' && (url.pathname === '/api/ollama' || url.pathname === '/api/ollama/chat')) {
        const tokenOk = isBridgeTokenAuthorized(request);
        if (!tokenOk) {
          return sendJson(response, 403, { error: 'ACCESS DENIED: Neplatný TRINITY_BRIDGE_TOKEN pre Ollama most.' });
        }
        const input = await parseJsonBody(request);
        const model = input.model || 'qwen3.5:4b';
        const messages = Array.isArray(input.messages) ? input.messages : [{ role: 'user', content: String(input.prompt || '') }];
        const numPredict = Math.min(Number(input.max_tokens) || 600, 4096);
        const numCtx = Math.min(Number(input.num_ctx) || 2048, 8192);
        const temperature = typeof input.temperature === 'number' ? input.temperature : 0.25;

        try {
          const ollamaRes = await fetch('http://127.0.0.1:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              messages,
              stream: false,
              options: {
                num_ctx: numCtx,
                num_predict: numPredict,
                temperature
              }
            }),
            signal: AbortSignal.timeout(180_000)
          });
          if (!ollamaRes.ok) {
            return sendJson(response, ollamaRes.status, { error: `Ollama HTTP error ${ollamaRes.status}` });
          }
          const ollamaData = await ollamaRes.json();
          const responseText = ollamaData.message?.content?.trim() || ollamaData.message?.thinking?.trim() || '';
          const record = appendLocalSovereignLedger(options.dataDir || dataDir, {
            actor: winSession.username || 'Basterix',
            operation: 'OLLAMA_LOCAL_INFERENCE',
            model,
            tokens_in: ollamaData.prompt_eval_count || 0,
            tokens_out: ollamaData.eval_count || 0,
            exit_code: 0
          });
          return sendJson(response, 200, {
            ok: true,
            provider: 'ollama-local',
            model,
            text: responseText,
            thinking: ollamaData.message?.thinking || null,
            usage: {
              prompt_eval_count: ollamaData.prompt_eval_count || 0,
              eval_count: ollamaData.eval_count || 0
            },
            local_ledger_receipt: record
          });
        } catch (err) {
          return sendJson(response, 502, { error: `Ollama inference zlyhala: ${err.message}` });
        }
      }

      // 2. OmniDev Studio Diagnostics & Recovery Endpoint
      if (request.method === 'POST' && url.pathname === '/api/omnidev/diagnose') {
        const input = await parseJsonBody(request);
        const diagnosis = diagnoseOmniDevStackTrace(input.errorText || '', {
          filePath: input.filePath || '',
          sourceSnippet: input.sourceCode || ''
        });
        const recoveryPlan = input.sourceCode
          ? await proposeOmniDevRecoveryPatch({
              filePath: input.filePath || 'Trinity/src/studio.js',
              sourceCode: input.sourceCode,
              errorText: input.errorText || ''
            })
          : null;
        return sendJson(response, 200, {
          status: 'DIAGNOSED',
          omnidev_studio: 'RECOVERED',
          diagnosis,
          recoveryPlan
        });
      }

      // 3. Privileged Execution Gate (requires valid Bridge Token AND verified Basterix OS SID or Google OAuth)
      if (request.method === 'POST' && url.pathname === '/api/execute-privileged') {
        const tokenOk = isBridgeTokenAuthorized(request);
        const input = await parseJsonBody(request);
        const targetDataDir = options.dataDir || dataDir;

        // Nikdy nedôverovať neovereným hlavičkám/telu bez dôkazu a platného TRINITY_BRIDGE_TOKEN
        const authContext = {
          email: input.email,
          phone: input.phone,
          windowsUser: input.windowsUser,
          verifiedGoogleToken: input.verifiedGoogleToken === true && tokenOk,
          verifiedWebhookSignature: input.verifiedWebhookSignature === true && tokenOk,
          verifiedWindowsToken: input.verifiedWindowsToken === true && tokenOk,
          sid: input.sid || winSession.sid,
          windowsSession: options.windowsSession || null,
          checkLocalWindows: tokenOk && !input.email && !input.phone && !input.windowsUser
        };

        const result = await executePrivileged(
          authContext,
          { action: input.action || 'READ_WORKSPACE', target: input.payload?.path || input.payload?.app || input.payload?.target || input.action },
          async verifiedAuth => {
            if (input.action === 'open_app' || input.action === 'e2e_truth_verify') {
              const rawApp = input.payload?.app || input.payload?.target || null;
              const appMap = {
                calculator:'calculator',calc:'calculator',kalkulacka:'calculator',
                notepad:'notepad',poznamkovyblok:'notepad',
                paint:'paint',skicar:'paint',
                explorer:'explorer',prieskumnik:'explorer',
                chrome:'chrome',edge:'edge',
                whatsapp:'whatsapp',watsap:'whatsapp',
                vscode:'vscode',code:'vscode',
                terminal:'terminal',powershell:'terminal',cmd:'terminal',
                cmder:'cmder',commander:'commander',
                browser:'browser',prehliadac:'browser'
              };
              let appToOpen = null;
              if (rawApp) {
                const clean = String(rawApp).toLowerCase().replace(/[^a-z]/g, '');
                appToOpen = appMap[clean] || rawApp;
              }
              let appResult = null;
              if (appToOpen) {
                try {
                  appResult = await executeDesktop({ task: 'desktop-control', operation: 'launch', app: appToOpen });
                } catch (err) {
                  const windows = await listDesktopWindows().catch(() => []);
                  appResult = { operation: 'launch_fallback_list', app: appToOpen, note: err.message, active_windows_count: windows.length };
                }
              } else {
                const windows = await listDesktopWindows().catch(() => []);
                appResult = { operation: 'list', active_windows_count: windows.length, sample_windows: windows.slice(0, 5) };
              }
              const localLedger = appendLocalSovereignLedger(targetDataDir, {
                actor: verifiedAuth.operator,
                channel: verifiedAuth.channel,
                identifier: verifiedAuth.identifier,
                operation: input.action.toUpperCase(),
                exit_code: 0,
                windows_sid: winSession.sid,
                app_result: appResult
              });
              return {
                status: 'completed',
                exit_code: 0,
                operator: verifiedAuth.operator,
                channel: verifiedAuth.channel,
                identifier: verifiedAuth.identifier,
                windows_sid: winSession.sid,
                os_token_verified: winSession.osTokenVerified,
                app_execution: appResult,
                receipt: { action: 'open_app', target: appToOpen, desktop: appResult, success: !appResult?.note },
                local_ledger_receipt: localLedger,
                executed_at: new Date().toISOString()
              };
            }
            if (input.action === 'read' && input.payload?.path) {
              const fileData = await readWorkspaceFile(workspaceRoot, input.payload.path);
              const localLedger = appendLocalSovereignLedger(targetDataDir, {
                actor: verifiedAuth.operator,
                channel: verifiedAuth.channel,
                identifier: verifiedAuth.identifier,
                operation: 'READ_WORKSPACE_FILE',
                exit_code: 0,
                windows_sid: winSession.sid,
                path: input.payload.path
              });
              return {
                status: 'completed',
                exit_code: 0,
                operator: verifiedAuth.operator,
                channel: verifiedAuth.channel,
                identifier: verifiedAuth.identifier,
                receipt: fileData,
                local_ledger_receipt: localLedger
              };
            }
            if (ACTIONS.has(input.action)) {
              const proposal = await store.create(input.action, input.payload || {}, verifiedAuth.identifier);
              await store.transition(proposal.id, ['proposed'], 'approved', {
                approvedAt: new Date().toISOString(),
                approvedBy: `BASTERIX_ROOT:${verifiedAuth.channel}`
              });
              await store.transition(proposal.id, ['approved'], 'executing', {
                executionStartedAt: new Date().toISOString()
              });
              const receipt = await executeProposal(workspaceRoot, { ...proposal, status: 'approved' }, targetDataDir);
              const finalStatus = receipt.success === false ? 'failed' : 'completed';
              await store.transition(proposal.id, ['executing'], finalStatus, {
                receipt,
                completedAt: new Date().toISOString()
              });
              const localLedger = appendLocalSovereignLedger(targetDataDir, {
                actor: verifiedAuth.operator,
                channel: verifiedAuth.channel,
                identifier: verifiedAuth.identifier,
                operation: input.action.toUpperCase(),
                exit_code: receipt.exitCode ?? 0,
                windows_sid: winSession.sid,
                proposal_id: proposal.id
              });
              return {
                status: finalStatus,
                exit_code: receipt.exitCode ?? 0,
                operator: verifiedAuth.operator,
                channel: verifiedAuth.channel,
                identifier: verifiedAuth.identifier,
                receipt,
                local_ledger_receipt: localLedger
              };
            }
            const localLedger = appendLocalSovereignLedger(targetDataDir, {
              actor: verifiedAuth.operator,
              channel: verifiedAuth.channel,
              identifier: verifiedAuth.identifier,
              operation: input.action || 'PRIVILEGED_ACTION',
              exit_code: 0,
              windows_sid: winSession.sid
            });
            return {
              status: 'completed',
              exit_code: 0,
              operator: verifiedAuth.operator,
              channel: verifiedAuth.channel,
              identifier: verifiedAuth.identifier,
              verified_proof: verifiedAuth.verifiedProof,
              local_ledger_receipt: localLedger,
              executed_at: new Date().toISOString()
            };
          }
        );

        return sendJson(response, 200, result);
      }

      return sendJson(response, 404, { error: 'Endpoint not found on System Bridge (7788).' });
    } catch (error) {
      return sendJson(response, error.status || 500, {
        error: error.message || 'Internal Bridge Error',
        securityIncident: error.securityIncident || null
      });
    }
  });

  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.TRINITY_BRIDGE_PORT || 7788);
  const server = await createSystemBridgeServer({ port });
  server.listen(port, '127.0.0.1', () => {
    const win = inspectWindowsSession();
    console.log(JSON.stringify({
      event: 'trinity_system_bridge_online',
      host: '127.0.0.1',
      port,
      operator: win.username,
      role: win.role,
      sid_verified: Boolean(win.sid)
    }));
  });
}

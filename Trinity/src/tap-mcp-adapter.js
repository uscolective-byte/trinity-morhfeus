import { z } from 'zod';
import { fromLegacy, digest } from '../../packages/contracts/src/tap.js';
import { executeTapTask, TapError } from './tap-runtime.js';

export const tapDiagnosticInput = z.object({
  message: z.string().max(2000).default('ping'),
  idempotency_key: z.string().uuid().optional()
}).strict();

function uuidFromHex(hex) {
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`;
}

/** access comes exclusively from the existing authenticated MCP host, never tool arguments. */
export async function runTapMcpDiagnostic(env, input, access) {
  if (access?.projectControl !== true || typeof access.principal !== 'string' || !access.principal.trim()) {
    throw new TapError('TAP_MCP_IDENTITY_REQUIRED');
  }
  if (env.TRINITY_TAP_ENABLED !== 'true') throw new TapError('TAP_NOT_ENABLED');
  const args = tapDiagnosticInput.parse(input);
  const environment = env.TRINITY_ENV;
  if (!['local', 'staging', 'production'].includes(environment)) throw new TapError('TAP_ENVIRONMENT_DENIED');
  const actor = `mcp:${await digest(access.principal)}`;
  const idempotencyKey = args.idempotency_key ?? crypto.randomUUID();
  // Every hashed request field must stay stable on replay, including the authorization reference.
  const run = uuidFromHex(await digest({ actor, environment, key: idempotencyKey }));
  const authorizationRef = `grant:${actor}`;
  const request = { ...fromLegacy({ agent_id: 'orchestrator', tool_id: 'diagnostic_ping', arguments: { message: args.message } }, {
    sender_id: actor, environment, authorization_ref: authorizationRef, idempotency_key: idempotencyKey,
    task_id: run, run_id: run, trace_id: run, objective: 'Verify the existing diagnostic_ping execution and durable evidence'
  }), message_id: run };
  const context = { principal: { authenticated: true, agent_id: actor }, environment,
    grant: { subject_id: actor, receiver_id: 'orchestrator', environment, authorization_ref: authorizationRef,
      expires_at: Date.now() + 60000, scopes: ['tool:diagnostic_ping'] } };
  const outcome = await executeTapTask(env, request, context);
  if (outcome.status !== 'VERIFIED') {
    return { isError: true, data: { status: outcome.status.toLowerCase(), error: outcome.error?.code || 'TAP_NOT_VERIFIED', tap: outcome, tap_request: request } };
  }
  // Keep all original healthy/echo/receipt fields for existing clients; TAP evidence is additive.
  return { isError: false, data: { ...outcome.result, tap: outcome, tap_request: request } };
}

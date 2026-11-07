import { configuredBridgeToken } from '../../packages/contracts/src/bridge-auth.js';
import { authenticate, checkOrigin, equal, HttpError } from './security.js';

/** Caller supplies an exact configured bridge credential OR an existing server-authenticated owner session. */
export async function authorizeBridgeRequest(request, env) {
  checkOrigin(request, env);
  const expected = configuredBridgeToken(env);
  if (!expected) throw new HttpError(503, 'BRIDGE_CREDENTIAL_NOT_CONFIGURED');
  const explicit = request.headers.get('X-Trinity-Bridge-Token');
  if (explicit !== null) {
    if (!explicit.trim() || explicit.length > 2048 || !await equal(explicit.trim(), expected)) throw new HttpError(401, 'BRIDGE_CREDENTIAL_INVALID');
    return { token: expected, actor: 'bridge-credential', channel: 'configured-bridge-credential' };
  }
  const bearer = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (bearer && bearer.length <= 2048 && await equal(bearer, expected)) return { token: expected, actor: 'bridge-credential', channel: 'configured-bridge-credential' };
  const user = await authenticate(request, env);
  if (user.role !== 'owner') throw new HttpError(403, 'BRIDGE_OWNER_REQUIRED');
  return { token: expected, actor: `user:${user.id}`, channel: 'authenticated-owner-session' };
}
export async function authorizeBridgeProxy(request, env) { return (await authorizeBridgeRequest(request, env)).token; }

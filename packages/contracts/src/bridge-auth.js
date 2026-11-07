/** Existing string credentials only. A catalog entry, token prefix or source literal is never a credential. */
export function configuredBridgeToken(env = {}) {
  for (const value of [env.TRINITY_BRIDGE_TOKEN, env.TRINITY_LOCAL_TOKEN]) {
    if (typeof value !== 'string') continue;
    const token = value.trim();
    if (token && token.length <= 2048 && !/[\r\n]/.test(token)) return token;
  }
  return null;
}

export const BRIDGE_AUTH_VERSION = 'trinity.bridge.v1';
/** A migration marker for metadata written by the authenticated registration path, not a signature. */
export function registeredBridgeTunnelUrl(meta) {
  if (meta?.auth_version !== BRIDGE_AUTH_VERSION || typeof meta.tunnel_url !== 'string') return null;
  try {
    const url = new URL(meta.tunnel_url);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
    return url.origin;
  } catch { return null; }
}

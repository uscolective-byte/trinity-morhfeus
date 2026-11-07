export async function internalAuthorized(request, env) {
  const expected = env?.TRINITY_INTERNAL_KEY || env?.TRINITY_GATEWAY_KEY;
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get('Authorization') || '');
  if (typeof expected !== 'string' || !expected.trim() || !match) return false;
  const digest = value => crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  const [a, b] = await Promise.all([digest(expected), digest(match[1])]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < x.length; i++) difference |= x[i] ^ y[i];
  return difference === 0;
}

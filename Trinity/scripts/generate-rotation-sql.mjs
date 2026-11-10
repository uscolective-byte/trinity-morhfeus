import crypto from 'node:crypto';

// Generate 32 bytes of cryptographic randomness
const bytes = crypto.randomBytes(32);
const material = bytes.toString('base64url');
const secret = `trn_live_${material}`;
const keyHash = crypto.createHash('sha256').update(secret).digest('hex');
const prefix = secret.slice(0, 17);
const id = crypto.randomUUID();
const owner = 'saboivan2008@gmail.com';
const expires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);

// SQL to revoke old key and insert new one
const sqlRevoke = `UPDATE ops_api_access_keys SET status='revoked', revoked_at=datetime('now') WHERE key_prefix='trn_live_S9ec0ut_';`;
const sqlInsert = `INSERT INTO ops_api_access_keys (id, owner_id, name, key_hash, key_prefix, scopes_json, rate_limit_per_minute, status, expires_at) VALUES ('${id}', '${owner}', 'Live Trinity MCP Token (Rotated)', '${keyHash}', '${prefix}', json_array('mcp:read','mcp:write','api:invoke'), 120, 'active', '${expires}');`;

console.log(JSON.stringify({
  secret,
  prefix,
  id,
  sql: `${sqlRevoke} ${sqlInsert}`
}, null, 2));

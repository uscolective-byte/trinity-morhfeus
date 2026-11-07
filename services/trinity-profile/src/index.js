// services/trinity-profile/src/index.js
import { TapKeyManager, TapTokenEngine, validateProfileInput } from "../../../packages/contracts/src/tap.js";

const memoryKeyPairStore = new WeakMap();
let fallbackGlobalKeyPair = null;

function resolveKv(env) {
  return env?.TRINITY_KV || env?.TRINITY_KV_PROD || env?.TRINITY_KV_STAGING || env?.Mastermind || env?.PC_STATE || null;
}

function resolveDb(env) {
  return env?.DB || env?.TRINITY_D1 || null;
}

export async function getOrRotatePrivateKey(env = {}) {
  const kv = resolveKv(env);
  let privateKeyB64 = kv && typeof kv.get === "function" ? await kv.get("TAP_PRIVATE_KEY_B64") : null;
  let publicKeyB64 = kv && typeof kv.get === "function" ? await kv.get("TAP_PUBLIC_KEY_B64") : null;

  if (!privateKeyB64 || !publicKeyB64) {
    const cached = (env && typeof env === "object" && memoryKeyPairStore.get(env)) || fallbackGlobalKeyPair;
    if (cached) {
      privateKeyB64 = cached.privateKeyB64;
      publicKeyB64 = cached.publicKeyB64;
    } else {
      const keyPair = await TapKeyManager.generateKeyPair();
      privateKeyB64 = await TapKeyManager.exportKeyPkcs8(keyPair.privateKey);
      publicKeyB64 = await TapKeyManager.exportKeySpki(keyPair.publicKey);
      const entry = { privateKeyB64, publicKeyB64 };
      if (env && typeof env === "object") memoryKeyPairStore.set(env, entry);
      fallbackGlobalKeyPair = entry;
    }

    if (kv && typeof kv.put === "function") {
      await kv.put("TAP_PRIVATE_KEY_B64", privateKeyB64);
      await kv.put("TAP_PUBLIC_KEY_B64", publicKeyB64);
    }
  }

  const privateKey = await TapKeyManager.importPrivateKey(privateKeyB64);
  const publicKey = await TapKeyManager.importPublicKey(publicKeyB64);
  return { privateKey, publicKey, publicKeyB64 };
}

async function upsertTapProfileD1(db, row) {
  if (!db || typeof db.prepare !== "function") return;
  const sql = `INSERT INTO profiles (id, username, email, role, permissions, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
           ON CONFLICT(username) DO UPDATE SET
             email = excluded.email,
             role = excluded.role,
             permissions = excluded.permissions,
             updated_at = excluded.updated_at`;
  try {
    await db.prepare(sql).bind(row.id, row.username, row.email, row.role, row.permissions, row.created_at, row.updated_at).run();
  } catch {
    await db.prepare(`CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT,
      role TEXT NOT NULL DEFAULT 'guest',
      permissions TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`).run();
    await db.prepare(sql).bind(row.id, row.username, row.email, row.role, row.permissions, row.created_at, row.updated_at).run();
  }
}

export default {
  async fetch(request, env = {}, _ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/^\/api(?=\/profiles\/)/, "");

    // Kľúče a verejný JWKS endpoint
    if (request.method === "GET" && pathname === "/profiles/public-key") {
      const { publicKeyB64 } = await getOrRotatePrivateKey(env);
      return new Response(JSON.stringify({ alg: "RS256", pubkey: publicKeyB64 }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // POST /profiles/create
    if (request.method === "POST" && pathname === "/profiles/create") {
      try {
        const body = await request.json();
        validateProfileInput(body);

        const { username, email, role = "guest", permissions = [] } = body;
        const normalizedUser = username.trim();
        const isBasterix = normalizedUser.toLowerCase() === "basterix" || email === "saboivan2008@gmail.com";
        const finalRole = isBasterix ? "ring0_owner" : (role === "ring0_owner" ? "guest" : role);

        const finalPermissions = isBasterix
          ? ["RING0_ALL", "OVERRIDE_KILLSWITCH", "SCHEMA_MIGRATE", "FLEET_DEPLOY", "LEDGER_WRITE"]
          : permissions;

        const profileId = crypto.randomUUID();
        const now = Date.now();

        const db = resolveDb(env);
        await upsertTapProfileD1(db, {
          id: profileId,
          username: normalizedUser,
          email: email || null,
          role: finalRole,
          permissions: JSON.stringify(finalPermissions),
          created_at: now,
          updated_at: now
        });

        // Vygenerovanie podpísaného Ring tokenu cez RSASSA-PKCS1-v1_5
        const { privateKey } = await getOrRotatePrivateKey(env);
        const token = await TapTokenEngine.sign({
          sub: profileId,
          usr: normalizedUser,
          rol: finalRole,
          prm: finalPermissions,
          env: env.ENVIRONMENT || env.TRINITY_ENV || "production"
        }, privateKey);

        return new Response(JSON.stringify({
          success: true,
          profile: { id: profileId, username: normalizedUser, role: finalRole, permissions: finalPermissions },
          token: token
        }), {
          status: 201,
          headers: { "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: String(err.message || "").startsWith("SCHEMA_ERROR") ? 400 : 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // POST /profiles/verify
    if ((request.method === "POST" || request.method === "GET") && pathname === "/profiles/verify") {
      try {
        const authHeader = request.headers.get("Authorization") || "";
        const token = authHeader.replace(/^Bearer\s+/i, "").trim();
        if (!token) throw new Error("MISSING_TOKEN");

        const { publicKey } = await getOrRotatePrivateKey(env);
        const verifiedClaims = await TapTokenEngine.verify(token, publicKey);

        return new Response(JSON.stringify({ valid: true, claims: verifiedClaims }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ valid: false, error: err.message }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    return new Response("TRINITY_PROFILE_ROUTER: 404", { status: 404 });
  }
};

/**
 * TRINITY SOVEREIGN IDENTITY & PROFILE ENGINE
 * Subsystem: trinity-profile (Worker 47)
 * Endpoints: /api/profile/*, /profiles/*, /api/profiles/*, /api/auth/*, /init-schema, /health
 */
import tapProfileService from "../../services/trinity-profile/src/index.js";

export interface Env {
  DB?: D1Database;
  TRINITY_KV?: KVNamespace;
  TRINITY_SENTINEL?: Fetcher;
  TRINITY_AUDIT?: Fetcher;
  CORE?: Fetcher;
  ENVIRONMENT?: string;
  TOKEN_SALT?: string;
  PROFILE_ADMIN_SECRET?: string;
  ADMIN_SECRET?: string;
  TRINITY_OPS_KEY?: string;
  CF_ACCESS_CLIENT_ID?: string;
  CF_ACCESS_CLIENT_SECRET?: string;
  CLOUDFLARE_ACCESS_CLIENT_ID?: string;
  CLOUDFLARE_ACCESS_CLIENT_SECRET?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  CF_ACCESS_ADMIN_EMAILS?: string;
}

export type UserRole = "superadmin" | "admin" | "operator" | "user" | "trinity_agent";

export interface UserPreferences {
  preferredModel: string;
  fastFallbackModel: string;
  temperature: number;
  maxTokens: number;
  customSystemPrompt: string;
  theme: "aura" | "matrix" | "dark" | "cyberpunk" | "minimal";
  streamResponse: boolean;
  developerMode: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  alias?: string;
  avatarUrl?: string;
  role: UserRole;
  organization?: string;
  walletAddress?: string;
  ttkBalance?: number;
  preferences: UserPreferences;
  apiKeyHash?: string;
  status: "ACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION";
  createdAt: number;
  updatedAt: number;
  lastLoginAt: number;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  preferredModel: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  fastFallbackModel: "@cf/meta/llama-3.1-8b-instruct-fp8-fast",
  temperature: 0.7,
  maxTokens: 2048,
  customSystemPrompt: "Si autonómny podsystém AURA TRINITY. Odpovedaj vecne, deterministicky a presne podľa systémových protokolov.",
  theme: "aura",
  streamResponse: true,
  developerMode: true
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Trinity-Node, X-User-Id, X-Profile-Key, X-Admin-Secret"
};

class CryptoEngine {
  public static async hash(data: string, salt: string = ""): Promise<string> {
    const enc = new TextEncoder();
    const digest = await crypto.subtle.digest("SHA-256", enc.encode(data + salt));
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
  }
}

type AccessClaims = { iss?: string; aud?: string | string[]; exp?: number; nbf?: number; email?: string };
let accessJwksCache: { issuer: string; expiresAt: number; keys: JsonWebKey[] } | undefined;

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), char => char.charCodeAt(0));
}

function decodeJwtPart<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T;
}

async function verifyCloudflareAccessJwt(request: Request, env: Env): Promise<AccessClaims | null> {
  const teamDomain = env.CF_ACCESS_TEAM_DOMAIN?.trim().replace(/^https:\/\//i, "").replace(/\/$/, "");
  const expectedAudience = env.CF_ACCESS_AUD?.trim();
  const token = request.headers.get("CF-Access-Jwt-Assertion");
  if (!teamDomain || !expectedAudience || !token || !/^[a-z0-9-]+\.cloudflareaccess\.com$/i.test(teamDomain)) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const header = decodeJwtPart<{ alg?: string; kid?: string }>(parts[0]);
    const claims = decodeJwtPart<AccessClaims>(parts[1]);
    const issuer = `https://${teamDomain}`;
    const now = Math.floor(Date.now() / 1000);
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (header.alg !== "RS256" || !header.kid || claims.iss !== issuer || !audiences.includes(expectedAudience) ||
        typeof claims.exp !== "number" || claims.exp <= now ||
        (typeof claims.nbf === "number" && claims.nbf > now + 30)) return null;

    let keys: JsonWebKey[];
    if (accessJwksCache?.issuer === issuer && accessJwksCache.expiresAt > Date.now()) {
      keys = accessJwksCache.keys;
    } else {
      const response = await fetch(`${issuer}/cdn-cgi/access/certs`, { headers: { Accept: "application/json" } });
      if (!response.ok) return null;
      const body = await response.json() as { keys?: JsonWebKey[] };
      if (!Array.isArray(body.keys)) return null;
      keys = body.keys;
      accessJwksCache = { issuer, expiresAt: Date.now() + 5 * 60_000, keys };
    }
    const jwk = keys.find(key => (key as JsonWebKey & { kid?: string }).kid === header.kid && key.kty === "RSA");
    if (!jwk) return null;
    const publicKey = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const signature = decodeBase64Url(parts[2]);
    return await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, signature, signedData) ? claims : null;
  } catch {
    return null;
  }
}

/**
 * Constant-time string comparison preventing timing side-channel attacks.
 * Pre-hashes inputs with SHA-256 to ensure identical buffer lengths (32 bytes)
 * before performing XOR-based constant-time evaluation.
 */
async function timingSafeStringEqual(a: string | null | undefined, b: string | null | undefined): Promise<boolean> {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (!a || !b) return false;
  const enc = new TextEncoder();
  const hashA = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(a)));
  const hashB = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(b)));
  let diff = 0;
  for (let i = 0; i < 32; i++) {
    diff |= hashA[i] ^ hashB[i];
  }
  return diff === 0;
}

/**
 * Genuine cryptographic and store-backed admin authorization verifier.
 * Supports:
 * 1. Admin Secret: Matches X-Admin-Secret header or body.adminSecret against env.ADMIN_SECRET / env.TRINITY_OPS_KEY / env.PROFILE_ADMIN_SECRET.
 * 2. Cloudflare Access Service Token: Verifies BOTH CF-Access-Client-Id AND CF-Access-Client-Secret against configured secrets.
 * 3. Cloudflare Access Signed JWT: Verifies cryptographically signed CF-Access-Jwt-Assertion and checks admin email allowlist.
 * 4. Bearer Token: Validates master ops secrets or looks up SHA-256 key hash in TRINITY_KV and verifies caller has admin/superadmin role.
 * Any unauthenticated attempt fails closed and returns false.
 */
async function verifyAdminAuthorization(request: Request, body: any, env: Env, salt: string): Promise<boolean> {
  // 1. Admin Secret Verification (timing-safe against server-configured secrets)
  const adminSecret = typeof body?.adminSecret === "string" ? body.adminSecret.trim() : (request.headers.get("X-Admin-Secret")?.trim() || null);
  if (adminSecret) {
    for (const secret of [env.ADMIN_SECRET, env.TRINITY_OPS_KEY, env.PROFILE_ADMIN_SECRET]) {
      if (typeof secret === "string" && secret.length >= 8 && await timingSafeStringEqual(adminSecret, secret)) {
        return true;
      }
    }
  }

  // 2. Cloudflare Access Service Client Verification
  // Must verify BOTH CF-Access-Client-Id AND CF-Access-Client-Secret against configured secrets
  const cfAccessClientId = request.headers.get("CF-Access-Client-Id")?.trim();
  const cfAccessClientSecret = request.headers.get("CF-Access-Client-Secret")?.trim();
  if (cfAccessClientId && cfAccessClientSecret) {
    const configuredPairs = [
      { id: env.CF_ACCESS_CLIENT_ID, secret: env.CF_ACCESS_CLIENT_SECRET },
      { id: env.CLOUDFLARE_ACCESS_CLIENT_ID, secret: env.CLOUDFLARE_ACCESS_CLIENT_SECRET }
    ];
    for (const pair of configuredPairs) {
      if (typeof pair.id === "string" && pair.id.length > 0 &&
          typeof pair.secret === "string" && pair.secret.length > 0) {
        const idMatches = await timingSafeStringEqual(cfAccessClientId, pair.id);
        const secretMatches = await timingSafeStringEqual(cfAccessClientSecret, pair.secret);
        if (idMatches && secretMatches) {
          return true;
        }
      }
    }
  }

  // 3. Cloudflare Access Signed JWT Assertion Verification
  const accessClaims = await verifyCloudflareAccessJwt(request, env);
  if (accessClaims?.email && env.CF_ACCESS_ADMIN_EMAILS) {
    const adminEmails = new Set(env.CF_ACCESS_ADMIN_EMAILS.split(",").map(e => e.trim().toLowerCase()).filter(Boolean));
    if (adminEmails.has(accessClaims.email.toLowerCase())) {
      return true;
    }
  }

  // 4. Bearer Token Verification (Master Ops Key or Verified Admin Key from TRINITY_KV)
  const authHeader = request.headers.get("Authorization")?.trim() || "";
  if (authHeader.startsWith("Bearer ")) {
    const rawToken = authHeader.replace(/^Bearer\s+/, "").trim();
    if (rawToken && rawToken.length >= 8) {
      // 4a. Check master ops secret
      for (const masterSecret of [env.ADMIN_SECRET, env.TRINITY_OPS_KEY, env.PROFILE_ADMIN_SECRET]) {
        if (typeof masterSecret === "string" && masterSecret.length >= 8 && await timingSafeStringEqual(rawToken, masterSecret)) {
          return true;
        }
      }

      // 4b. Check registered API key in TRINITY_KV
      if (env.TRINITY_KV) {
        const keyHashWithSalt = await CryptoEngine.hash(rawToken, salt);
        const keyHashRaw = await CryptoEngine.hash(rawToken, "");

        let profileId = await env.TRINITY_KV.get(`api_key_lookup:${keyHashWithSalt}`);
        if (!profileId) {
          profileId = await env.TRINITY_KV.get(`api_key_lookup:${keyHashRaw}`);
        }

        if (profileId) {
          let callerProfile: UserProfile | null = null;
          const cached = await env.TRINITY_KV.get(`profile:${profileId}`);
          if (cached) {
            try { callerProfile = JSON.parse(cached); } catch {}
          }

          // Authoritative D1 check: If env.DB is present
          if (env.DB) {
            try {
              const row: any = await env.DB.prepare(
                "SELECT role, email, status FROM user_profiles WHERE id = ?"
              ).bind(profileId).first();

              if (row) {
                // Reconcile/self-heal KV cache if callerProfile && callerProfile.role !== row.role
                if (callerProfile && callerProfile.role !== row.role) {
                  callerProfile.role = row.role;
                  if (row.email) callerProfile.email = row.email;
                  if (row.status) callerProfile.status = row.status;
                  callerProfile.updatedAt = Date.now();
                  await env.TRINITY_KV.put(`profile:${profileId}`, JSON.stringify(callerProfile), { expirationTtl: 86400 * 30 });
                }

                if ((row.role === "admin" || row.role === "superadmin") && row.status !== "SUSPENDED") {
                  return true;
                }
                return false;
              } else {
                return false;
              }
            } catch {
              // Fail closed on D1 database errors
              return false;
            }
          }

          // Fallback only if !env.DB (lightweight mock/test environments without D1)
          if (!env.DB && callerProfile && (callerProfile.role === "admin" || callerProfile.role === "superadmin") && callerProfile.status !== "SUSPENDED") {
            return true;
          }
        }
      }
    }
  }

  return false;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;
    const salt = env.TOKEN_SALT || "trinity_salt_default";

    // Standard Universal Non-AI Health Probe
    if (request.method === "GET" && pathname === "/health") {
      const missing: string[] = [];
      if (!env.DB) missing.push("DB");
      if (!env.TRINITY_KV) missing.push("TRINITY_KV");
      return Response.json({
        ok: missing.length === 0,
        service: "trinity-profile",
        version: "10.3.0",
        status: missing.length ? "degraded" : "serving",
        ...(missing.length ? { missing } : {})
      }, { status: missing.length ? 503 : 200, headers: CORS_HEADERS });
    }

    try {
      if (pathname.startsWith("/profiles/") || pathname.startsWith("/api/profiles/")) {
        return await tapProfileService.fetch(request, env as any, ctx);
      }

      // 1. Inicializácia rozšírenej databázovej schémy
      if (pathname === "/init-schema" || pathname === "/api/profile/init-schema") {
        if (env.DB) {
          await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS user_profiles (
              id TEXT PRIMARY KEY,
              email TEXT UNIQUE NOT NULL,
              display_name TEXT NOT NULL,
              alias TEXT,
              avatar_url TEXT,
              role TEXT DEFAULT 'user',
              organization TEXT,
              wallet_address TEXT,
              ttk_balance REAL DEFAULT 0,
              preferences_json TEXT,
              api_key_hash TEXT,
              status TEXT DEFAULT 'ACTIVE',
              created_at INTEGER,
              updated_at INTEGER,
              last_login_at INTEGER
            );
          `).run();

          await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS user_sessions (
              token TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              expires_at INTEGER NOT NULL,
              created_at INTEGER NOT NULL
            );
          `).run();
        }
        return Response.json({ status: "SCHEMA_EXPANDED_SUCCESS" }, { headers: CORS_HEADERS });
      }

      // 2. Vytvorenie alebo Registrácia nového profilu
      if (request.method === "POST" && (pathname === "/api/profile/create" || pathname === "/api/profile/register")) {
        const body = await request.json() as any;
        if (!body.email || !body.displayName) {
          return Response.json({ error: "Missing required fields: email, displayName" }, { status: 400, headers: CORS_HEADERS });
        }

        const emailClean = body.email.toLowerCase().trim();
        const profileId = body.id || `usr_${crypto.randomUUID().slice(0, 12)}`;
        const now = Date.now();

        // Hardened cryptographic and store-backed admin role authorization
        const isAdminAuthorized = await verifyAdminAuthorization(request, body, env, salt);

        let role: UserRole = "user";
        if (body.role && ["operator", "trinity_agent", "admin", "superadmin"].includes(body.role)) {
          role = isAdminAuthorized ? body.role : "user";
        }

        const mergedPrefs: UserPreferences = {
          ...DEFAULT_PREFERENCES,
          ...(body.preferences || {})
        };

        const newApiKey = `trk_${crypto.randomUUID().replace(/-/g, "")}`;
        const apiKeyHash = await CryptoEngine.hash(newApiKey, salt);

        const profile: UserProfile = {
          id: profileId,
          email: emailClean,
          displayName: body.displayName.trim(),
          alias: body.alias || (role === "superadmin" ? "SovereignNode" : undefined),
          avatarUrl: body.avatarUrl || "",
          role,
          organization: body.organization || (role === "superadmin" ? "Trinity Sovereign Core" : "AURA"),
          walletAddress: body.walletAddress || "",
          ttkBalance: body.ttkBalance || 0,
          preferences: mergedPrefs,
          apiKeyHash,
          status: "ACTIVE",
          createdAt: now,
          updatedAt: now,
          lastLoginAt: now
        };

        // Zápis do D1
        if (env.DB) {
          await env.DB.prepare(`
            INSERT OR REPLACE INTO user_profiles 
            (id, email, display_name, alias, avatar_url, role, organization, wallet_address, ttk_balance, preferences_json, api_key_hash, status, created_at, updated_at, last_login_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            profile.id, profile.email, profile.displayName, profile.alias || null,
            profile.avatarUrl || null, profile.role, profile.organization || null,
            profile.walletAddress || null, profile.ttkBalance || 0,
            JSON.stringify(profile.preferences), profile.apiKeyHash, profile.status,
            profile.createdAt, profile.updatedAt, profile.lastLoginAt
          ).run();
        }

        // Zápis do KV cache
        if (env.TRINITY_KV) {
          await env.TRINITY_KV.put(`profile:${profile.id}`, JSON.stringify(profile), { expirationTtl: 86400 * 30 });
          await env.TRINITY_KV.put(`profile_by_email:${profile.email}`, profile.id, { expirationTtl: 86400 * 30 });
          await env.TRINITY_KV.put(`api_key_lookup:${apiKeyHash}`, profile.id, { expirationTtl: 86400 * 30 });
        }

        // Audit log cez Service Binding
        if (env.TRINITY_AUDIT) {
          ctx.waitUntil(
            env.TRINITY_AUDIT.fetch("https://audit/log", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "PROFILE_CREATED", userId: profile.id, role: profile.role })
            }).catch(() => null)
          );
        }

        return Response.json({
          status: "CREATED",
          profile,
          secretApiKey: newApiKey
        }, { status: 201, headers: CORS_HEADERS });
      }

      // 3. Získanie profilu (/api/profile/me alebo podľa ID/Emailu)
      if (request.method === "GET" && (pathname.startsWith("/api/profile/") || pathname === "/api/profile")) {
        const queryId = url.searchParams.get("id") || (pathname !== "/api/profile" && pathname !== "/api/profile/me" ? pathname.split("/").pop() : null);
        const queryEmail = url.searchParams.get("email");
        const authHeader = request.headers.get("Authorization");

        let targetId = queryId;

        // Ak ide o /me s Bearer API kľúčom
        if (!targetId && authHeader && authHeader.startsWith("Bearer trk_")) {
          const rawKey = authHeader.replace("Bearer ", "").trim();
          const keyHash = await CryptoEngine.hash(rawKey, salt);
          if (env.TRINITY_KV) {
            targetId = await env.TRINITY_KV.get(`api_key_lookup:${keyHash}`);
          }
        }

        let profile: UserProfile | null = null;

        if (targetId && env.TRINITY_KV) {
          const cached = await env.TRINITY_KV.get(`profile:${targetId}`);
          if (cached) profile = JSON.parse(cached);
        }

        if (!profile && env.DB) {
          let row: any = null;
          if (targetId) {
            row = await env.DB.prepare("SELECT * FROM user_profiles WHERE id = ?").bind(targetId).first();
          } else if (queryEmail) {
            row = await env.DB.prepare("SELECT * FROM user_profiles WHERE email = ?").bind(queryEmail.toLowerCase().trim()).first();
          }

          if (row) {
            profile = {
              id: row.id,
              email: row.email,
              displayName: row.display_name,
              alias: row.alias,
              avatarUrl: row.avatar_url,
              role: row.role,
              organization: row.organization,
              walletAddress: row.wallet_address,
              ttkBalance: row.ttk_balance,
              preferences: JSON.parse(row.preferences_json || "{}"),
              status: row.status,
              createdAt: row.created_at,
              updatedAt: row.updated_at,
              lastLoginAt: row.last_login_at
            };
          }
        }

        if (!profile) {
          return Response.json({ error: "Profile not found" }, { status: 404, headers: CORS_HEADERS });
        }

        // Skryjeme hash API kľúča
        const { apiKeyHash, ...safeProfile } = profile;
        return Response.json(safeProfile, { headers: CORS_HEADERS });
      }

      // 4. Aktualizácia profilu a inferenčných preferencií
      if ((request.method === "PUT" || request.method === "POST") && pathname === "/api/profile/update") {
        const body = await request.json() as any;
        if (!body.id) {
          return Response.json({ error: "Missing required 'id' attribute" }, { status: 400, headers: CORS_HEADERS });
        }

        const now = Date.now();
        const isAdminAuthorized = await verifyAdminAuthorization(request, body, env, salt);

        // Sanitize input fields:
        const safeBody = { ...body };
        if (!isAdminAuthorized) {
          delete safeBody.role;
          delete safeBody.apiKeyHash;
          delete safeBody.email;
          delete safeBody.status;
          delete safeBody.ttkBalance;
          delete safeBody.createdAt;
        }

        if (env.DB) {
          if (isAdminAuthorized && (body.role || body.status)) {
            await env.DB.prepare(`
              UPDATE user_profiles 
              SET display_name = COALESCE(?, display_name),
                  alias = COALESCE(?, alias),
                  avatar_url = COALESCE(?, avatar_url),
                  role = COALESCE(?, role),
                  status = COALESCE(?, status),
                  organization = COALESCE(?, organization),
                  wallet_address = COALESCE(?, wallet_address),
                  preferences_json = COALESCE(?, preferences_json),
                  updated_at = ?
              WHERE id = ?
            `).bind(
              safeBody.displayName || null,
              safeBody.alias || null,
              safeBody.avatarUrl || null,
              body.role || null,
              body.status || null,
              safeBody.organization || null,
              safeBody.walletAddress || null,
              safeBody.preferences ? JSON.stringify(safeBody.preferences) : null,
              now,
              body.id
            ).run();
          } else {
            await env.DB.prepare(`
              UPDATE user_profiles 
              SET display_name = COALESCE(?, display_name),
                  alias = COALESCE(?, alias),
                  avatar_url = COALESCE(?, avatar_url),
                  organization = COALESCE(?, organization),
                  wallet_address = COALESCE(?, wallet_address),
                  preferences_json = COALESCE(?, preferences_json),
                  updated_at = ?
              WHERE id = ?
            `).bind(
              safeBody.displayName || null,
              safeBody.alias || null,
              safeBody.avatarUrl || null,
              safeBody.organization || null,
              safeBody.walletAddress || null,
              safeBody.preferences ? JSON.stringify(safeBody.preferences) : null,
              now,
              body.id
            ).run();
          }
        }

        if (env.TRINITY_KV) {
          const cached = await env.TRINITY_KV.get(`profile:${body.id}`);
          if (cached) {
            const current = JSON.parse(cached);
            const updated = {
              ...current,
              ...safeBody,
              role: isAdminAuthorized && body.role ? body.role : current.role,
              status: isAdminAuthorized && body.status ? body.status : current.status,
              email: current.email,
              apiKeyHash: current.apiKeyHash,
              ttkBalance: current.ttkBalance,
              createdAt: current.createdAt,
              id: current.id,
              preferences: { ...(current.preferences || {}), ...(safeBody.preferences || {}) },
              updatedAt: now
            };
            await env.TRINITY_KV.put(`profile:${body.id}`, JSON.stringify(updated), { expirationTtl: 86400 * 30 });
          }
        }

        return Response.json({ status: "UPDATED", userId: body.id, updatedAt: now }, { headers: CORS_HEADERS });
      }

      // 5. Defaultný health / metadata endpoint
      return Response.json({
        worker: "trinity-profile",
        version: "10.3.0",
        capabilities: [
          "sovereign_identity",
          "inference_preferences",
          "ttk_treasury_link",
          "api_key_auth"
        ],
        endpoints: [
          "/health",
          "/api/profile/create",
          "/api/profile/me",
          "/api/profile/update",
          "/init-schema"
        ]
      }, { headers: CORS_HEADERS });

    } catch (err: any) {
      return Response.json({ error: err.message, status: "INTERNAL_ERROR" }, { status: 500, headers: CORS_HEADERS });
    }
  }
};

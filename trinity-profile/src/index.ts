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

type ProfilePrincipal = { id: string; email: string };

function normalizePreferences(input: unknown, base: UserPreferences = DEFAULT_PREFERENCES): UserPreferences | null {
  if (input === undefined) return { ...base };
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;

  const source = input as Record<string, unknown>;
  const result: UserPreferences = { ...base };
  const stringFields: Array<[keyof Pick<UserPreferences, "preferredModel" | "fastFallbackModel">, number]> = [
    ["preferredModel", 120], ["fastFallbackModel", 120]
  ];
  for (const [key, max] of stringFields) {
    const value = source[key];
    if (value !== undefined) {
      if (typeof value !== "string" || value.trim().length === 0 || value.length > max) return null;
      result[key] = value.trim();
    }
  }
  if (source.temperature !== undefined) {
    if (typeof source.temperature !== "number" || !Number.isFinite(source.temperature) || source.temperature < 0 || source.temperature > 2) return null;
    result.temperature = source.temperature;
  }
  if (source.maxTokens !== undefined) {
    if (typeof source.maxTokens !== "number" || !Number.isInteger(source.maxTokens) || source.maxTokens < 1 || source.maxTokens > 8192) return null;
    result.maxTokens = source.maxTokens;
  }
  if (source.customSystemPrompt !== undefined) {
    if (typeof source.customSystemPrompt !== "string" || source.customSystemPrompt.length > 4000) return null;
    result.customSystemPrompt = source.customSystemPrompt;
  }
  if (source.theme !== undefined) {
    if (!(["aura", "matrix", "dark", "cyberpunk", "minimal"] as unknown[]).includes(source.theme)) return null;
    result.theme = source.theme as UserPreferences["theme"];
  }
  for (const key of ["streamResponse", "developerMode"] as const) {
    if (source[key] !== undefined) {
      if (typeof source[key] !== "boolean") return null;
      result[key] = source[key];
    }
  }
  return result;
}

async function resolveProfilePrincipal(request: Request, env: Env, salt: string): Promise<ProfilePrincipal | null> {
  if (!env.DB) return null;
  const match = /^Bearer\s+(trk_[a-z0-9_-]{24,128})$/i.exec(request.headers.get("Authorization")?.trim() || "");
  if (!match) return null;

  const apiKey = match[1];
  const hashes = [await CryptoEngine.hash(apiKey, salt), await CryptoEngine.hash(apiKey, "")];
  let row: { id: string; email: string; status: string; api_key_hash: string | null } | null = null;
  if (env.TRINITY_KV) {
    for (const hash of hashes) {
      const profileId = await env.TRINITY_KV.get(`api_key_lookup:${hash}`);
      if (profileId) {
        row = await env.DB.prepare(
          "SELECT id, email, status, api_key_hash FROM user_profiles WHERE id = ?"
        ).bind(profileId).first<{ id: string; email: string; status: string; api_key_hash: string | null }>();
        if (row) break;
      }
    }
  }
  if (!row) {
    row = await env.DB.prepare(
      "SELECT id, email, status, api_key_hash FROM user_profiles WHERE api_key_hash = ? OR api_key_hash = ? LIMIT 1"
    ).bind(hashes[0], hashes[1]).first<{ id: string; email: string; status: string; api_key_hash: string | null }>();
  }
  if (!row || row.status !== "ACTIVE" || !row.email || !row.id || !hashes.includes(row.api_key_hash || "")) return null;
  return { id: row.id, email: row.email };
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
        if (request.method !== "POST") {
          return Response.json({ error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: CORS_HEADERS });
        }
        if (!await verifyAdminAuthorization(request, null, env, salt)) {
          return Response.json({ error: "ADMIN_AUTH_REQUIRED" }, { status: 401, headers: CORS_HEADERS });
        }
        if (!env.DB) {
          return Response.json({ error: "DATABASE_UNAVAILABLE" }, { status: 503, headers: CORS_HEADERS });
        }
        {
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
        let body: any;
        try { body = await request.json(); }
        catch { return Response.json({ error: "INVALID_JSON_BODY" }, { status: 400, headers: CORS_HEADERS }); }
        if (!body || typeof body !== "object" || Array.isArray(body) ||
            typeof body.email !== "string" || typeof body.displayName !== "string") {
          return Response.json({ error: "Missing required fields: email, displayName" }, { status: 400, headers: CORS_HEADERS });
        }

        const emailClean = body.email.trim().toLowerCase();
        const displayName = body.displayName.trim();
        if (emailClean.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean) ||
            displayName.length < 1 || displayName.length > 120) {
          return Response.json({ error: "INVALID_PROFILE_INPUT" }, { status: 400, headers: CORS_HEADERS });
        }
        if (!env.DB || !env.TRINITY_KV) {
          return Response.json({ error: "PROFILE_STORAGE_UNAVAILABLE" }, { status: 503, headers: CORS_HEADERS });
        }
        const mergedPrefs = normalizePreferences(body.preferences);
        if (!mergedPrefs) {
          return Response.json({ error: "INVALID_PREFERENCES" }, { status: 400, headers: CORS_HEADERS });
        }

        const profileId = `usr_${crypto.randomUUID().slice(0, 12)}`;
        const now = Date.now();

        // Hardened cryptographic and store-backed admin role authorization
        const isAdminAuthorized = await verifyAdminAuthorization(request, body, env, salt);

        let role: UserRole = "user";
        if (body.role && ["operator", "trinity_agent", "admin", "superadmin"].includes(body.role)) {
          role = isAdminAuthorized ? body.role : "user";
        }

        const newApiKey = `trk_${crypto.randomUUID().replace(/-/g, "")}`;
        const apiKeyHash = await CryptoEngine.hash(newApiKey, salt);

        const profile: UserProfile = {
          id: profileId,
          email: emailClean,
          displayName,
          alias: typeof body.alias === "string" && body.alias.length <= 64 ? body.alias.trim() || undefined : undefined,
          avatarUrl: typeof body.avatarUrl === "string" && body.avatarUrl.length <= 2048 ? body.avatarUrl : "",
          role,
          organization: typeof body.organization === "string" && body.organization.length <= 120 ? body.organization : (role === "superadmin" ? "Trinity Sovereign Core" : "AURA"),
          walletAddress: typeof body.walletAddress === "string" && body.walletAddress.length <= 256 ? body.walletAddress : "",
          ttkBalance: isAdminAuthorized && typeof body.ttkBalance === "number" && Number.isFinite(body.ttkBalance) && body.ttkBalance >= 0 ? body.ttkBalance : 0,
          preferences: mergedPrefs,
          apiKeyHash,
          status: "ACTIVE",
          createdAt: now,
          updatedAt: now,
          lastLoginAt: now
        };

        // Do not replace an existing email row: public registration must never take over an account.
        const insertResult = await env.DB.prepare(`
            INSERT INTO user_profiles
            (id, email, display_name, alias, avatar_url, role, organization, wallet_address, ttk_balance, preferences_json, api_key_hash, status, created_at, updated_at, last_login_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(email) DO NOTHING
          `).bind(
            profile.id, profile.email, profile.displayName, profile.alias || null,
            profile.avatarUrl || null, profile.role, profile.organization || null,
            profile.walletAddress || null, profile.ttkBalance || 0,
            JSON.stringify(profile.preferences), profile.apiKeyHash, profile.status,
            profile.createdAt, profile.updatedAt, profile.lastLoginAt
          ).run();
        if (insertResult.meta.changes === 0) {
          return Response.json({ error: "PROFILE_ALREADY_EXISTS" }, { status: 409, headers: CORS_HEADERS });
        }

        // Zápis do KV cache
        try {
          await env.TRINITY_KV.put(`profile:${profile.id}`, JSON.stringify(profile), { expirationTtl: 86400 * 30 });
          await env.TRINITY_KV.put(`profile_by_email:${profile.email}`, profile.id, { expirationTtl: 86400 * 30 });
          await env.TRINITY_KV.put(`api_key_lookup:${apiKeyHash}`, profile.id, { expirationTtl: 86400 * 30 });
        } catch (error) {
          await Promise.allSettled([
            env.TRINITY_KV.delete(`profile:${profile.id}`),
            env.TRINITY_KV.delete(`profile_by_email:${profile.email}`),
            env.TRINITY_KV.delete(`api_key_lookup:${apiKeyHash}`)
          ]);
          await env.DB.prepare("DELETE FROM user_profiles WHERE id = ?").bind(profile.id).run().catch(() => undefined);
          throw error;
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

        const { apiKeyHash: _apiKeyHash, ...safeProfile } = profile;
        return Response.json({
          status: "CREATED",
          profile: safeProfile,
          secretApiKey: newApiKey
        }, { status: 201, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } });
      }

      // 3. Získanie profilu (/api/profile/me alebo podľa ID/Emailu)
      if (request.method === "GET" && (pathname.startsWith("/api/profile/") || pathname === "/api/profile")) {
        const queryId = url.searchParams.get("id") || (pathname !== "/api/profile" && pathname !== "/api/profile/me" ? pathname.split("/").pop() : null);
        const queryEmail = url.searchParams.get("email");
        const isAdminAuthorized = await verifyAdminAuthorization(request, null, env, salt);
        const principal = isAdminAuthorized ? null : await resolveProfilePrincipal(request, env, salt);
        if (!isAdminAuthorized && !principal) {
          return Response.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401, headers: CORS_HEADERS });
        }

        let targetId = queryId;
        if (!targetId && principal) targetId = principal.id;
        if (targetId && principal && targetId !== principal.id) {
          return Response.json({ error: "PROFILE_ACCESS_DENIED" }, { status: 403, headers: CORS_HEADERS });
        }
        if (queryEmail && principal && queryEmail.trim().toLowerCase() !== principal.email.toLowerCase()) {
          return Response.json({ error: "PROFILE_ACCESS_DENIED" }, { status: 403, headers: CORS_HEADERS });
        }
        if (!targetId && !queryEmail) {
          return Response.json({ error: "PROFILE_ID_REQUIRED" }, { status: 400, headers: CORS_HEADERS });
        }

        if (!env.DB) {
          return Response.json({ error: "DATABASE_UNAVAILABLE" }, { status: 503, headers: CORS_HEADERS });
        }
        const row: any = targetId
          ? await env.DB.prepare("SELECT * FROM user_profiles WHERE id = ?").bind(targetId).first()
          : await env.DB.prepare("SELECT * FROM user_profiles WHERE email = ?").bind(queryEmail!.trim().toLowerCase()).first();
        const profile: UserProfile | null = row ? {
          id: row.id,
          email: row.email,
          displayName: row.display_name,
          alias: row.alias,
          avatarUrl: row.avatar_url,
          role: row.role,
          organization: row.organization,
          walletAddress: row.wallet_address,
          ttkBalance: row.ttk_balance,
          preferences: normalizePreferences(JSON.parse(row.preferences_json || "{}")) || { ...DEFAULT_PREFERENCES },
          apiKeyHash: row.api_key_hash,
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          lastLoginAt: row.last_login_at
        } : null;

        if (!profile) {
          return Response.json({ error: "Profile not found" }, { status: 404, headers: CORS_HEADERS });
        }

        // Skryjeme hash API kľúča
        const { apiKeyHash, ...safeProfile } = profile;
        return Response.json(safeProfile, { headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } });
      }

      // 4. Aktualizácia profilu a inferenčných preferencií
      if ((request.method === "PUT" || request.method === "POST") && pathname === "/api/profile/update") {
        let body: any;
        try { body = await request.json(); }
        catch { return Response.json({ error: "INVALID_JSON_BODY" }, { status: 400, headers: CORS_HEADERS }); }
        if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.id !== "string" || body.id.length > 100) {
          return Response.json({ error: "INVALID_PROFILE_ID" }, { status: 400, headers: CORS_HEADERS });
        }

        const isAdminAuthorized = await verifyAdminAuthorization(request, body, env, salt);
        const principal = isAdminAuthorized ? null : await resolveProfilePrincipal(request, env, salt);
        if (!isAdminAuthorized && !principal) {
          return Response.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401, headers: CORS_HEADERS });
        }
        if (principal && principal.id !== body.id) {
          return Response.json({ error: "PROFILE_ACCESS_DENIED" }, { status: 403, headers: CORS_HEADERS });
        }
        if (!isAdminAuthorized && ["role", "status", "email", "apiKeyHash", "ttkBalance", "createdAt"].some(key => body[key] !== undefined)) {
          return Response.json({ error: "ADMIN_AUTH_REQUIRED_FOR_PROTECTED_FIELDS" }, { status: 403, headers: CORS_HEADERS });
        }
        if (!env.DB || !env.TRINITY_KV) {
          return Response.json({ error: "PROFILE_STORAGE_UNAVAILABLE" }, { status: 503, headers: CORS_HEADERS });
        }

        const current: any = await env.DB.prepare("SELECT * FROM user_profiles WHERE id = ?").bind(body.id).first();
        if (!current) return Response.json({ error: "PROFILE_NOT_FOUND" }, { status: 404, headers: CORS_HEADERS });

        const safeBody: Partial<UserProfile> = {};
        const textFields: Array<[keyof Pick<UserProfile, "displayName" | "alias" | "avatarUrl" | "organization" | "walletAddress">, number]> = [
          ["displayName", 120], ["alias", 64], ["avatarUrl", 2048], ["organization", 120], ["walletAddress", 256]
        ];
        for (const [key, max] of textFields) {
          const value = body[key];
          if (value !== undefined) {
            if (typeof value !== "string" || value.length > max || (key === "displayName" && value.trim().length === 0)) {
              return Response.json({ error: "INVALID_PROFILE_INPUT" }, { status: 400, headers: CORS_HEADERS });
            }
            (safeBody as any)[key] = value.trim();
          }
        }

        const existingPreferences = normalizePreferences(JSON.parse(current.preferences_json || "{}")) || { ...DEFAULT_PREFERENCES };
        const nextPreferences = body.preferences === undefined ? existingPreferences : normalizePreferences(body.preferences, existingPreferences);
        if (!nextPreferences) return Response.json({ error: "INVALID_PREFERENCES" }, { status: 400, headers: CORS_HEADERS });
        if (body.preferences !== undefined) safeBody.preferences = nextPreferences;

        const allowedRoles: UserRole[] = ["superadmin", "admin", "operator", "user", "trinity_agent"];
        const allowedStatuses: UserProfile["status"][] = ["ACTIVE", "SUSPENDED", "PENDING_VERIFICATION"];
        if (isAdminAuthorized && body.role !== undefined && !allowedRoles.includes(body.role)) {
          return Response.json({ error: "INVALID_ROLE" }, { status: 400, headers: CORS_HEADERS });
        }
        if (isAdminAuthorized && body.status !== undefined && !allowedStatuses.includes(body.status)) {
          return Response.json({ error: "INVALID_STATUS" }, { status: 400, headers: CORS_HEADERS });
        }

        const now = Date.now();
        const update = await env.DB.prepare(`
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
          safeBody.displayName ?? null,
          safeBody.alias ?? null,
          safeBody.avatarUrl ?? null,
          isAdminAuthorized ? body.role ?? null : null,
          isAdminAuthorized ? body.status ?? null : null,
          safeBody.organization ?? null,
          safeBody.walletAddress ?? null,
          body.preferences !== undefined ? JSON.stringify(nextPreferences) : null,
          now,
          body.id
        ).run();
        if (update.meta.changes === 0) return Response.json({ error: "PROFILE_NOT_FOUND" }, { status: 404, headers: CORS_HEADERS });

        const updated: UserProfile = {
          id: current.id,
          email: current.email,
          displayName: safeBody.displayName ?? current.display_name,
          alias: safeBody.alias ?? current.alias ?? undefined,
          avatarUrl: safeBody.avatarUrl ?? current.avatar_url ?? "",
          role: isAdminAuthorized && body.role !== undefined ? body.role : current.role,
          organization: safeBody.organization ?? current.organization ?? undefined,
          walletAddress: safeBody.walletAddress ?? current.wallet_address ?? "",
          ttkBalance: current.ttk_balance ?? 0,
          preferences: nextPreferences,
          apiKeyHash: current.api_key_hash ?? undefined,
          status: isAdminAuthorized && body.status !== undefined ? body.status : current.status,
          createdAt: current.created_at,
          updatedAt: now,
          lastLoginAt: current.last_login_at
        };
        try {
          await env.TRINITY_KV.put(`profile:${body.id}`, JSON.stringify(updated), { expirationTtl: 86400 * 30 });
        } catch {
          await env.TRINITY_KV.delete(`profile:${body.id}`).catch(() => undefined);
        }

        return Response.json({ status: "UPDATED", userId: body.id, updatedAt: now }, { headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } });
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

    } catch {
      return Response.json({ error: "INTERNAL_ERROR" }, { status: 500, headers: CORS_HEADERS });
    }
  }
};

import { z } from 'zod';

export const PROTOCOL = 'trinity.agent.v1';
export const CONTRACT_VERSION = '1.0.0';
export const Status = z.enum(['REQUESTED', 'QUEUED', 'RUNNING', 'COMPLETED', 'VERIFIED', 'FAILED', 'CANCELLED', 'UNKNOWN_OUTCOME']);
const id = z.string().uuid();
const identity = z.object({ type: z.enum(['agent', 'service']), id: z.string().min(1).max(100) }).strict();
const json = z.json();
export const ReceiptSchema = z.object({
  protocol: z.literal('trinity.receipt.v1'),
  receipt_id: id, task_id: id, run_id: id, agent_id: z.string().min(1),
  tool_id: z.string().min(1), environment: z.enum(['local', 'staging', 'production']),
  request_hash: z.string().regex(/^[a-f0-9]{64}$/),
  result_hash: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.literal('COMPLETED'), created_at: z.iso.datetime(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/)
}).strict();
export const MessageSchema = z.object({
  protocol: z.literal(PROTOCOL), contract_version: z.literal(CONTRACT_VERSION),
  message_id: id, trace_id: id, task_id: id, run_id: id,
  sender: identity, receiver: identity,
  kind: z.enum(['task.request', 'task.status', 'task.result']),
  environment: z.enum(['local', 'staging', 'production']), status: Status,
  authorization_ref: z.string().min(1).max(200),
  idempotency_key: z.string().min(1).max(200),
  payload: z.object({
    objective: z.string().min(1).max(4000), tool_id: z.string().min(1).max(100),
    arguments: z.record(z.string(), json),
    constraints: z.array(z.string().max(1000)).max(50),
    acceptance_criteria: z.array(z.string().max(1000)).max(50)
  }).strict(),
  result: json.nullable(), evidence: z.array(ReceiptSchema).max(10),
  error: z.object({ code: z.string().min(1).max(100), message: z.string().max(500) }).strict().nullable()
}).strict().superRefine((m, ctx) => {
  const fail = (message) => ctx.addIssue({ code: 'custom', message });
  if (m.kind === 'task.request' && (m.status !== 'REQUESTED' || m.result !== null || m.evidence.length || m.error !== null)) fail('A request cannot claim an execution outcome');
  if (m.status === 'VERIFIED' && (!m.evidence.length || m.error !== null)) fail('VERIFIED requires evidence and no error');
  if (m.evidence.some(e => e.task_id !== m.task_id || e.run_id !== m.run_id || e.agent_id !== m.receiver.id || e.tool_id !== m.payload.tool_id || e.environment !== m.environment)) fail('Evidence identity mismatch');
});

const transitions = {
  REQUESTED: ['QUEUED', 'CANCELLED'], QUEUED: ['RUNNING', 'CANCELLED'],
  RUNNING: ['COMPLETED', 'FAILED', 'UNKNOWN_OUTCOME'],
  COMPLETED: ['VERIFIED', 'FAILED', 'UNKNOWN_OUTCOME'],
  UNKNOWN_OUTCOME: [], VERIFIED: [], FAILED: [], CANCELLED: []
};
export function transition(from, to) {
  Status.parse(from); Status.parse(to);
  if (!transitions[from].includes(to)) throw new Error(`TAP_INVALID_TRANSITION: ${from} -> ${to}`);
  return to;
}

// Input is a trusted legacy caller's data, not an authenticated principal.
// This adapter deliberately never imports legacy status or _evidence as VERIFIED.
export function fromLegacy({ agent_id, tool_id, arguments: args = {} }, context) {
  return MessageSchema.parse({
    protocol: PROTOCOL, contract_version: CONTRACT_VERSION,
    message_id: crypto.randomUUID(), trace_id: context.trace_id ?? crypto.randomUUID(),
    task_id: context.task_id ?? crypto.randomUUID(), run_id: context.run_id ?? crypto.randomUUID(),
    sender: { type: 'agent', id: context.sender_id }, receiver: { type: 'agent', id: agent_id },
    kind: 'task.request', environment: context.environment, status: 'REQUESTED',
    authorization_ref: context.authorization_ref, idempotency_key: context.idempotency_key,
    payload: { objective: context.objective ?? tool_id, tool_id, arguments: args, constraints: [], acceptance_criteria: [] },
    result: null, evidence: [], error: null
  });
}

export function canonicalJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonicalJson(value[k])).join(',') + '}';
  }
  throw new Error('TAP_NON_JSON_VALUE');
}
export async function digest(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJson(value)));
  return Array.from(new Uint8Array(bytes), v => v.toString(16).padStart(2, '0')).join('');
}
export async function createReceipt(message, result) {
  const m = MessageSchema.parse(message);
  const body = {
    protocol: 'trinity.receipt.v1', receipt_id: crypto.randomUUID(),
    task_id: m.task_id, run_id: m.run_id, agent_id: m.receiver.id, tool_id: m.payload.tool_id,
    environment: m.environment, request_hash: await digest(m), result_hash: await digest(result),
    status: 'COMPLETED', created_at: new Date().toISOString()
  };
  return ReceiptSchema.parse({ ...body, checksum: await digest(body) });
}
export async function verifyReceipt(receipt, request, result) {
  const parsed = ReceiptSchema.safeParse(receipt);
  if (!parsed.success) return false;
  const { checksum, ...body } = parsed.data;
  return checksum === await digest(body)
    && body.request_hash === await digest(request) && body.result_hash === await digest(result)
    && body.task_id === request.task_id && body.run_id === request.run_id
    && body.agent_id === request.receiver.id && body.tool_id === request.payload.tool_id
    && body.environment === request.environment;
}

// ============================================================================
// TRINITY ASSURANCE PROTOCOL (TAP) - CRYPTO RUNTIME v11.2.0
// ============================================================================

const KEY_ALGO = {
  name: "RSASSA-PKCS1-v1_5",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256"
};

export function base64UrlEncode(str) {
  const bytes = typeof str === "string" ? new TextEncoder().encode(str) : new Uint8Array(str);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(str) {
  let base64 = String(str).replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export class TapKeyManager {
  static async generateKeyPair() {
    return await crypto.subtle.generateKey(
      KEY_ALGO,
      true,
      ["sign", "verify"]
    );
  }

  static async exportKeyPkcs8(privateKey) {
    const exported = await crypto.subtle.exportKey("pkcs8", privateKey);
    return base64UrlEncode(exported);
  }

  static async exportKeySpki(publicKey) {
    const exported = await crypto.subtle.exportKey("spki", publicKey);
    return base64UrlEncode(exported);
  }

  static async importPrivateKey(b64) {
    const buffer = base64UrlDecode(b64);
    return await crypto.subtle.importKey("pkcs8", buffer, KEY_ALGO, true, ["sign"]);
  }

  static async importPublicKey(b64) {
    const buffer = base64UrlDecode(b64);
    return await crypto.subtle.importKey("spki", buffer, KEY_ALGO, true, ["verify"]);
  }
}

export class TapTokenEngine {
  static async sign(payload, privateKey, kid = "trinity-root-01") {
    const header = {
      alg: "RS256",
      typ: "JWT",
      kid: kid
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (payload.exp_seconds ?? 86400),
      iss: "trinity-ring0",
      aud: "aura-fleet"
    }));

    const dataToSign = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
    const signatureBuffer = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      privateKey,
      dataToSign
    );

    const encodedSignature = base64UrlEncode(signatureBuffer);
    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
  }

  static async verify(token, publicKey) {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) {
      throw new Error("TAP_MALFORMED_TOKEN");
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    const dataToVerify = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = base64UrlDecode(signatureB64);

    const isValid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      signature,
      dataToVerify
    );

    if (!isValid) {
      throw new Error("TAP_SIGNATURE_INVALID");
    }

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      throw new Error("TAP_TOKEN_EXPIRED");
    }

    return payload;
  }
}

export function validateProfileInput(input) {
  if (!input || typeof input !== "object") {
    throw new Error("SCHEMA_ERROR: Payload must be JSON object");
  }
  const { username, email, role, permissions } = input;

  if (!username || typeof username !== "string" || !/^[a-zA-Z0-9_\-\.]{3,32}$/.test(username)) {
    throw new Error("SCHEMA_ERROR: Invalid username (3-32 alnum characters required)");
  }
  if (email && (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) {
    throw new Error("SCHEMA_ERROR: Invalid email format");
  }
  const allowedRoles = ["ring0_owner", "sub_agent", "auditor", "operator", "guest"];
  if (role && !allowedRoles.includes(role)) {
    throw new Error(`SCHEMA_ERROR: Invalid role. Allowed: ${allowedRoles.join(", ")}`);
  }
  if (permissions && (!Array.isArray(permissions) || !permissions.every(p => typeof p === "string"))) {
    throw new Error("SCHEMA_ERROR: Permissions must be array of strings");
  }
  return true;
}

export async function verifyTapToken(token, publicKeyOrB64) {
  try {
    if (!token || typeof token !== "string") {
      return { valid: false, error: "TAP_MISSING_TOKEN" };
    }
    if (!publicKeyOrB64) {
      return { valid: false, error: "TAP_MISSING_PUBLIC_KEY" };
    }
    const pubKey =
      typeof publicKeyOrB64 === "string"
        ? await TapKeyManager.importPublicKey(publicKeyOrB64)
        : publicKeyOrB64;
    const payload = await TapTokenEngine.verify(token, pubKey);
    return { valid: true, payload };
  } catch (err) {
    return { valid: false, error: err?.message || "TAP_VERIFICATION_FAILED" };
  }
}



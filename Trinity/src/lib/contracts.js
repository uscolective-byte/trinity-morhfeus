/**
 * Trinity Lightweight Contracts
 * Nahrada za Zod — nativna validacia bez 60KB+ runtime
 * @version 1.0.0
 */

// === CHAT PAYLOAD ===
export function validateChatPayload(body) {
  if (!body || typeof body !== "object") throw new Error("INVALID_PAYLOAD");
  const { task, mode, agent, provider, history } = body;
  if (!task || typeof task !== "string" || task.trim().length === 0) {
    throw new Error("TASK_REQUIRED");
  }
  return {
    task: task.slice(0, 8000),
    mode: ["single", "team", "control"].includes(mode) ? mode : "single",
    agent: typeof agent === "string" ? agent : "ORCHESTRATOR",
    provider: typeof provider === "string" ? provider : "workers-ai",
    history: Array.isArray(history) ? history.slice(-20) : []
  };
}

// === TOOL EXECUTION ===
export function validateToolExecution(body) {
  if (!body || typeof body !== "object") throw new Error("INVALID_PAYLOAD");
  const { tool, input, run_id, step } = body;
  if (!tool || typeof tool !== "string") throw new Error("TOOL_REQUIRED");
  return {
    tool: tool.slice(0, 100),
    input: input && typeof input === "object" ? input : {},
    run_id: typeof run_id === "string" ? run_id : null,
    step: typeof step === "number" ? step : 0
  };
}

// === SETTINGS ===
export function validateSettingUpdate(body) {
  if (!body || typeof body !== "object") throw new Error("INVALID_PAYLOAD");
  const { value, category, description } = body;
  if (value === undefined) throw new Error("VALUE_REQUIRED");
  return {
    value: String(value).slice(0, 4096),
    category: typeof category === "string" ? category.slice(0, 50) : "general",
    description: typeof description === "string" ? description.slice(0, 200) : null
  };
}

// === DNS RECORD ===
export function validateDNSRecord(body) {
  if (!body || typeof body !== "object") throw new Error("INVALID_PAYLOAD");
  const { type, name, content } = body;
  if (!type || !name || !content) throw new Error("DNS_FIELDS_REQUIRED");
  const validTypes = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV", "CAA"];
  if (!validTypes.includes(type)) throw new Error("INVALID_DNS_TYPE");
  return {
    type,
    name: String(name).slice(0, 255),
    content: String(content).slice(0, 1000),
    ttl: body.ttl && body.ttl >= 1 && body.ttl <= 86400 ? body.ttl : 1,
    proxied: typeof body.proxied === "boolean" ? body.proxied : false,
    priority: body.priority || 0
  };
}

// === CONVERSATION ===
export function validateConversation(body) {
  if (!body || typeof body !== "object") throw new Error("INVALID_PAYLOAD");
  return {
    title: (body.title || "Untitled").slice(0, 200),
    message: body.message ? String(body.message).slice(0, 8000) : null,
    role: ["user", "assistant", "system"].includes(body.role) ? body.role : "user"
  };
}

// === PROJECT ===
export function validateProject(body) {
  if (!body || typeof body !== "object") throw new Error("INVALID_PAYLOAD");
  if (!body.name) throw new Error("PROJECT_NAME_REQUIRED");
  return {
    name: String(body.name).slice(0, 200),
    description: body.description ? String(body.description).slice(0, 2000) : null
  };
}

// === TASK ===
export function validateTask(body) {
  if (!body || typeof body !== "object") throw new Error("INVALID_PAYLOAD");
  if (!body.title) throw new Error("TASK_TITLE_REQUIRED");
  return {
    title: String(body.title).slice(0, 200),
    description: body.description ? String(body.description).slice(0, 2000) : null,
    priority: ["low", "medium", "high"].includes(body.priority) ? body.priority : "medium",
    assignee: body.assignee ? String(body.assignee).slice(0, 100) : null,
    project_id: body.project_id ? String(body.project_id).slice(0, 100) : null
  };
}

// === SAFE JSON PARSE ===
export function safeParse(str, fallback = null) {
  try { return JSON.parse(str); } catch { return fallback; }
}

// === BOUND STRING ===
export function boundString(val, max = 1000) {
  if (typeof val !== "string") return "";
  return val.slice(0, max);
}

// === SAFE NUMBER ===
export function safeNumber(val, min = 0, max = 1000000, fallback = 0) {
  const n = Number(val);
  if (isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

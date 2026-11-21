/**
 * Trinity D1 Storage Helper
 * Parametrizované dotazy pre trinity-v03
 * @version 1.0.0
 */

export class D1 {
  constructor(db) {
    this.db = db;
  }

  // === TRACE LOG ===
  async log(traceId, source, eventType, severity, message, payload, status = "ok", durationMs = null) {
    try {
      await this.db.prepare(
        "INSERT INTO trinity_trace_log (id, trace_id, source, event_type, severity, message, payload_json, status, duration_ms, environment) VALUES (?,?,?,?,?,?,?,?,?,?)"
      ).bind(crypto.randomUUID(), traceId, source, eventType, severity, message,
        JSON.stringify(payload).slice(0, 4096), status, durationMs, "production").run();
    } catch (e) { console.error("D1 log failed:", e.message); }
  }

  // === SYSTEM PROMPTS ===
  async getActivePrompts() {
    try {
      const r = await this.db.prepare("SELECT content FROM system_prompts WHERE active=1 ORDER BY priority DESC").all();
      return r.results?.map(p => p.content).join("\n\n---\n\n") || null;
    } catch { return null; }
  }

  // === TOOL REGISTRY ===
  async getTool(toolId) {
    return await this.db.prepare("SELECT * FROM trinity_tool_registry WHERE tool_id=? AND enabled=1").bind(toolId).first();
  }

  async listTools() {
    const r = await this.db.prepare("SELECT tool_id, name, category, description, success_count, error_count, avg_latency_ms FROM trinity_tool_registry WHERE enabled=1 ORDER BY category, name").all();
    return r.results || [];
  }

  async recordToolSuccess(tool, ms) {
    try {
      await this.db.batch([
        this.db.prepare("INSERT INTO core_tool_receipts (id, run_id, step, tool, status, receipt_id, input_json, output_json) VALUES (?,?,?,?,?,?,?,?)")
          .bind(crypto.randomUUID(), crypto.randomUUID(), 0, tool, "completed", crypto.randomUUID(), "{}", "{}"),
        this.db.prepare("UPDATE trinity_tool_registry SET success_count=success_count+1, avg_latency_ms=(avg_latency_ms+?)/2, last_used=datetime('now') WHERE tool_id=?")
          .bind(ms, tool)
      ]);
    } catch (e) {}
  }

  async recordToolError(tool, input, error) {
    try {
      await this.db.batch([
        this.db.prepare("INSERT INTO core_tool_receipts (id, run_id, step, tool, status, receipt_id, input_json, output_json) VALUES (?,?,?,?,?,?,?,?)")
          .bind(crypto.randomUUID(), crypto.randomUUID(), 0, tool, "failed", crypto.randomUUID(), JSON.stringify(input).slice(0, 8192), JSON.stringify({error}).slice(0, 8192)),
        this.db.prepare("UPDATE trinity_tool_registry SET error_count=error_count+1, last_used=datetime('now') WHERE tool_id=?")
          .bind(tool)
      ]);
    } catch (e) {}
  }

  // === MODEL HEALTH ===
  async updateModelHealth(routeId, isPrimary, status, latencyMs, error = null) {
    const id = `health-${routeId}-${isPrimary ? "primary" : "fallback"}`;
    try {
      await this.db.prepare(
        "UPDATE trinity_model_health SET latency_ms=?, status=?, error_message=?, checked_at=datetime('now') WHERE id=?"
      ).bind(latencyMs, status, error, id).run();
    } catch (e) {}
  }

  async updateRouteStats(routeId, success, latencyMs, error = null) {
    try {
      if (success) {
        await this.db.prepare("UPDATE model_routes SET success_count=success_count+1, avg_latency_ms=?, last_success_at=datetime('now') WHERE id=?")
          .bind(latencyMs, routeId).run();
      } else {
        await this.db.prepare("UPDATE model_routes SET error_count=error_count+1, last_error=?, last_error_at=datetime('now'), fallback_triggered=fallback_triggered+1 WHERE id=?")
          .bind(error?.slice(0, 500), routeId).run();
      }
    } catch (e) {}
  }

  // === CONVERSATIONS ===
  async createConversation(title) {
    const id = crypto.randomUUID();
    await this.db.prepare("INSERT INTO conversations (id, title) VALUES (?, ?)").bind(id, title).run();
    return { id, title };
  }

  async getConversations() {
    const r = await this.db.prepare("SELECT * FROM conversations ORDER BY updated_at DESC").all();
    return r.results || [];
  }

  async getMessages(convId) {
    const r = await this.db.prepare("SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at ASC").bind(convId).all();
    return r.results || [];
  }

  async addMessage(convId, role, content, module = null, model = null) {
    const id = crypto.randomUUID();
    await this.db.batch([
      this.db.prepare("INSERT INTO messages (id, conversation_id, role, content, module, model) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(id, convId, role, content, module, model),
      this.db.prepare("UPDATE conversations SET message_count=message_count+1, updated_at=datetime('now') WHERE id=?")
        .bind(convId)
    ]);
    return { id, role, content };
  }

  // === SETTINGS ===
  async getSetting(key, fallback = null) {
    try {
      const r = await this.db.prepare("SELECT value FROM settings WHERE key=?").bind(key).first();
      return r?.value || fallback;
    } catch { return fallback; }
  }

  async setSetting(key, value, category = "general", description = null) {
    await this.db.prepare(
      "INSERT INTO settings (key, value, category, description, updated_at) VALUES (?, ?, ?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value=?, category=?, description=?, updated_at=datetime('now')"
    ).bind(key, value, category, description, value, category, description).run();
  }

  async getSettingsByCategory(category) {
    const r = await this.db.prepare("SELECT key, value, description FROM settings WHERE category=?").bind(category).all();
    return r.results || [];
  }

  // === PROJECTS ===
  async getProjects() {
    const r = await this.db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all();
    return r.results || [];
  }

  async createProject(name, description = null) {
    const id = crypto.randomUUID();
    await this.db.prepare("INSERT INTO projects (id, name, description) VALUES (?, ?, ?)").bind(id, name, description).run();
    return { id, name, description };
  }

  // === TASKS ===
  async getTasks() {
    const r = await this.db.prepare("SELECT * FROM tasks ORDER BY created_at DESC").all();
    return r.results || [];
  }

  async createTask(title, description = null, priority = "medium", assignee = null, projectId = null) {
    const id = crypto.randomUUID();
    await this.db.prepare("INSERT INTO tasks (id, title, description, priority, assignee, project_id) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, title, description, priority, assignee, projectId).run();
    return { id, title };
  }

  // === GENERIC ===
  async query(sql, params = []) {
    const stmt = params.length > 0 ? this.db.prepare(sql).bind(...params) : this.db.prepare(sql);
    return await stmt.all();
  }

  async first(sql, params = []) {
    const stmt = params.length > 0 ? this.db.prepare(sql).bind(...params) : this.db.prepare(sql);
    return await stmt.first();
  }
}

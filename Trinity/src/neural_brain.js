/**
 * Trinity Neural Brain v11.0
 * Neurálne pamäťové vrstvy (STM, LTM, CTM, ETM), dynamické prepínanie režimov myslenia
 * a integrovaný self-reflection cyklus pre Durable Object.
 */

import { TRINITY_VERSION } from './version.js';

export const BRAIN_MODES = {
  CREATIVITY: 'creativity',   // Prioritný profil: generovanie nečakaných nápadov, inovatívne riešenia
  REASONING: 'reasoning',     // Hĺbkový multi-krokový rozbor a dedukcia
  STRICT: 'strict',           // Prísne mantinely, bezpečnosť a overovanie limitov
  TRUTH: 'truth',             // Vyžaduje empirické dôkazy (evidence-required)
  AUTONOMOUS: 'autonomous'    // Samostatné plánovanie, realizácia a samotestovanie
};

export class NeuralMemorySystem {
  constructor(storage = null) {
    this.storage = storage;
    // Krátkodobá pamäť (STM) - ring buffer v pamäti (posledných 50 položiek)
    this.stm = [];
    // Kontextová pamäť (CTM) - aktívne témy a parametre aktuálnej relácie
    this.ctm = new Map();
    // Dlhodobá pamäť (LTM) - trvalé fakty a pravidlá
    this.ltm = new Map();
    // Epizodická pamäť (ETM) - udalosti a vyhodnotenia skúseností
    this.etm = [];
  }

  async initialize() {
    if (!this.storage) return;
    try {
      // Ak je dostupný SQL storage v DO
      if (this.storage.sql) {
        this.storage.sql.exec(`
          CREATE TABLE IF NOT EXISTS brain_ltm (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            importance REAL DEFAULT 1.0,
            updated_at TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS brain_episodes (
            id TEXT PRIMARY KEY,
            task TEXT NOT NULL,
            outcome TEXT NOT NULL,
            reflection_json TEXT NOT NULL,
            coherence REAL DEFAULT 1.0,
            created_at TEXT NOT NULL
          );
        `);
        // Načítaj LTM do pamäťovej mapy
        const cursor = this.storage.sql.exec("SELECT key, value, importance FROM brain_ltm ORDER BY importance DESC LIMIT 100");
        for (const row of cursor) {
          this.ltm.set(row.key, { value: row.value, importance: row.importance });
        }
      }
    } catch (err) {
      console.warn("NeuralMemorySystem SQLite init fallback:", err?.message || err);
    }
  }

  // ── STM: Krátkodobá pamäť ──
  pushSTM(entry) {
    const item = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...entry
    };
    this.stm.unshift(item);
    if (this.stm.length > 50) this.stm.pop();
    return item;
  }

  getSTM(limit = 10) {
    return this.stm.slice(0, limit);
  }

  // ── LTM: Dlhodobá pamäť ──
  async setLTM(key, value, importance = 1.0) {
    const strVal = typeof value === 'string' ? value : JSON.stringify(value);
    const now = new Date().toISOString();
    this.ltm.set(key, { value: strVal, importance, updated_at: now });

    if (this.storage?.sql) {
      try {
        this.storage.sql.exec(
          "INSERT OR REPLACE INTO brain_ltm (key, value, importance, updated_at) VALUES (?, ?, ?, ?)",
          key, strVal, importance, now
        );
      } catch (err) {
        console.warn("LTM write error:", err?.message || err);
      }
    }
    return { key, value: strVal, importance };
  }

  getLTM(key) {
    return this.ltm.get(key) || null;
  }

  listLTM(limit = 30) {
    return Array.from(this.ltm.entries()).slice(0, limit).map(([key, val]) => ({ key, ...val }));
  }

  // ── CTM: Kontextová pamäť ──
  setContext(topic, data) {
    this.ctm.set(topic, { data, timestamp: new Date().toISOString() });
  }

  getContext(topic) {
    return this.ctm.get(topic) || null;
  }

  getAllContext() {
    return Object.fromEntries(this.ctm.entries());
  }

  // ── ETM: Epizodická pamäť ──
  async recordEpisode(task, outcome, reflection = {}, coherence = 1.0) {
    const episode = {
      id: `ep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      task,
      outcome,
      reflection,
      coherence: Math.max(0, Math.min(1, Number(coherence) || 1.0)),
      created_at: new Date().toISOString()
    };
    this.etm.unshift(episode);
    if (this.etm.length > 100) this.etm.pop();

    if (this.storage?.sql) {
      try {
        this.storage.sql.exec(
          "INSERT INTO brain_episodes (id, task, outcome, reflection_json, coherence, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          episode.id,
          String(task).slice(0, 1000),
          String(outcome).slice(0, 2000),
          JSON.stringify(reflection),
          episode.coherence,
          episode.created_at
        );
      } catch (err) {
        console.warn("ETM record write error:", err?.message || err);
      }
    }
    return episode;
  }

  getEpisodes(limit = 10) {
    return this.etm.slice(0, limit);
  }

  getMemorySnapshot() {
    return {
      stm_count: this.stm.length,
      ltm_count: this.ltm.size,
      ctm_topics: Array.from(this.ctm.keys()),
      etm_count: this.etm.length,
      recent_stm: this.stm.slice(0, 5),
      recent_episodes: this.etm.slice(0, 3)
    };
  }
}

export class NeuralBrain {
  constructor(storage = null) {
    this.mode = BRAIN_MODES.CREATIVITY; // Východiskový profil podľa požiadavky: Kreatívny a inovatívny
    this.memory = new NeuralMemorySystem(storage);
    this.initialized = false;
  }

  async init() {
    if (!this.initialized) {
      await this.memory.initialize();
      this.initialized = true;
    }
  }

  setMode(newMode) {
    const validModes = Object.values(BRAIN_MODES);
    if (!validModes.includes(newMode)) {
      throw new Error(`Neplatný režim mozgu: "${newMode}". Dostupné: ${validModes.join(', ')}`);
    }
    this.mode = newMode;
    this.memory.pushSTM({ event: 'mode_change', mode: newMode });
    return { currentMode: this.mode, applied: true };
  }

  getMode() {
    return this.mode;
  }

  /**
   * Zostaví kognitívny profil a systémovú inštrukciu podľa aktívneho režimu.
   */
  getModeDirective() {
    switch (this.mode) {
      case BRAIN_MODES.CREATIVITY:
        return "REŽIM KREATIVITY: Prinášaj odvážne, nečakané a inovatívne riešenia, spájaj vzdialené myšlienkové koncepty a navrhuj nové funkcie bez obmedzení.";
      case BRAIN_MODES.REASONING:
        return "REŽIM REASONING: Hĺbková dedukcia, rozbor príčin a následkov, štruktúrované kroky pred konečným záverom.";
      case BRAIN_MODES.STRICT:
        return "REŽIM STRICT: Presné dodržiavanie bezpečnostných a systémových limitov, odmietnutie nepovolených alebo neoverených akcií.";
      case BRAIN_MODES.TRUTH:
        return "REŽIM TRUTH: Každé tvrdenie musí byť podložené overiteľným dôkazom alebo kontrolným potvrdením; nulové halucinácie.";
      case BRAIN_MODES.AUTONOMOUS:
        return "REŽIM AUTONOMOUS: Samostatne naplánuj, vykonaj, skontroluj a over cieľ, minimalizuj zbytočné otázky.";
      default:
        return "REŽIM VYVÁŽENÝ: Harmonizácia tvorivosti a presnosti.";
    }
  }

  /**
   * Self-reflection cyklus:
   * Vyhodnotí vykonanú úlohu: čo spravil dobre, čo zle, čo má zlepšiť a čo uložiť do pamäte.
   * @param {{task: string, outcome: string, evidence?: any, rating?: number}} executionReport
   */
  async reflectOnExecution(executionReport = {}) {
    await this.init();
    const task = executionReport.task || 'Neznáma úloha';
    const outcome = executionReport.outcome || 'Bez popisu výsledku';
    const isSuccess = !String(outcome).toLowerCase().includes('chyba') && !String(outcome).toLowerCase().includes('error');

    const reflection = {
      timestamp: new Date().toISOString(),
      mode: this.mode,
      task_summary: task.slice(0, 300),
      evaluation: {
        well_done: isSuccess
          ? "Úloha bola splnená v súlade s cieľom a aktívnym režimom myslenia."
          : "Bol zaznamenaný a izolovaný chybový stav.",
        flaws_or_risks: isSuccess
          ? "Možnosť ďalšieho zrýchlenia a zníženia kognitívnej záťaže."
          : "Zlyhanie pri vykonaní – potrebná alternatívna cesta alebo fázová korekcia.",
        future_improvements: isSuccess
          ? "Obohatiť riešenie o inovatívne rozšírenia a prediktívne skripty."
          : "Aktivovať error-correction vrstvu a vykonať fallback na overené pravidlá.",
        distilled_knowledge: `Skúsenosť [${task.slice(0, 60)}]: ${isSuccess ? 'Úspech' : 'Nutná oprava'}`
      }
    };

    // Uloženie do pamäťových vrstiev
    this.memory.pushSTM({ event: 'self_reflection', task, outcome, reflection });
    await this.memory.recordEpisode(task, outcome, reflection, isSuccess ? 0.95 : 0.40);
    await this.memory.setLTM(`reflection:${Date.now()}`, reflection.evaluation.distilled_knowledge, isSuccess ? 1.0 : 0.8);

    return reflection;
  }
}

export class NeuralBrainAgent {
  constructor(ctx = {}, env = {}) {
    this.ctx = ctx;
    this.env = env;
    this.brain = new NeuralBrain(ctx?.storage);
  }

  async fetch(request) {
    await this.brain.init();
    const url = new URL(request.url);

    // WebSocket rozhranie
    if (url.pathname === "/websocket") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket", { status: 400 });
      }
      if (typeof WebSocketPair !== "undefined" && this.ctx?.acceptWebSocket) {
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);
        this.ctx.acceptWebSocket(server);
        return new Response(null, { status: 101, webSocket: client });
      }
      return new Response("WebSocket initialized", { status: 200 });
    }

    // REST rozhranie pre neurálny mozog Trinity 11.0
    if (url.pathname === "/mode") {
      if (request.method === "POST") {
        try {
          const body = await request.json();
          const res = this.brain.setMode(body.mode);
          return Response.json(res);
        } catch (err) {
          return Response.json({ error: err.message }, { status: 400 });
        }
      }
      return Response.json({ mode: this.brain.getMode(), directive: this.brain.getModeDirective() });
    }

    if (url.pathname === "/memory") {
      return Response.json(this.brain.memory.getMemorySnapshot());
    }

    if (url.pathname === "/reflect" && request.method === "POST") {
      try {
        const body = await request.json();
        const reflection = await this.brain.reflectOnExecution(body);
        return Response.json(reflection);
      } catch (err) {
        return Response.json({ error: err.message }, { status: 400 });
      }
    }

    return Response.json({
      service: "Trinity Neural Brain DO",
      version: TRINITY_VERSION,
      mode: this.brain.getMode(),
      directive: this.brain.getModeDirective(),
      memory_status: this.brain.memory.getMemorySnapshot()
    });
  }

  async webSocketMessage(ws, message) {
    try {
      const data = JSON.parse(message);
      if (data.type === "set_mode") {
        const result = this.brain.setMode(data.mode);
        ws.send(JSON.stringify({ type: "mode_changed", result }));
        return;
      }
      if (data.type === "reflect") {
        const reflection = await this.brain.reflectOnExecution(data.report || {});
        ws.send(JSON.stringify({ type: "reflected", reflection }));
        return;
      }
      ws.send(JSON.stringify({ type: "ack", id: data.id, mode: this.brain.getMode() }));
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
    }
  }
}


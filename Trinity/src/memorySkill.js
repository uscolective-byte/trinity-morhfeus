/**
 * @module TRINITY_OMNI_CORE
 * @subsystem MEMORY_AND_KNOWLEDGE_ENGINE
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Modul memorySkill.js (Trinity/src/memorySkill.js) v ekosystéme TRINITY OMNI-CORE.
 */
// src/memorySkill.js

export const memorySkills = {
  /**
   * Uloží nový príkaz natrvalo do Cloudflare D1 databázy
   * Formát v čete: !skill analyzuj = Sprav hĺbkový audit kódu a vypíš 3 riziká.
   */
  async learnFromChat(rawText, env) {
    if (!rawText || typeof rawText !== 'string') return null;
    const match = rawText.match(/^!skill\s+([a-zA-Z0-9_-]+)\s*=\s*(.*)$/is);
    if (!match) {
      return null;
    }

    const cmdName = match[1].toLowerCase().trim();
    const instructions = match[2].trim();

    if (!instructions) {
      throw new Error('Pokyn príkazu nesmie byť prázdny.');
    }
    if (['skill', 'zoznam', 'zlepsenie'].includes(cmdName)) {
      throw new Error(`Názov !${cmdName} je vyhradený pre zabudovaný príkaz. Zvoľ iný názov.`);
    }

    if (!env?.DB) {
      throw new Error('D1 databáza nie je k dispozícii pre uloženie príkazu.');
    }

    const write = await env.DB.prepare(
      `INSERT INTO trinity_commands (cmd_name, instructions, created_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(cmd_name) DO UPDATE SET
         instructions = excluded.instructions,
         created_at = datetime('now')`
    )
      .bind(cmdName, instructions)
      .run();

    if (write?.success === false) {
      throw new Error('Príkaz sa nepodarilo uložiť do D1 databázy.');
    }

    // Vyčistíme cache zoznamu príkazov
    const cache = env.CACHE || env.Mastermind || null;
    if (cache && typeof cache.delete === 'function') {
      try {
        await cache.delete("trinity:learned_commands");
      } catch (_) { }
    }

    // A successful request alone is not evidence that these instructions persisted.
    // Read D1 directly, bypassing KV, before the engine can issue a completed receipt.
    const stored = await env.DB.prepare(
      'SELECT instructions FROM trinity_commands WHERE cmd_name = ?'
    ).bind(cmdName).first();
    if (stored?.instructions !== instructions) {
      throw new Error('Uloženie príkazu sa nepodarilo overiť v D1 databáze. Skontroluj jeho aktuálny obsah.');
    }

    return {
      learned: true,
      command: `!${cmdName}`,
      instructions,
      message: `✅ Príkaz !${cmdName} bol natrvalo zapísaný do D1 databázy Trinity.`
    };
  },

  /**
   * Načíta všetky naučené príkazy z D1 (s rýchlou KV cache)
   */
  async getAllCommands(env) {
    if (!env?.DB) return [];

    const cache = env.CACHE || env.Mastermind || null;
    if (cache && typeof cache.get === 'function') {
      try {
        const cached = await cache.get("trinity:learned_commands", { type: "json" });
        if (cached) return cached;
      } catch (_) { }
    }

    const { results } = await env.DB.prepare(
      "SELECT cmd_name, instructions, created_at FROM trinity_commands ORDER BY cmd_name ASC"
    ).all();

    const commands = results || [];

    if (cache && typeof cache.put === 'function') {
      try {
        await cache.put("trinity:learned_commands", JSON.stringify(commands), {
          expirationTtl: 300
        });
      } catch (_) { }
    }

    return commands;
  },

  /**
   * Skontroluje, či správa v čete nevolá už naučený príkaz (napr. "!analyzuj tento text")
   */
  async resolveCustomCommand(rawText, env) {
    if (!rawText || typeof rawText !== 'string' || !rawText.startsWith("!")) return null;

    const parts = rawText.slice(1).trim().split(/\s+/);
    const cmdName = parts[0].toLowerCase();
    const userArgs = parts.slice(1).join(" ");

    if (cmdName === "zoznam") {
      const list = await this.getAllCommands(env);
      return {
        type: "list",
        commands: list,
        message: list.length > 0
          ? `Zoznam naučených príkazov Trinity (${list.length}):\n` + list.map(c => `• !${c.cmd_name}: ${c.instructions}`).join('\n')
          : "Zatiaľ nie sú uložené žiadne vlastné príkazy. Nový príkaz vytvoríš napríklad: !skill test = Skontroluj stav systému."
      };
    }

    if (!env?.DB) return null;

    const row = await env.DB.prepare(
      "SELECT instructions FROM trinity_commands WHERE cmd_name = ?"
    )
      .bind(cmdName)
      .first();

    if (!row) return null;

    return {
      type: "execute",
      command: `!${cmdName}`,
      instructions: row.instructions,
      expandedPrompt: `Vykonaj uložený postup [${cmdName}]: ${row.instructions}\n\nVstup od používateľa: ${userArgs || "(žiadny dodatočný vstup)"}`
    };
  }
};

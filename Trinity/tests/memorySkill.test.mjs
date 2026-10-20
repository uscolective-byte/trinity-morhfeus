import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memorySkills } from '../src/memorySkill.js';
import { runAgent } from '../src/engine.js';
import { skillRegistry } from '../src/skillRegistry.js';

function createMockMemoryDB() {
  const store = new Map();
  const cacheStore = new Map();

  const DB = {
    store,
    prepare(sql) {
      let params = [];
      return {
        bind(...args) {
          params = args;
          return this;
        },
        async run() {
          if (sql.includes('INSERT INTO trinity_commands')) {
            const [cmd_name, instructions] = params;
            store.set(cmd_name.toLowerCase(), {
              cmd_name: cmd_name.toLowerCase(),
              instructions,
              created_at: new Date().toISOString()
            });
            return { success: true };
          }
          return { success: true };
        },
        async first() {
          if (sql.includes('SELECT instructions FROM trinity_commands WHERE cmd_name = ?')) {
            const name = String(params[0]).toLowerCase();
            const found = store.get(name);
            return found ? { instructions: found.instructions } : null;
          }
          if (sql.includes('ops_plugins')) {
            return { installed: 1, enabled: 1 };
          }
          return null;
        },
        async all() {
          if (sql.includes('SELECT cmd_name, instructions, created_at FROM trinity_commands')) {
            const results = Array.from(store.values()).sort((a, b) => a.cmd_name.localeCompare(b.cmd_name));
            return { results };
          }
          return { results: [] };
        }
      };
    }
  };

  const CACHE = {
    cacheStore,
    async get(key) {
      return cacheStore.get(key) || null;
    },
    async put(key, value) {
      cacheStore.set(key, JSON.parse(value));
    },
    async delete(key) {
      cacheStore.delete(key);
    }
  };

  return { DB, CACHE };
}

test('memorySkills: learnFromChat ukladá príkaz do D1 a invaliduje cache', async () => {
  const env = createMockMemoryDB();
  const input = '!skill analyzuj = Sprav hĺbkový audit kódu a vypíš 3 riziká.';

  const res = await memorySkills.learnFromChat(input, env);
  assert.ok(res);
  assert.equal(res.learned, true);
  assert.equal(res.command, '!analyzuj');
  assert.equal(res.instructions, 'Sprav hĺbkový audit kódu a vypíš 3 riziká.');
  assert.ok(res.message.includes('✅ Príkaz !analyzuj bol natrvalo zapísaný'));

  // Overenie v D1
  const stored = env.DB.store.get('analyzuj');
  assert.ok(stored);
  assert.equal(stored.instructions, 'Sprav hĺbkový audit kódu a vypíš 3 riziká.');

  // Neplatný formát vráti null
  assert.equal(await memorySkills.learnFromChat('Ahoj Trinity', env), null);
  assert.equal(await memorySkills.learnFromChat('!skill', env), null);
});

test('memorySkills: getAllCommands s KV cache a načítaním z D1', async () => {
  const env = createMockMemoryDB();
  await memorySkills.learnFromChat('!skill test1 = Pokyn 1', env);
  await memorySkills.learnFromChat('!skill test2 = Pokyn 2', env);

  // Prvýkrát ide do DB a naplní cache
  const list = await memorySkills.getAllCommands(env);
  assert.equal(list.length, 2);
  assert.equal(list[0].cmd_name, 'test1');
  assert.equal(list[1].cmd_name, 'test2');

  // Cache je naplnená
  assert.ok(env.CACHE.cacheStore.has('trinity:learned_commands'));

  // Druhýkrát číta z cache
  const cachedList = await memorySkills.getAllCommands(env);
  assert.equal(cachedList.length, 2);
});

test('memorySkills: resolveCustomCommand rozoznáva !zoznam a vlastné príkazy', async () => {
  const env = createMockMemoryDB();
  await memorySkills.learnFromChat('!skill scan = Vyhľadaj bezpečnostné zraniteľnosti.', env);

  // 1. Zoznam
  const listRes = await memorySkills.resolveCustomCommand('!zoznam', env);
  assert.ok(listRes);
  assert.equal(listRes.type, 'list');
  assert.ok(listRes.message.includes('!scan'));

  // 2. Vlastný príkaz s argumentmi
  const execRes = await memorySkills.resolveCustomCommand('!scan index.js --strict', env);
  assert.ok(execRes);
  assert.equal(execRes.type, 'execute');
  assert.equal(execRes.command, '!scan');
  assert.ok(execRes.expandedPrompt.includes('Vykonaj uložený postup [scan]: Vyhľadaj bezpečnostné zraniteľnosti.'));
  assert.ok(execRes.expandedPrompt.includes('Vstup od používateľa: index.js --strict'));

  // 3. Neznámy príkaz
  const unknownRes = await memorySkills.resolveCustomCommand('!neexistuje', env);
  assert.equal(unknownRes, null);

  // 4. Bežná správa bez !
  const normalRes = await memorySkills.resolveCustomCommand('Bežný dotaz', env);
  assert.equal(normalRes, null);
});

test('memorySkills: integrácia do runAgent (učenie v čete a volanie !zoznam)', async () => {
  const env = createMockMemoryDB();

  // Test učenia priamo cez runAgent
  const agentLearnRes = await runAgent(env, 'orchestrator', '!skill rychly_plan = Vytvor 3-bodový plán implementácie.');
  assert.ok(agentLearnRes.text.includes('✅ Príkaz !rychly_plan bol natrvalo zapísaný'));
  assert.equal(agentLearnRes.model, 'deterministic-memory');

  // Test !zoznam priamo cez runAgent
  const agentListRes = await runAgent(env, 'orchestrator', '!zoznam');
  assert.ok(agentListRes.text.includes('Zoznam naučených príkazov Trinity'));
  assert.ok(agentListRes.text.includes('!rychly_plan'));
  assert.equal(agentListRes.model, 'deterministic-memory');
});

test('memorySkills: integrácia do SkillRegistry', async () => {
  assert.ok(skillRegistry.has('learnFromChat'));
  assert.ok(skillRegistry.has('getAllCommands'));
  assert.ok(skillRegistry.has('resolveCustomCommand'));

  const all = skillRegistry.list();
  const learn = all.find(s => s.name === 'learnFromChat');
  assert.ok(learn);
  assert.equal(learn.category, 'memory');
});

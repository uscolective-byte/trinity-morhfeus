#!/usr/bin/env node
/**
 * ✦ TRINITY GEMINI LOCAL DEVELOPER CHAT
 * 
 * Interaktívny terminálový agent pre vývoj a správu ekosystému TRINITY
 * priamo cez Google Gemini s nástrojmi (Function Calling) napojenými na Trinity.
 * 
 * Funkcie:
 * - Obojsmerná konverzácia v slovenskom jazyku
 * - Autonómne spúšťanie testov (npm test)
 * - Čítanie a zápis súborov Trinity (s ochranou tokenov a tajomstiev)
 * - Kontrola health pre https://auru.space (prod) a https://auru.dev (dev)
 * - Lokálny gateway http://127.0.0.1:8791
 * - Build a bezpečný deploy s commit tagom cez Wrangler
 * - Git status, commit a push
 * - Priame prepojenie na Trinity Worker API a Copilot / Azure OpenAI
 */

import readline from 'node:readline';
import { exec, execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const TRINITY_DIR = path.join(ROOT_DIR, 'Trinity');

// ANSI Farby pre štýlový terminál
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m'
};

// Získanie API kľúča (priorita: ENV -> .dev.vars)
function getGeminiApiKey() {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5) {
    return process.env.GEMINI_API_KEY;
  }
  const devVarsPath = path.join(TRINITY_DIR, '.dev.vars');
  if (fs.existsSync(devVarsPath)) {
    try {
      const content = fs.readFileSync(devVarsPath, 'utf8');
      const match = content.match(/GEMINI_API_KEY\s*=\s*([^\r\n]+)/);
      if (match && match[1].trim()) {
        return match[1].trim();
      }
    } catch {
      // Ignoruj chybu čítania
    }
  }
  return null;
}

let activeApiKey = getGeminiApiKey();

// Zoznam nástrojov poskytovaných pre Gemini (Function Declarations)
const GEMINI_TOOLS_DECLARATIONS = [
  {
    name: 'trinity_health',
    description: 'Skontroluje stav a health Trinity serverov (produkcia auru.space, vývoj auru.dev a lokálna brána).',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: []
    }
  },
  {
    name: 'run_tests',
    description: 'Spustí kompletnú testovaciu sadu (npm test) v priečinku Trinity a vráti výsledok.',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: []
    }
  },
  {
    name: 'build_trinity',
    description: 'Zostaví Worker pre vývoj (development) alebo produkciu (production).',
    parameters: {
      type: 'OBJECT',
      properties: {
        environment: {
          type: 'STRING',
          description: 'Cieľové prostredie: "development" alebo "production"'
        }
      },
      required: ['environment']
    }
  },
  {
    name: 'read_code_file',
    description: 'Bezpečne načíta obsah zdrojového súboru Trinity. Z bezpečnostných dôvodov odmieta čítanie súborov s tajomstvami (.env, .credentials).',
    parameters: {
      type: 'OBJECT',
      properties: {
        file_path: {
          type: 'STRING',
          description: 'Relatívna cesta k súboru v rámci projektu, napr. "Trinity/src/index.js"'
        },
        start_line: {
          type: 'INTEGER',
          description: 'Voliteľný počiatočný riadok (1-indexed)'
        },
        end_line: {
          type: 'INTEGER',
          description: 'Voliteľný koncový riadok (1-indexed)'
        }
      },
      required: ['file_path']
    }
  },
  {
    name: 'write_code_file',
    description: 'Bezpečne zapíše alebo upraví obsah súboru v rámci projektu Trinity.',
    parameters: {
      type: 'OBJECT',
      properties: {
        file_path: {
          type: 'STRING',
          description: 'Relatívna cesta k súboru, napr. "Trinity/src/my-agent.js"'
        },
        content: {
          type: 'STRING',
          description: 'Nový obsah súboru'
        }
      },
      required: ['file_path', 'content']
    }
  },
  {
    name: 'list_directory',
    description: 'Zobrazí zoznam súborov a priečinkov v zadanej ceste projektu.',
    parameters: {
      type: 'OBJECT',
      properties: {
        dir_path: {
          type: 'STRING',
          description: 'Relatívna cesta k priečinku (predvolene ".")'
        }
      },
      required: []
    }
  },
  {
    name: 'git_status',
    description: 'Zistí aktuálny stav vetvy a zmenených súborov cez Git.',
    parameters: {
      type: 'OBJECT',
      properties: {},
      required: []
    }
  },
  {
    name: 'git_commit',
    description: 'Vytvorí Git commit so zadanou správou.',
    parameters: {
      type: 'OBJECT',
      properties: {
        message: {
          type: 'STRING',
          description: 'Správa commitu v slovenčine'
        }
      },
      required: ['message']
    }
  },
  {
    name: 'deploy_trinity',
    description: 'Nasadí Trinity Worker cez Wrangler na vývoj (development: auru.dev) alebo produkciu (production: auru.space) s tagom Git commitu.',
    parameters: {
      type: 'OBJECT',
      properties: {
        environment: {
          type: 'STRING',
          description: 'Cieľ: "development" alebo "production"'
        }
      },
      required: ['environment']
    }
  },
  {
    name: 'ask_trinity',
    description: 'Odošle priamy dotaz Trinity agentovi alebo Copilotu cez cloud/lokálny endpoint.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'Text dotazu pre Trinity'
        },
        agent: {
          type: 'STRING',
          description: 'Názov agenta alebo skillu (napr. "copilot", "gemini-developer")'
        }
      },
      required: ['query']
    }
  }
];

// Implementácie nástrojov (Tools Execution Handlers)
const toolHandlers = {
  async trinity_health() {
    const results = {};
    const endpoints = [
      { name: 'production (auru.space)', url: 'https://auru.space/health' },
      { name: 'development (auru.dev)', url: 'https://auru.dev/health' },
      { name: 'local_gateway (127.0.0.1:8791)', url: 'http://127.0.0.1:8791/health' }
    ];

    for (const ep of endpoints) {
      try {
        const resp = await fetch(ep.url, { signal: AbortSignal.timeout(4000) });
        const text = await resp.text();
        let parsed = text;
        try { parsed = JSON.parse(text); } catch {}
        results[ep.name] = { status: resp.status, ok: resp.ok, data: parsed };
      } catch (err) {
        results[ep.name] = { ok: false, error: err.message };
      }
    }
    return results;
  },

  async run_tests() {
    try {
      const { stdout, stderr } = await execAsync('npm test', { cwd: TRINITY_DIR, timeout: 120000 });
      return { success: true, output: (stdout + '\n' + stderr).slice(-2000) };
    } catch (err) {
      return { success: false, error: err.message, output: (err.stdout + '\n' + err.stderr).slice(-2000) };
    }
  },

  async build_trinity({ environment }) {
    if (!['development', 'production'].includes(environment)) return { success: false, error: 'Choose development or production explicitly.' };
    const isDev = environment === 'development';
    const cmd = isDev ? 'npm run build:development' : 'npm run build';
    try {
      const { stdout, stderr } = await execAsync(cmd, { cwd: TRINITY_DIR, timeout: 60000 });
      return { success: true, environment, output: stdout.slice(-1000) };
    } catch (err) {
      return { success: false, environment, error: err.message, output: err.stdout?.slice(-1000) };
    }
  },

  async read_code_file({ file_path, start_line, end_line }) {
    const cleanPath = path.normalize(file_path);
    const forbidden = ['.env', '.credentials', '.dev.vars', 'id_rsa', 'secret'];
    if (forbidden.some(f => cleanPath.toLowerCase().includes(f))) {
      return { success: false, error: `Prístup k súboru '${file_path}' je zablokovaný z dôvodu ochrany tajomstiev.` };
    }
    const fullPath = path.resolve(ROOT_DIR, cleanPath);
    if ((path.relative(ROOT_DIR, fullPath).startsWith('..') || path.isAbsolute(path.relative(ROOT_DIR, fullPath)))) {
      return { success: false, error: 'Nepovolený prístup mimo koreňového adresára.' };
    }
    if (!fs.existsSync(fullPath)) {
      return { success: false, error: `Súbor '${file_path}' neexistuje.` };
    }
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      const start = Math.max(1, start_line || 1);
      const end = Math.min(lines.length, end_line || lines.length);
      const selected = lines.slice(start - 1, end).join('\n');
      return { success: true, file_path, total_lines: lines.length, start_line: start, end_line: end, content: selected };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async write_code_file({ file_path, content }) {
    const cleanPath = path.normalize(file_path);
    const forbidden = ['.env', '.credentials', '.dev.vars', 'id_rsa', 'secret'];
    if (forbidden.some(f => cleanPath.toLowerCase().includes(f))) {
      return { success: false, error: `Zápis do '${file_path}' je zablokovaný z dôvodu ochrany tajomstiev.` };
    }
    const fullPath = path.resolve(ROOT_DIR, cleanPath);
    if ((path.relative(ROOT_DIR, fullPath).startsWith('..') || path.isAbsolute(path.relative(ROOT_DIR, fullPath)))) {
      return { success: false, error: 'Nepovolený prístup mimo koreňového adresára.' };
    }
    try {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf8');
      return { success: true, file_path, bytes_written: Buffer.byteLength(content, 'utf8') };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async list_directory({ dir_path = '.' }) {
    const targetDir = path.resolve(ROOT_DIR, dir_path);
    if ((path.relative(ROOT_DIR, targetDir).startsWith('..') || path.isAbsolute(path.relative(ROOT_DIR, targetDir)))) {
      return { success: false, error: 'Cesta je mimo repozitára.' };
    }
    try {
      const items = fs.readdirSync(targetDir, { withFileTypes: true });
      return {
        success: true,
        directory: dir_path,
        items: items.map(it => ({
          name: it.name,
          type: it.isDirectory() ? 'directory' : 'file'
        }))
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async git_status() {
    try {
      const { stdout } = await execAsync('git status -s && git branch --show-current', { cwd: ROOT_DIR });
      return { success: true, status: stdout.trim() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async git_commit({ message }) {
    try {
      await execAsync('git add -A', { cwd: ROOT_DIR });
      const { stdout } = await execFileAsync('git', ['commit', '-m', String(message)], { cwd: ROOT_DIR });
      return { success: true, output: stdout.trim() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async deploy_trinity({ environment }) {
    if (!['development', 'production'].includes(environment)) return { success: false, error: 'Choose development or production explicitly.' };
    const isDev = environment === 'development';
    try {
      const { stdout: commitHash } = await execAsync('git rev-parse HEAD', { cwd: ROOT_DIR });
      const tag = commitHash.trim();
      const cmd = `npm run ${isDev ? 'deploy:development' : 'deploy'} -- --tag ${tag}`;
      const { stdout, stderr } = await execAsync(cmd, { cwd: TRINITY_DIR, timeout: 90000 });
      return {
        success: true,
        environment,
        tag,
        output: (stdout + '\n' + stderr).slice(-1000)
      };
    } catch (err) {
      return { success: false, environment, error: err.message };
    }
  },

  async ask_trinity({ query, agent = 'copilot' }) {
    const baseUrl = 'https://auru.dev';
    try {
      const resp = await fetch(`${baseUrl}/api/copilot/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, agent }),
        signal: AbortSignal.timeout(10000)
      });
      const data = await resp.json().catch(() => null);
      return { success: resp.ok, status: resp.status, response: data };
    } catch (err) {
      return { success: false, error: `Spojenie so vzdialenou Trinity zlyhalo: ${err.message}` };
    }
  }
};

// Volanie Google Gemini API s nástrojmi (Function Calling)
async function callGemini(conversationHistory, apiKey) {
  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const systemInstruction = {
    parts: [
      {
        text: `Si TRINITY GEMINI DEVELOPER AGENT. Tvojou úlohou je pomáhať vývojárovi priamo vyvíjať, testovať, debugovať a nasadzovať systém Trinity na lokálnom počítači aj v cloude (Cloudflare Workers).
Komunikuj striktne v slovenskom jazyku.
Máš prístup k nástrojom:
- trinity_health: skontroluj dostupnosť prod (auru.space), dev (auru.dev) a lokálneho servera
- run_tests: spusti npm test a analyzuj výstup
- build_trinity: zostav vývojovú alebo produkčnú verziu
- read_code_file: prečítaj kód
- write_code_file: zapíš kód do súborov
- list_directory: pozri súbory v priečinku
- git_status, git_commit: spravuj git verzie
- deploy_trinity: bezpečne nasaď s tagom commitu
- ask_trinity: pošli dotaz priamo bežiacemu Trinity Copilotu

Ak ťa používateľ požiada o úpravu kódu, overenie funkčnosti, testovanie alebo nasadenie, autonómne použi zodpovedajúce nástroje, over výsledok a zrozumiteľne informuj používateľa. Nikdy neodhaľuj tajomstvá ani tokeny.`
      }
    ]
  };

  const payload = {
    system_instruction: systemInstruction,
    contents: conversationHistory,
    tools: [
      {
        function_declarations: GEMINI_TOOLS_DECLARATIONS
      }
    ]
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini API HTTP ${resp.status}: ${errText.slice(0, 400)}`);
  }

  return await resp.json();
}

// Hlavná interaktívna slučka
async function main() {
  console.log(`\n${C.bold}${C.cyan}╔══════════════════════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.cyan}║   ✦ TRINITY GEMINI DEVELOPER AGENT & WORKSPACE CHAT            ║${C.reset}`);
  console.log(`${C.bold}${C.cyan}║   Vývoj, testovanie a nasadzovanie Trinity priamo cez Gemini     ║${C.reset}`);
  console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════════════════════════════════╝${C.reset}\n`);

  console.log(`${C.yellow}Lokálny koreň projektu:${C.reset} ${ROOT_DIR}`);
  console.log(`${C.yellow}Trinity Worker cesta:${C.reset}  ${TRINITY_DIR}`);

  if (activeApiKey) {
    console.log(`${C.green}✔ Gemini API kľúč detegovaný a pripravený.${C.reset}`);
  } else {
    console.log(`${C.yellow}⚠ GEMINI_API_KEY nie je nastavený.${C.reset}`);
    console.log(`  Môžeš zadať kľúč priamo, alebo použiť príkazy:`);
    console.log(`  ${C.bold}/health${C.reset}  - overí stav Trinity`);
    console.log(`  ${C.bold}/test${C.reset}    - spustí npm test`);
    console.log(`  ${C.bold}/build${C.reset}   - zostaví projekt`);
    console.log(`  ${C.bold}/deploy${C.reset}  - nasadí na dev/prod`);
    console.log(`  ${C.bold}/key <KLUC>${C.reset} - nastaví Gemini kľúč pre toto sedenie\n`);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${C.bold}${C.magenta}Gemini> ${C.reset}`
  });

  const conversationHistory = [];

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    if (input === '/exit' || input === 'exit' || input === 'koniec') {
      console.log(`\n${C.green}Dovidenia! TRINITY Developer Chat ukončený.${C.reset}\n`);
      process.exit(0);
    }

    // Lokálne rýchle príkazy
    if (input.startsWith('/key ')) {
      const key = input.replace('/key ', '').trim();
      activeApiKey = key;
      console.log(`${C.green}✔ Gemini API kľúč nastavený pre toto sedenie.${C.reset}`);
      rl.prompt();
      return;
    }

    if (input === '/health') {
      console.log(`${C.cyan}Preverujem stav Trinity serverov...${C.reset}`);
      const h = await toolHandlers.trinity_health();
      console.log(JSON.stringify(h, null, 2));
      rl.prompt();
      return;
    }

    if (input === '/test') {
      console.log(`${C.cyan}Spúšťam npm test v Trinity...${C.reset}`);
      const t = await toolHandlers.run_tests();
      console.log(t.output || t.error);
      rl.prompt();
      return;
    }

    if (input === '/build') {
      console.log(`${C.cyan}Zostavujem vývojovú verziu...${C.reset}`);
      const b = await toolHandlers.build_trinity({ environment: 'development' });
      console.log(b.output || b.error);
      rl.prompt();
      return;
    }

    if (input === '/status') {
      const s = await toolHandlers.git_status();
      console.log(s.status || s.error);
      rl.prompt();
      return;
    }

    if (!activeApiKey) {
      console.log(`${C.red}Chyba: Pre voľnú konverzáciu a autonómne nástroje zadaj Gemini API kľúč:${C.reset}`);
      console.log(`Zadaj príkaz: ${C.bold}/key AIzaSy...${C.reset} alebo nastav premennú GEMINI_API_KEY v systéme.`);
      rl.prompt();
      return;
    }

    // Pridaj požiadavku používateľa do histórie
    conversationHistory.push({
      role: 'user',
      parts: [{ text: input }]
    });

    try {
      process.stdout.write(`${C.dim}✦ Gemini premýšľa...${C.reset}\r`);
      let keepRunning = true;
      let turns = 0;

      while (keepRunning && turns < 6) {
        turns++;
        const responseData = await callGemini(conversationHistory, activeApiKey);
        const candidate = responseData?.candidates?.[0];
        const content = candidate?.content;

        if (!content || !content.parts) {
          console.log(`${C.red}Odpoveď od Gemini bola prázdna.${C.reset}`);
          break;
        }

        // Zaznamenaj model response do histórie
        conversationHistory.push(content);

        // Hľadaj function calls
        const functionCalls = content.parts.filter(p => p.functionCall);

        if (functionCalls.length > 0) {
          const functionResponses = [];
          for (const fc of functionCalls) {
            const { name, args } = fc.functionCall;
            console.log(`\n${C.yellow}⚙ Spúšťam nástroj:${C.reset} ${C.bold}${name}${C.reset}(${JSON.stringify(args || {})})`);
            
            let result;
            if (toolHandlers[name]) {
              try {
                result = await toolHandlers[name](args || {});
              } catch (e) {
                result = { success: false, error: e.message };
              }
            } else {
              result = { success: false, error: `Neznámy nástroj '${name}'` };
            }

            console.log(`${C.green}✔ Výsledok nástroja ${name}:${C.reset} ${JSON.stringify(result).slice(0, 160)}...`);

            functionResponses.push({
              functionResponse: {
                name,
                response: { output: result }
              }
            });
          }

          // Pošli výsledky funkcií späť do Gemini
          conversationHistory.push({
            role: 'user',
            parts: functionResponses
          });
        } else {
          // Normálna textová odpoveď
          const text = content.parts.map(p => p.text || '').join('\n');
          console.log(`\n${C.bold}${C.cyan}Trinity Gemini Agent:${C.reset}\n${text}\n`);
          keepRunning = false;
        }
      }
    } catch (err) {
      console.log(`\n${C.red}Chyba komunikácie s Gemini:${C.reset} ${err.message}`);
    }

    rl.prompt();
  });
}

main().catch(err => {
  console.error('Kritická chyba:', err);
  process.exit(1);
});

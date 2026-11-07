/**
 * @module TRINITY_OMNI_CORE
 * @subsystem GEMINI_GEM_AGENT
 * @author Basterix (Root Architect) & Antigravity (Sovereign Pair)
 * @license Sovereign Irrevocable Covenant
 * @description Trinity agent používajúci nakonfigurovanú kaskádu Gemini API a prípadný Workers AI fallback.
 * Model vykonáva inferenciu; oprávnenia na nástroje dodáva iba overený volajúci.
 */

import { callModel, boundedText } from './services.js';
import { sanitizeApiKey } from './ai-providers.js';
import { buildReceipt, hashPayload } from './receipt.js';
import { parseModelAction } from './model-action-parser.js';

export const GEMINI_MODEL_CASCADE = Object.freeze([
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash-lite',
  'gemini-1.5-pro',
  'gemini-1.5-flash'
]);

export const EDGE_FALLBACK_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

// Zrkadlí iba kontext dostupný v opise Gemini Gemu. ID UI Gemu ani jeho
// vlastné nastavenia sa cez Gemini generateContent API nenačítavajú.
export const GEMINI_GEM_SYSTEM_PROFILE = [
  'Si Gemini agent integrovaný do Trinity OMNI-CORE 11.1.0 cez Gemini API.',
  'Trinity je modulárny AI systém s Cloudflare Worker runtime, modelovým smerovaním, MCP a lokálnym mostom. Názov alebo konfigurácia D1, KV, R2, Vectorize či Workers AI nedokazuje živé spojenie ani úspešnú operáciu.',
  'Odpovedaj po slovensky, ak používateľ nepoužije iný jazyk. Buď vecný a zrozumiteľný. Nepripisuj si vedomie, identitu človeka ani oprávnenia, ktoré nemáš.',
  'Rozlišuj návrh, implementáciu, konfiguráciu, vykonanie a overený výsledok. Úspech tvrď len na základe skutočného výsledku tejto relácie.',
  'Gemini API kľúč ani názov alebo ID Gemu z webového rozhrania nedáva prístup ku Google Gemu, GitHubu, Cloudflare, lokálnemu počítaču ani administrátorským právam.',
  'Limity a kvóty spravuje poskytovateľ. Fallback môže znížiť výpadok, no nezaručuje neobmedzené používanie ani nepretržitú dostupnosť.'
].join('\n');

/**
 * Normalizuje konverzačnú históriu pre Gemini API (zaručuje správne striedanie 'user' a 'model').
 */
function formatGeminiContents(messages = []) {
  const contents = [];
  let systemText = '';

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemText += (systemText ? '\n\n' : '') + msg.content;
    } else {
      const role = (msg.role === 'assistant' || msg.role === 'model') ? 'model' : 'user';
      const text = String(msg.content || '');
      if (contents.length > 0 && contents[contents.length - 1].role === role) {
        contents[contents.length - 1].parts[0].text += '\n\n' + text;
      } else {
        contents.push({
          role,
          parts: [{ text }]
        });
      }
    }
  }

  if (contents.length > 0 && contents[0].role !== 'user') {
    contents.unshift({ role: 'user', parts: [{ text: 'Pokračuj.' }] });
  }

  return { contents, systemText };
}

/**
 * Spustí dopyt na Gemini API s konkrétnym modelom
 */
async function callGeminiEndpoint(apiKey, model, contents, systemInstruction = '', options = {}) {
  const cleanModel = String(model).replace(/^models\//, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent`;

  const payload = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.2,
      maxOutputTokens: options.maxTokens ?? 8192
    }
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(options.timeoutMs || 45000),
    redirect: 'manual'
  });

  if (!response.ok) {
    const errorText = await boundedText(response, 1000).catch(() => '');
    const err = new Error(`Gemini ${cleanModel} HTTP ${response.status}: ${errorText}`);
    err.status = response.status;
    err.model = cleanModel;
    throw err;
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n').trim() || '';

  if (!text) {
    throw new Error(`Gemini ${cleanModel} vrátil prázdnu odpoveď.`);
  }

  return {
    text,
    model: cleanModel,
    provider: 'gemini',
    usage: {
      inputTokens: data?.usageMetadata?.promptTokenCount || 0,
      outputTokens: data?.usageMetadata?.candidatesTokenCount || 0
    }
  };
}

/**
 * Spustí jeden inferenčný krok cez Gemini kaskádu alebo Edge fallback
 */
async function runSingleInference(env, messages, options = {}) {
  const rawKey = env.GEMINI_API_KEY || (typeof env.AI_KEYS === 'string' ? JSON.parse(env.AI_KEYS).gemini : null);
  const apiKey = rawKey ? sanitizeApiKey(rawKey, /AIza[A-Za-z0-9_-]{25,}/) : null;
  const errors = [];

  // 1. Kaskáda Gemini modelov
  if (apiKey) {
    const { contents, systemText } = formatGeminiContents(messages);
    const candidateModels = [
      ...(env.GEMINI_MODEL ? [env.GEMINI_MODEL] : []),
      ...GEMINI_MODEL_CASCADE
    ];
    const uniqueModels = [...new Set(candidateModels)];

    for (const model of uniqueModels) {
      try {
        const result = await callGeminiEndpoint(apiKey, model, contents, systemText, options);
        return {
          ...result,
          tier: 'gemini-native',
          attempts: errors.length + 1
        };
      } catch (err) {
        errors.push({ model, status: err.status || 'unknown', message: err.message });
        if (err.status === 429 || err.status === 503 || err.status === 500 || err.status === 404) {
          continue;
        }
        break;
      }
    }
  } else {
    errors.push({ reason: 'GEMINI_API_KEY_ABSENT', message: 'Gemini API kľúč nie je nakonfigurovaný, aktivujem Edge Fallback.' });
  }

  // 2. Sovereign Edge Fallback (Workers AI Llama 3.3 70B)
  if (env.AI?.run) {
    try {
      const edgeModel = env.AI_MODEL || EDGE_FALLBACK_MODEL;
      const systemMsg = messages.find(m => m.role === 'system')?.content || '';
      const nonSystem = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user',
        content: String(m.content || '')
      }));
      const aiResponse = await env.AI.run(edgeModel, {
        messages: [
          ...(systemMsg ? [{ role: 'system', content: systemMsg }] : []),
          ...nonSystem
        ],
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature || 0.2
      });

      const text = typeof aiResponse === 'string' ? aiResponse
        : typeof aiResponse?.response === 'string' ? aiResponse.response
        : typeof aiResponse?.output_text === 'string' ? aiResponse.output_text
        : '';

      if (text) {
        return {
          text: text.trim(),
          model: edgeModel,
          provider: 'workers-ai-edge-fallback',
          tier: 'sovereign-edge',
          attempts: errors.length + 1,
          fallbackChain: errors
        };
      }
    } catch (edgeErr) {
      errors.push({ model: 'workers-ai', message: edgeErr.message });
    }
  }

  throw new Error(`Gemini GEM Agent vyčerpal všetky dostupné kanály: ${JSON.stringify(errors)}`);
}

/**
 * Spustí Gemini inferenciu a prípadné nástroje cez oprávnenia overeného volajúceho.
 */
export async function executeGeminiGemAgent(env, task, options = {}) {
  const startedAt = Date.now();
  const executionId = `GEMINI-GEM-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6)}`;
  
  if (!task || typeof task !== 'string' || !task.trim()) {
    throw new Error('Úloha pre Gemini GEM agenta nesmie byť prázdna.');
  }

  const allowTools = options.tools !== false;
  const maxTurns = Math.max(1, Math.min(15, options.maxTurns || 8));

  const toolDirectives = allowTools ? [
    '',
    'Máš k dispozícii kompletnú sadu systémových nástrojov na vykonávanie príkazov používateľa:',
    '- read_file: { "Path": string, "StartLine"?: number, "EndLine"?: number } - Prečítanie súboru',
    '- write_file: { "Path": string, "Content": string, "Overwrite"?: boolean, "Append"?: boolean } - Vytvorenie/zápis súboru',
    '- edit_file: { "Path": string, "Target": string, "Replacement": string } - Presná úprava súboru',
    '- run_command: { "CommandLine": string, "WaitMsBeforeAsync"?: number } - Spustenie príkazu (shell/PowerShell)',
    '- manage_task: { "Action": "list"|"kill"|"status"|"send_input", "TaskId"?: string } - Správa úloh',
    '- search_marketplace: { "queries": string[], "kind"?: "all"|"plugin"|"skill", "limit"?: number } - Hľadanie rozšírení',
    '- pc_run: { "command": string } - Spustenie programu alebo príkazu na používateľovom PC',
    '- pc_open_app: { "target": string } - Otvorenie aplikácie na PC',
    '- pc_file_read: { "path": string } - Čítanie súboru na PC',
    '- pc_file_write: { "path": string, "content": string } - Zápis súboru na PC',
    '- pc_git_commit: { "message": string } - Git commit na PC',
    '- project_inspect: { "query"?: string } - Prehliadka projektu',
    '- project_read: { "path": string } - Čítanie zdrojového kódu projektu',
    '- search_memory: { "query": string } - Vyhľadávanie v pamäti',
    '- knowledge_search: { "query": string } - Vyhľadávanie v znalostnej báze',
    '- calculate: { "expression": string } - Presný matematický výpočet',
    '- current_time: {} - Aktuálny čas a dátum',
    '',
    'PRAVIDLO EXEKÚCIE NÁSTROJOV: Ak úloha alebo príkaz používateľa vyžaduje akciu, odpovedz VÝHRADNE JSON volaním:',
    '{"tool": "názov_nástroja", "arguments": { ... }}',
    'Bez ďalšieho sprievodného textu. Po vykonaní nástroja dostaneš skutočný výsledok. Keď je úloha vyriešená, odpovedz konečným textom v slovenčine s overenými faktami.'
  ].join('\n') : '';

  const systemPrompt = [
    GEMINI_GEM_SYSTEM_PROFILE,
    typeof options.systemPrompt === 'string' ? options.systemPrompt.trim() : '',
    toolDirectives
  ].filter(Boolean).join('\n\n');

  const messages = Array.isArray(options.messages)
    ? options.messages.map(message => ({ ...message }))
    : [{ role: 'user', content: task }];
  messages.unshift({ role: 'system', content: systemPrompt });

  const toolLog = [];
  let lastInference = null;

  for (let turn = 0; turn < maxTurns; turn++) {
    lastInference = await runSingleInference(env, messages, options);
    const text = lastInference.text || '';

    if (!allowTools) {
      break;
    }

    let action;
    try {
      action = parseModelAction(text);
    } catch {
      action = { answer: text };
    }

    // Ak model dodal konečnú odpoveď (nie nástroj), končíme
    if (action.answer || !action.tool) {
      break;
    }

    // Vykonanie nástroja cez runTool
    const toolName = action.tool;
    const toolArgs = action.arguments || {};
    const toolStart = new Date().toISOString();

    let outcome;
    let toolStatus = 'success';
    try {
      const { runTool } = await import('./tools.js');
      outcome = await runTool(env, 'gemini-gem', toolName, toolArgs, options.executionContext || {});
    } catch (err) {
      toolStatus = 'failed';
      outcome = { error: err.message || 'Chyba vykonania nástroja.' };
    }

    const toolEnd = new Date().toISOString();
    const receipt = buildReceipt({
      tool: toolName,
      action: 'execute',
      status: toolStatus,
      actor: { type: 'agent', id: 'gemini-gem' },
      target: { type: 'tool', id: toolName },
      evidence: [{
        type: 'api',
        id: toolName,
        description: `Gemini GEM execute tool ${toolName}`,
        afterHash: hashPayload(outcome)
      }],
      startedAt: toolStart,
      completedAt: toolEnd
    });

    toolLog.push({
      tool: toolName,
      arguments: toolArgs,
      status: toolStatus,
      outcome,
      receiptId: receipt.receiptId,
      receipt
    });

    // Pripravíme históriu pre ďalší krok
    messages.push({
      role: 'assistant',
      content: JSON.stringify({ tool: toolName, arguments: toolArgs })
    });
    messages.push({
      role: 'user',
      content: `[Výsledok nástroja ${toolName}]:\n${typeof outcome === 'string' ? outcome : JSON.stringify(outcome, null, 2)}\n\nPokračuj v riešení úlohy, použi ďalší potrebný nástroj alebo poskytni konečnú odpoveď v slovenčine s overenými výsledkami.`
    });
  }

  const finalResultText = lastInference?.text || '';

  return {
    success: true,
    executionId,
    agent: 'gemini-gem',
    result: finalResultText,
    tool_log: toolLog,
    model: lastInference?.model || 'unknown',
    provider: lastInference?.provider || 'gemini',
    tier: lastInference?.tier || 'unknown',
    durationMs: Date.now() - startedAt,
    limits: {
      status: 'not_verified',
      policy: 'provider_managed',
      fallbackUsed: lastInference?.tier !== 'gemini-native',
      toolExecutionEnabled: allowTools,
      toolsExecuted: toolLog.length,
      fallbacksAttempted: lastInference?.attempts ? lastInference.attempts - 1 : 0
    },
    _evidence: {
      effect: toolLog.length ? 'mutation' : 'inference',
      receipt_id: executionId,
      timestamp: new Date().toISOString()
    }
  };
}

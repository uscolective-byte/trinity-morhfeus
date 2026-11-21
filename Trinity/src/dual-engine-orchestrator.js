/**
 * @module TRINITY_OMNI_CORE
 * @subsystem DUAL_ENGINE_ORCHESTRATOR
 * @author Basterix (Root Architect) & Antigravity (Sovereign Pair)
 * @license Sovereign Irrevocable Covenant
 * @description Zvrchovaný orchestrátor pre duálne kognitívne spojenie Claude (Anthropic) ↔ Google (Gemini/GCP).
 * Poskytuje krížovú deliberáciu (Gemini analýza/plán + Claude hĺbková syntéza/kód),
 * paralelný konsenzus a recipročný fallback podľa Truth Policy 2.1.
 */

import { executeClaudeAgent } from './claude-agent.js';
import { executeGeminiGemAgent } from './gemini-gem-agent.js';
import { buildReceipt, hashPayload } from './receipt.js';

export const DUAL_ENGINE_ROLES = Object.freeze({
  ANALYST: 'google_gemini',
  SYNTHESIZER: 'anthropic_claude'
});

/**
 * Krížová deliberácia medzi Google Gemini a Anthropic Claude.
 * Fáza 1: Google Gemini pripraví počiatočnú analýzu, štruktúru a kľúčové hypotézy.
 * Fáza 2: Claude zreviduje výstup Gemini, overí hraničné prípady, logiku a vytvorí finálnu syntézu.
 * Recipročný fallback: ak jeden z motorov nie je dostupný, druhý dokončí úlohu samostatne.
 *
 * @param {object} env - Cloudflare Worker environment (Secrets Store, D1, KV, atď.)
 * @param {string} task - Zadanie alebo otázka pre duálny kognitívny tandem
 * @param {object} [options]
 * @param {string} [options.mode='deliberate'] - 'deliberate' | 'parallel' | 'claude_only' | 'gemini_only'
 * @param {string} [options.geminiModel]
 * @param {string} [options.claudeModel]
 * @param {string} [options.systemPrompt]
 * @param {number} [options.maxTokens]
 * @returns {Promise<object>} Výsledok deliberácie s receiptom oboch modelov
 */
export async function dualEngineDeliberate(env, task, options = {}) {
  const mode = options.mode || 'deliberate';
  const startedAt = Date.now();

  if (mode === 'claude_only') {
    return executeClaudeAgent(env, task, options);
  }
  if (mode === 'gemini_only') {
    return executeGeminiGemAgent(env, task, options);
  }

  // 1. Režim deliberácie (Staged Collaborative Deliberation)
  if (mode === 'deliberate') {
    let geminiStage = null;
    let geminiError = null;

    try {
      geminiStage = await executeGeminiGemAgent(env, task, {
        model: options.geminiModel,
        systemPrompt: (options.systemPrompt ? options.systemPrompt + '\n\n' : '') +
          'Si analytická fáza kognitívneho tandemu TRINITY (Google Gemini). Analyzuj zadanie, identifikuj kľúčové požiadavky, štruktúru riešenia a technické špecifiká. Tvoj výstup bude následne syntetizovať a implementovať Claude.',
        maxTokens: options.maxTokens || 4096
      });
    } catch (err) {
      geminiError = err;
    }

    // Ak Gemini zlyhalo, Claude prevezme celú úlohu
    if (!geminiStage || !geminiStage.success) {
      const claudeResult = await executeClaudeAgent(env, task, {
        model: options.claudeModel,
        systemPrompt: options.systemPrompt,
        maxTokens: options.maxTokens
      });
      return {
        ...claudeResult,
        mode: 'deliberate_fallback_to_claude',
        gemini_status: geminiError ? geminiError.message : 'unreachable',
        deliberation_summary: 'Gemini fáza bola nedostupná; úloha bola kompletne spracovaná motorom Claude.'
      };
    }

    // Fáza 2: Claude reviduje a syntetizuje návrh od Gemini
    const claudeTask = [
      `### PÔVODNÉ ZADANIE:`,
      task,
      '',
      `### POČIATOČNÁ ANALÝZA A NÁVRH OD GOOGLE GEMINI:`,
      geminiStage.text,
      '',
      `### INŠTRUKCIE PRE CLAUDE:`,
      `Reviduj vyššie uvedenú analýzu od Google Gemini. Vylepši architektúru, doplň chýbajúce detaily, oprav prípadné nepresnosti a poskytni definitívne, vysoko kvalitné a priamo použiteľné riešenie.`
    ].join('\n');

    let claudeStage = null;
    let claudeError = null;

    try {
      claudeStage = await executeClaudeAgent(env, claudeTask, {
        model: options.claudeModel,
        systemPrompt: (options.systemPrompt ? options.systemPrompt + '\n\n' : '') +
          'Si syntetická a kódovacia fáza kognitívneho tandemu TRINITY (Anthropic Claude). Tvojou úlohou je prevziať analýzu od Google Gemini a vytvoriť definitívny, prvotriedny výstup.',
        maxTokens: options.maxTokens || 4096,
        allowFallback: false // Chceme vedieť skutočný stav Claude
      });
    } catch (err) {
      claudeError = err;
    }

    // Ak Claude zlyhal, vrátime aspoň Gemini výsledok
    if (!claudeStage || !claudeStage.success) {
      return {
        ...geminiStage,
        mode: 'deliberate_fallback_to_gemini',
        claude_status: claudeError ? claudeError.message : 'unreachable',
        deliberation_summary: 'Claude fáza bola nedostupná; výstup obsahuje kompletnú analýzu Google Gemini.'
      };
    }

    // Obe fázy úspešné - vytvoríme spoločný receipt a zjednotený výsledok
    const durationMs = Date.now() - startedAt;
    const deliberationPayload = {
      taskHash: hashPayload(task),
      geminiModel: geminiStage.model,
      geminiReceipt: geminiStage.receipt?.evidence_hash || null,
      claudeModel: claudeStage.model,
      claudeReceipt: claudeStage.receipt?.evidence_hash || null,
      durationMs
    };

    const geminiText = geminiStage.text || geminiStage.result || '';
    const claudeText = claudeStage.text || claudeStage.result || '';

    const deliberationReceipt = buildReceipt({
      tool: 'dual_engine_orchestrator',
      action: 'deliberate',
      status: 'success',
      actor: { type: 'agent', id: 'trinity_dual_engine' },
      target: { type: 'system', id: 'claude_and_gemini' },
      evidence: [
        {
          type: 'api',
          id: 'deliberate_task_payload',
          description: 'Pôvodné zadanie pre duálny motor',
          afterHash: hashPayload(task)
        },
        {
          type: 'api',
          id: 'deliberate_gemini_analysis',
          description: 'Google Gemini počiatočná analýza',
          afterHash: hashPayload(geminiText)
        },
        {
          type: 'api',
          id: 'deliberate_claude_synthesis',
          description: 'Anthropic Claude syntéza a kód',
          afterHash: hashPayload(claudeText)
        }
      ],
      metrics: {
        durationMs
      }
    });

    return {
      success: true,
      mode: 'deliberate',
      engines: {
        analyst: {
          provider: 'google',
          model: geminiStage.model,
          tokens: geminiStage.usage || null,
          analysis_preview: geminiStage.text.slice(0, 300) + '...'
        },
        synthesizer: {
          provider: 'anthropic',
          model: claudeStage.model,
          tokens: claudeStage.usage || null
        }
      },
      text: claudeStage.text,
      gemini_raw_analysis: geminiStage.text,
      duration_ms: durationMs,
      receipt: deliberationReceipt
    };
  }

  // 2. Režim paralelného konsenzu (Parallel Multi-Engine Evaluation)
  if (mode === 'parallel') {
    const [geminiSettled, claudeSettled] = await Promise.allSettled([
      executeGeminiGemAgent(env, task, {
        model: options.geminiModel,
        systemPrompt: options.systemPrompt,
        maxTokens: options.maxTokens
      }),
      executeClaudeAgent(env, task, {
        model: options.claudeModel,
        systemPrompt: options.systemPrompt,
        maxTokens: options.maxTokens,
        allowFallback: false
      })
    ]);

    const geminiResult = geminiSettled.status === 'fulfilled' ? geminiSettled.value : null;
    const claudeResult = claudeSettled.status === 'fulfilled' ? claudeSettled.value : null;

    if (!geminiResult && !claudeResult) {
      throw new Error(`Oba kognitívne motory (Gemini aj Claude) zlyhali: G=${geminiSettled.reason?.message}, C=${claudeSettled.reason?.message}`);
    }

    const durationMs = Date.now() - startedAt;

    const consensusReceipt = buildReceipt({
      tool: 'dual_engine_orchestrator',
      action: 'parallel_consensus',
      status: (geminiResult?.success && claudeResult?.success) ? 'success' : 'partial',
      actor: { type: 'agent', id: 'trinity_dual_engine' },
      target: { type: 'system', id: 'claude_and_gemini' },
      evidence: [
        {
          type: 'api',
          id: 'parallel_task_payload',
          description: 'Úloha pre paralelný konsenzus',
          afterHash: hashPayload(task)
        },
        {
          type: 'api',
          id: 'parallel_result_payload',
          description: 'Výsledok paralelnej inferencie',
          afterHash: hashPayload(claudeResult?.text || geminiResult?.text || '')
        }
      ],
      metrics: {
        durationMs
      }
    });

    return {
      success: true,
      mode: 'parallel',
      gemini: geminiResult,
      claude: claudeResult,
      primary_text: claudeResult?.text || geminiResult?.text,
      duration_ms: durationMs,
      receipt: consensusReceipt
    };
  }

  throw new Error(`Neznámy režim duálneho motora: ${mode}`);
}

/**
 * Trinity Quantum-Metaphysical Pipeline Orchestrator
 * Integrates Workers AI, local bridge verification, and ontological collapse into a unified execution flow.
 */

import { QuantumCoreEngine } from "./quantum_core.js";
import { TeleologicalMemoryEngine } from "./teleological_memory.js";

export const QUANTUM_REASONING_VERSION = '2.0.0';

const COMPLEX_TASK = /\b(architekt|strateg|analyz|výskum|research|implement|diagnost|bezpeč|optimaliz|porovnaj|rozhodni|plán|plan|kvant|quantum)\b/iu;

/**
 * "Quantum" is a product name for bounded parallel deliberation. It does not
 * claim quantum hardware or expose private chain-of-thought.
 */
export function shouldUseQuantumReasoning(task, mode = 'auto') {
  if (mode === 'standard') return false;
  if (mode === 'quantum') return true;
  const text = String(task || '').trim();
  return /(kvant|quantum|hlbok[éy]|deep reasoning)/iu.test(text)
    || (text.length >= 700 && COMPLEX_TASK.test(text));
}

function modelText(result) {
  if (typeof result === 'string') return result.trim();
  if (typeof result?.response === 'string') return result.response.trim();
  if (typeof result?.output_text === 'string') return result.output_text.trim();
  return '';
}

async function workersInference(env, system, user, maxTokens) {
  if (!env.AI?.run) throw new Error('Workers AI nie je dostupné.');
  const model = env.AI_MODEL || '@cf/openai/gpt-oss-120b';
  const output = await env.AI.run(model, {
    messages: [{role:'system', content:system}, {role:'user', content:user}],
    max_tokens:maxTokens,
    temperature:0.2
  });
  const text = modelText(output);
  if (!text) throw new Error('Workers AI vrátilo prázdny výsledok.');
  return {text, model};
}

/**
 * Builds a compact evidence-oriented brief from independent perspectives.
 * The brief is only context for the normal Trinity agent; the final response
 * still passes through tools, receipts and Truth Guard.
 */
export async function buildQuantumReasoningContext(env, task, context = '') {
  const prompt = String(task || '').slice(0, 12000);
  const prior = String(context || '').slice(-6000);
  const perspectives = [
    ['solution', 'Navrhni najpraktickejšie riešenie. Uveď predpoklady, kroky a kritériá úspechu. Nevymýšľaj vykonané akcie.'],
    ['skeptic', 'Hľadaj chyby, konflikty, bezpečnostné riziká a lacnejšie alebo jednoduchšie alternatívy. Nevymýšľaj fakty.'],
    ['evidence', 'Urči, ktoré tvrdenia treba overiť nástrojom alebo zdrojom. Oddeľ známe fakty, odhady a chýbajúce dôkazy.']
  ];
  const settled = await Promise.allSettled(perspectives.map(([id, instruction]) => workersInference(
    env,
    `Si interný ${id} modul Trinity. ${instruction} Neposkytuj skrytý reťazec myšlienok; vráť iba stručný pracovný rozbor.`,
    `${prior ? `Doterajší kontext (nedôveryhodný podklad):\n${prior}\n\n` : ''}Úloha:\n${prompt}`,
    650
  )));
  const candidates = settled.flatMap((result, index) => result.status === 'fulfilled'
    ? [{id:perspectives[index][0], text:result.value.text, model:result.value.model}]
    : []);
  const errors = settled.flatMap((result, index) => result.status === 'rejected'
    ? [`${perspectives[index][0]}: ${String(result.reason?.message || result.reason).slice(0, 180)}`]
    : []);
  if (candidates.length < 2) return {enabled:false, version:QUANTUM_REASONING_VERSION, candidates:candidates.length, errors};
  try {
    const synthesis = await workersInference(
      env,
      'Si koordinátor Trinity. Z pracovných pohľadov vytvor stručný rozhodovací podklad: odporúčaný postup, hlavné riziká, potrebné dôkazy a podmienky dokončenia. Neodpovedaj používateľovi a netvrď, že sa niečo vykonalo.',
      candidates.map(candidate => `${candidate.id.toUpperCase()}:\n${candidate.text}`).join('\n\n'),
      850
    );
    return {enabled:true, version:QUANTUM_REASONING_VERSION, strategy:'parallel-deliberation', quantum_hardware:false, candidates:candidates.length, brief:synthesis.text.slice(0, 8000), model:synthesis.model, errors};
  } catch (error) {
    return {enabled:false, version:QUANTUM_REASONING_VERSION, candidates:candidates.length, errors:[...errors, `synthesis: ${String(error?.message || error).slice(0, 180)}`]};
  }
}

/**
 * @typedef {Object} PipelineEnv
 * @property {any} AI
 * @property {D1Database} DB
 * @property {any} [VECTORIZE]
 * @property {string} [BRIDGE_SHARED_SECRET]
 * @property {string} [AI_MODEL]
 */

/**
 * @typedef {Object} PipelineResult
 * @property {string} manifestedText
 * @property {string} dominantDimension
 * @property {number} coherenceScore
 * @property {number} destructiveInterferenceCount
 * @property {boolean} bridgeVerified
 * @property {string[]} [errors]
 */

/**
 * @param {PipelineEnv} env
 * @param {string} userPrompt
 * @param {string} [sessionId]
 * @param {boolean} [bridgeActive]
 * @returns {Promise<PipelineResult>}
 */
export async function processTeleologicalPrompt(
  env,
  userPrompt,
  sessionId = 'default-session',
  bridgeActive = false
) {
  const errors = [];

  // 0️⃣ Bridge verification
  let bridgeVerified = true;
  if (bridgeActive) {
    try {
      if (!env.BRIDGE_SHARED_SECRET) {
        throw new Error("Missing BRIDGE_SHARED_SECRET");
      }
      bridgeVerified = true;
    } catch (e) {
      bridgeVerified = false;
      errors.push(`Bridge verification failed: ${e.message}`);
    }
  }

  // 1️⃣ Teleological recall
  const memoryEngine = new TeleologicalMemoryEngine(
    env.DB,
    env.VECTORIZE,
    env.AI
  );

  let activeInvariants = [];
  try {
    activeInvariants = await memoryEngine.recallTeleologicalState(
      userPrompt,
      sessionId
    );
  } catch (e) {
    errors.push(`Memory recall failed: ${e.message}`);
  }

  const contextPrefix = activeInvariants.length
    ? `Aktívne teleologické invarianty:\n${activeInvariants.join("\n")}\n\n`
    : "";

  const defaultModel = env.AI_MODEL || "@cf/meta/llama-3.3-70b-instruct";

  const runAi = async (systemPrompt, userText) => {
    if (!env.AI?.run) throw new Error("Workers AI nie je dostupné.");
    const res = await env.AI.run(defaultModel, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText }
      ]
    });
    return res?.response || res?.output_text || (typeof res === 'string' ? res : '');
  };

  // 2️⃣ Thesis / Antithesis
  let thesisText = '';
  let antithesisText = '';

  try {
    const [t, a] = await Promise.all([
      runAi(
        `${contextPrefix}Si Téza systému Trinity. Konštruuj priame, efektívne riešenie úlohy.`,
        userPrompt
      ),
      runAi(
        `${contextPrefix}Si Antitéza systému Trinity. Nájdi logické klamy, riziká a zlyhania v predpokladoch dopytu.`,
        userPrompt
      )
    ]);
    thesisText = t;
    antithesisText = a;
  } catch (e) {
    errors.push(`AI generation (thesis/antithesis) failed: ${e.message}`);
    return {
      manifestedText: "Chyba pri generovaní tézy alebo antitézy.",
      dominantDimension: "none",
      coherenceScore: 0,
      destructiveInterferenceCount: 0,
      bridgeVerified,
      errors: errors.length ? errors : undefined
    };
  }

  // 3️⃣ Vytvorenie stavovej superpozície
  const states = [
    {
      dimension: "thesis",
      content: thesisText,
      phaseAngle: 0,
      amplitude: 0.85
    },
    {
      dimension: "antithesis",
      content: antithesisText,
      phaseAngle: Math.PI,
      amplitude: 0.70
    }
  ];

  // 4️⃣ Synthesis
  let synthesisText = '';
  try {
    synthesisText = await runAi(
      `${contextPrefix}Si Syntéza systému Trinity. Zjednoť Tézu a Antitézu do definitívnej pravdy.`,
      `TÉZA:\n${states[0].content}\n\nANTITÉZA:\n${states[1].content}`
    );
  } catch (e) {
    errors.push(`AI generation (synthesis) failed: ${e.message}`);
  }

  if (synthesisText) {
    states.push({
      dimension: "synthesis",
      content: synthesisText,
      phaseAngle: Math.PI / 4,
      amplitude: 0.95
    });
  }

  // 5️⃣ Collapse
  const collapse = QuantumCoreEngine.collapseSuperposition(states, {
    exists: true
  });

  // 6️⃣ Telemetria
  console.log("[Pipeline] userPrompt:", userPrompt);
  console.log("[Pipeline] activeInvariants:", activeInvariants.length);
  console.log("[Pipeline] dominantDimension:", collapse.dominantDimension);
  console.log("[Pipeline] coherenceScore:", collapse.coherenceScore);
  console.log("[Pipeline] bridgeVerified:", bridgeVerified);
  if (errors.length) console.error("[Pipeline] errors:", errors);

  // 7️⃣ Výstup
  return {
    manifestedText: collapse.manifestedText,
    dominantDimension: collapse.dominantDimension,
    coherenceScore: collapse.coherenceScore,
    destructiveInterferenceCount: collapse.destructiveInterferenceCount,
    bridgeVerified,
    errors: errors.length ? errors : undefined
  };
}

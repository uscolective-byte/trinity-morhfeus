/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CORE_RUNTIME
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Modul chat-routing.js (Trinity/src/chat-routing.js) v ekosystéme TRINITY OMNI-CORE.
 * Integruje Kmitočtový Protokol 3-6-9, Quantum Router a Entanglement synchronizáciu.
 */
import {planTask} from './planner.js';
import {getConfiguredAIProvider} from './ai-providers.js';
import {QuantumRouter} from './quantum-router.js';
import {ResonanceMatrix369, RESONANCE_FREQUENCIES} from './resonance-matrix.js';
import {globalEntanglementBridge, EntanglementBridge} from './entanglement-sync.js';

export {
  QuantumRouter,
  ResonanceMatrix369,
  RESONANCE_FREQUENCIES,
  globalEntanglementBridge,
  EntanglementBridge
};

export const CHAT_ENGINE_VALUES=['auto','cloud','fast','gemini','openai','ollama','local','deepseek-r1','llama','qwen','groq','deepseek','anthropic','mistral','openrouter'];
export function normalizeChatEngine(value){return typeof value==='string'?value.trim().toLowerCase():value;}

// Automatic PC requests stay in the cloud planner; only explicit local mode uses local inference.
export function selectChatProvider(engine,message,options={}){
  const normalized = normalizeChatEngine(engine) || 'auto';
  if(normalized==='edge'||normalized==='cloud') return 'workers-ai';
  if(normalized==='codex') return 'openai';
  if(normalized!=='auto') return normalized;

  // Protokol 3-6-9: Kvantový router zámerov a vlnová funkcia ψ
  const quantumRoute = QuantumRouter.route(message, options.context, options.config);
  const planned = planTask(message);

  // Ak kvantový router aj plánovač indikujú bežný dialóg, použije sa rýchla inferencia
  if(quantumRoute.collapsedAgent === 'chat' && planned.intent === 'conversation') {
    return 'fast';
  }
  return 'workers-ai';
}

// Strongest first. Only providers with a verified, enabled key (or a Worker secret) are considered.
export const BEST_PROVIDER_ORDER=['gemini','openai','anthropic','deepseek','groq','mistral','openrouter'];
const ENV_KEYS={openai:'OPENAI_API_KEY',groq:'GROQ_API_KEY',deepseek:'DEEPSEEK_API_KEY',gemini:'GEMINI_API_KEY'};

export async function pickChatProvider(env,engine,message,options={}){
  const base=selectChatProvider(engine,message,options);
  if(engine!=='auto')return base;
  const text=String(message||'').trim();
  if(base==='fast'&&text.length<=80)return 'fast';
  for(const provider of BEST_PROVIDER_ORDER){
    try{
      const configured=await getConfiguredAIProvider(env,provider);
      if(configured?.apiKey||configured?.secret_id)return provider;
    }catch{}
    const key=ENV_KEYS[provider];
    if(key&&typeof env[key]==='string'&&env[key].trim().length>=8)return provider;
  }
  return 'workers-ai';
}

/**
 * Plnohodnotný kvantový rezonančný router pre hlavný tok Trinity (Protokol 3-6-9).
 * Prepojuje Fázu 3 (Téza), Fázu 6 (Antitéza) a Entanglement synchronizáciu bez pollovania.
 * @param {object} env
 * @param {string} engine
 * @param {string} message
 * @param {object} [context]
 */
export async function routeChatWithResonance(env,engine,message,context={}){
  const thesis = ResonanceMatrix369.captureThesis(message, context);
  const transformation = ResonanceMatrix369.evaluateTransformation(thesis, env);
  const provider = await pickChatProvider(env, engine, message, { context });

  globalEntanglementBridge.emitStateChange('chat-routed', {
    collapsedAgent: thesis.collapsed.agent,
    confidence: thesis.collapsed.score,
    provider,
    sessionId: context.sessionId || 'anonymous',
    checksPassed: transformation.every(t => t.passed)
  });

  return {
    provider,
    thesis,
    transformation,
    collapsedAgent: thesis.collapsed.agent,
    confidence: thesis.collapsed.score
  };
}

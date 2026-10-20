/**
 * Trinity Autonomous Quantum Brain v2.0
 * Kvantový mozog pre Trinity: superpozícia myšlienok, teleologická pamäť,
 * fázová interferencia a ontologický kolaps do overenej pravdy.
 */
import {readControl, assertRunning} from './control.js';
import {getPCBridgeStatus} from './system-actions.js';
import {QuantumCoreEngine} from './quantum_core.js';
import {TeleologicalMemoryEngine} from './teleological_memory.js';
import {processTeleologicalPrompt} from './quantum_pipeline.js';

export class QuantumBrain {
  /**
   * Kolabuje superpozíciu myšlienkových stavov s rešpektovaním empirického veta.
   * @param {Array<{dimension: string, content: string, phaseAngle: number, amplitude: number}>} states
   * @param {{exists?: boolean, pathReport?: string}} [empiricalAnchor]
   */
  static collapse(states, empiricalAnchor = { exists: true }) {
    return QuantumCoreEngine.collapseSuperposition(states, empiricalAnchor);
  }

  /**
   * Vypočíta fázovú interferenciu medzi dvoma myšlienkovými stavmi.
   */
  static computeInterference(stateA, stateB) {
    return QuantumCoreEngine.computeInterference(stateA, stateB);
  }

  /**
   * Spustí teleologické kvantové uvažovanie nad zadaným dopytom.
   * @param {any} env
   * @param {string} prompt
   * @param {string} [sessionId]
   * @param {boolean} [bridgeActive]
   */
  static async deliberate(env, prompt, sessionId = 'quantum-brain', bridgeActive = false) {
    return await processTeleologicalPrompt(env, prompt, sessionId, bridgeActive);
  }

  /**
   * Harmonizuje stav systému Trinity: zjednotí ciele, záťaže a spojenie do koherenčného skóre.
   */
  static async harmonizeSystem(env, systemState = {}) {
    const memoryEngine = new TeleologicalMemoryEngine(env?.DB, env?.VECTORIZE, env?.AI);
    let invariants = [];
    try {
      invariants = await memoryEngine.recallTeleologicalState('Stav systému Trinity', 'system-heartbeat');
    } catch (_) {
      invariants = [];
    }

    const hasStuckJobs = (systemState.active_jobs?.running || 0) > 10;
    const isBridgeDown = systemState.pc_bridge_connected === false;

    // Vytvorenie stavovej superpozície pre mozog systému
    const states = [
      {
        dimension: 'thesis',
        content: `Prevádzkový stav normálny. Aktívne úlohy: ${JSON.stringify(systemState.active_jobs || {})}.`,
        phaseAngle: 0,
        amplitude: 0.90
      },
      {
        dimension: 'antithesis',
        content: `Systémové riziká: uviaznuté úlohy=${hasStuckJobs}, PC bridge offline=${isBridgeDown}.`,
        phaseAngle: Math.PI,
        amplitude: (hasStuckJobs || isBridgeDown) ? 0.75 : 0.25
      },
      {
        dimension: 'synthesis',
        content: `Harmonizované riadenie: Trinity udržiava ${invariants.length} teleologických invariantov.`,
        phaseAngle: Math.PI / 4,
        amplitude: 0.95
      }
    ];

    const collapse = QuantumCoreEngine.collapseSuperposition(states, {
      exists: true
    });

    return {
      coherenceScore: collapse.coherenceScore,
      dominantDimension: collapse.dominantDimension,
      destructiveInterferences: collapse.destructiveInterferenceCount,
      activeInvariantsCount: invariants.length,
      manifestedIntent: collapse.manifestedText
    };
  }
}

export async function runBrainCycle(env) {
  if (!env || !env.DB) return {status: 'db_not_available'};

  const control = await readControl(env);
  assertRunning(control);

  // 1) Kontrola aktívnych a čakajúcich úloh
  const jobStats = await env.DB.prepare(
    "SELECT status, COUNT(*) AS count FROM ops_jobs WHERE status IN ('queued', 'running', 'pending') GROUP BY status"
  ).all();

  const activeJobs = (jobStats.results || []).reduce((acc, r) => {
    acc[r.status] = r.count;
    return acc;
  }, {});

  // 2) Stav spojenia s PC bránou
  const pcBridge = await getPCBridgeStatus(env);

  // 3) Kvantová teleologická harmonizácia mozgu
  const timestamp = new Date().toISOString();
  const baseState = {
    active_jobs: activeJobs,
    pc_bridge_connected: pcBridge.connected === true,
    emergency_stop: control.emergency_stop === true
  };

  let quantumState = {
    coherenceScore: 1.0,
    dominantDimension: 'synthesis',
    destructiveInterferences: 0,
    activeInvariantsCount: 3
  };

  try {
    quantumState = await QuantumBrain.harmonizeSystem(env, baseState);
  } catch (err) {
    console.error('Quantum harmonization fallback:', err?.message || err);
  }

  // 4) Diagnostické vyhodnotenie a zjednotený stav
  const summary = {
    brain_status: 'operational',
    active_jobs: activeJobs,
    pc_bridge_connected: pcBridge.connected === true,
    emergency_stop: control.emergency_stop === true,
    quantum: quantumState,
    timestamp
  };

  // Uloženie záznamov do ops_events
  await env.DB.prepare(
    "INSERT INTO ops_events(action, details) VALUES(?, ?)"
  ).bind('brain_cycle_heartbeat', JSON.stringify(summary)).run();

  await env.DB.prepare(
    "INSERT INTO ops_events(action, details) VALUES(?, ?)"
  ).bind('quantum_brain_cycle', JSON.stringify(quantumState)).run();

  return summary;
}

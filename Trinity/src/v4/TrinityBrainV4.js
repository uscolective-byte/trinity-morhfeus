/**
 * TRINITY BRAIN V4 — AUTONOMOUS EVOLUTIONARY META-ORCHESTRATOR
 * Architektúra: Cloudflare Durable Object + Hybrid Bridge Sync
 * Sub-systémy: MetaBrain, QuantumCoreEngine (QCE-Fusion), EvoEngineV3, SkillForge, HybridBrain
 */

import { MetaBrain } from './MetaBrain.js';
import { QuantumCoreEngine } from './QuantumCoreEngine.js';
import { EvoEngineV3 } from './EvoEngineV3.js';
import { SkillForge } from './SkillForge.js';
import { HybridBrain } from './HybridBrain.js';

export class TrinityBrainV4 {
  constructor(state = {}, env = {}) {
    this.state = state;
    this.env = env;
    this.storage = state?.storage || {
      _data: new Map(),
      async get(key) { return this._data.get(key); },
      async put(key, val) { this._data.set(key, val); }
    };

    // 1. Inicializácia pamäťových vrstiev (In-Memory Buffer)
    this.stm = []; // Short-Term Memory (posledných N udalostí)
    this.stmMaxLimit = 50;
    this.ltm = new Map(); // Long-Term Memory (ontológia, vzorce)
    this.etm = []; // Episodic Memory (história interakcií a zámerov)

    // 2. Stav identity a evolučného cyklu
    this.genome = {
      version: '10.4.0-EVO',
      generation: 1,
      archetypeWeights: {
        creator: 0.25,
        ruler: 0.15,
        sage: 0.20,
        magician: 0.25,
        rebel: 0.15
      },
      agentConsensusWeights: {
        guardian: 0.30,
        sentinel: 0.20,
        planner: 0.20,
        optimizer: 0.15,
        analyzer: 0.15
      },
      fitnessScore: 100.0,
      mutationRate: 0.05
    };

    // 3. Inicializácia podriadených systémov
    this.meta = new MetaBrain(this.env);
    this.qce = new QuantumCoreEngine(this.env, { weights: this.genome.agentConsensusWeights });
    this.evo = new EvoEngineV3(this.storage, this.env);
    this.forge = new SkillForge(this.storage, this.env);
    this.hybrid = new HybridBrain(this.env);

    this.initialized = false;
  }

  /**
   * Asynchrónna hydratácia perzistentného stavu z Durable Object Storage
   */
  async ensureInitialized() {
    if (this.initialized) return;

    try {
      const [savedGenome, savedLtm, savedEtm] = await Promise.all([
        this.storage.get('brain_genome'),
        this.storage.get('brain_ltm'),
        this.storage.get('brain_etm')
      ]);

      if (savedGenome) this.genome = savedGenome;
      if (savedLtm) this.ltm = new Map(Object.entries(savedLtm));
      if (savedEtm && Array.isArray(savedEtm)) this.etm = savedEtm;
    } catch (err) {
      console.warn('TrinityBrainV4 storage hydration warning:', err?.message || err);
    }

    await Promise.all([
      this.forge.init(),
      this.evo.init(this.genome),
      this.hybrid.init()
    ]);

    this.initialized = true;
  }

  /**
   * HLAVNÝ VSTUP: Kognitívny a exekučný cyklus TrinityBrainV4
   * @param {Object} input - Vstupná požiadavka (prompt, task, payload)
   * @param {Object} clientMeta - Kontext klienta (PC Bridge stav, latencia, autorizácia)
   */
  async processTask(input, clientMeta = {}) {
    await this.ensureInitialized();
    const cycleStartTime = performance.now();
    const cycleId = `cycle_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      // ---------------------------------------------------------
      // FÁZA 1: PERCEPTION & METAFYZICKÁ INTERPRETÁCIA (MetaBrain)
      // ---------------------------------------------------------
      const metaContext = await this.meta.perceive({
        input,
        activeArchetypes: this.genome.archetypeWeights,
        etmSnapshot: this.etm.slice(-5)
      });

      // Zápis do STM
      this._pushSTM({ phase: 'PERCEPTION', cycleId, metaContext });

      // ---------------------------------------------------------
      // FÁZA 2: HYBRID ROUTING DECISION (HybridBrain)
      // ---------------------------------------------------------
      const targetExecutionTarget = await this.hybrid.routeDecision({
        metaContext,
        clientMeta,
        taskComplexity: input.complexity || 'AUTO'
      });

      // ---------------------------------------------------------
      // FÁZA 3: PARALELNÝ REASONING & FÚZIA (QCE-Fusion)
      // ---------------------------------------------------------
      const qcePlan = await this.qce.executeFusion({
        task: input,
        metaContext,
        target: targetExecutionTarget,
        weights: this.genome.agentConsensusWeights
      });

      // ---------------------------------------------------------
      // FÁZA 4: DYNAMICKÁ SYNTÉZA CHÝBAJÚCICH SCHOPNOSTÍ (SkillForge)
      // ---------------------------------------------------------
      let executionResult = null;
      if (qcePlan.requiresNewSkill) {
        const forgedSkill = await this.forge.forgeSkillFromQCE(qcePlan.skillSpec, {
          cycleId,
          genome: this.genome
        });
        this._pushSTM({ phase: 'SKILL_FORGED', cycleId, skill: forgedSkill.name });
      }

      // ---------------------------------------------------------
      // FÁZA 5: EXEKÚCIA (Cloud vs PC Bridge)
      // ---------------------------------------------------------
      if (targetExecutionTarget === 'PC_BRIDGE') {
        executionResult = await this.hybrid.dispatchToLocalBridge(qcePlan.decision);
      } else {
        executionResult = await this._executeCloudAction(qcePlan.decision);
      }

      // ---------------------------------------------------------
      // FÁZA 6: EVOLUČNÝ REFLEXNÝ CYKLUS & MUTÁCIA (EvoEngineV3)
      // ---------------------------------------------------------
      const totalLatency = Math.round(performance.now() - cycleStartTime);
      const reflection = await this.evo.evaluateCycle({
        cycleId,
        input,
        qcePlan,
        executionResult,
        latencyMs: totalLatency,
        currentGenome: this.genome
      });

      // Ak evolučný engine našiel priaznivejšiu mutáciu, aktualizuj genóm
      if (reflection.promotedGenome) {
        this.genome = reflection.promotedGenome;
        try {
          await this.storage.put('brain_genome', this.genome);
        } catch (_) {}
        this._pushSTM({ phase: 'GENOME_MUTATION_PROMOTED', generation: this.genome.generation });
      }

      // ---------------------------------------------------------
      // FÁZA 7: PAMÄŤOVÝ IMPRINT (LTM & ETM)
      // ---------------------------------------------------------
      await this._imprintMemories(input, qcePlan, executionResult, reflection);

      return {
        success: true,
        cycleId,
        executionTarget: targetExecutionTarget,
        result: executionResult,
        evolution: {
          generation: this.genome.generation,
          fitness: this.genome.fitnessScore,
          mutationApplied: !!reflection.promotedGenome
        },
        telemetry: {
          latencyMs: totalLatency,
          consensusScore: qcePlan.confidence
        }
      };

    } catch (error) {
      // Auto-Rollback a sebaopravný proces pri zlyhaní
      console.error(`[TrinityBrainV4 CRITICAL] Zlyhanie v cykle ${cycleId}:`, error);
      await this.evo.recordFailure({ cycleId, error: error.message, genome: this.genome });

      return {
        success: false,
        cycleId,
        error: error.message,
        fallbackState: 'AUTO_RECOVERY_ENGAGED'
      };
    }
  }

  /**
   * Zápis do Short-Term Memory s rotáciou
   */
  _pushSTM(entry) {
    this.stm.push({ ...entry, timestamp: Date.now() });
    if (this.stm.length > this.stmMaxLimit) {
      this.stm.shift();
    }
  }

  /**
   * Zápis úspešných stratégií do LTM a histórie preferencií do ETM
   */
  async _imprintMemories(input, plan, result, reflection) {
    const timestamp = Date.now();

    // 1. Zápis do ETM (Epizodická pamäť: čo chcel používateľ a ako sme to vyriešili)
    this.etm.push({
      intent: input.intent || input.name || 'TASK',
      userPreferenceIndicator: input.style || 'neutral',
      success: result.success,
      timestamp
    });
    if (this.etm.length > 200) this.etm.shift();
    try {
      await this.storage.put('brain_etm', this.etm);
    } catch (_) {}

    // 2. Zápis do LTM (Ontologické pravidlá a overené postupy)
    if (result.success && reflection.fitnessScoreDelta > 0) {
      const patternKey = `pattern_${input.type || 'generic'}`;
      this.ltm.set(patternKey, {
        winningHypothesis: plan.decision,
        archetypeBalance: this.genome.archetypeWeights,
        timestamp
      });
      try {
        await this.storage.put('brain_ltm', Object.fromEntries(this.ltm));
      } catch (_) {}
    }
  }

  /**
   * Exekúcia cloudových natívnych operácií (ak nejde cez PC-Bridge)
   */
  async _executeCloudAction(decision) {
    if (decision.action === 'EXECUTE_SKILL') {
      return await this.forge.execute(decision.skillName, decision.params);
    }
    return {
      success: true,
      data: decision,
      context: 'CLOUD_DO_NATIVE'
    };
  }

  /**
   * HTTP rozhranie pre Durable Object RPC / Fetch
   */
  async fetch(request) {
    await this.ensureInitialized();
    const url = new URL(request.url);

    // Autorizačná kontrola pre volania brány
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const requiredKey = this.env.TRINITY_GATEWAY_KEY;

    // Ak je zadaný kľúč a nesedí, vráť 401
    if (requiredKey && token && token !== requiredKey) {
      return new Response(JSON.stringify({ error: 'Lokálna brána nie je autorizovaná.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (url.pathname === '/api/v4/process' && request.method === 'POST') {
      const payload = await request.json();
      const clientMeta = {
        ip: request.headers.get('CF-Connecting-IP'),
        colo: request.cf?.colo || 'UNKNOWN'
      };
      const result = await this.processTask(payload, clientMeta);
      return Response.json(result);
    }

    if (url.pathname === '/api/v4/state' && request.method === 'GET') {
      return Response.json({
        genome: this.genome,
        stmSize: this.stm.length,
        ltmSize: this.ltm.size,
        etmSize: this.etm.length,
        registeredSkills: Array.from(this.forge.runtimeRegistry.keys())
      });
    }

    return new Response('TrinityBrainV4 Core Active.', { status: 200 });
  }
}

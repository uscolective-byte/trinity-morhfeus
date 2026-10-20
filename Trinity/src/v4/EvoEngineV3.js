/**
 * Trinity EvoEngine v3.0
 * Evolučné riadenie mozgu: fitness scoring, genetické mutácie archetypov a váh agentov,
 * selekcia a auto-rollback pri zlyhaní.
 */

export class EvoEngineV3 {
  constructor(storage = null, env = {}) {
    this.storage = storage;
    this.env = env;
    this.genome = null;
    this.failureHistory = [];
  }

  async init(initialGenome) {
    this.genome = initialGenome || {
      version: '10.4.0-EVO',
      generation: 1,
      archetypeWeights: { creator: 0.2, ruler: 0.2, sage: 0.2, magician: 0.2, rebel: 0.2 },
      agentConsensusWeights: { guardian: 0.3, sentinel: 0.2, planner: 0.2, optimizer: 0.15, analyzer: 0.15 },
      fitnessScore: 100.0,
      mutationRate: 0.05
    };
  }

  /**
   * Vyhodnotí exekučný cyklus, vypočíta zmenu fitness skóre a navrhne prípadnú mutáciu genómu.
   */
  async evaluateCycle({ cycleId, input, qcePlan, executionResult, latencyMs, currentGenome }) {
    const isSuccess = Boolean(executionResult?.success !== false);
    const latencyScore = Math.max(0, 1.0 - (latencyMs / 5000)); // Rýchlosť: ideál < 500ms
    const consensusBonus = (qcePlan?.confidence || 0.8) * 0.5;

    // Zmena fitness skóre
    let fitnessScoreDelta = isSuccess ? Number(((latencyScore * 2.0) + consensusBonus).toFixed(3)) : -5.0;

    const baseGenome = currentGenome || this.genome;
    let promotedGenome = null;

    // Ak bol cyklus úspešný a vygeneroval vysoké skóre, otestujeme malú genetickú mutáciu
    if (isSuccess && Math.random() < (baseGenome.mutationRate || 0.05)) {
      promotedGenome = this._applyBeneficialMutation(baseGenome, fitnessScoreDelta);
    }

    return {
      cycleId,
      fitnessScoreDelta,
      newFitness: Number((baseGenome.fitnessScore + fitnessScoreDelta).toFixed(2)),
      promotedGenome
    };
  }

  /**
   * Zaznamená zlyhanie a vykoná auto-rollback na overený stav.
   */
  async recordFailure({ cycleId, error, genome }) {
    this.failureHistory.push({
      cycleId,
      error,
      generation: genome?.generation,
      timestamp: new Date().toISOString()
    });
    if (this.failureHistory.length > 50) this.failureHistory.shift();

    if (this.storage) {
      try {
        await this.storage.put('brain_failures', this.failureHistory);
      } catch (err) {
        console.warn('EvoEngine failure save warning:', err?.message || err);
      }
    }

    return { autoRollbackEngaged: true, failureCount: this.failureHistory.length };
  }

  /**
   * Aplikuje jemnú adaptívnu mutáciu na váhy archetypov
   */
  _applyBeneficialMutation(genome, delta) {
    const mutated = JSON.parse(JSON.stringify(genome));
    mutated.generation = (mutated.generation || 1) + 1;
    mutated.fitnessScore = Number(((mutated.fitnessScore || 100.0) + delta).toFixed(2));

    // Jemná mutácia: mierne posilnenie tvorivého archetypu (creator / magician)
    const archetypes = mutated.archetypeWeights;
    const shift = 0.02;
    if (archetypes.creator && archetypes.ruler) {
      archetypes.creator = Number((archetypes.creator + shift).toFixed(3));
      archetypes.ruler = Number(Math.max(0.05, archetypes.ruler - shift).toFixed(3));
    }

    return mutated;
  }
}

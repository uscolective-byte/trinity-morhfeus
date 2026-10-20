/**
 * Trinity MetaBrain v10.4
 * Kognitívna percepcia, metafyzická interpretácia a archetypálny aparát.
 * Archetypy: Creator (tvorba), Ruler (štruktúra), Sage (múdrosť), Magician (transformácia), Rebel (disrupcia).
 */

export class MetaBrain {
  constructor(env = {}) {
    this.env = env;
  }

  /**
   * Analyzuje vstup a kontext cez prizmu archetypov a histórie.
   * @param {{input: any, activeArchetypes: Record<string, number>, etmSnapshot?: Array<any>}} param0
   */
  async perceive({ input, activeArchetypes = {}, etmSnapshot = [] }) {
    const rawText = typeof input === 'string' ? input : (input.query || input.prompt || input.task || JSON.stringify(input));
    const lower = String(rawText).toLowerCase();

    // Detekcia kľúčových vektorov zámeru
    const isCreative = /vytvor|navrhni|vymysli|kreativ|inovac|nova|napady|create|design|innovat/.test(lower);
    const isAnalytical = /analyzuj|spocitaj|zisti|over|metrik|data|analy|audit|verify/.test(lower);
    const isAction = /spusti|otvor|vykonaj|uloz|zapis|nastav|run|exec|write|deploy/.test(lower);
    const isSystem = /system|stav|pamat|mozog|bridge|status|health|memory/.test(lower);

    // Dominantný archetyp na základe váh a kľúčových slov
    let dominantArchetype = 'creator';
    let maxWeight = activeArchetypes.creator || 0.2;

    if (isAnalytical && (activeArchetypes.sage || 0.2) >= maxWeight) {
      dominantArchetype = 'sage';
      maxWeight = activeArchetypes.sage;
    }
    if (isAction && (activeArchetypes.ruler || 0.2) >= maxWeight) {
      dominantArchetype = 'ruler';
      maxWeight = activeArchetypes.ruler;
    }
    if (isCreative && (activeArchetypes.magician || 0.2) >= maxWeight) {
      dominantArchetype = 'magician';
      maxWeight = activeArchetypes.magician;
    }

    // Odhad kognitívnej rezonancie
    const cognitiveResonance = Number(((maxWeight * 0.7) + (etmSnapshot.length > 0 ? 0.3 : 0.1)).toFixed(3));

    return {
      semanticIntent: isCreative ? 'CREATION' : isAnalytical ? 'ANALYSIS' : isAction ? 'ACTION' : 'QUERY',
      dominantArchetype,
      cognitiveResonance,
      archetypeWeights: activeArchetypes,
      contextDepth: etmSnapshot.length,
      timestamp: new Date().toISOString()
    };
  }
}

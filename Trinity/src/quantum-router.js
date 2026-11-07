/**
 * @module TRINITY_OMNI_CORE
 * @subsystem QUANTUM_ROUTER
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Modul quantum-router.js (Trinity/src/quantum-router.js).
 * Implementuje superpozíciu zámerov a pozorovateľský kolaps podľa špecifikácie 3-6-9.
 */

/**
 * @typedef {Object} IntentState
 * @property {string} agent - Identifikátor kandidátnej cesty spracovania
 * @property {number} score - Pravdepodobnostná amplitúda / skóre zámeru
 * @property {string} [rationale] - Dôvod priradenia amplitúdy
 */

/**
 * @typedef {IntentState[]} IntentWaveFunction
 */

export class QuantumRouter {
  /**
   * Zostaví vstupnú vlnovú funkciu zámeru ψ = ∑ c_i |agent_i⟩ pred pozorovaním.
   * @param {string} userInput - Vstupný text používateľa
   * @param {object} [context] - Kontext relácie a pozorovateľa
   * @param {object} [config] - Konfiguračné váhy z resonance.json
   * @returns {IntentWaveFunction} Vlnová funkcia superpozície
   */
  static buildWaveFunction(userInput, context = {}, config = {}) {
    const raw = String(userInput || '').trim().toLowerCase();
    const weights = config?.weights || {
      coder: 1.2,
      planner: 1.0,
      auditor: 1.1,
      sentinel: 1.5,
      chat: 0.8
    };

    /** @type {IntentWaveFunction} */
    const candidates = [
      { agent: 'chat', score: 0.25 * (weights.chat || 1.0) },
      { agent: 'planner', score: 0.20 * (weights.planner || 1.0) },
      { agent: 'coder', score: 0.20 * (weights.coder || 1.0) },
      { agent: 'auditor', score: 0.20 * (weights.auditor || 1.0) },
      { agent: 'sentinel', score: 0.15 * (weights.sentinel || 1.0) }
    ];

    if (!raw) {
      return candidates;
    }

    // Posun amplitúd podľa rezonancie vstupných atribútov
    for (const c of candidates) {
      if (c.agent === 'coder' && /kód|funkci|oprav|implementuj|build|script|skript|pr|vetv|git|css|html|ts|js|worker/i.test(raw)) {
        c.score += 0.55;
      }
      if (c.agent === 'planner' && /plán|architekt|rozpad|postup|stratégi|krok|fáz|road/i.test(raw)) {
        c.score += 0.50;
      }
      if (c.agent === 'auditor' && /test|over|skontroluj|verify|analýz|log|výsledok|dôkaz|chyb/i.test(raw)) {
        c.score += 0.52;
      }
      if (c.agent === 'sentinel' && /bezpečnos|token|kľúč|secret|heslo|access|auth|lock|d1|kv/i.test(raw)) {
        c.score += 0.60;
      }
      if (c.agent === 'chat' && (raw.length < 40 || /ahoj|dobrý|pomoc|kto si|ďakujem/i.test(raw))) {
        c.score += 0.45;
      }
    }

    // Normalizácia pravdepodobností: ∑ score = 1.0
    const total = candidates.reduce((acc, cur) => acc + cur.score, 0) || 1.0;
    return candidates.map(c => ({
      agent: c.agent,
      score: Number((c.score / total).toFixed(4))
    }));
  }

  /**
   * Kolaps vlnovej funkcie (Pozorovateľský efekt).
   * Po prijatí vstupu vyberá najpravdepodobnejšiu a najvhodnejšiu cestu.
   * @param {IntentWaveFunction} psi - Vstupná vlnová funkcia
   * @returns {IntentState} Kolabovaný stav zámeru
   */
  static collapseIntent(psi) {
    if (!Array.isArray(psi) || psi.length === 0) {
      return { agent: 'chat', score: 1.0 };
    }
    const sorted = [...psi].sort((a, b) => b.score - a.score);
    return sorted[0];
  }

  /**
   * Kompletné kvantové smerovanie zámeru.
   * @param {string} userInput
   * @param {object} [context]
   * @param {object} [config]
   */
  static route(userInput, context = {}, config = {}) {
    const psi = this.buildWaveFunction(userInput, context, config);
    const collapsed = this.collapseIntent(psi);
    return {
      psi,
      collapsed,
      collapsedAgent: collapsed.agent,
      confidence: collapsed.score,
      timestamp: new Date().toISOString()
    };
  }
}

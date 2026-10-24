/**
 * Trinity HybridBrain v10.4
 * Inteligentné smerovanie výpočtov: Cloudflare Workers / Durable Object vs lokálny PC Bridge.
 */

export class HybridBrain {
  constructor(env = {}) {
    this.env = env;
    this.bridgeAvailable = false;
  }

  async init() {
    this.bridgeAvailable = Boolean(this.env.PC_BRIDGE_SERVICE || this.env.PC_BRIDGE_V2 || this.env.BRIDGE_SHARED_SECRET);
  }

  /**
   * Rozhodne, či úloha beží v cloude alebo sa presmeruje na lokálny PC Bridge.
   * @param {{metaContext: any, clientMeta: any, taskComplexity?: string}} param0
   * @returns {Promise<'CLOUD_DO'|'PC_BRIDGE'>}
   */
  async routeDecision({ metaContext, clientMeta = {}, taskComplexity = 'AUTO' }) {
    await this.init();

    // Ak je explicitly požadovaná lokálna akcia (napr. súbory, procesy, lokálne nástroje)
    const isLocalRequired = metaContext?.semanticIntent === 'ACTION' ||
      clientMeta.requiresLocalExecution === true ||
      taskComplexity === 'LOCAL_BRIDGE';

    // Ak je brána dostupná a úloha si žiada lokálnu akciu, smerujeme na PC_BRIDGE
    if (this.bridgeAvailable && isLocalRequired) {
      return 'PC_BRIDGE';
    }

    return 'CLOUD_DO';
  }

  /**
   * Odošle požiadavku na vykonanie do lokálneho PC Bridge.
   */
  async dispatchToLocalBridge(decision) {
    if (!this.bridgeAvailable) {
      return {
        success: false,
        error: 'PC Bridge nie je nakonfigurovaný ani dostupný.',
        fallbackContext: 'CLOUD_FALLBACK_APPLIED'
      };
    }

    // Skúsime volať interné Cloudflare service binding pre PC Bridge
    const bridgeService = this.env.PC_BRIDGE_V2 || this.env.PC_BRIDGE_SERVICE;
    if (bridgeService && typeof bridgeService.fetch === 'function') {
      try {
        const resp = await bridgeService.fetch('https://pc-bridge.internal/action', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.env.TRINITY_GATEWAY_KEY || this.env.BRIDGE_SHARED_SECRET || ''}`
          },
          body: JSON.stringify(decision)
        });
        const data = await resp.json();
        return { success: true, bridgeData: data, context: 'SERVICE_BINDING' };
      } catch (err) {
        return { success: false, error: err?.message || err, fallbackContext: 'SERVICE_BINDING_ERROR' };
      }
    }

    return {
      success: false, context: 'PC_BRIDGE_UNAVAILABLE', error: 'PC Bridge nie je pripojený.',
      task: decision.task,
      dispatchedAt: new Date().toISOString()
    };
  }
}

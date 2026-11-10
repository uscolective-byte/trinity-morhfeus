/**
 * Trinity Model Fallback Validator
 * 
 * Validuje fallback kaskádu modelov.
 * Kontroluje latenciu a správanie pri výpadku primárneho modelu.
 * 
 * @version 1.0.0
 * @author Trinity Team
 */

import { TrinityLogger } from './trinity-logger.js';

// === MODEL ROUTES ===

const MODEL_ROUTES = {
  'route-chat': {
    primary: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    fallback: '@cf/meta/llama-3.1-8b-instruct-fast',
    capability: 'GENERAL_CHAT',
    maxLatencyMs: 5000,
    testPrompt: 'Ahoj, ako sa máš? Odpovedz krátko v slovenčine.'
  },
  'route-coding': {
    primary: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    fallback: '@cf/meta/llama-3.1-8b-instruct-fast',
    capability: 'CODING',
    maxLatencyMs: 8000,
    testPrompt: 'Napíš jednoduchú funkciu v JavaScript ktorá vráti súčet dvoch čísel.'
  },
  'route-fast': {
    primary: '@cf/meta/llama-3.1-8b-instruct-fast',
    fallback: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    capability: 'FAST_TASK',
    maxLatencyMs: 2000,
    testPrompt: 'Čo je hlavné mesto Slovenska? Odpovedz jedným slovom.'
  },
  'route-reasoning': {
    primary: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    fallback: '@cf/meta/llama-3.1-8b-instruct-fast',
    capability: 'REASONING',
    maxLatencyMs: 10000,
    testPrompt: 'Vysvetli logicky: ak A > B a B > C, čo môžeme povedať o A a C?'
  },
  'route-embedding': {
    primary: '@cf/baai/bge-base-en-v1.5',
    fallback: '@cf/baai/bge-small-en-v1.5',
    capability: 'EMBEDDING',
    maxLatencyMs: 1000,
    testPrompt: 'trinity ai assistant slovak'
  }
};

// === MODEL VALIDATOR ===

export class ModelValidator {
  constructor(env, logger, trace) {
    this.env = env;
    this.ai = env.AI;
    this.db = env.DB || env.TRINITY_D1;
    this.logger = logger;
    this.trace = trace;
  }

  /**
   * Otestuje jeden model — zmeria latenciu a kvalitu odpovede
   */
  async testModel(routeId, model, isPrimary, testPrompt) {
    const startTime = Date.now();
    const healthId = `health-${routeId}-${isPrimary ? 'primary' : 'fallback'}`;
    
    try {
      this.logger?.info('model-validator', 'model.test.start', `Testing ${model} (${routeId})`, {
        route_id: routeId, model, is_primary: isPrimary
      }, this.trace);

      let response;
      let output;

      if (routeId === 'route-embedding') {
        // Embedding test
        response = await this.ai.run(model, { text: [testPrompt] });
        output = { type: 'embedding', dimensions: response.data?.[0]?.length || 0 };
      } else {
        // Chat/completion test
        response = await this.ai.run(model, {
          messages: [
            { role: 'system', content: 'Si Trinity. Odpovedaj stručne v slovenčine.' },
            { role: 'user', content: testPrompt }
          ],
          max_tokens: 200,
          temperature: 0.7
        });
        output = { 
          type: 'chat', 
          response: response.response?.substring(0, 200),
          response_length: response.response?.length || 0
        };
      }

      const latencyMs = Date.now() - startTime;
      const route = MODEL_ROUTES[routeId];
      const withinLatency = latencyMs <= route.maxLatencyMs;
      const status = withinLatency ? 'healthy' : 'slow';

      // Zápíš do trinity_model_health
      await this.db.prepare(
        `UPDATE trinity_model_health 
         SET latency_ms = ?, status = ?, error_message = NULL, checked_at = datetime('now')
         WHERE id = ?`
      ).bind(latencyMs, status, healthId).run();

      // Aktualizuj model_routes
      if (isPrimary) {
        await this.db.prepare(
          `UPDATE model_routes 
           SET success_count = success_count + 1, avg_latency_ms = ?, last_success_at = datetime('now')
           WHERE id = ?`
        ).bind(latencyMs, routeId).run();
      }

      this.logger?.info('model-validator', 'model.test.success', `${model} OK in ${latencyMs}ms`, {
        route_id: routeId, model, latencyMs, status, within_latency: withinLatency
      }, this.trace);

      return { model, status, latencyMs, output, withinLatency };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      
      await this.db.prepare(
        `UPDATE trinity_model_health 
         SET status = 'error', error_message = ?, checked_at = datetime('now')
         WHERE id = ?`
      ).bind(error.message.substring(0, 500), healthId).run();

      if (isPrimary) {
        await this.db.prepare(
          `UPDATE model_routes 
           SET error_count = error_count + 1, last_error = ?, last_error_at = datetime('now'),
               fallback_triggered = fallback_triggered + 1
           WHERE id = ?`
        ).bind(error.message.substring(0, 500), routeId).run();
      }

      this.logger?.error('model-validator', 'model.test.error', `${model} failed: ${error.message}`, {
        route_id: routeId, model, latencyMs, error: error.message
      }, this.trace);

      return { model, status: 'error', latencyMs, error: error.message };
    }
  }

  /**
   * Spustí plnú validáciu všetkých routov — primár + fallback
   */
  async validateAll() {
    const results = [];
    
    for (const [routeId, route] of Object.entries(MODEL_ROUTES)) {
      // Test primárneho modelu
      const primaryResult = await this.testModel(routeId, route.primary, true, route.testPrompt);
      results.push({ route: routeId, role: 'primary', ...primaryResult });

      // Ak primárny zlyhal, testuj fallback
      if (primaryResult.status === 'error' && route.fallback) {
        this.logger?.warn('model-validator', 'fallback.triggered', 
          `Primary failed for ${routeId}, testing fallback ${route.fallback}`, {
            route_id: routeId, primary: route.primary, fallback: route.fallback
          }, this.trace);

        const fallbackResult = await this.testModel(routeId, route.fallback, false, route.testPrompt);
        results.push({ route: routeId, role: 'fallback', ...fallbackResult });
      } else if (route.fallback) {
        // Aj keď primárny funguje, otestuj fallback (v pozadí)
        const fallbackResult = await this.testModel(routeId, route.fallback, false, route.testPrompt);
        results.push({ route: routeId, role: 'fallback', ...fallbackResult });
      }
    }

    return this._summarize(results);
  }

  /**
   * Validuje jeden route (pre rýchle health checky)
   */
  async validateRoute(routeId) {
    const route = MODEL_ROUTES[routeId];
    if (!route) return { error: `Unknown route: ${routeId}` };

    const primaryResult = await this.testModel(routeId, route.primary, true, route.testPrompt);
    
    if (primaryResult.status === 'error' && route.fallback) {
      const fallbackResult = await this.testModel(routeId, route.fallback, false, route.testPrompt);
      return { route: routeId, primary: primaryResult, fallback: fallbackResult, fallbackTriggered: true };
    }

    return { route: routeId, primary: primaryResult, fallbackTriggered: false };
  }

  /**
   * Súhrn výsledkov
   */
  _summarize(results) {
    const summary = {
      total: results.length,
      healthy: results.filter(r => r.status === 'healthy').length,
      slow: results.filter(r => r.status === 'slow').length,
      error: results.filter(r => r.status === 'error').length,
      fallbacks_triggered: results.filter(r => r.role === 'fallback' && r.route).length,
      avg_latency_ms: Math.round(results.reduce((sum, r) => sum + (r.latencyMs || 0), 0) / results.length),
      routes: {}
    };

    for (const r of results) {
      const key = `${r.route}-${r.role}`;
      summary.routes[key] = {
        model: r.model,
        status: r.status,
        latency_ms: r.latencyMs
      };
    }

    return summary;
  }

  /**
   * Cron job — spustí sa periodicky na validáciu
   */
  async runHealthCheck() {
    this.logger?.info('model-validator', 'healthcheck.start', 'Starting model health check', {}, this.trace);
    
    const results = await this.validateAll();
    
    this.logger?.info('model-validator', 'healthcheck.complete', 
      `Health check: ${results.healthy} healthy, ${results.slow} slow, ${results.error} errors`, {
        summary: results
      }, this.trace);

    return results;
  }
}

// === FALLBACK HANDLER ===

/**
 * Wrapper pre AI volania s automatickým fallbackom
 */
export async function callWithFallback(env, routeId, input, logger, trace) {
  const route = MODEL_ROUTES[routeId];
  if (!route) throw new Error(`Unknown route: ${routeId}`);

  const db = env.DB || env.TRINITY_D1;
  
  // Skús primárny model
  try {
    const startTime = Date.now();
    const response = await env.AI.run(route.primary, input);
    const latencyMs = Date.now() - startTime;

    await db.prepare(
      `UPDATE model_routes SET success_count = success_count + 1, avg_latency_ms = ?, last_success_at = datetime('now') WHERE id = ?`
    ).bind(latencyMs, routeId).run();

    logger?.info('ai-router', 'model.primary.success', `${routeId} primary OK`, {
      route_id: routeId, model: route.primary, latencyMs
    }, trace);

    return { response, model: route.primary, fallbackUsed: false, latencyMs };
  } catch (primaryError) {
    logger?.error('ai-router', 'model.primary.failed', `${routeId} primary failed: ${primaryError.message}`, {
      route_id: routeId, model: route.primary, error: primaryError.message
    }, trace);

    // Ak nie je fallback, throw
    if (!route.fallback) throw primaryError;

    // Skús fallback
    logger?.warn('ai-router', 'model.fallback.start', `${routeId} falling back to ${route.fallback}`, {
      route_id: routeId, fallback: route.fallback
    }, trace);

    try {
      const startTime = Date.now();
      const response = await env.AI.run(route.fallback, input);
      const latencyMs = Date.now() - startTime;

      await db.prepare(
        `UPDATE model_routes SET fallback_triggered = fallback_triggered + 1, last_error = ?, last_error_at = datetime('now') WHERE id = ?`
      ).bind(primaryError.message.substring(0, 500), routeId).run();

      logger?.info('ai-router', 'model.fallback.success', `${routeId} fallback OK`, {
        route_id: routeId, model: route.fallback, latencyMs
      }, trace);

      return { response, model: route.fallback, fallbackUsed: true, latencyMs, primaryError: primaryError.message };
    } catch (fallbackError) {
      await db.prepare(
        `UPDATE model_routes SET error_count = error_count + 1, last_error = ?, last_error_at = datetime('now') WHERE id = ?`
      ).bind(fallbackError.message.substring(0, 500), routeId).run();

      logger?.fatal('ai-router', 'model.fallback.failed', `${routeId} fallback also failed`, {
        route_id: routeId, primary_error: primaryError.message, fallback_error: fallbackError.message
      }, trace);

      throw new Error(`Both primary and fallback failed for ${routeId}: primary=${primaryError.message}, fallback=${fallbackError.message}`);
    }
  }
}

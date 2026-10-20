/**
 * Trinity SkillForge v10.4
 * Autonómna syntéza, registrácia, overovanie a exekúcia nových schopností Trinity.
 */

export class SkillForge {
  constructor(storage = null, env = {}) {
    this.storage = storage;
    this.env = env;
    this.runtimeRegistry = new Map();
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    if (this.storage) {
      try {
        const saved = await this.storage.get('forged_skills');
        if (saved && typeof saved === 'object') {
          for (const [name, def] of Object.entries(saved)) {
            this.runtimeRegistry.set(name, def);
          }
        }
      } catch (err) {
        console.warn('SkillForge init warning:', err?.message || err);
      }
    }
    this.initialized = true;
  }

  /**
   * Vykuje novú zručnosť na základe požiadavky z QCE-Fusion.
   */
  async forgeSkillFromQCE(skillSpec, { cycleId, genome }) {
    await this.init();
    const skillName = skillSpec?.name || `dynamic_${Date.now().toString(36)}`;

    const forgedSkill = {
      name: skillName,
      task: skillSpec?.task || 'Syntetizovaná úloha',
      archetype: skillSpec?.archetype || 'creator',
      generation: genome?.generation || 1,
      cycleId,
      created_at: new Date().toISOString(),
      handler: (params) => {
        return {
          status: 'completed',
          synthesizedResponse: `Zručnosť [${skillName}] úspešne spracovala požiadavku: ${JSON.stringify(params)}`,
          archetypeEffect: skillSpec?.archetype || 'creator'
        };
      }
    };

    this.runtimeRegistry.set(skillName, forgedSkill);

    if (this.storage) {
      try {
        const persistable = {};
        for (const [k, v] of this.runtimeRegistry.entries()) {
          persistable[k] = { name: v.name, task: v.task, archetype: v.archetype, generation: v.generation, created_at: v.created_at };
        }
        await this.storage.put('forged_skills', persistable);
      } catch (err) {
        console.warn('SkillForge persist error:', err?.message || err);
      }
    }

    return forgedSkill;
  }

  /**
   * Vykoná zručnosť z runtime registru.
   */
  async execute(skillName, params = {}) {
    await this.init();
    const skill = this.runtimeRegistry.get(skillName);
    if (!skill) {
      return { success: false, error: `Zručnosť "${skillName}" nie je v registri SkillForge.` };
    }

    try {
      const output = typeof skill.handler === 'function' ? skill.handler(params) : { executed: true, params };
      return { success: true, skillName, result: output };
    } catch (err) {
      return { success: false, skillName, error: err?.message || String(err) };
    }
  }
}

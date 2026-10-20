/**
 * Trinity Copilot Plugin Ecosystem
 * Poskytuje správu pluginov pre Trinity Copilot:
 * - Registrácia pluginov s metadátami, závislosťami a zoznamom skillov
 * - Vstavané pluginy (Core, PowerPlatform, WebResearch, Media, Analytics, PCBridge, Dialog)
 * - Podpora pre dynamické zapínanie / vypínanie pluginov
 */

export const BUILTIN_COPILOT_PLUGINS = [
  {
    id:'integration-diagnostics',name:'Integration Configuration Diagnostics',version:'1.0.0',
    description:'Kontrola konfigurácie AI, Copilot Studio a PC Bridge bez odhalenia tajomstiev; živé spojenie vyžaduje samostatný test.',
    skills:['integrationReadiness'],category:'integration',enabled:true,required:false
  },
  {
    id: 'core-copilot',
    name: 'Core Copilot Pack',
    version: '1.0.0',
    description: 'Základné robustné mechanizmy: validácia, timeout, circuit-breaker, retry a audit.',
    skills: ['validateInput', 'withTimeout', 'checkHttpStatus', 'checkResponseStructure', 'logAudit', 'withRetry', 'circuitBreaker', 'rateLimiter', 'cacheGet', 'cachePut', 'recordMetrics'],
    category: 'core',
    enabled: true,
    required: true
  },
  {
    id: 'powerplatform-connector',
    name: 'Power Platform & Dynamics 365 Dataverse Connector',
    version: '2.0.0',
    description: 'Integrácia s Microsoft Power Platform, Dynamics 365 Dataverse (CRM) a Copilot Studio.',
    skills: ['callPowerPlatform', 'dataverseWhoAmI', 'dataverseQuery', 'dataverseCreateRecord', 'dataverseUpdateRecord', 'dataverseDeleteRecord'],
    category: 'integration',
    enabled: true,
    required: false
  },
  {
    id: 'web-researcher',
    name: 'Web Research Plugin',
    version: '1.0.0',
    description: 'Webové vyhľadávanie a extrakcia relevantných úryvkov zo zdrojov.',
    skills: ['webSearch'],
    category: 'integration',
    enabled: true,
    required: false
  },
  {
    id: 'media-studio',
    name: 'Media & Image Generation Plugin',
    version: '1.0.0',
    description: 'Tvorba obrázkov cez Workers AI a ukladanie médií do R2.',
    skills: ['generateImage', 'r2Store', 'r2Get'],
    category: 'media',
    enabled: true,
    required: false
  },
  {
    id: 'data-analytics',
    name: 'Data & Text Analytics Plugin',
    version: '1.0.0',
    description: 'Analýza textu, detekcia sentimentu, presné výpočty a štatistika.',
    skills: ['analyzeText', 'calculate', 'statistics'],
    category: 'analytics',
    enabled: true,
    required: false
  },
  {
    id: 'pc-bridge-automation',
    name: 'PC Bridge & Git Automation Plugin',
    version: '1.0.0',
    description: 'Spúšťanie lokálnych overených skriptov s SHA-256 a Git operácie.',
    skills: ['pcRunScript', 'pcGitCommit', 'pcGitPr'],
    category: 'automation',
    enabled: true,
    required: false
  },
  {
    id: 'dialog-experience',
    name: 'Dialog & User Experience Plugin',
    version: '1.0.0',
    description: 'Správa histórie relácií, viacjazyčnosť, fallback, bohaté formátovanie a sanitizácia.',
    skills: ['dialogManagement', 'detectLanguage', 'multilingualSupport', 'fallbackHandler', 'formatRichResponse', 'rateLimitedFeedback', 'securitySanitise'],
    category: 'user',
    enabled: true,
    required: true
  },
  {
    id: 'security-devops',
    name: 'Security & DevOps Toolkit',
    version: '1.1.0',
    description: 'Audit kódu, refactoring, kontrola SQL dotazov, kryptografické hashe, semver a JWT analýza.',
    skills: ['codeRefactor', 'sqlValidate', 'cryptoHash', 'diffCompare', 'semverCheck', 'jwtDecode'],
    category: 'security',
    enabled: true,
    required: false
  },
  {
    id: 'data-intelligence',
    name: 'Data Intelligence & Processing',
    version: '1.1.0',
    description: 'Inteligentná transformácia JSON ciest, RFC CSV parser, štatistika a Base64 kódovanie.',
    skills: ['jsonTransform', 'csvParse', 'statistics', 'analyzeText', 'base64Codec'],
    category: 'analytics',
    enabled: true,
    required: false
  },
  {
    id: 'web-standards',
    name: 'Web Standards & Network Defense',
    version: '1.1.0',
    description: 'Sanitizácia HTML, Markdown kompilátor, analýza URL a validácia IP adries.',
    skills: ['htmlSanitize', 'markdownToHtml', 'urlParse', 'ipCheck', 'colorPalette'],
    category: 'web',
    enabled: true,
    required: false
  },
  {
    id: 'cloud-worker-ops',
    name: 'Cloudflare Worker Operations & Telemetry',
    version: '1.1.0',
    description: 'Telemetria workerov, hodnotenie latencie, chybovosti a ochrana pred preťažením.',
    skills: ['cloudMetricEvaluate', 'checkHttpStatus', 'circuitBreaker', 'rateLimiter', 'recordMetrics'],
    category: 'cloud',
    enabled: true,
    required: false
  },
  {
    id: 'gemini-developer-pack',
    name: 'Gemini Developer Agent & Automation Suite',
    version: '1.0.0',
    description: 'Vývoj a správa Trinity cez Gemini: diagnostika, spúšťanie overených príkazov, inšpekcia súborov a nasadzovanie.',
    skills: ['geminiDevStatus', 'geminiDevRunCommand', 'geminiDevFileInspect', 'geminiDevDeploy'],
    category: 'automation',
    enabled: true,
    required: false
  },
  {
    id: 'ai-studio-builder',
    name: 'AI Studio Builder Plugin',
    version: '1.0.0',
    description: 'Copilot agent vytvára, upravuje a vypisuje weby v Trinity AI Studio.',
    skills: ['aiStudioBuild', 'aiStudioRevise', 'aiStudioList'],
    category: 'automation',
    enabled: true,
    required: false
  },
  {
    id: 'copilot-studio-agent',
    name: 'Microsoft Copilot Studio Agent (Direct Line)',
    version: '1.0.0',
    description: 'Trinity kladie otázky agentovi z Microsoft Copilot Studio cez webový kanál Direct Line.',
    skills: ['copilotStudioAsk'],
    category: 'integration',
    enabled: true,
    required: false
  },
  {
    id: 'productivity-plus',
    name: 'Productivity Plus',
    version: '1.0.0',
    description: 'Praktické nástroje: slug, čas čítania, extraktívne zhrnutie, rozdiel dátumov a cron plán.',
    skills: ['slugify', 'readingTime', 'extractiveSummary', 'dateDiff', 'cronNextRuns'],
    category: 'analytics',
    enabled: true,
    required: false
  }
];

class CopilotPluginRegistry {
  constructor() {
    this._plugins = new Map();
    for (const plugin of BUILTIN_COPILOT_PLUGINS) {
      this._plugins.set(plugin.id, { ...plugin });
    }
  }

  register(plugin) {
    if (!plugin?.id || !plugin?.name) {
      throw new Error('Plugin musí obsahovať aspoň id a name.');
    }
    const existing = this._plugins.get(plugin.id);
    if (existing?.required) {
      throw new Error(`Povinný systémový plugin '${plugin.id}' nie je možné prepísať.`);
    }
    this._plugins.set(plugin.id, {
      ...plugin,
      version: plugin.version || '1.0.0',
      enabled: plugin.enabled ?? true,
      registeredAt: new Date().toISOString()
    });
    return this._plugins.get(plugin.id);
  }

  get(id) {
    return this._plugins.get(id) || null;
  }

  list() {
    return Array.from(this._plugins.values());
  }

  enable(id) {
    const plugin = this._plugins.get(id);
    if (!plugin) throw new Error(`Plugin '${id}' neexistuje.`);
    plugin.enabled = true;
    return plugin;
  }

  disable(id) {
    const plugin = this._plugins.get(id);
    if (!plugin) throw new Error(`Plugin '${id}' neexistuje.`);
    if (plugin.required) {
      throw new Error(`Povinný plugin '${id}' nie je možné vypnúť.`);
    }
    plugin.enabled = false;
    return plugin;
  }

  isSkillEnabled(skillName) {
    for (const plugin of this._plugins.values()) {
      if (plugin.enabled && Array.isArray(plugin.skills) && plugin.skills.includes(skillName)) {
        return true;
      }
    }
    return false;
  }
}

export const copilotPluginRegistry = new CopilotPluginRegistry();
export const copilotPlugins = BUILTIN_COPILOT_PLUGINS;

export function assertCopilotSkillEnabled(name) {
  const owners=copilotPluginRegistry.list().filter(plugin=>plugin.skills?.includes(name));
  if(owners.length&&!owners.some(plugin=>plugin.enabled))throw new Error(`Plugin pre skill '${name}' je vypnutý.`);
}

import { z } from 'zod';
import { HttpError } from './security.js';
import { domainNameSchema, getDomain, createDomain, addDnsRecord } from './domains.js';
import { getStudioProject } from './studio.js';
import { recordStepDocument } from './trinity-documents.js';

const DOMAIN_ENVS_KV_KEY = 'assistant:domains:environments';

export const ENVIRONMENT_NAMES = ['production', 'staging', 'preview', 'development'];
export const ENVIRONMENT_TEMPLATES = [
  'ai_saas',
  'business_landing',
  'domain_for_sale',
  'ecommerce_checkout',
  'portfolio',
  'studio_project',
  'custom_html'
];

export const provisionDomainEnvSchema = z.object({
  domain_name: domainNameSchema,
  registrar: z.string().trim().max(50).optional().default('cloudflare'),
  template: z.enum(ENVIRONMENT_TEMPLATES).optional().default('ai_saas'),
  title: z.string().trim().max(140).optional(),
  subtitle: z.string().trim().max(300).optional(),
  ssl_mode: z.enum(['flexible', 'full', 'strict']).optional().default('strict'),
  proxied: z.boolean().optional().default(true),
  waf_enabled: z.boolean().optional().default(true),
  cache_level: z.enum(['bypass', 'standard', 'aggressive']).optional().default('standard'),
  auto_create_dns: z.boolean().optional().default(true),
  sale_price_eur: z.number().min(0).max(10000000).optional().nullable(),
  payment_checkout_url: z.string().max(2048).optional().default('')
}).strict();

export const deployDomainEnvSchema = z.object({
  domain_name: domainNameSchema,
  environment: z.enum(ENVIRONMENT_NAMES).default('production'),
  template: z.enum(ENVIRONMENT_TEMPLATES).default('ai_saas'),
  title: z.string().trim().max(140).optional(),
  subtitle: z.string().trim().max(400).optional(),
  cta_text: z.string().trim().max(80).optional().default('Objednať / Kontaktovať'),
  cta_url: z.string().trim().max(2048).optional().default('/api/payments/catalog'),
  studio_project_id: z.string().uuid().optional().nullable(),
  custom_html: z.string().max(250000).optional().default(''),
  ssl_mode: z.enum(['flexible', 'full', 'strict']).optional().default('strict'),
  proxied: z.boolean().optional().default(true),
  waf_enabled: z.boolean().optional().default(true),
  cache_level: z.enum(['bypass', 'standard', 'aggressive']).optional().default('standard'),
  env_vars: z.record(z.string().max(60), z.string().max(500)).optional().default({})
}).strict();

const memStore = new Map();

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function readEnvironmentsMap(env) {
  if (env?.Mastermind?.get) {
    try {
      const raw = await env.Mastermind.get(DOMAIN_ENVS_KV_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {}
  }
  if (env?.DB?.prepare) {
    try {
      const row = await env.DB.prepare("SELECT value FROM ops_memory WHERE key = ?").bind(DOMAIN_ENVS_KV_KEY).first();
      if (row?.value) {
        const parsed = JSON.parse(row.value);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {}
  }
  return memStore.get(DOMAIN_ENVS_KV_KEY) || {};
}

async function writeEnvironmentsMap(env, mapObj) {
  const serialized = JSON.stringify(mapObj);
  memStore.set(DOMAIN_ENVS_KV_KEY, mapObj);
  if (env?.Mastermind?.put) {
    try {
      await env.Mastermind.put(DOMAIN_ENVS_KV_KEY, serialized);
    } catch {}
  }
  if (env?.DB?.prepare) {
    try {
      await env.DB.prepare(
        "INSERT INTO ops_memory(key,value,source) VALUES(?,?,'domain-environments') ON CONFLICT(key) DO UPDATE SET value=excluded.value,source='domain-environments',updated_at=datetime('now')"
      ).bind(DOMAIN_ENVS_KV_KEY, serialized).run();
    } catch {}
  }
  return mapObj;
}

export function generateEnvironmentHtml({
  domain_name,
  environment = 'production',
  template = 'ai_saas',
  title,
  subtitle,
  cta_text = 'Spustiť spoluprácu',
  cta_url = '/api/payments/catalog',
  version = 1,
  ssl_mode = 'strict',
  proxied = true,
  waf_enabled = true,
  env_vars = {}
}) {
  const host = environment === 'production' ? domain_name : `${environment}.${domain_name}`;
  const pageTitle = title || `${domain_name.toUpperCase()} · ${environment.toUpperCase()}`;
  const pageSubtitle = subtitle || (
    template === 'domain_for_sale'
      ? `Prémiová doména ${domain_name} je pripravená na okamžitý predaj alebo prenájom s priamou platbou cez Revolut Pro a PayPal.`
      : template === 'ecommerce_checkout'
        ? `Rýchly predajný a objednávkový portál na doméne ${host} s okamžitým presmerovaním na Revolut Pro alebo PayPal.`
        : `Cloudové prostredie (${environment}) pre doménu ${domain_name}, spravované a nasadené priamo cez Trinity Cloud Control Plane.`
  );

  const badgeColor = environment === 'production' ? '#10b981' : environment === 'staging' ? '#f59e0b' : '#38bdf8';
  const envEntries = Object.entries(env_vars || {});

  return `<!doctype html>
<html lang="sk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(pageTitle)}</title>
  <style>
    :root { --accent: ${badgeColor}; --bg: #070d19; --card: rgba(15,23,42,0.85); --text: #f8fafc; --muted: #94a3b8; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: radial-gradient(circle at top right, #1e293b, var(--bg) 65%); color: var(--text); min-height: 100vh; padding: 2.5rem 1.5rem; line-height: 1.6; }
    .container { max-width: 980px; margin: 0 auto; }
    header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem; padding-bottom: 1.5rem; border-bottom: 1px solid rgba(148,163,184,0.18); margin-bottom: 2.5rem; }
    .brand { font-weight: 800; font-size: 1.25rem; letter-spacing: 0.04em; display: flex; align-items: center; gap: 0.6rem; }
    .dot { width: 11px; height: 11px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 12px var(--accent); }
    .badges { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .badge { font-size: 0.75rem; font-weight: 700; padding: 0.28rem 0.7rem; border-radius: 999px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14); color: var(--text); }
    .badge.env { background: ${badgeColor}22; border-color: var(--accent); color: var(--accent); }
    .hero { background: var(--card); border: 1px solid rgba(148,163,184,0.2); border-radius: 20px; padding: 2.5rem; margin-bottom: 2rem; box-shadow: 0 20px 50px rgba(0,0,0,0.35); }
    .hero h1 { font-size: clamp(1.9rem, 4vw, 3rem); line-height: 1.15; margin-bottom: 1rem; }
    .hero p { color: var(--muted); font-size: 1.1rem; max-width: 720px; margin-bottom: 1.75rem; }
    .cta-row { display: flex; flex-wrap: wrap; gap: 0.85rem; }
    .btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.8rem 1.5rem; border-radius: 12px; font-weight: 700; text-decoration: none; background: var(--accent); color: #04101c; transition: transform 0.15s ease; }
    .btn.secondary { background: rgba(255,255,255,0.07); color: var(--text); border: 1px solid rgba(255,255,255,0.16); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem; }
    .card { background: var(--card); border: 1px solid rgba(148,163,184,0.16); border-radius: 16px; padding: 1.5rem; }
    .card h3 { font-size: 1.05rem; margin-bottom: 0.45rem; color: var(--accent); }
    .card p { font-size: 0.92rem; color: var(--muted); }
    footer { margin-top: 3rem; padding-top: 1.25rem; border-top: 1px solid rgba(148,163,184,0.14); color: var(--muted); font-size: 0.85rem; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand"><span class="dot"></span><span>${escapeHtml(host)}</span></div>
      <div class="badges">
        <span class="badge env">${escapeHtml(environment.toUpperCase())} · v${Number(version) || 1}</span>
        <span class="badge">SSL: ${escapeHtml(ssl_mode.toUpperCase())}</span>
        <span class="badge">${proxied ? '☁️ Cloudflare Proxy ON' : 'DNS Only'}</span>
        <span class="badge">${waf_enabled ? '🛡️ WAF Active' : 'WAF Off'}</span>
      </div>
    </header>
    <main>
      <section class="hero">
        <h1>${escapeHtml(pageTitle)}</h1>
        <p>${escapeHtml(pageSubtitle)}</p>
        <div class="cta-row">
          <a class="btn" href="${escapeHtml(cta_url)}">${escapeHtml(cta_text)} →</a>
          <a class="btn secondary" href="/">Trinity Workspace</a>
        </div>
      </section>
      <section class="grid">
        <article class="card">
          <h3>⚡ Cloudflare Edge Runtime</h3>
          <p>Prostredie <b>${escapeHtml(environment)}</b> beží na globálnej infraštruktúre s okamžitým prepínaním verzií a nulovým výpadkom.</p>
        </article>
        <article class="card">
          <h3>💳 Revolut Pro & PayPal Ready</h3>
          <p>Priame napojenie na overené platobné odkazy pre okamžitý predaj služieb, licencií alebo prenájom domény.</p>
        </article>
        <article class="card">
          <h3>🔒 Bezpečnosť & DNS</h3>
          <p>Automatická správa DNS záznamov, ${escapeHtml(ssl_mode)} TLS šifrovanie a ochrana aplikácie.</p>
        </article>
      </section>
      ${envEntries.length ? `<section class="card" style="margin-top:1.25rem"><h3>Premenné prostredia (${escapeHtml(environment)})</h3><p>${envEntries.map(([k, v]) => `<code>${escapeHtml(k)}=${escapeHtml(v)}</code>`).join(' · ')}</p></section>` : ''}
    </main>
    <footer>
      <span>Doména: <b>${escapeHtml(domain_name)}</b> · Šablóna: <b>${escapeHtml(template)}</b></span>
      <span>Powered by Trinity Cloud Control Plane</span>
    </footer>
  </div>
</body>
</html>`;
}

function buildDefaultEnvironmentEntry(domain_name, envName, opts = {}) {
  const host = envName === 'production' ? domain_name : `${envName}.${domain_name}`;
  const version = 1;
  const template = opts.template || 'ai_saas';
  const title = opts.title || `${domain_name} (${envName.toUpperCase()})`;
  const subtitle = opts.subtitle || '';
  const ssl_mode = opts.ssl_mode || 'strict';
  const proxied = opts.proxied !== false;
  const waf_enabled = opts.waf_enabled !== false;
  const cache_level = opts.cache_level || 'standard';
  const cta_url = opts.payment_checkout_url || '/api/payments/catalog';
  const html = generateEnvironmentHtml({
    domain_name,
    environment: envName,
    template,
    title,
    subtitle,
    cta_url,
    version,
    ssl_mode,
    proxied,
    waf_enabled
  });
  return {
    environment: envName,
    hostname: host,
    status: 'deployed',
    version,
    template,
    title,
    subtitle,
    ssl_mode,
    proxied,
    waf_enabled,
    cache_level,
    env_vars: {},
    live_path: `/sites/${domain_name}/${envName}`,
    html,
    updated_at: new Date().toISOString()
  };
}

export async function provisionDomainWithEnvironments(env, actor = 'owner', rawInput = {}) {
  const input = provisionDomainEnvSchema.parse(rawInput);
  const domain_name = input.domain_name;

  let domainRecord = null;
  if (env?.DB?.prepare) {
    try {
      domainRecord = await getDomain(env, domain_name);
      if (!domainRecord) {
        domainRecord = await createDomain(env, {
          domain_name,
          registrar: input.registrar || 'cloudflare',
          status: input.sale_price_eur ? 'for_sale' : 'active',
          listing_type: input.sale_price_eur ? 'sale' : 'none',
          sale_price: input.sale_price_eur || null,
          notes: `Vytvorené cez Trinity Cloudflare Control Plane (${input.template})`
        });
      }
      if (input.auto_create_dns && domainRecord?.id) {
        const existingDns = await env.DB.prepare('SELECT COUNT(*) AS count FROM domain_dns_records WHERE domain_id=?').bind(domainRecord.id).first().catch(() => ({ count: 0 }));
        if (!existingDns?.count) {
          await addDnsRecord(env, domainRecord.id, { type: 'A', name: '@', content: '192.0.2.1', ttl: 1, proxied: input.proxied }).catch(() => {});
          await addDnsRecord(env, domainRecord.id, { type: 'CNAME', name: 'staging', content: domain_name, ttl: 1, proxied: input.proxied }).catch(() => {});
          await addDnsRecord(env, domainRecord.id, { type: 'CNAME', name: 'dev', content: domain_name, ttl: 1, proxied: input.proxied }).catch(() => {});
        }
      }
    } catch {}
  }

  const allMap = await readEnvironmentsMap(env);
  const environments = {
    production: buildDefaultEnvironmentEntry(domain_name, 'production', input),
    staging: buildDefaultEnvironmentEntry(domain_name, 'staging', input),
    development: buildDefaultEnvironmentEntry(domain_name, 'development', input)
  };

  const entry = {
    domain_name,
    domain_id: domainRecord?.id || crypto.randomUUID(),
    registrar: input.registrar || 'cloudflare',
    ssl_mode: input.ssl_mode,
    proxied: input.proxied,
    waf_enabled: input.waf_enabled,
    cache_level: input.cache_level,
    environments,
    created_at: allMap[domain_name]?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    updated_by: actor
  };

  allMap[domain_name] = entry;
  await writeEnvironmentsMap(env, allMap);

  await recordStepDocument(env, {
    title: `Vytvorenie domény a Cloudflare prostredí: ${domain_name}`,
    category: 'domain_production',
    step_name: `domain_env_provision:${domain_name}`,
    actor,
    summary: `Doména ${domain_name} bola vytvorená so všetkými prostrediami (production, staging, development), DNS záznamami a nasadenou šablónou ${input.template}.`,
    content: [
      `### Konfigurácia domény \`${domain_name}\``,
      `- **Registrátor / Control Plane**: \`${entry.registrar}\``,
      `- **SSL/TLS režim**: \`${entry.ssl_mode}\``,
      `- **Cloudflare Proxy**: \`${entry.proxied ? 'Zapnuté (Orange Cloud)' : 'DNS Only'}\``,
      `- **WAF ochrana**: \`${entry.waf_enabled ? 'Aktívna' : 'Vypnutá'}\``,
      '',
      '### Vytvorené prostredia (Environments)',
      `- **Production**: \`/sites/${domain_name}/production\` (${environments.production.hostname})`,
      `- **Staging**: \`/sites/${domain_name}/staging\` (${environments.staging.hostname})`,
      `- **Development**: \`/sites/${domain_name}/development\` (${environments.development.hostname})`
    ].join('\n'),
    receipt_id: `domain-provision:${domain_name}`,
    tags: ['cloudflare', 'domain', domain_name, 'environments']
  });

  return {
    ok: true,
    domain: domainRecord || { id: entry.domain_id, domain_name, status: 'active' },
    control_plane: entry
  };
}

export async function deployDomainEnvironment(env, actor = 'owner', rawInput = {}) {
  const input = deployDomainEnvSchema.parse(rawInput);
  const { domain_name, environment } = input;
  const allMap = await readEnvironmentsMap(env);

  if (!allMap[domain_name]) {
    await provisionDomainWithEnvironments(env, actor, {
      domain_name,
      template: input.template,
      title: input.title,
      subtitle: input.subtitle,
      ssl_mode: input.ssl_mode,
      proxied: input.proxied,
      waf_enabled: input.waf_enabled,
      cache_level: input.cache_level
    });
  }

  const refreshedMap = await readEnvironmentsMap(env);
  const domainEntry = refreshedMap[domain_name];
  const prevEnv = domainEntry.environments?.[environment] || {};
  const nextVersion = (Number(prevEnv.version) || 0) + 1;

  let html = '';
  if (input.template === 'studio_project' && input.studio_project_id) {
    const project = await getStudioProject(env, 'primary', input.studio_project_id);
    html = project.html;
  } else if (input.template === 'custom_html' && input.custom_html.trim()) {
    html = input.custom_html;
  } else {
    html = generateEnvironmentHtml({
      domain_name,
      environment,
      template: input.template,
      title: input.title || prevEnv.title || `${domain_name} · ${environment.toUpperCase()}`,
      subtitle: input.subtitle || prevEnv.subtitle || '',
      cta_text: input.cta_text,
      cta_url: input.cta_url,
      version: nextVersion,
      ssl_mode: input.ssl_mode,
      proxied: input.proxied,
      waf_enabled: input.waf_enabled,
      env_vars: input.env_vars
    });
  }

  const updatedEnv = {
    environment,
    hostname: environment === 'production' ? domain_name : `${environment}.${domain_name}`,
    status: 'deployed',
    version: nextVersion,
    template: input.template,
    studio_project_id: input.studio_project_id || null,
    title: input.title || prevEnv.title || `${domain_name} (${environment})`,
    subtitle: input.subtitle || prevEnv.subtitle || '',
    cta_text: input.cta_text,
    cta_url: input.cta_url,
    ssl_mode: input.ssl_mode,
    proxied: input.proxied,
    waf_enabled: input.waf_enabled,
    cache_level: input.cache_level,
    env_vars: input.env_vars || {},
    live_path: `/sites/${domain_name}/${environment}`,
    html,
    updated_at: new Date().toISOString(),
    deployed_by: actor
  };

  domainEntry.environments[environment] = updatedEnv;
  domainEntry.ssl_mode = input.ssl_mode;
  domainEntry.proxied = input.proxied;
  domainEntry.waf_enabled = input.waf_enabled;
  domainEntry.cache_level = input.cache_level;
  domainEntry.updated_at = new Date().toISOString();
  refreshedMap[domain_name] = domainEntry;

  await writeEnvironmentsMap(env, refreshedMap);

  await recordStepDocument(env, {
    title: `Nasadenie prostredia ${environment.toUpperCase()} pre doménu ${domain_name} (v${nextVersion})`,
    category: 'domain_production',
    step_name: `domain_env_deploy:${domain_name}:${environment}`,
    actor,
    summary: `Prostredie ${environment} domény ${domain_name} bolo vyprodukované a nasadené vo verzii v${nextVersion} (šablóna: ${input.template}).`,
    content: [
      `### Detail produkčného nasadenia`,
      `- **Doména**: \`${domain_name}\``,
      `- **Prostredie**: \`${environment}\` (verzia \`v${nextVersion}\`)`,
      `- **Hostname**: \`${updatedEnv.hostname}\``,
      `- **Živá URL cesta**: \`${updatedEnv.live_path}\``,
      `- **Šablóna / Zdroj**: \`${input.template}\``,
      `- **SSL / Proxy / WAF**: \`${input.ssl_mode}\` / \`${input.proxied ? 'Proxied' : 'DNS Only'}\` / \`${input.waf_enabled ? 'WAF ON' : 'WAF OFF'}\``
    ].join('\n'),
    receipt_id: `domain-deploy:${domain_name}:${environment}:v${nextVersion}`,
    tags: ['deploy', domain_name, environment, `v${nextVersion}`]
  });

  return {
    ok: true,
    domain_name,
    environment: updatedEnv,
    control_plane: domainEntry
  };
}

export const TWENTY_STARTER_CLOUDFLARE_DOMAINS = [
  { domain_name: 'auru.space', template: 'ai_saas', title: 'Auru Space · Verejný Klientsky Portál Trinity', subtitle: 'Oficiálny produkčný portál a klientska zóna pre bežných používateľov. Asistent, katalóg riešení, klientska zóna a bezpečné rozhranie bez prístupu k internému riadeniu.', status: 'active', listing_type: 'none', sale_price: null, lease_price_monthly: null },
  { domain_name: 'auru.dev', template: 'ai_saas', title: 'Auru Dev · Sovereign Admin & Owner Trinity Lab', subtitle: 'Súkromné riadiace a vývojové centrum vlastníka (Ivan Sabo / Basterix). Plné admin a owner práva, Morpheus Social Commander, terminál a nástroje Trinity.', status: 'active', listing_type: 'none', sale_price: null, lease_price_monthly: null },
  { domain_name: 'trinity-ai.sk', template: 'ai_saas', title: 'Trinity AI Slovensko · Firemná AI na kľúč', subtitle: 'Prémiová slovenská doména pre AI agentúru, chatboty a firemné automatizácie.', status: 'for_sale', listing_type: 'both', sale_price: 1490, lease_price_monthly: 79 },
  { domain_name: 'quantum-studio.eu', template: 'portfolio', title: 'Quantum Creative Studio EU', subtitle: 'Európske digitálne a multimediálne štúdio pre tvorbu webov, videa, hudby a dizajnu.', status: 'for_sale', listing_type: 'both', sale_price: 1290, lease_price_monthly: 69 },
  { domain_name: 'cloud-architekt.sk', template: 'business_landing', title: 'Cloud Architekt · Cloudflare & Serverless', subtitle: 'Návrh, správa a zrýchlenie podnikových webov na Cloudflare Workers a D1.', status: 'for_sale', listing_type: 'both', sale_price: 890, lease_price_monthly: 49 },
  { domain_name: 'fintech-desk.eu', template: 'ai_saas', title: 'Fintech & Commodity Desk Europe', subtitle: 'Platforma pre komoditnú analytiku, SEPA QR platby a finančné riadenie.', status: 'for_sale', listing_type: 'both', sale_price: 1990, lease_price_monthly: 99 },
  { domain_name: 'ai-automatizacia.sk', template: 'ai_saas', title: 'AI Automatizácia pre firmy', subtitle: 'Automatické spracovanie dopytov, faktúr, e-mailov a zákazníckej podpory 24/7.', status: 'for_sale', listing_type: 'both', sale_price: 1190, lease_price_monthly: 59 },
  { domain_name: 'digitalny-predaj.sk', template: 'ecommerce_checkout', title: 'Digitálny Predaj & PayPal Checkout', subtitle: 'Rýchly predajný portál pre digitálne produkty, kurzy a služby s okamžitou platbou.', status: 'for_sale', listing_type: 'both', sale_price: 790, lease_price_monthly: 45 },
  { domain_name: 'smart-webstranky.sk', template: 'business_landing', title: 'Smart Webstránky na kľúč', subtitle: 'Moderné responzívne weby s vysokou konverziou, SEO a okamžitým nasadením.', status: 'for_sale', listing_type: 'both', sale_price: 690, lease_price_monthly: 39 },
  { domain_name: 'krypto-komodity.eu', template: 'ai_saas', title: 'Krypto & Komodity Live Analytics', subtitle: 'Živé trhové dáta pre zlato, striebro, ropu, urán a digitálne aktíva v EUR.', status: 'for_sale', listing_type: 'both', sale_price: 1590, lease_price_monthly: 85 },
  { domain_name: 'video-produkcia.sk', template: 'portfolio', title: 'AI Video & Motion Produkcia', subtitle: 'Tvorba reklamných videí, animácií, reels a vizuálnych kampaní novej generácie.', status: 'for_sale', listing_type: 'both', sale_price: 990, lease_price_monthly: 55 },
  { domain_name: 'hudba-studio.sk', template: 'portfolio', title: 'AI Hudobné & Zvukové Štúdio', subtitle: 'Syntéza originálnej hudby, podmazov pre videá, podcastov a zvukového dizajnu.', status: 'for_sale', listing_type: 'both', sale_price: 750, lease_price_monthly: 42 },
  { domain_name: 'prezentacie-pro.sk', template: 'business_landing', title: 'Prezentácie Pro · Pitch Decks & Slajdy', subtitle: 'Interaktívne 16:9 prezentácie a PDF reporty pre investorov, obchod a konferencie.', status: 'for_sale', listing_type: 'both', sale_price: 650, lease_price_monthly: 35 },
  { domain_name: 'sepa-platby.eu', template: 'ecommerce_checkout', title: 'SEPA QR & PayPal Platobná Brána', subtitle: 'Okamžité platobné odkazy a certifikované EPC QR kódy pre európske banky.', status: 'for_sale', listing_type: 'both', sale_price: 1390, lease_price_monthly: 75 },
  { domain_name: 'basterix-labs.dev', template: 'ai_saas', title: 'Basterix Labs · R&D Neural Systems', subtitle: 'Výskumné laboratórium pre kvantovo-inšpirované algoritmy a autonómnych agentov.', status: 'active', listing_type: 'lease', sale_price: null, lease_price_monthly: 89 },
  { domain_name: 'slovakia-tech.sk', template: 'business_landing', title: 'Slovakia Tech & Innovation Hub', subtitle: 'Technologický portál, katalóg inovácií a B2B partnerstiev na Slovensku.', status: 'for_sale', listing_type: 'both', sale_price: 1100, lease_price_monthly: 59 },
  { domain_name: 'edata-analytics.eu', template: 'ai_saas', title: 'eData Analytics & BI Cloud', subtitle: 'Spracovanie dát, prediktívne modely a manažérske dashboardy v reálnom čase.', status: 'for_sale', listing_type: 'both', sale_price: 1450, lease_price_monthly: 79 },
  { domain_name: 'cyber-security.sk', template: 'business_landing', title: 'Cyber Security & WAF Audit SK', subtitle: 'Bezpečnostné audity webov, ochrana pred DDoS, šifrovanie a penetračné kontroly.', status: 'for_sale', listing_type: 'both', sale_price: 1250, lease_price_monthly: 65 },
  { domain_name: 'nextgen-eshop.eu', template: 'ecommerce_checkout', title: 'NextGen Edge E-Shop Platform', subtitle: 'Bleskový e-shop na Cloudflare Edge s okamžitým košíkom a PayPal/Revolut platbami.', status: 'for_sale', listing_type: 'both', sale_price: 950, lease_price_monthly: 49 },
  { domain_name: 'neural-agents.space', template: 'ai_saas', title: 'Neural Agents · Autonómne AI tímy', subtitle: 'Prenájom a nasadenie špecializovaných AI agentov pre obchod, výskum a vývoj.', status: 'for_sale', listing_type: 'both', sale_price: 1890, lease_price_monthly: 95 }
];

export async function seedTwentyCloudflareDomains(env, actor = 'cloudflare-auto-seed') {
  const allMap = await readEnvironmentsMap(env);
  const createdDomains = [];
  const now = new Date().toISOString();

  for (const item of TWENTY_STARTER_CLOUDFLARE_DOMAINS) {
    let domainRecord = null;
    if (env?.DB?.prepare) {
      try {
        domainRecord = await getDomain(env, item.domain_name);
        if (!domainRecord) {
          domainRecord = await createDomain(env, {
            domain_name: item.domain_name,
            registrar: 'cloudflare',
            status: item.status,
            auto_renew: true,
            listing_type: item.listing_type,
            sale_price: item.sale_price,
            sale_currency: 'EUR',
            lease_price_monthly: item.lease_price_monthly,
            lease_currency: 'EUR',
            notes: `${item.title} — ${item.subtitle}`
          });
        }
        if (domainRecord?.id) {
          const existingDns = await env.DB.prepare('SELECT COUNT(*) AS count FROM domain_dns_records WHERE domain_id=?').bind(domainRecord.id).first().catch(() => ({ count: 0 }));
          if (!existingDns?.count) {
            await addDnsRecord(env, domainRecord.id, { type: 'A', name: '@', content: '192.0.2.1', ttl: 1, proxied: true }).catch(() => {});
            await addDnsRecord(env, domainRecord.id, { type: 'CNAME', name: 'staging', content: item.domain_name, ttl: 1, proxied: true }).catch(() => {});
            await addDnsRecord(env, domainRecord.id, { type: 'CNAME', name: 'dev', content: item.domain_name, ttl: 1, proxied: true }).catch(() => {});
          }
        }
      } catch {}
    }

    if (!allMap[item.domain_name]) {
      const opts = {
        template: item.template,
        title: item.title,
        subtitle: item.subtitle,
        ssl_mode: 'strict',
        proxied: true,
        waf_enabled: true,
        cache_level: 'standard',
        payment_checkout_url: '/pay/checkout/domena-prenajom'
      };
      allMap[item.domain_name] = {
        domain_name: item.domain_name,
        domain_id: domainRecord?.id || crypto.randomUUID(),
        registrar: 'cloudflare',
        ssl_mode: 'strict',
        proxied: true,
        waf_enabled: true,
        cache_level: 'standard',
        environments: {
          production: buildDefaultEnvironmentEntry(item.domain_name, 'production', opts),
          staging: buildDefaultEnvironmentEntry(item.domain_name, 'staging', opts),
          development: buildDefaultEnvironmentEntry(item.domain_name, 'development', opts)
        },
        created_at: now,
        updated_at: now,
        updated_by: actor
      };
    }
    createdDomains.push(item.domain_name);
  }

  await writeEnvironmentsMap(env, allMap);

  await recordStepDocument(env, {
    title: `Cloudflare Inicializácia: Vytvorených 20 domén s produkčnými prostrediami`,
    category: 'domain_production',
    step_name: 'domain_seed_twenty',
    actor,
    summary: `Cez Cloudflare Control Plane bolo pripravených a nasadených 20 domén s DNS záznamami (A, CNAME), prostrediami (production, staging, development) a ponukami v trhovisku.`,
    content: [
      `# 🌐 Portfólio 20 Cloudflare Domén v Trinity`,
      ``,
      ...TWENTY_STARTER_CLOUDFLARE_DOMAINS.map((d, idx) =>
        `${idx + 1}. **\`${d.domain_name}\`** — ${d.title} (${d.sale_price ? `Predaj: ${d.sale_price} €` : 'Vlastná aktívna'}${d.lease_price_monthly ? ` · Prenájom: ${d.lease_price_monthly} €/mes.` : ''}) → \`/sites/${d.domain_name}/production\``
      )
    ].join('\n'),
    receipt_id: `cloudflare:seed20:${crypto.randomUUID()}`,
    tags: ['cloudflare', 'domains', '20-domains', 'seed']
  });

  return {
    ok: true,
    total_seeded: TWENTY_STARTER_CLOUDFLARE_DOMAINS.length,
    domains: createdDomains
  };
}

export async function listDomainEnvironments(env, domainFilter = '', { autoSeedIfEmpty = false } = {}) {
  let allMap = await readEnvironmentsMap(env);
  if (autoSeedIfEmpty && Object.keys(allMap).length < 20) {
    await seedTwentyCloudflareDomains(env, 'cloudflare-startup-seed');
    allMap = await readEnvironmentsMap(env);
  }
  let items = Object.values(allMap);
  if (domainFilter && String(domainFilter).trim()) {
    const q = String(domainFilter).trim().toLowerCase();
    items = items.filter(item => item.domain_name.toLowerCase().includes(q));
  }
  return {
    provider: 'Trinity Cloudflare Control Plane',
    supported_environments: ENVIRONMENT_NAMES,
    supported_templates: ENVIRONMENT_TEMPLATES,
    total_domains: items.length,
    items: items.map(item => ({
      ...item,
      environments: Object.fromEntries(
        Object.entries(item.environments || {}).map(([k, v]) => {
          const { html, ...rest } = v;
          return [k, { ...rest, has_html: Boolean(html) }];
        })
      )
    }))
  };
}

export async function handlePublicSiteRoute(request, env) {
  if (request.method !== 'GET') return null;
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/sites\/([a-z0-9.-]+\.[a-z]{2,})(?:\/([a-z0-9_-]+))?\/?$/i);
  if (!match) return null;

  const domain_name = match[1].toLowerCase();
  const envName = (match[2] || 'production').toLowerCase();
  let allMap = await readEnvironmentsMap(env);
  if (!allMap[domain_name] && TWENTY_STARTER_CLOUDFLARE_DOMAINS.some(d => d.domain_name === domain_name)) {
    await seedTwentyCloudflareDomains(env, 'cloudflare-startup-seed');
    allMap = await readEnvironmentsMap(env);
  }
  const entry = allMap[domain_name];
  if (!entry || !entry.environments?.[envName]?.html) {
    throw new HttpError(404, `Pre doménu ${domain_name} zatiaľ nie je vyprodukované prostredie '${envName}'.`);
  }

  const targetEnv = entry.environments[envName];
  return new Response(targetEnv.html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Trinity-Domain': domain_name,
      'X-Trinity-Environment': envName,
      'X-Trinity-Version': String(targetEnv.version || 1),
      'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'self'"
    }
  });
}

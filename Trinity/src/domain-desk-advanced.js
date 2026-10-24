import { z } from 'zod';
import { HttpError } from './security.js';
import { getDomain, updateDomain, addDnsRecord, deleteDnsRecord, listDnsRecords } from './domains.js';
import { recordStepDocument } from './trinity-documents.js';

export const escrowDealSchema = z.object({
  domain_name: z.string().trim().min(3).max(253),
  deal_type: z.enum(['instant_buy', 'lease_to_own', 'make_offer']).default('instant_buy'),
  amount: z.number().min(0).max(10000000),
  currency: z.string().default('EUR'),
  buyer_email: z.string().email(),
  buyer_notes: z.string().max(1000).optional().default(''),
  target_dns: z.string().trim().max(253).optional().default('192.0.2.1')
}).strict();

export const escrowSettleSchema = z.object({
  deal_id: z.string().min(1),
  payment_reference: z.string().trim().max(120).default('manual_verified'),
  target_dns: z.string().trim().max(253).optional()
}).strict();

export const cloneEnvSchema = z.object({
  domain_name: z.string().trim().min(3).max(253),
  source_env: z.string().trim().min(2).max(40).default('production'),
  target_env: z.string().trim().min(2).max(40).default('staging'),
  ab_variant_label: z.string().trim().max(80).optional().default('Variant B (A/B Test)')
}).strict();

export const telegramConfigSchema = z.object({
  bot_token: z.string().trim().regex(/^\d{5,20}:[A-Za-z0-9_-]{30,100}$/, 'Neplatný Telegram Bot Token.'),
  chat_id: z.string().trim().regex(/^-?\d{1,20}$|^@[A-Za-z][A-Za-z0-9_]{4,31}$/, 'Neplatné Telegram Chat ID.'),
  enabled: z.boolean().default(true)
}).strict();

const TELEGRAM_CONFIG_KEY = 'assistant:telegram:config';

// ----------------------------------------------------
// 1. ESCROW BROKERING & LANDING PAGES
// ----------------------------------------------------

export function generateEscrowLandingHtml({ domain, salePrice = 490, leasePrice = 49, paymentUrl = '' }) {
  const domainName = domain.domain_name || 'tvojadomena.sk';
  const priceBuy = salePrice || domain.sale_price || 490;
  const priceLease = leasePrice || domain.lease_price_monthly || 49;
  const payLink = paymentUrl || `/pay/checkout/domain-${domainName.replace(/[^a-z0-9]/gi, '-')}`;

  return `<!doctype html>
<html lang="sk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${domainName} · Táto prémiová doména je na predaj alebo prenájom</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(15, 23, 42, 0.75);
      --border: rgba(56, 189, 248, 0.2);
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --accent-glow: rgba(56, 189, 248, 0.35);
      --green: #10b981;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: radial-gradient(circle at 50% 10%, #1e293b 0%, var(--bg) 70%);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
    }
    .container {
      max-width: 820px;
      width: 100%;
      background: var(--card-bg);
      border: 1px solid var(--border);
      backdrop-filter: blur(16px);
      border-radius: 24px;
      padding: 44px 32px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.5), 0 0 32px var(--accent-glow);
      text-align: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 16px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      background: rgba(56, 189, 248, 0.1);
      border: 1px solid var(--border);
      color: var(--accent);
      margin-bottom: 20px;
    }
    h1 {
      font-size: clamp(32px, 6vw, 54px);
      font-weight: 800;
      letter-spacing: -0.03em;
      margin-bottom: 12px;
      background: linear-gradient(135deg, #ffffff 40%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle {
      font-size: 18px;
      color: var(--text-muted);
      max-width: 580px;
      margin: 0 auto 36px;
      line-height: 1.5;
    }
    .deal-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 36px;
      text-align: left;
    }
    .card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      transition: transform 0.2s, border-color 0.2s;
    }
    .card:hover {
      transform: translateY(-3px);
      border-color: var(--accent);
    }
    .card.featured {
      background: linear-gradient(180deg, rgba(56, 189, 248, 0.08) 0%, rgba(15, 23, 42, 0.5) 100%);
      border-color: var(--accent);
    }
    .card-label {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--accent);
      margin-bottom: 8px;
    }
    .card-price {
      font-size: 32px;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 8px;
    }
    .card-price small {
      font-size: 14px;
      font-weight: 400;
      color: var(--text-muted);
    }
    .card-desc {
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.4;
      margin-bottom: 20px;
    }
    .btn {
      display: inline-block;
      text-align: center;
      padding: 12px 20px;
      border-radius: 10px;
      font-weight: 600;
      font-size: 14px;
      text-decoration: none;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }
    .btn-primary {
      background: linear-gradient(135deg, #0284c7, #2563eb);
      color: #ffffff;
      box-shadow: 0 4px 16px rgba(37, 99, 235, 0.4);
    }
    .btn-primary:hover {
      filter: brightness(1.15);
      box-shadow: 0 6px 22px rgba(37, 99, 235, 0.6);
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.06);
      color: #e2e8f0;
      border: 1px solid rgba(255, 255, 255, 0.12);
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.12);
    }
    .escrow-banner {
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.25);
      border-radius: 12px;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      font-size: 13px;
      color: #a7f3d0;
      margin-bottom: 28px;
    }
    .inquiry-box {
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 14px;
      padding: 24px;
      text-align: left;
    }
    .inquiry-box h3 {
      font-size: 16px;
      margin-bottom: 12px;
      color: #f1f5f9;
    }
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr 140px auto;
      gap: 10px;
    }
    @media (max-width: 640px) {
      .form-row { grid-template-columns: 1fr; }
    }
    input, button {
      padding: 12px 14px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.04);
      color: #ffffff;
      font-size: 14px;
    }
    input:focus {
      outline: none;
      border-color: var(--accent);
    }
    footer {
      margin-top: 32px;
      font-size: 12px;
      color: var(--text-muted);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">🛡️ Overené cez Trinity Escrow Brokering</div>
    <h1>${domainName}</h1>
    <p class="subtitle">Zabezpečte si túto exkluzívnu doménu pre vaše podnikanie s okamžitým prepisom DNS a garantovanou ochranou transakcie.</p>

    <div class="deal-cards">
      <div class="card featured">
        <div>
          <span class="card-label">Jednorazový odkup</span>
          <div class="card-price">${priceBuy} € <small>jednorazovo</small></div>
          <p class="card-desc">Úplný prevod vlastníctva domény, autorizačný kód na prevod a okamžitý prepis DNS záznamov.</p>
        </div>
        <a href="${payLink}" class="btn btn-primary">Kúpiť ihneď (${priceBuy} €)</a>
      </div>

      <div class="card">
        <div>
          <span class="card-label">Mesačný prenájom</span>
          <div class="card-price">${priceLease} € <small>/ mesiac</small></div>
          <p class="card-desc">Flexibilný nájom so zachovaním predkupného práva a plnou kontrolou nad DNS a smerovaním webu.</p>
        </div>
        <a href="${payLink}?type=lease" class="btn btn-secondary">Prenajať (${priceLease} €/mes)</a>
      </div>

      <div class="card">
        <div>
          <span class="card-label">Splátky / Dohoda</span>
          <div class="card-price">Ponuka <small>na mieru</small></div>
          <p class="card-desc">Možnosť rozloženia kúpnej ceny na 3 až 12 mesačných splátok s escrow ochranou.</p>
        </div>
        <button type="button" onclick="document.getElementById('inquiry-email').focus()" class="btn btn-secondary">Navrhnúť cenu</button>
      </div>
    </div>

    <div class="escrow-banner">
      <span>🔒</span>
      <span><b>100% Escrow Garancia:</b> Finančné prostriedky sú držané v bezpečí až do úspešného overenia funkčnosti a prepisu DNS záznamov.</span>
    </div>

    <div class="inquiry-box">
      <h3>Máte otázku alebo vlastný cenový návrh?</h3>
      <form id="escrow-inquiry-form" onsubmit="handleInquiry(event)">
        <div class="form-row">
          <input type="email" id="inquiry-email" required placeholder="Váš e-mail (napr. kontakt@firma.sk)">
          <input type="text" id="inquiry-notes" placeholder="Poznámka / Váš zámer">
          <input type="number" id="inquiry-offer" min="10" placeholder="Ponuka v €">
          <button type="submit" class="btn btn-primary" id="inquiry-btn">Odoslať ponuku</button>
        </div>
      </form>
      <div id="inquiry-status" style="margin-top:10px;font-size:13px;color:#38bdf8;display:none"></div>
    </div>

    <footer>
      Trinity 11.0 Domain & Hosting Desk · Bezpečný brokering a správa doménových portfólií
    </footer>
  </div>

  <script>
    async function handleInquiry(e) {
      e.preventDefault();
      const btn = document.getElementById('inquiry-btn');
      const status = document.getElementById('inquiry-status');
      btn.disabled = true;
      btn.textContent = 'Odosielam…';
      try {
        const resp = await fetch('/api/domains/escrow/inquire', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            domain_name: '${domainName}',
            deal_type: 'make_offer',
            amount: parseFloat(document.getElementById('inquiry-offer').value) || ${priceBuy},
            currency: 'EUR',
            buyer_email: document.getElementById('inquiry-email').value,
            buyer_notes: document.getElementById('inquiry-notes').value,
            target_dns: '192.0.2.1'
          })
        });
        const res = await resp.json();
        if (!res.success) throw new Error(res.error || 'Odoslanie ponuky zlyhalo.');
        status.style.display = 'block';
        status.textContent = '✓ Vaša ponuka bola bezpečne zaevidovaná v Trinity Escrow. Vlastník domény bol notifikovaný.';
        document.getElementById('escrow-inquiry-form').reset();
      } catch (err) {
        status.style.display = 'block';
        status.textContent = '⚠ Chyba: ' + err.message;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Odoslať ponuku';
      }
    }
  </script>
</body>
</html>`;
}

export async function createEscrowDeal(env, input) {
  const parsed = escrowDealSchema.parse(input);
  const domain = await getDomain(env, parsed.domain_name);
  if (!domain) throw new HttpError(404, `Doména ${parsed.domain_name} sa nenašla.`);

  const dealId = `deal-${crypto.randomUUID()}`;
  if (env.DB) {
    await env.DB.prepare(`
      INSERT INTO domain_escrow_deals(
        id, domain_id, domain_name, deal_type, amount, currency, buyer_email, buyer_notes, target_dns, status
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).bind(
      dealId,
      domain.id,
      parsed.domain_name,
      parsed.deal_type,
      parsed.amount,
      parsed.currency,
      parsed.buyer_email,
      parsed.buyer_notes || '',
      parsed.target_dns || '192.0.2.1'
    ).run();
  }

  // Record audit and Trinity Document
  await recordStepDocument(env, {
    title: `Escrow Ponuka pre doménu ${parsed.domain_name}`,
    category: 'domain',
    description: `Zaevidovaná ponuka typu ${parsed.deal_type} na sumu ${parsed.amount} ${parsed.currency} od ${parsed.buyer_email}.`,
    details: { deal_id: dealId, ...parsed }
  }).catch(() => {});

  return {
    success: true,
    deal_id: dealId,
    domain_name: parsed.domain_name,
    amount: parsed.amount,
    currency: parsed.currency,
    status: 'pending'
  };
}

export async function settleEscrowDeal(env, actor = 'admin', input) {
  const parsed = escrowSettleSchema.parse(input);
  if (!env.DB) throw new HttpError(503, 'Databáza D1 nie je dostupná.');

  const deal = await env.DB.prepare('SELECT * FROM domain_escrow_deals WHERE id = ?').bind(parsed.deal_id).first();
  if (!deal) throw new HttpError(404, `Escrow obchod ${parsed.deal_id} sa nenašiel.`);
  if (deal.status === 'settled') throw new HttpError(400, 'Tento escrow obchod už bol vysporiadaný.');

  const domain = await getDomain(env, deal.domain_name);
  if (!domain) throw new HttpError(404, `Doména ${deal.domain_name} nebola nájdená.`);

  const targetDns = parsed.target_dns || deal.target_dns || '192.0.2.1';

  // 1. Update domain status to sold or leased
  const newStatus = deal.deal_type === 'lease_to_own' ? 'leased' : 'sold';
  await updateDomain(env, domain.id, {
    status: newStatus,
    notes: `Escrow vysporiadaný deal=${deal.id} buyer=${deal.buyer_email} ref=${parsed.payment_reference}`
  });

  // 2. Automated DNS rewrite
  const existingRecords = await listDnsRecords(env, domain.id);
  const aRecords = existingRecords.filter(r => r.type === 'A' && r.name === '@');
  for (const r of aRecords) {
    await deleteDnsRecord(env, domain.id, r.id).catch(() => {});
  }
  await addDnsRecord(env, domain.id, {
    type: 'A',
    name: '@',
    content: targetDns,
    ttl: 1,
    proxied: true
  });

  // 3. Mark deal as settled in D1
  await env.DB.prepare(`
    UPDATE domain_escrow_deals 
    SET status = 'settled', payment_reference = ?, settled_at = datetime('now')
    WHERE id = ?
  `).bind(parsed.payment_reference, deal.id).run();

  // 4. Record wallet and domain transaction
  const txId = `tx-escrow-${crypto.randomUUID()}`;
  await env.DB.prepare(`
    INSERT INTO domain_transactions(id, domain_id, domain_name, type, amount, currency, party, details)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    txId,
    domain.id,
    domain.domain_name,
    deal.deal_type,
    deal.amount,
    deal.currency,
    deal.buyer_email,
    `Escrow deal settled: payment_ref=${parsed.payment_reference}, target_dns=${targetDns}`
  ).run().catch(() => {});

  // 5. Document step
  await recordStepDocument(env, {
    title: `Escrow Úspešne Vysporiadaný: ${domain.domain_name}`,
    category: 'domain',
    description: `Doména bola prevedená na ${deal.buyer_email} za sumu ${deal.amount} ${deal.currency}. DNS prepísané na ${targetDns}.`,
    details: { deal_id: deal.id, domain_id: domain.id, buyer: deal.buyer_email, dns: targetDns }
  }).catch(() => {});

  return {
    success: true,
    deal_id: deal.id,
    domain_name: domain.domain_name,
    status: 'settled',
    new_domain_status: newStatus,
    target_dns: targetDns,
    settled_at: new Date().toISOString()
  };
}

// ----------------------------------------------------
// 2. MONITORING EXPIRATIONS, SSL & WORKERS (TELEGRAM BOT)
// ----------------------------------------------------

export async function getTelegramConfig(env) {
  if (!env.DB) return { enabled: false, configured: false };
  const row = await env.DB.prepare('SELECT value FROM ops_memory WHERE key = ?').bind(TELEGRAM_CONFIG_KEY).first();
  if (!row?.value) {
    const hasEnvVars = Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);
    return {
      enabled: hasEnvVars,
      configured: hasEnvVars,
      from_env: hasEnvVars,
      chat_id_masked: hasEnvVars ? (env.TELEGRAM_CHAT_ID ? `${env.TELEGRAM_CHAT_ID.slice(0, 3)}***` : '—') : '—'
    };
  }
  try {
    const cfg = JSON.parse(row.value);
    return {
      enabled: Boolean(cfg.enabled),
      configured: Boolean(cfg.bot_token && cfg.chat_id),
      chat_id_masked: cfg.chat_id ? `${cfg.chat_id.slice(0, 3)}***` : '—'
    };
  } catch {
    return { enabled: false, configured: false };
  }
}

export async function saveTelegramConfig(env, input) {
  const parsed = telegramConfigSchema.parse(input);
  if (!env.DB) throw new HttpError(503, 'Databáza D1 nie je dostupná.');

  await env.DB.prepare(`
    INSERT INTO ops_memory(key, value, source, updated_at)
    VALUES(?, ?, 'telegram-config', datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')
  `).bind(TELEGRAM_CONFIG_KEY, JSON.stringify(parsed)).run();

  return { success: true, message: 'Telegram konfigurácia bola bezpečne uložená.' };
}

export async function sendTelegramAlert(env, messageText) {
  let botToken = env.TELEGRAM_BOT_TOKEN;
  let chatId = env.TELEGRAM_CHAT_ID;

  if (env.DB) {
    const row = await env.DB.prepare('SELECT value FROM ops_memory WHERE key = ?').bind(TELEGRAM_CONFIG_KEY).first().catch(() => null);
    if (row?.value) {
      try {
        const cfg = JSON.parse(row.value);
        if (!cfg.enabled) return { sent: false, reason: 'Telegram upozornenia sú vypnuté.' };
        if (cfg.bot_token && cfg.chat_id) {
          botToken = cfg.bot_token;
          chatId = cfg.chat_id;
        }
      } catch { return { sent: false, reason: 'Telegram konfigurácia je poškodená.' }; }
    }
  }

  const header = '📱 <b>Trinity Notification · Majiteľ: Ivan Sabo (+421949009722)</b>\n';
  const fullText = messageText.includes('+421949009722') ? messageText : (header + messageText);

  if (!botToken || !chatId) {
    return { sent: false, phone: '+421949009722', reason: 'Telegram nie je nakonfigurovaný (chýba bot_token alebo chat_id).' };
  }

  if (!telegramConfigSchema.safeParse({ bot_token: botToken, chat_id: String(chatId), enabled: true }).success) {
    return { sent: false, reason: 'Telegram konfigurácia nie je platná. Skontroluj Bot Token a Chat ID.' };
  }

  try {
    const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: fullText,
        parse_mode: 'HTML'
      })
    });
    const result = await resp.json();
    const sent = resp.ok && result.ok === true;
    return sent
      ? { sent: true, message_id: result.result?.message_id }
      : { sent: false, reason: 'Telegram odmietol správu. Over token, príjemcu a oprávnenia bota.', status: resp.status };
  } catch (err) {
    return { sent: false, reason: 'Telegram neodpovedal. Skontroluj pripojenie a skús odoslanie znova.' };
  }
}

export async function checkDomainsAndSslHealth(env, { notifyTelegram = true } = {}) {
  if (!env.DB) return { success: false, error: 'Databáza D1 nie je dostupná.' };

  const domains = (await env.DB.prepare('SELECT id, domain_name, status, expires_at FROM managed_domains LIMIT 100').all()).results || [];
  const alerts = [];
  const now = new Date();

  // 1. Expiration check
  for (const d of domains) {
    if (d.expires_at) {
      const expDate = new Date(d.expires_at);
      const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) {
        alerts.push({
          domain_name: d.domain_name,
          alert_type: 'domain_expiry',
          severity: 'critical',
          days_remaining: diffDays,
          message: `Doména ${d.domain_name} exspiruje o ${diffDays} dní (${d.expires_at})!`
        });
      } else if (diffDays <= 30) {
        alerts.push({
          domain_name: d.domain_name,
          alert_type: 'domain_expiry',
          severity: 'warning',
          days_remaining: diffDays,
          message: `Doména ${d.domain_name} exspiruje o ${diffDays} dní (${d.expires_at}).`
        });
      }
    }
  }

  // 2. Cloudflare Worker health check
  const workerEndpoints = [
    { name: 'Production (auru.space)', url: 'https://auru.space/health' },
    { name: 'Development (auru.dev)', url: 'https://auru.dev/health' }
  ];

  for (const ep of workerEndpoints) {
    try {
      const r = await fetch(ep.url, { method: 'GET', signal: AbortSignal.timeout(4000) });
      if (!r.ok && r.status !== 401) {
        alerts.push({
          domain_name: ep.name,
          alert_type: 'worker_outage',
          severity: 'critical',
          days_remaining: 0,
          message: `Výpadok workeru: ${ep.name} vrátil HTTP ${r.status}.`
        });
      }
    } catch (err) {
      alerts.push({
        domain_name: ep.name,
        alert_type: 'worker_outage',
        severity: 'critical',
        days_remaining: 0,
        message: `Nedostupný worker endpoint ${ep.name}: ${err.message}`
      });
    }
  }

  // 3. Save alerts to DB and dispatch Telegram notification
  let telegramDispatched = 0;
  for (const a of alerts) {
    const alertId = `alt-${crypto.randomUUID()}`;
    await env.DB.prepare(`
      INSERT INTO domain_health_alerts(id, domain_name, alert_type, severity, message, days_remaining, created_at)
      VALUES(?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(alertId, a.domain_name, a.alert_type, a.severity, a.message, a.days_remaining ?? 0).run().catch(() => {});

    // Create incident in ops_incidents
    const incId = `inc-mon-${crypto.randomUUID()}`;
    await env.DB.prepare(`
      INSERT INTO ops_incidents(id, title, severity, status, created_at)
      VALUES(?, ?, ?, 'open', datetime('now'))
    `).bind(incId, a.message, a.severity).run().catch(() => {});

    if (notifyTelegram) {
      const tgMsg = `🚨 <b>TRINITY ALERT [${a.severity.toUpperCase()}]</b>\n\n${a.message}\n\n<i>Čas: ${new Date().toLocaleString('sk-SK')}</i>`;
      const tgRes = await sendTelegramAlert(env, tgMsg);
      if (tgRes.sent) {
        telegramDispatched++;
        await env.DB.prepare('UPDATE domain_health_alerts SET telegram_sent = 1 WHERE id = ?').bind(alertId).run().catch(() => {});
      }
    }
  }

  return {
    success: true,
    total_domains_checked: domains.length,
    alerts_count: alerts.length,
    alerts,
    telegram_dispatched: telegramDispatched,
    checked_at: new Date().toISOString()
  };
}

export async function listDomainAlerts(env) {
  if (!env.DB) return { alerts: [] };
  const rows = (await env.DB.prepare(`
    SELECT id, domain_name, alert_type, severity, message, days_remaining, telegram_sent, resolved, created_at 
    FROM domain_health_alerts 
    ORDER BY created_at DESC LIMIT 50
  `).all()).results || [];
  return { alerts: rows };
}

// ----------------------------------------------------
// 3. 1-CLICK A/B TESTING & ENVIRONMENT CLONING
// ----------------------------------------------------

export async function cloneDomainEnvironment(env, actor = 'owner', input) {
  const parsed = cloneEnvSchema.parse(input);
  const domain = await getDomain(env, parsed.domain_name);
  if (!domain) throw new HttpError(404, `Doména ${parsed.domain_name} neexistuje.`);

  // Read environments map
  const DOMAIN_ENVS_KV_KEY = 'assistant:domains:environments';
  let store = {};
  if (env?.DB?.prepare) {
    const row = await env.DB.prepare("SELECT value FROM ops_memory WHERE key = ?").bind(DOMAIN_ENVS_KV_KEY).first();
    if (row?.value) {
      try { store = JSON.parse(row.value); } catch {}
    }
  }

  const domainEnvs = store[parsed.domain_name] || {};
  const sourceEnv = domainEnvs[parsed.source_env];
  if (!sourceEnv) {
    throw new HttpError(404, `Zdrojové prostredie „${parsed.source_env}“ na doméne ${parsed.domain_name} neexistuje.`);
  }

  // Clone environment configuration
  const targetConfig = {
    ...sourceEnv,
    environment: parsed.target_env,
    title: `${sourceEnv.title || domain.domain_name} · [${parsed.ab_variant_label}]`,
    version: (sourceEnv.version || 1) + 1,
    cloned_from: parsed.source_env,
    ab_test: {
      is_variant: true,
      label: parsed.ab_variant_label,
      source_env: parsed.source_env,
      cloned_at: new Date().toISOString()
    },
    updated_at: new Date().toISOString(),
    deployed_at: new Date().toISOString()
  };

  domainEnvs[parsed.target_env] = targetConfig;
  store[parsed.domain_name] = domainEnvs;

  // Persist updated environments map
  const serialized = JSON.stringify(store);
  if (env?.DB?.prepare) {
    await env.DB.prepare(
      "INSERT INTO ops_memory(key,value,source) VALUES(?,?,'domain-environments') ON CONFLICT(key) DO UPDATE SET value=excluded.value,source='domain-environments',updated_at=datetime('now')"
    ).bind(DOMAIN_ENVS_KV_KEY, serialized).run();
  }
  if (env?.Mastermind?.put) {
    await env.Mastermind.put(DOMAIN_ENVS_KV_KEY, serialized).catch(() => {});
  }

  // Ensure DNS subdomain exists for cloned environment
  if (parsed.target_env !== 'production') {
    await addDnsRecord(env, domain.id, {
      type: 'CNAME',
      name: parsed.target_env,
      content: parsed.domain_name,
      ttl: 1,
      proxied: true
    }).catch(() => {});
  }

  // Document step
  await recordStepDocument(env, {
    title: `1-Klikové Klonovanie: ${parsed.target_env}.${parsed.domain_name}`,
    category: 'domain',
    description: `Vytvorené A/B testovacie prostredie ${parsed.target_env} skopírovaním z ${parsed.source_env}. Štítok: ${parsed.ab_variant_label}.`,
    details: { domain_name: parsed.domain_name, source_env: parsed.source_env, target_env: parsed.target_env }
  }).catch(() => {});

  const sourceUrl = parsed.source_env === 'production' ? `https://${parsed.domain_name}` : `https://${parsed.source_env}.${parsed.domain_name}`;
  const targetUrl = parsed.target_env === 'production' ? `https://${parsed.domain_name}` : `https://${parsed.target_env}.${parsed.domain_name}`;

  return {
    success: true,
    domain_name: parsed.domain_name,
    source_env: parsed.source_env,
    target_env: parsed.target_env,
    source_url: sourceUrl,
    target_url: targetUrl,
    ab_test_label: parsed.ab_variant_label,
    cloned_at: new Date().toISOString()
  };
}

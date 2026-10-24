import { sendTelegramAlert } from './domain-desk-advanced.js';
// src/audit-log.js: Operational Audit Trail & Comprehensive Event Timeline

export function categorizeAction(action) {
  const act = String(action || '').toLowerCase();
  if (act.startsWith('domain_') || act.startsWith('escrow_') || act.includes('dns')) return 'domains';
  if (act.startsWith('wallet_') || act.startsWith('invoice_') || act.startsWith('price_alert_') || act.startsWith('commodity_') || act.includes('revolut') || act.includes('paypal')) return 'banking';
  if (act.startsWith('google_') || act.startsWith('passkey_') || act.startsWith('secret_') || act.startsWith('emergency_stop') || act.includes('auth') || act.includes('permission')) return 'security';
  if (act.startsWith('studio_') || act.startsWith('voice_') || act.startsWith('evolution_') || act.startsWith('graph_rag') || act.includes('model')) return 'ai_studio';
  return 'system';
}

export function determineSeverity(action, details = {}) {
  const act = String(action || '').toLowerCase();
  if (act.includes('emergency_stop') || act.includes('revoked') || act.includes('deleted') || act.includes('incident_') || act.includes('failed') || act.includes('error')) {
    return 'critical';
  }
  if (act.includes('triggered') || act.includes('sold') || act.includes('registered') || act.includes('invoice_created') || act.includes('approved') || act.includes('escrow_completed')) {
    return 'warning';
  }
  return 'info';
}

export function extractActor(details = {}) {
  if (typeof details !== 'object' || !details) return 'Trinity System';
  return details.by || details.email || details.user || details.admin || details.requested_by || details.owner_id || details.actor || 'Trinity System';
}

export function generateEventSummary(action, details = {}) {
  const d = typeof details === 'object' && details !== null ? details : {};
  switch (action) {
    case 'google_login':
      return `Používateľ ${d.email || 'Admin'} sa úspešne prihlásil cez Google OAuth.`;
    case 'passkey_login':
      return `Používateľ ${d.email || 'Admin'} sa overil biometricky cez Passkey (${d.friendly_name || 'TouchID/Windows Hello'}).`;
    case 'passkey_registered':
      return `Zaregistrovaný nový Passkey pre používateľa ${d.email || 'Admin'}: "${d.friendly_name || 'Biometrický kľúč'}".`;
    case 'passkey_revoked':
      return `Passkey kľúč bol zrušený a vymazaný zo systému (${d.email || 'Admin'}).`;
    case 'domain_created':
      return `Doména ${d.domain_name || ''} bola pridaná do Trinity správy.`;
    case 'domain_dns_created':
      return `DNS záznam vytvorený: [${d.type || 'A'}] ${d.name || ''} -> ${d.content || ''}.`;
    case 'domain_dns_deleted':
      return `DNS záznam zmazaný z domény ${d.domain_name || ''}.`;
    case 'domain_listed_for_sale':
      return `Doména ${d.domain_name || ''} vystavená na predaj za ${d.price_eur || 0} €.`;
    case 'domain_sold':
      return `Doména ${d.domain_name || ''} predaná kupujúcemu ${d.buyer_email || ''} za ${d.price_eur || 0} €.`;
    case 'domain_escrow_intent':
      return `Vytvorený escrow prenájom/predaj pre doménu ${d.domain_name || ''} (${d.amount_eur || 0} €).`;
    case 'domain_escrow_completed':
      return `Escrow úspešne dokončený pre ${d.domain_name || ''}; DNS prepísané na nového majiteľa.`;
    case 'price_alert_created':
      return `Vytvorený cenový alert: ${d.symbol || ''} ${d.condition === 'above' ? '≥' : '≤'} ${d.target_price || 0} €.`;
    case 'price_alert_triggered':
      return `SMART ALERT: ${d.symbol || ''} preťal cieľovú hladinu pri cene ${d.current_price || 0} €!`;
    case 'invoice_created':
      return `Vygenerovaná SEPA faktúra ${d.invoice_number || ''} pre ${d.client_name || ''} na sumu ${d.amount_eur || 0} €.`;
    case 'system_action_admin_authorized':
      return `Admin príkaz autorizovaný: ${d.action || ''}.`;
    case 'system_action_approved':
      return `Systémová operácia "${d.action || ''}" schválená administrátorom.`;
    case 'system_action_finished':
      return `Systémová akcia "${d.action || ''}" bola úspešne dokončená.`;
    case 'emergency_stop_enabled':
      return `POZOR: Núdzové zastavenie (Emergency Stop) aktivované používateľom ${d.by || 'Admin'}.`;
    case 'emergency_stop_disabled':
      return `Núdzové zastavenie deaktivované; autonómna prevádzka obnovená.`;
    case 'studio_created':
      return `AI Studio: Vygenerovaný nový web projekt "${d.name || ''}" (${d.model || ''}).`;
    case 'studio_code_review':
      return `Automatický audit webu: Skóre kvality ${d.score || 0}/100.`;
    case 'voice_dialogue_turn':
      return `Hlasová interakcia s Trinity ukončená (${d.duration_sec || 0}s).`;
    default:
      return `${action}: ${JSON.stringify(d).slice(0, 100)}`;
  }
}

export async function queryAuditEvents(env, options = {}) {
  const limit = Math.min(Math.max(Number(options.limit || 50), 1), 200);
  const actionFilter = options.action ? String(options.action).trim() : null;
  const categoryFilter = options.category ? String(options.category).trim() : null;
  const severityFilter = options.severity ? String(options.severity).trim() : null;
  const searchFilter = options.search ? String(options.search).trim().toLowerCase() : null;

  let query = 'SELECT id, job_id, action, details, created_at FROM ops_events';
  const conditions = [];
  const bindings = [];

  if (actionFilter) {
    conditions.push('action LIKE ?');
    bindings.push(`%${actionFilter}%`);
  }

  if (options.since) {
    conditions.push('created_at >= ?');
    bindings.push(options.since);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY id DESC LIMIT ?';
  bindings.push(limit * 2); // fetch slightly more to filter in memory by category/severity/search

  const stmt = env.DB.prepare(query);
  const rows = (await (bindings.length > 0 ? stmt.bind(...bindings).all() : stmt.all())).results || [];

  const results = [];
  for (const row of rows) {
    let parsedDetails = {};
    try {
      parsedDetails = JSON.parse(row.details || '{}');
    } catch {
      parsedDetails = { raw: row.details };
    }

    const category = categorizeAction(row.action);
    const severity = determineSeverity(row.action, parsedDetails);
    const actor = extractActor(parsedDetails);
    const summary = generateEventSummary(row.action, parsedDetails);

    if (categoryFilter && category !== categoryFilter) continue;
    if (severityFilter && severity !== severityFilter) continue;
    if (searchFilter) {
      const match =
        row.action.toLowerCase().includes(searchFilter) ||
        summary.toLowerCase().includes(searchFilter) ||
        actor.toLowerCase().includes(searchFilter) ||
        JSON.stringify(parsedDetails).toLowerCase().includes(searchFilter);
      if (!match) continue;
    }

    results.push({
      id: row.id,
      job_id: row.job_id,
      timestamp: row.created_at,
      action: row.action,
      category,
      severity,
      actor,
      summary,
      details: parsedDetails
    });

    if (results.length >= limit) break;
  }

  return results;
}

export async function exportAuditEvents(env, format = 'json', options = {}) {
  const events = await queryAuditEvents(env, { ...options, limit: 200 });

  if (format === 'csv') {
    const headers = ['ID', 'Timestamp', 'Category', 'Severity', 'Action', 'Actor', 'Summary', 'Details'];
    const escapeCsv = (val) => `"${String(val || '').replace(/"/g, '""')}"`;
    const rows = [headers.join(',')];

    for (const e of events) {
      rows.push([
        e.id,
        escapeCsv(e.timestamp),
        escapeCsv(e.category),
        escapeCsv(e.severity),
        escapeCsv(e.action),
        escapeCsv(e.actor),
        escapeCsv(e.summary),
        escapeCsv(JSON.stringify(e.details))
      ].join(','));
    }

    return {
      contentType: 'text/csv; charset=utf-8',
      data: rows.join('\r\n'),
      filename: `trinity-audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    };
  }

  return {
    contentType: 'application/json',
    data: JSON.stringify(events, null, 2),
    filename: `trinity-audit-log-${new Date().toISOString().slice(0, 10)}.json`
  };
}

export async function recordAuditEvent(env, { action, details, jobId = null }) {
  if (!action) return;
  const detailsStr = typeof details === 'string' ? details : JSON.stringify(details || {});
  await env.DB.prepare('INSERT INTO ops_events(job_id, action, details) VALUES(?, ?, ?)')
    .bind(jobId, action, detailsStr)
    .run();

  try {
    let parsedDetails = {};
    try {
      parsedDetails = typeof details === 'string' ? JSON.parse(details || '{}') : (details || {});
    } catch {
      parsedDetails = { raw: details };
    }
    const severity = determineSeverity(action, parsedDetails);
    const isNotifyWorthy = severity === 'critical' || severity === 'warning' ||
      action.startsWith('escrow_') || action.startsWith('payment_') || action.startsWith('invoice_') ||
      action.includes('checkout') || action.includes('order') || action.includes('trade') ||
      action.includes('domain_expiry') || action.includes('worker_outage') || action === 'google_login';

    if (isNotifyWorthy) {
      const summary = generateEventSummary(action, parsedDetails);
      const alertMsg = `📱 <b>Trinity Event Alert</b> (+421949009722)\n` +
        `<b>Udalosť:</b> <code>${action}</code> [${severity.toUpperCase()}]\n` +
        `<b>Podrobnosti:</b> ${summary}\n` +
        `<i>Čas: ${new Date().toISOString()}</i>`;
      sendTelegramAlert(env, alertMsg).catch(() => {});
    }
  } catch {}
}

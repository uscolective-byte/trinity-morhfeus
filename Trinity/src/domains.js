import { z } from 'zod';
import { HttpError } from './security.js';
import {cloudflareRequest,cloudflareAccount} from './infrastructure.js';

export const DOMAIN_STATUSES = ['active', 'parked', 'leased', 'for_sale', 'sold', 'pending', 'expired'];
export const LISTING_TYPES = ['none', 'sale', 'lease', 'both'];
export const DNS_RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'CAA', 'NS', 'SRV'];

export const domainNameSchema = z.string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(253)
  .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i, 'Neplatný formát domény.');

export const domainInputSchema = z.object({
  domain_name: domainNameSchema,
  zone_id: z.string().trim().max(100).optional().nullable(),
  registrar: z.string().trim().max(50).default('cloudflare'),
  status: z.enum(DOMAIN_STATUSES).default('active'),
  auto_renew: z.boolean().default(true),
  expires_at: z.string().datetime().optional().nullable(),
  nameservers: z.array(z.string().trim().min(3).max(253)).max(10).optional().default([]),
  notes: z.string().max(1000).optional().nullable(),
  listing_type: z.enum(LISTING_TYPES).default('none'),
  sale_price: z.number().min(0).max(1000000000).optional().nullable(),
  sale_currency: z.string().trim().min(3).max(5).default('EUR'),
  lease_price_monthly: z.number().min(0).max(1000000000).optional().nullable(),
  lease_currency: z.string().trim().min(3).max(5).default('EUR'),
  current_tenant: z.string().trim().max(150).optional().nullable(),
  lease_starts_at: z.string().datetime().optional().nullable(),
  lease_expires_at: z.string().datetime().optional().nullable(),
  buyer: z.string().trim().max(150).optional().nullable(),
  sold_at: z.string().datetime().optional().nullable()
}).strict();

export const domainRegistrationSchema = z.object({
  domain_name: domainNameSchema,
  registrar: z.string().trim().max(50).default('cloudflare'),
  years: z.number().int().min(1).max(10).default(1),
  auto_renew: z.boolean().default(true),
  zone_id: z.string().trim().max(100).optional().nullable(),
  nameservers: z.array(z.string().trim().min(3).max(253)).max(10).optional().default([]),
  notes: z.string().max(1000).optional().nullable(),
  live_register: z.boolean().default(false),
  purchase_confirmed: z.boolean().default(false),
  max_price: z.number().positive().max(100000).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD')
}).strict();

export const domainSaleListingSchema = z.object({
  domain: z.string().trim().min(1).max(253),
  price: z.number().min(0.01).max(1000000000),
  currency: z.string().trim().min(3).max(5).default('EUR'),
  notes: z.string().max(1000).optional().nullable()
}).strict();

export const domainSaleSchema = z.object({
  domain: z.string().trim().min(1).max(253),
  buyer: z.string().trim().min(2).max(150),
  price: z.number().min(0.01).max(1000000000),
  currency: z.string().trim().min(3).max(5).default('EUR'),
  notes: z.string().max(1000).optional().nullable()
}).strict();

export const domainLeaseListingSchema = z.object({
  domain: z.string().trim().min(1).max(253),
  monthly_price: z.number().min(0.01).max(1000000000),
  currency: z.string().trim().min(3).max(5).default('EUR'),
  notes: z.string().max(1000).optional().nullable()
}).strict();

export const domainLeaseSchema = z.object({
  domain: z.string().trim().min(1).max(253),
  tenant: z.string().trim().min(2).max(150),
  monthly_price: z.number().min(0.01).max(1000000000),
  currency: z.string().trim().min(3).max(5).default('EUR'),
  duration_months: z.number().int().min(1).max(120).default(12),
  starts_at: z.string().datetime().optional().nullable(),
  notes: z.string().max(1000).optional().nullable()
}).strict();

export const domainEndLeaseSchema = z.object({
  domain: z.string().trim().min(1).max(253),
  reason: z.string().max(500).default('Dohodnuté ukončenie prenájmu')
}).strict();

export const dnsRecordInputSchema = z.object({
  type: z.enum(DNS_RECORD_TYPES),
  name: z.string().trim().min(1).max(253),
  content: z.string().trim().min(1).max(4096),
  ttl: z.number().int().min(1).max(86400).default(1),
  proxied: z.boolean().default(true),
  priority: z.number().int().min(0).max(65535).optional().nullable()
}).strict();

function normalizeDomainRow(row) {
  if (!row) return null;
  let nameservers = [];
  try {
    nameservers = row.nameservers_json ? JSON.parse(row.nameservers_json) : [];
  } catch {
    nameservers = [];
  }
  return {
    id: row.id,
    domain_name: row.domain_name,
    zone_id: row.zone_id || null,
    registrar: row.registrar || 'cloudflare',
    status: row.status || 'active',
    auto_renew: Boolean(row.auto_renew),
    expires_at: row.expires_at || null,
    nameservers,
    dns_records_count: Number(row.dns_records_count || 0),
    notes: row.notes || null,
    listing_type: row.listing_type || 'none',
    sale_price: row.sale_price != null ? Number(row.sale_price) : null,
    sale_currency: row.sale_currency || 'EUR',
    lease_price_monthly: row.lease_price_monthly != null ? Number(row.lease_price_monthly) : null,
    lease_currency: row.lease_currency || 'EUR',
    current_tenant: row.current_tenant || null,
    lease_starts_at: row.lease_starts_at || null,
    lease_expires_at: row.lease_expires_at || null,
    buyer: row.buyer || null,
    sold_at: row.sold_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function normalizeDnsRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    domain_id: row.domain_id,
    record_id: row.record_id || null,
    type: row.type,
    name: row.name,
    content: row.content,
    ttl: Number(row.ttl || 1),
    proxied: Boolean(row.proxied),
    priority: row.priority != null ? Number(row.priority) : null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function normalizeTransactionRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    domain_id: row.domain_id,
    domain_name: row.domain_name,
    type: row.type,
    amount: Number(row.amount || 0),
    currency: row.currency || 'EUR',
    party: row.party || null,
    details: row.details || null,
    created_at: row.created_at
  };
}

function getCloudflareToken(env) {
  return env?.CLOUDFLARE_API_TOKEN || env?.CF_API_TOKEN || env?.CLOUDFLARE_TOKEN || null;
}

function getCloudflareAccountId(env) {
  return env?.CF_ACCOUNT_ID || env?.CLOUDFLARE_ACCOUNT_ID || 'b60342e5e52f5646fbd4e913bb409334';
}

export async function checkDomainAvailability(env, rawDomain) {
  const domain = domainNameSchema.parse(rawDomain);
  const token = getCloudflareToken(env);
  const accountId = getCloudflareAccountId(env);

  if (!token) {
    return {
      domain_name: domain,
      configured: false,
      registrable: null,
      message: 'Cloudflare Registrar API token (CF_API_TOKEN) nie je dostupný v prostredí.'
    };
  }

  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/registrar/domain-check`, {
      method: 'POST',
      signal: AbortSignal.timeout(20000),
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ domains: [domain] })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      const err = (data.errors && data.errors[0]?.message) || `HTTP ${res.status}`;
      return {
        domain_name: domain,
        configured: true,
        success: false,
        registrable: null,
        error: err
      };
    }

    const domainInfo = data.result?.domains?.[0] || {};
    return {
      domain_name: domain,
      configured: true,
      success: true,
      registrable: Boolean(domainInfo.registrable),
      reason: domainInfo.reason || (domainInfo.registrable ? 'available' : 'unavailable'),
      tier: domainInfo.tier || 'standard',
      pricing: domainInfo.pricing || null
    };
  } catch (err) {
    return {
      domain_name: domain,
      configured: true,
      success: false,
      registrable: null,
      error: err.message
    };
  }
}

export async function listDomains(env, filter = {}) {
  if (!env?.DB?.prepare) return [];
  let query = 'SELECT * FROM managed_domains';
  const conditions = [];
  const bindings = [];

  if (filter.status) {
    conditions.push('status = ?');
    bindings.push(filter.status);
  }
  if (filter.listing_type) {
    conditions.push('listing_type = ?');
    bindings.push(filter.listing_type);
  }
  if (filter.search) {
    conditions.push('lower(domain_name) LIKE ?');
    bindings.push(`%${filter.search.toLowerCase()}%`);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY domain_name ASC LIMIT 100';

  const stmt = env.DB.prepare(query);
  const rows = bindings.length > 0 ? await stmt.bind(...bindings).all() : await stmt.all();
  return (rows.results || []).map(normalizeDomainRow);
}

export async function getDomain(env, idOrName) {
  if (!env?.DB?.prepare) return null;
  const isUuid = /^[0-9a-f-]{36}$/i.test(idOrName);
  const row = isUuid
    ? await env.DB.prepare('SELECT * FROM managed_domains WHERE id=?').bind(idOrName).first()
    : await env.DB.prepare('SELECT * FROM managed_domains WHERE lower(domain_name)=lower(?)').bind(String(idOrName).trim()).first();
  return normalizeDomainRow(row);
}

export async function createDomain(env, input) {
  const data = domainInputSchema.parse(input);
  const existing = await getDomain(env, data.domain_name);
  if (existing) {
    throw new HttpError(409, `Doména '${data.domain_name}' už existuje v správe Trinity.`);
  }

  const id = crypto.randomUUID();
  const nsJson = JSON.stringify(data.nameservers || []);

  await env.DB.prepare(`
    INSERT INTO managed_domains(
      id, domain_name, zone_id, registrar, status, auto_renew, expires_at,
      nameservers_json, notes, listing_type, sale_price, sale_currency,
      lease_price_monthly, lease_currency, current_tenant, lease_starts_at,
      lease_expires_at, buyer, sold_at
    )
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    data.domain_name,
    data.zone_id || null,
    data.registrar,
    data.status,
    data.auto_renew ? 1 : 0,
    data.expires_at || null,
    nsJson,
    data.notes || null,
    data.listing_type || 'none',
    data.sale_price ?? null,
    data.sale_currency || 'EUR',
    data.lease_price_monthly ?? null,
    data.lease_currency || 'EUR',
    data.current_tenant || null,
    data.lease_starts_at || null,
    data.lease_expires_at || null,
    data.buyer || null,
    data.sold_at || null
  ).run();

  await env.DB.prepare("INSERT INTO ops_events(action, details) VALUES('domain_created', ?)")
    .bind(JSON.stringify({ id, domain_name: data.domain_name, registrar: data.registrar, status: data.status }))
    .run();

  return getDomain(env, id);
}

export async function registerDomain(env, input) {
  const data = domainRegistrationSchema.parse(input);
  const existing = await getDomain(env, data.domain_name);
  if (existing) {
    throw new HttpError(409, `Doména '${data.domain_name}' už existuje v správe Trinity.`);
  }

  const now = new Date(), id = crypto.randomUUID(), txId = crypto.randomUUID();
  let expiresAt = null, transactionAmount = 0, transactionCurrency = data.currency;
  let cfRegistrationResult = null;
  let registrarReceipt = {registrar:data.registrar,status:'recorded',recorded_at:now.toISOString(),live_registration:false,completed:false,note:'Iba evidencia v Trinity; doména nebola kúpená.'};
  if(data.live_register){
    if(!data.purchase_confirmed||!data.max_price)throw new HttpError(400,'Nákup vyžaduje potvrdenú konkrétnu doménu a max_price.');
    if(data.years!==1)throw new HttpError(400,'Cloudflare Registrar API podporuje v tomto postupe registráciu na 1 rok.');
    const quote=await checkDomainAvailability(env,data.domain_name);
    const price=Number(quote.pricing?.registration_cost);
    if(quote.success!==true||quote.registrable!==true)throw new HttpError(409,'Doménu nie je možné teraz registrovať; over dostupnosť a konfiguráciu registrátora.');
    if(!Number.isFinite(price)||price<=0||quote.pricing?.currency!==data.currency||price>data.max_price)throw new HttpError(409,'Cena alebo mena nezodpovedá potvrdenému limitu.');
    const response=await cloudflareRequest(env,`/accounts/${cloudflareAccount(env)}/registrar/registrations`,'POST',{domain_name:data.domain_name,auto_renew:data.auto_renew});
    cfRegistrationResult=response.result;
    const completed=cfRegistrationResult?.state==='succeeded'&&cfRegistrationResult?.completed===true;
    expiresAt=completed?(cfRegistrationResult.context?.registration?.expires_at||null):null;
    transactionAmount=price;
    registrarReceipt={registrar:'cloudflare',recorded_at:now.toISOString(),expires_at:expiresAt,status:cfRegistrationResult?.state||'in_progress',completed,live_registration:true,cloudflare_workflow_id:cfRegistrationResult?.id||null,quoted_price:price,currency:data.currency,note:completed?'Registrátor potvrdil dokončenú registráciu.':'Registrácia bola prijatá; dokončenie treba overiť cez stav registrácie.'};
  }
  const nsJson=JSON.stringify(data.nameservers||[]);

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO managed_domains(
        id, domain_name, zone_id, registrar, status, auto_renew, expires_at,
        nameservers_json, notes, listing_type, sale_price, sale_currency,
        lease_price_monthly, lease_currency, current_tenant, lease_starts_at,
        lease_expires_at, buyer, sold_at
      )
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'EUR', NULL, 'EUR', NULL, NULL, NULL, NULL, NULL)
    `).bind(
      id,
      data.domain_name,
      data.zone_id || null,
      data.live_register ? 'cloudflare' : data.registrar,
      registrarReceipt.completed ? 'active' : 'pending',
      data.auto_renew ? 1 : 0,
      expiresAt,
      nsJson,
      data.notes || registrarReceipt.note,
      'none'
    ),
    env.DB.prepare(`
      INSERT INTO domain_transactions(id, domain_id, domain_name, type, amount, currency, party, details)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      txId,
      id,
      data.domain_name,
      data.live_register ? 'live_registration' : 'registration',
      transactionAmount,
      transactionCurrency,
      data.live_register ? 'Cloudflare Registrar' : data.registrar,
      JSON.stringify(registrarReceipt)
    ),
    env.DB.prepare("INSERT INTO ops_events(action, details) VALUES('domain_registered', ?)")
      .bind(JSON.stringify({ id, domain_name: data.domain_name, registrar: data.live_register ? 'cloudflare' : data.registrar, years: data.years, expires_at: expiresAt, live_registration: Boolean(data.live_register) }))
  ]);

  const domain = await getDomain(env, id);
  return { domain, registration_receipt: registrarReceipt, cloudflare_result: cfRegistrationResult };
}

export async function updateDomain(env, idOrName, input) {
  const domain = await getDomain(env, idOrName);
  if (!domain) throw new HttpError(404, 'Doména nebola nájdená.');

  const updateSchema = domainInputSchema.partial();
  const data = updateSchema.parse(input);

  const nextStatus = data.status ?? domain.status;
  const nextZoneId = data.zone_id !== undefined ? (data.zone_id || null) : domain.zone_id;
  const nextRegistrar = data.registrar ?? domain.registrar;
  const nextAutoRenew = data.auto_renew !== undefined ? (data.auto_renew ? 1 : 0) : (domain.auto_renew ? 1 : 0);
  const nextExpires = data.expires_at !== undefined ? (data.expires_at || null) : domain.expires_at;
  const nextNs = data.nameservers ? JSON.stringify(data.nameservers) : JSON.stringify(domain.nameservers);
  const nextNotes = data.notes !== undefined ? (data.notes || null) : domain.notes;
  const nextListing = data.listing_type ?? domain.listing_type;
  const nextSalePrice = data.sale_price !== undefined ? data.sale_price : domain.sale_price;
  const nextSaleCurrency = data.sale_currency ?? domain.sale_currency;
  const nextLeasePrice = data.lease_price_monthly !== undefined ? data.lease_price_monthly : domain.lease_price_monthly;
  const nextLeaseCurrency = data.lease_currency ?? domain.lease_currency;
  const nextTenant = data.current_tenant !== undefined ? data.current_tenant : domain.current_tenant;
  const nextLeaseStart = data.lease_starts_at !== undefined ? data.lease_starts_at : domain.lease_starts_at;
  const nextLeaseExpires = data.lease_expires_at !== undefined ? data.lease_expires_at : domain.lease_expires_at;
  const nextBuyer = data.buyer !== undefined ? data.buyer : domain.buyer;
  const nextSoldAt = data.sold_at !== undefined ? data.sold_at : domain.sold_at;

  await env.DB.prepare(`
    UPDATE managed_domains
    SET zone_id=?, registrar=?, status=?, auto_renew=?, expires_at=?, nameservers_json=?,
        notes=?, listing_type=?, sale_price=?, sale_currency=?, lease_price_monthly=?,
        lease_currency=?, current_tenant=?, lease_starts_at=?, lease_expires_at=?,
        buyer=?, sold_at=?, updated_at=datetime('now')
    WHERE id=?
  `).bind(
    nextZoneId, nextRegistrar, nextStatus, nextAutoRenew, nextExpires, nextNs,
    nextNotes, nextListing, nextSalePrice, nextSaleCurrency, nextLeasePrice,
    nextLeaseCurrency, nextTenant, nextLeaseStart, nextLeaseExpires,
    nextBuyer, nextSoldAt, domain.id
  ).run();

  return getDomain(env, domain.id);
}

export async function deleteDomain(env, idOrName) {
  const domain = await getDomain(env, idOrName);
  if (!domain) throw new HttpError(404, 'Doména nebola nájdená.');

  await env.DB.batch([
    env.DB.prepare('DELETE FROM domain_dns_records WHERE domain_id=?').bind(domain.id),
    env.DB.prepare('DELETE FROM domain_transactions WHERE domain_id=?').bind(domain.id),
    env.DB.prepare('DELETE FROM managed_domains WHERE id=?').bind(domain.id),
    env.DB.prepare("INSERT INTO ops_events(action, details) VALUES('domain_deleted', ?)").bind(JSON.stringify({ id: domain.id, domain_name: domain.domain_name }))
  ]);

  return { ok: true, deleted_id: domain.id, domain_name: domain.domain_name };
}

export async function listDomainForSale(env, idOrName, input) {
  const domain = await getDomain(env, idOrName);
  if (!domain) throw new HttpError(404, 'Doména nebola nájdená.');
  if (domain.status === 'sold') throw new HttpError(400, 'Predanú doménu nie je možné znovu ponúkať na predaj.');

  const data = domainSaleListingSchema.parse({ domain: domain.domain_name, ...input });
  const newListingType = domain.listing_type === 'lease' || domain.listing_type === 'both' ? 'both' : 'sale';
  const newStatus = domain.status === 'leased' ? 'leased' : 'for_sale';

  await env.DB.batch([
    env.DB.prepare(`
      UPDATE managed_domains
      SET listing_type=?, sale_price=?, sale_currency=?, status=?, notes=coalesce(?, notes), updated_at=datetime('now')
      WHERE id=?
    `).bind(newListingType, data.price, data.currency, newStatus, data.notes || null, domain.id),
    env.DB.prepare("INSERT INTO ops_events(action, details) VALUES('domain_listed_for_sale', ?)")
      .bind(JSON.stringify({ domain: domain.domain_name, price: data.price, currency: data.currency }))
  ]);

  return getDomain(env, domain.id);
}

export async function sellDomain(env, idOrName, input) {
  const domain = await getDomain(env, idOrName);
  if (!domain) throw new HttpError(404, 'Doména nebola nájdená.');
  if (domain.status === 'sold') throw new HttpError(400, 'Doména už bola predaná.');

  const data = domainSaleSchema.parse({ domain: domain.domain_name, ...input });
  const txId = crypto.randomUUID();
  const soldAt = new Date().toISOString();

  await env.DB.batch([
    env.DB.prepare(`
      UPDATE managed_domains
      SET status='sold', listing_type='none', buyer=?, sold_at=?, sale_price=?, sale_currency=?,
          notes=coalesce(?, notes), updated_at=datetime('now')
      WHERE id=?
    `).bind(data.buyer, soldAt, data.price, data.currency, data.notes || null, domain.id),
    env.DB.prepare(`
      INSERT INTO domain_transactions(id, domain_id, domain_name, type, amount, currency, party, details)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      txId,
      domain.id,
      domain.domain_name,
      'sale',
      data.price,
      data.currency,
      data.buyer,
      JSON.stringify({ notes: data.notes || null, sold_at: soldAt })
    ),
    env.DB.prepare("INSERT INTO ops_events(action, details) VALUES('domain_sold', ?)")
      .bind(JSON.stringify({ domain: domain.domain_name, buyer: data.buyer, price: data.price, currency: data.currency }))
  ]);

  const updated = await getDomain(env, domain.id);
  return { domain: updated, transaction_id: txId, ok: true };
}

export async function listDomainForLease(env, idOrName, input) {
  const domain = await getDomain(env, idOrName);
  if (!domain) throw new HttpError(404, 'Doména nebola nájdená.');
  if (domain.status === 'sold') throw new HttpError(400, 'Predanú doménu nie je možné prenajímať.');

  const data = domainLeaseListingSchema.parse({ domain: domain.domain_name, ...input });
  const newListingType = domain.listing_type === 'sale' || domain.listing_type === 'both' ? 'both' : 'lease';

  await env.DB.batch([
    env.DB.prepare(`
      UPDATE managed_domains
      SET listing_type=?, lease_price_monthly=?, lease_currency=?, notes=coalesce(?, notes), updated_at=datetime('now')
      WHERE id=?
    `).bind(newListingType, data.monthly_price, data.currency, data.notes || null, domain.id),
    env.DB.prepare("INSERT INTO ops_events(action, details) VALUES('domain_listed_for_lease', ?)")
      .bind(JSON.stringify({ domain: domain.domain_name, monthly_price: data.monthly_price, currency: data.currency }))
  ]);

  return getDomain(env, domain.id);
}

export async function leaseDomain(env, idOrName, input) {
  const domain = await getDomain(env, idOrName);
  if (!domain) throw new HttpError(404, 'Doména nebola nájdená.');
  if (domain.status === 'sold') throw new HttpError(400, 'Predanú doménu nie je možné prenajať.');
  if (domain.status === 'leased') throw new HttpError(400, `Doména je už prenajatá nájomcovi '${domain.current_tenant}'.`);

  const data = domainLeaseSchema.parse({ domain: domain.domain_name, ...input });
  const startsAt = data.starts_at || new Date().toISOString();
  const startMs = new Date(startsAt).getTime();
  const expiresAt = new Date(startMs + data.duration_months * 30.4375 * 24 * 3600 * 1000).toISOString();
  const txId = crypto.randomUUID();

  await env.DB.batch([
    env.DB.prepare(`
      UPDATE managed_domains
      SET status='leased', current_tenant=?, lease_price_monthly=?, lease_currency=?,
          lease_starts_at=?, lease_expires_at=?, notes=coalesce(?, notes), updated_at=datetime('now')
      WHERE id=?
    `).bind(data.tenant, data.monthly_price, data.currency, startsAt, expiresAt, data.notes || null, domain.id),
    env.DB.prepare(`
      INSERT INTO domain_transactions(id, domain_id, domain_name, type, amount, currency, party, details)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      txId,
      domain.id,
      domain.domain_name,
      'lease',
      data.monthly_price,
      data.currency,
      data.tenant,
      JSON.stringify({ duration_months: data.duration_months, starts_at: startsAt, expires_at: expiresAt, notes: data.notes || null })
    ),
    env.DB.prepare("INSERT INTO ops_events(action, details) VALUES('domain_leased', ?)")
      .bind(JSON.stringify({ domain: domain.domain_name, tenant: data.tenant, monthly_price: data.monthly_price, expires_at: expiresAt }))
  ]);

  const updated = await getDomain(env, domain.id);
  return { domain: updated, transaction_id: txId, ok: true };
}

export async function endDomainLease(env, idOrName, input = {}) {
  const domain = await getDomain(env, idOrName);
  if (!domain) throw new HttpError(404, 'Doména nebola nájdená.');
  if (domain.status !== 'leased') throw new HttpError(400, 'Doména nie je v stave prenájmu.');

  const data = domainEndLeaseSchema.parse({ domain: domain.domain_name, ...input });
  const txId = crypto.randomUUID();
  const previousTenant = domain.current_tenant;
  const newStatus = domain.listing_type === 'sale' ? 'for_sale' : 'active';

  await env.DB.batch([
    env.DB.prepare(`
      UPDATE managed_domains
      SET status=?, current_tenant=NULL, lease_starts_at=NULL, lease_expires_at=NULL, updated_at=datetime('now')
      WHERE id=?
    `).bind(newStatus, domain.id),
    env.DB.prepare(`
      INSERT INTO domain_transactions(id, domain_id, domain_name, type, amount, currency, party, details)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      txId,
      domain.id,
      domain.domain_name,
      'lease_end',
      0,
      'EUR',
      previousTenant || 'Neznámy nájomca',
      JSON.stringify({ reason: data.reason })
    ),
    env.DB.prepare("INSERT INTO ops_events(action, details) VALUES('domain_lease_ended', ?)")
      .bind(JSON.stringify({ domain: domain.domain_name, tenant: previousTenant, reason: data.reason }))
  ]);

  const updated = await getDomain(env, domain.id);
  return { domain: updated, transaction_id: txId, ok: true };
}

export async function listDomainTransactions(env, idOrName) {
  const domain = await getDomain(env, idOrName);
  if (!domain) throw new HttpError(404, 'Doména nebola nájdená.');

  const rows = await env.DB.prepare('SELECT * FROM domain_transactions WHERE domain_id=? ORDER BY created_at DESC LIMIT 50')
    .bind(domain.id)
    .all();
  return (rows.results || []).map(normalizeTransactionRow);
}

export async function getDomainMarketplace(env) {
  if (!env?.DB?.prepare) return { for_sale: [], for_lease: [], sold: [] };

  const [saleRows, leaseRows, soldRows] = await Promise.all([
    env.DB.prepare("SELECT * FROM managed_domains WHERE listing_type IN ('sale','both') OR status='for_sale' ORDER BY domain_name ASC").all(),
    env.DB.prepare("SELECT * FROM managed_domains WHERE listing_type IN ('lease','both') OR status='leased' ORDER BY domain_name ASC").all(),
    env.DB.prepare("SELECT * FROM managed_domains WHERE status='sold' ORDER BY sold_at DESC LIMIT 20").all()
  ]);

  return {
    for_sale: (saleRows.results || []).map(normalizeDomainRow),
    for_lease: (leaseRows.results || []).map(normalizeDomainRow),
    sold: (soldRows.results || []).map(normalizeDomainRow)
  };
}

export async function listDnsRecords(env, domainIdOrName) {
  const domain = await getDomain(env, domainIdOrName);
  if (!domain) throw new HttpError(404, 'Doména nebola nájdená.');

  const rows = await env.DB.prepare('SELECT * FROM domain_dns_records WHERE domain_id=? ORDER BY type, name ASC').bind(domain.id).all();
  return (rows.results || []).map(normalizeDnsRow);
}

export async function addDnsRecord(env, domainIdOrName, input) {
  const domain = await getDomain(env, domainIdOrName);
  if (!domain) throw new HttpError(404, 'Doména nebola nájdená.');

  const data = dnsRecordInputSchema.parse(input);
  const id = crypto.randomUUID();
  let externalRecordId = null;
  let syncState = 'persisted_locally';

  const token = getCloudflareToken(env);
  if (token && domain.zone_id) {
    try {
      const cfRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${domain.zone_id}/dns_records`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: data.type,
          name: data.name,
          content: data.content,
          ttl: data.ttl,
          proxied: ['A', 'AAAA', 'CNAME'].includes(data.type) ? data.proxied : false,
          priority: data.type === 'MX' ? data.priority : undefined
        })
      });
      const cfJson = await cfRes.json();
      if (!cfRes.ok || !cfJson.success || !cfJson.result?.id) throw new HttpError(502,'Cloudflare odmietol DNS záznam.');
      if (cfJson.success && cfJson.result?.id) {
        externalRecordId = cfJson.result.id;
        syncState = 'synced_with_cloudflare';
      }
    } catch {
      throw new HttpError(502,'DNS záznam nebol vytvorený v Cloudflare.');
    }
  }

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO domain_dns_records(id, domain_id, record_id, type, name, content, ttl, proxied, priority)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      domain.id,
      externalRecordId,
      data.type,
      data.name,
      data.content,
      data.ttl,
      data.proxied ? 1 : 0,
      data.priority ?? null
    ),
    env.DB.prepare("UPDATE managed_domains SET dns_records_count = (SELECT COUNT(*) FROM domain_dns_records WHERE domain_id=?), updated_at=datetime('now') WHERE id=?")
      .bind(domain.id, domain.id),
    env.DB.prepare("INSERT INTO ops_events(action, details) VALUES('domain_dns_created', ?)")
      .bind(JSON.stringify({ domain: domain.domain_name, id, type: data.type, name: data.name, sync: syncState }))
  ]);

  const row = await env.DB.prepare('SELECT * FROM domain_dns_records WHERE id=?').bind(id).first();
  return { ...normalizeDnsRow(row), sync_status: syncState };
}

export async function deleteDnsRecord(env, domainIdOrName, recordId) {
  const domain = await getDomain(env, domainIdOrName);
  if (!domain) throw new HttpError(404, 'Doména nebola nájdená.');

  const existing = await env.DB.prepare('SELECT * FROM domain_dns_records WHERE id=? AND domain_id=?')
    .bind(recordId, domain.id)
    .first();
  if (!existing) throw new HttpError(404, 'DNS záznam nebol nájdený.');

  let syncState = 'deleted_locally';
  const token = getCloudflareToken(env);
  if (token && domain.zone_id && existing.record_id) {
    try {
      const cfRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${domain.zone_id}/dns_records/${existing.record_id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const cfJson = await cfRes.json();
      if (!cfRes.ok || !cfJson.success) throw new HttpError(502,'DNS odstránenie zlyhalo.');
      syncState = 'deleted_from_cloudflare';
    } catch {
      throw new HttpError(502,'DNS záznam sa nepodarilo odstrániť v Cloudflare; lokálny záznam bol zachovaný.');
    }
  }

  await env.DB.batch([
    env.DB.prepare('DELETE FROM domain_dns_records WHERE id=?').bind(recordId),
    env.DB.prepare("UPDATE managed_domains SET dns_records_count = (SELECT COUNT(*) FROM domain_dns_records WHERE domain_id=?), updated_at=datetime('now') WHERE id=?")
      .bind(domain.id, domain.id),
    env.DB.prepare("INSERT INTO ops_events(action, details) VALUES('domain_dns_deleted', ?)")
      .bind(JSON.stringify({ domain: domain.domain_name, id: recordId, sync: syncState }))
  ]);

  return { ok: true, deleted_record_id: recordId, sync_status: syncState };
}

export async function searchDomainNames(env,query){
  const q=z.string().trim().min(2).max(150).parse(query);
  const response=await cloudflareRequest(env,`/accounts/${cloudflareAccount(env)}/registrar/domain-search?q=${encodeURIComponent(q)}&limit=5`);
  return {domains:response.result?.domains||[],availability:'cached; check immediately before purchase'};
}
export async function refreshDomainRegistration(env,rawDomain){
  const name=domainNameSchema.parse(rawDomain),domain=await getDomain(env,name);
  if(!domain)throw new HttpError(404,'Doména nie je evidovaná.');
  const response=await cloudflareRequest(env,`/accounts/${cloudflareAccount(env)}/registrar/registrations/${encodeURIComponent(name)}/registration-status`);
  const registration=response.result,completed=registration.state==='succeeded'&&registration.completed===true;
  if(completed){await updateDomain(env,name,{status:'active',expires_at:registration.context?.registration?.expires_at||null});}
  await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('domain_registration_checked',?)").bind(JSON.stringify({domain_name:name,state:registration.state,completed})).run();
  return {domain_name:name,state:registration.state,completed,error:registration.error||null};
}
export async function syncCloudflareDomains(env){
  let synced=0;
  for(let page=1;page<=20;page++){
    const response=await cloudflareRequest(env,`/zones?account.id=${cloudflareAccount(env)}&per_page=50&page=${page}`);
    for(const zone of response.result||[]){
      const existing=await getDomain(env,zone.name);
      if(existing)await updateDomain(env,existing.id,{zone_id:zone.id,nameservers:zone.name_servers||[]});
      else await createDomain(env,{domain_name:zone.name,zone_id:zone.id,nameservers:zone.name_servers||[],status:zone.status==='active'?'active':'pending',notes:'Import DNS zóny Cloudflare; nepotvrdzuje vlastníctvo registrácie.'});
      synced++;
    }
    if(page>=(response.result_info?.total_pages||1))return {synced,complete:true,scope:'Cloudflare DNS zones'};
  }
  return {synced,complete:false,scope:'Cloudflare DNS zones'};
}
export async function createSubdomain(env,input){
  const data=z.object({domain:domainNameSchema,label:z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/),target:domainNameSchema}).strict().parse(input);
  const parent=await getDomain(env,data.domain);
  if(!parent?.zone_id)throw new HttpError(409,'Pre vytvorenie subdomény najprv synchronizuj Cloudflare DNS zónu.');
  if(!getCloudflareToken(env))throw new HttpError(503,'Chýba Cloudflare API token pre reálne vytvorenie subdomény.');
  return addDnsRecord(env,parent.id,{type:'CNAME',name:data.label+'.'+parent.domain_name,content:data.target,proxied:true});
}

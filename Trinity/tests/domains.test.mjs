import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  domainNameSchema,
  domainInputSchema,
  domainRegistrationSchema,
  domainSaleListingSchema,
  domainSaleSchema,
  domainLeaseListingSchema,
  domainLeaseSchema,
  domainEndLeaseSchema,
  dnsRecordInputSchema,
  listDomains,
  getDomain,
  createDomain,
  registerDomain,
  updateDomain,
  deleteDomain,
  listDomainForSale,
  sellDomain,
  listDomainForLease,
  leaseDomain,
  endDomainLease,
  listDomainTransactions,
  getDomainMarketplace,
  listDnsRecords,
  addDnsRecord,
  deleteDnsRecord,
  checkDomainAvailability
} from '../src/domains.js';
import { runTool } from '../src/tools.js';
import { AGENTS } from '../src/registry.js';

function createDomainMockDB() {
  const domains = new Map();
  const dnsRecords = new Map();
  const transactions = new Map();
  const events = [];

  const self = {
    domains,
    dnsRecords,
    transactions,
    events,
    prepare(sql) {
      let params = [];
      return {
        bind(...args) {
          params = args;
          return this;
        },
        async first() {
          if (sql.includes('SELECT * FROM managed_domains WHERE id=?')) {
            const id = params[0];
            return domains.get(id) || null;
          }
          if (sql.includes('SELECT * FROM managed_domains WHERE lower(domain_name)=lower(?)')) {
            const name = String(params[0]).toLowerCase();
            for (const d of domains.values()) {
              if (d.domain_name.toLowerCase() === name) return d;
            }
            return null;
          }
          if (sql.includes('SELECT * FROM domain_dns_records WHERE id=? AND domain_id=?')) {
            const [recordId, domainId] = params;
            const r = dnsRecords.get(recordId);
            return (r && r.domain_id === domainId) ? r : null;
          }
          if (sql.includes('SELECT * FROM domain_dns_records WHERE id=?')) {
            return dnsRecords.get(params[0]) || null;
          }
          if (sql.includes('FROM ops_plugins WHERE id=?')) {
            return { installed: 1, enabled: 1 };
          }
          return null;
        },
        async all() {
          if (sql.includes('FROM managed_domains')) {
            let list = Array.from(domains.values());
            if (sql.includes("listing_type IN ('sale','both')") || sql.includes("status='for_sale'")) {
              list = list.filter(d => ['sale', 'both'].includes(d.listing_type) || d.status === 'for_sale');
            } else if (sql.includes("listing_type IN ('lease','both')") || sql.includes("status='leased'")) {
              list = list.filter(d => ['lease', 'both'].includes(d.listing_type) || d.status === 'leased');
            } else if (sql.includes("status='sold'")) {
              list = list.filter(d => d.status === 'sold');
            }
            if (params.length > 0 && sql.includes('status = ?')) {
              list = list.filter(d => d.status === params[0]);
            }
            list.sort((a, b) => a.domain_name.localeCompare(b.domain_name));
            return { results: list };
          }
          if (sql.includes('FROM domain_dns_records WHERE domain_id=?')) {
            const domainId = params[0];
            const list = Array.from(dnsRecords.values()).filter(r => r.domain_id === domainId);
            return { results: list };
          }
          if (sql.includes('FROM domain_transactions WHERE domain_id=?')) {
            const domainId = params[0];
            const list = Array.from(transactions.values())
              .filter(t => t.domain_id === domainId)
              .sort((a, b) => b.created_at.localeCompare(a.created_at));
            return { results: list };
          }
          return { results: [] };
        },
        async run() {
          if (sql.includes('INSERT INTO managed_domains')) {
            const [id, domain_name, zone_id, registrar] = params;
            domains.set(id, {
              id,
              domain_name,
              zone_id,
              registrar,
              status: params[4] || 'active',
              auto_renew: params[5] ?? 1,
              expires_at: params[6] || null,
              nameservers_json: params[7] || '[]',
              notes: params[8] || null,
              listing_type: params[9] || 'none',
              sale_price: params[10] != null ? params[10] : null,
              sale_currency: params[11] || 'EUR',
              lease_price_monthly: params[12] != null ? params[12] : null,
              lease_currency: params[13] || 'EUR',
              current_tenant: params[14] || null,
              lease_starts_at: params[15] || null,
              lease_expires_at: params[16] || null,
              buyer: params[17] || null,
              sold_at: params[18] || null,
              dns_records_count: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
            return { success: true };
          }
          if (sql.includes('UPDATE managed_domains') && sql.includes('SET status=')) {
            if (sql.includes("status='sold'")) {
              const [buyer, sold_at, sale_price, sale_currency, notes, id] = params;
              const existing = domains.get(id);
              if (existing) {
                domains.set(id, {
                  ...existing,
                  status: 'sold',
                  listing_type: 'none',
                  buyer,
                  sold_at,
                  sale_price,
                  sale_currency,
                  notes: notes || existing.notes,
                  updated_at: new Date().toISOString()
                });
              }
              return { success: true };
            }
            if (sql.includes("status='leased'")) {
              const [current_tenant, lease_price_monthly, lease_currency, lease_starts_at, lease_expires_at, notes, id] = params;
              const existing = domains.get(id);
              if (existing) {
                domains.set(id, {
                  ...existing,
                  status: 'leased',
                  current_tenant,
                  lease_price_monthly,
                  lease_currency,
                  lease_starts_at,
                  lease_expires_at,
                  notes: notes || existing.notes,
                  updated_at: new Date().toISOString()
                });
              }
              return { success: true };
            }
          }
          if (sql.includes('UPDATE managed_domains') && sql.includes('SET listing_type=?')) {
            if (sql.includes('sale_price=?')) {
              const [listing_type, sale_price, sale_currency, status, notes, id] = params;
              const existing = domains.get(id);
              if (existing) {
                domains.set(id, {
                  ...existing,
                  listing_type,
                  sale_price,
                  sale_currency,
                  status,
                  notes: notes || existing.notes,
                  updated_at: new Date().toISOString()
                });
              }
              return { success: true };
            }
            if (sql.includes('lease_price_monthly=?')) {
              const [listing_type, lease_price_monthly, lease_currency, notes, id] = params;
              const existing = domains.get(id);
              if (existing) {
                domains.set(id, {
                  ...existing,
                  listing_type,
                  lease_price_monthly,
                  lease_currency,
                  notes: notes || existing.notes,
                  updated_at: new Date().toISOString()
                });
              }
              return { success: true };
            }
          }
          if (sql.includes('UPDATE managed_domains') && sql.includes('SET status=?') && sql.includes('current_tenant=NULL')) {
            const [status, id] = params;
            const existing = domains.get(id);
            if (existing) {
              domains.set(id, {
                ...existing,
                status,
                current_tenant: null,
                lease_starts_at: null,
                lease_expires_at: null,
                updated_at: new Date().toISOString()
              });
            }
            return { success: true };
          }
          if (sql.includes('UPDATE managed_domains') && sql.includes('SET zone_id=?')) {
            const [zone_id, registrar, status, auto_renew, expires_at, nameservers_json, notes, listing_type, sale_price, sale_currency, lease_price_monthly, lease_currency, current_tenant, lease_starts_at, lease_expires_at, buyer, sold_at, id] = params;
            const existing = domains.get(id);
            if (existing) {
              domains.set(id, {
                ...existing,
                zone_id,
                registrar,
                status,
                auto_renew,
                expires_at,
                nameservers_json,
                notes,
                listing_type: listing_type || existing.listing_type,
                sale_price: sale_price !== undefined ? sale_price : existing.sale_price,
                sale_currency: sale_currency || existing.sale_currency,
                lease_price_monthly: lease_price_monthly !== undefined ? lease_price_monthly : existing.lease_price_monthly,
                lease_currency: lease_currency || existing.lease_currency,
                current_tenant: current_tenant !== undefined ? current_tenant : existing.current_tenant,
                lease_starts_at: lease_starts_at !== undefined ? lease_starts_at : existing.lease_starts_at,
                lease_expires_at: lease_expires_at !== undefined ? lease_expires_at : existing.lease_expires_at,
                buyer: buyer !== undefined ? buyer : existing.buyer,
                sold_at: sold_at !== undefined ? sold_at : existing.sold_at,
                updated_at: new Date().toISOString()
              });
            }
            return { success: true };
          }
          if (sql.includes('INSERT INTO domain_transactions')) {
            const [id, domain_id, domain_name, type, amount, currency, party, details] = params;
            transactions.set(id, {
              id,
              domain_id,
              domain_name,
              type,
              amount: amount != null ? Number(amount) : 0,
              currency: currency || 'EUR',
              party,
              details,
              created_at: new Date().toISOString()
            });
            return { success: true };
          }
          if (sql.includes('INSERT INTO domain_dns_records')) {
            const [id, domain_id, record_id, type, name, content, ttl, proxied, priority] = params;
            dnsRecords.set(id, {
              id,
              domain_id,
              record_id,
              type,
              name,
              content,
              ttl,
              proxied,
              priority,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
            return { success: true };
          }
          if (sql.includes('UPDATE managed_domains SET dns_records_count')) {
            const domainId = params[1];
            const count = Array.from(dnsRecords.values()).filter(r => r.domain_id === domainId).length;
            const d = domains.get(domainId);
            if (d) d.dns_records_count = count;
            return { success: true };
          }
          if (sql.includes('DELETE FROM domain_dns_records WHERE id=?')) {
            dnsRecords.delete(params[0]);
            return { success: true };
          }
          if (sql.includes('DELETE FROM domain_dns_records WHERE domain_id=?')) {
            const domainId = params[0];
            for (const [id, r] of dnsRecords.entries()) {
              if (r.domain_id === domainId) dnsRecords.delete(id);
            }
            return { success: true };
          }
          if (sql.includes('DELETE FROM domain_transactions WHERE domain_id=?')) {
            const domainId = params[0];
            for (const [id, t] of transactions.entries()) {
              if (t.domain_id === domainId) transactions.delete(id);
            }
            return { success: true };
          }
          if (sql.includes('DELETE FROM managed_domains WHERE id=?')) {
            domains.delete(params[0]);
            return { success: true };
          }
          if (sql.includes('INSERT INTO ops_events')) {
            events.push({ action: params[0] || 'event', details: params[1] });
            return { success: true };
          }
          return { success: true };
        }
      };
    },
    async batch(statements) {
      const results = [];
      for (const stmt of statements) {
        results.push(await stmt.run());
      }
      return results;
    }
  };
  return self;
}

test('Domain Engine: Schema validácie odmietajú neplatné vstupy pre domény, predaj a prenájom', () => {
  assert.equal(domainNameSchema.parse('auru.space'), 'auru.space');
  assert.equal(domainNameSchema.parse('sub.mojadomena.sk'), 'sub.mojadomena.sk');
  assert.throws(() => domainNameSchema.parse('neplatna_domena'), /Neplatný formát/);
  assert.throws(() => domainNameSchema.parse(''), /Neplatný formát/);

  const regValid = domainRegistrationSchema.parse({
    domain_name: 'quantum-trinity.com',
    years: 2,
    registrar: 'cloudflare'
  });
  assert.equal(regValid.domain_name, 'quantum-trinity.com');
  assert.equal(regValid.years, 2);

  const saleListing = domainSaleListingSchema.parse({
    domain: 'auru.space',
    price: 5000,
    currency: 'EUR'
  });
  assert.equal(saleListing.price, 5000);

  const leaseListing = domainLeaseListingSchema.parse({
    domain: 'auru.space',
    monthly_price: 250,
    currency: 'EUR'
  });
  assert.equal(leaseListing.monthly_price, 250);

  assert.throws(() => domainSaleSchema.parse({ domain: 'auru.space', buyer: 'x' }));
});

test('Domain Engine: Registrácia a správa domény v D1 s auditnou stopou', async () => {
  const db = createDomainMockDB();
  const env = { DB: db };

  const regRes = await registerDomain(env, {
    domain_name: 'trinity-cloud.org',
    years: 3,
    registrar: 'cloudflare',
    auto_renew: true
  });

  assert.ok(regRes.domain.id);
  assert.equal(regRes.domain.domain_name, 'trinity-cloud.org');
  assert.equal(regRes.domain.status, 'pending');
  assert.equal(regRes.domain.expires_at,null);

  const txs = await listDomainTransactions(env, regRes.domain.id);
  assert.equal(txs.length, 1);
  assert.equal(txs[0].type, 'registration');
  assert.equal(txs[0].party, 'cloudflare');

  const updated = await updateDomain(env, regRes.domain.id, {
    notes: 'Kľúčová doména pre tím'
  });
  assert.equal(updated.notes, 'Kľúčová doména pre tím');
});

test('Domain Engine: Predaj a prenájom domén (komerčné funkcie)', async () => {
  const db = createDomainMockDB();
  const env = { DB: db };

  const d1 = await createDomain(env, {
    domain_name: 'premium-ai.sk',
    status: 'active'
  });

  // Ponuka na predaj
  const forSale = await listDomainForSale(env, d1.id, {
    price: 1500,
    currency: 'EUR',
    notes: 'Prémiová doména pre AI služby'
  });
  assert.equal(forSale.status, 'for_sale');
  assert.equal(forSale.sale_price, 1500);

  // Dokončenie predaja
  const sellRes = await sellDomain(env, d1.id, {
    buyer: 'Inovácie s.r.o.',
    price: 1500,
    currency: 'EUR'
  });
  assert.equal(sellRes.ok, true);
  assert.equal(sellRes.domain.status, 'sold');
  assert.equal(sellRes.domain.buyer, 'Inovácie s.r.o.');

  // Overenie, že predanú doménu nemožno znova predávať ani prenajímať
  await assert.rejects(listDomainForSale(env, d1.id, { price: 2000 }), /Predanú doménu/);
  await assert.rejects(leaseDomain(env, d1.id, { tenant: 'Test', monthly_price: 100 }), /Predanú doménu/);

  // Druhá doména pre prenájom
  const d2 = await createDomain(env, {
    domain_name: 'trinity-partner.eu',
    status: 'active'
  });

  // Ponuka na prenájom
  const forLease = await listDomainForLease(env, d2.id, {
    monthly_price: 80,
    currency: 'EUR'
  });
  assert.equal(forLease.lease_price_monthly, 80);

  // Uzatvorenie prenájmu
  const leaseRes = await leaseDomain(env, d2.id, {
    tenant: 'TechPartner Corp',
    monthly_price: 80,
    duration_months: 6
  });
  assert.equal(leaseRes.ok, true);
  assert.equal(leaseRes.domain.status, 'leased');
  assert.equal(leaseRes.domain.current_tenant, 'TechPartner Corp');
  assert.ok(leaseRes.domain.lease_expires_at);

  // Trh s doménami
  const market = await getDomainMarketplace(env);
  assert.ok(market.for_lease.some(d => d.domain_name === 'trinity-partner.eu'));
  assert.ok(market.sold.some(d => d.domain_name === 'premium-ai.sk'));

  // Ukončenie prenájmu
  const endRes = await endDomainLease(env, d2.id, { reason: 'Uplynutie dohodnutej doby' });
  assert.equal(endRes.ok, true);
  assert.equal(endRes.domain.status, 'active');
  assert.equal(endRes.domain.current_tenant, null);

  const txs = await listDomainTransactions(env, d2.id);
  assert.ok(txs.some(t => t.type === 'lease'));
  assert.ok(txs.some(t => t.type === 'lease_end'));
});

test('Domain Engine: Pridávanie, výpis a zmazanie DNS záznamov s Truth Policy', async () => {
  const db = createDomainMockDB();
  const env = { DB: db };

  const domain = await createDomain(env, {
    domain_name: 'auru.dev',
    zone_id: 'zone-dev-01'
  });

  const record1 = await addDnsRecord(env, domain.id, {
    type: 'CNAME',
    name: 'api',
    content: 'trinity-development.workers.dev',
    proxied: true
  });

  assert.ok(record1.id);
  assert.equal(record1.name, 'api');
  assert.equal(record1.type, 'CNAME');
  assert.equal(record1.sync_status, 'persisted_locally');

  const record2 = await addDnsRecord(env, domain.id, {
    type: 'TXT',
    name: '_trinity',
    content: 'verification=abc123xyz',
    proxied: false
  });
  assert.equal(record2.type, 'TXT');

  const dnsList = await listDnsRecords(env, domain.id);
  assert.equal(dnsList.length, 2);

  const updatedDomain = await getDomain(env, domain.id);
  assert.equal(updatedDomain.dns_records_count, 2);

  const delResult = await deleteDnsRecord(env, domain.id, record1.id);
  assert.equal(delResult.ok, true);

  const remaining = await listDnsRecords(env, domain.id);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].name, '_trinity');
});

test('Domain Engine: Integrácia nástrojov do Trinity runTool a rolí (registrácia, predaj, prenájom)', async () => {
  const db = createDomainMockDB();
  const env = { DB: db };
  const orchestrator = AGENTS.find(a => a.id === 'orchestrator');
  const cloudflareAgent = AGENTS.find(a => a.id === 'cloudflare');
  const bizDev = AGENTS.find(a => a.id === 'business-development');

  assert.ok(orchestrator.tools.includes('domain_list'));
  assert.ok(orchestrator.tools.includes('domain_register'));
  assert.ok(orchestrator.tools.includes('domain_sell'));
  assert.ok(orchestrator.tools.includes('domain_lease'));
  assert.ok(orchestrator.tools.includes('domain_marketplace'));

  assert.ok(cloudflareAgent.tools.includes('domain_register'));
  assert.ok(bizDev.tools.includes('domain_sell'));
  assert.ok(bizDev.tools.includes('domain_lease'));

  // Registrácia cez orchestrátora
  const regToolRes = await runTool(env, orchestrator, 'domain_register', {
    domain_name: 'nova-platforma.sk',
    years: 1,
    registrar: 'cloudflare'
  });
  assert.equal(regToolRes.ok, true);
  assert.equal(regToolRes.domain.domain_name, 'nova-platforma.sk');

  // Ponuka na predaj cez bizDev
  const saleListRes = await runTool(env, bizDev, 'domain_list_for_sale', {
    domain: 'nova-platforma.sk',
    price: 3200,
    currency: 'EUR'
  });
  assert.equal(saleListRes.ok, true);
  assert.equal(saleListRes.domain.sale_price, 3200);

  // Kontrola trhu cez ľubovoľného agenta
  const marketRes = await runTool(env, cloudflareAgent, 'domain_marketplace', {});
  assert.ok(marketRes.for_sale.some(d => d.domain_name === 'nova-platforma.sk'));

  // Predaj domény cez bizDev
  const sellToolRes = await runTool(env, bizDev, 'domain_sell', {
    domain: 'nova-platforma.sk',
    buyer: 'Kupujúci Holding',
    price: 3200,
    currency: 'EUR'
  });
  assert.equal(sellToolRes.ok, true);
  assert.equal(sellToolRes.domain.status, 'sold');

  // Inšpekcia domény
  const inspectRes = await runTool(env, orchestrator, 'domain_inspect', {
    domain: 'nova-platforma.sk'
  });
  assert.equal(inspectRes.domain.status, 'sold');
  assert.ok(inspectRes.transactions.length >= 2);
});

test('Domain Engine: TOOL_HELP a skillRegistry obsahujú všetky doménové nástroje a schopnosti', async () => {
  const { TOOL_HELP } = await import('../src/tools.js');
  const { skillRegistry } = await import('../src/skillRegistry.js');
  const { READ_TOOLS } = await import('../src/truth.js');

  const domainToolKeys = [
    'domain_check',
    'domain_list',
    'domain_inspect',
    'domain_add',
    'domain_register',
    'domain_list_for_sale',
    'domain_sell',
    'domain_list_for_lease',
    'domain_lease',
    'domain_end_lease',
    'domain_marketplace',
    'domain_set_dns',
    'domain_delete_dns'
  ];

  for (const toolKey of domainToolKeys) {
    assert.ok(TOOL_HELP[toolKey], `TOOL_HELP[${toolKey}] nesmie byť undefined`);
    assert.ok(TOOL_HELP[toolKey].length > 10, `Popis ${toolKey} musí byť zmysluplný`);
  }

  // Truth Policy read tools
  assert.ok(READ_TOOLS.has('domain_check'));
  assert.ok(READ_TOOLS.has('domain_list'));
  assert.ok(READ_TOOLS.has('domain_inspect'));
  assert.ok(READ_TOOLS.has('domain_marketplace'));

  // Skill Registry kategória a schopnosti
  const allSkills = skillRegistry.list();
  const domainSkills = allSkills.filter(s => s.category === 'domains');
  assert.ok(domainSkills.length >= 5, 'skillRegistry musí obsahovať aspoň 5 doménových schopností');
  assert.ok(domainSkills.some(s => s.name === 'domainRegister'));
  assert.ok(domainSkills.some(s => s.name === 'domainSetDns'));
  assert.ok(domainSkills.some(s => s.name === 'domainSell'));
});

test('Domain Engine: Cloudflare Registrar live check a live registrácia', async () => {
  const originalFetch = globalThis.fetch;
  try {
    // 1. Neúspešná konfigurácia (chýba token)
    const noTokenEnv = { CF_ACCOUNT_ID: 'acc123' };
    const noTokenRes = await checkDomainAvailability(noTokenEnv, 'test-domena.com');
    assert.equal(noTokenRes.configured, false);
    assert.equal(noTokenRes.registrable, null);

    // 2. Úspešná live dostupnosť cez mockovaný fetch
    let fetchCalledWith = null;
    globalThis.fetch = async (url, opts) => {
      fetchCalledWith = { url, opts };
      if (url.includes('/registrar/domain-check')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              success: true,
              result: {
                domains: [
                  {
                    domain: 'nova-super-domena.com',
                    registrable: true,
                    reason: 'available',
                    tier: 'standard',
                    pricing: { registration_cost: 9.77, currency: 'USD' }
                  }
                ]
              }
            };
          }
        };
      }
      if (url.includes('/registrar/registrations')) {
        return Response.json({success:true,result:{id:'cf-reg-workflow-999',state:'succeeded',completed:true,context:{registration:{expires_at:'2027-10-20T00:00:00.000Z'}}}});
      }
      return { ok: false, status: 404, async json() { return { success: false }; } };
    };

    const mockEnv = {
      CF_ACCOUNT_ID: 'acc123',
      CF_API_TOKEN: 'token-secret',
      DB: createDomainMockDB()
    };

    const checkRes = await checkDomainAvailability(mockEnv, 'nova-super-domena.com');
    assert.equal(checkRes.success, true);
    assert.equal(checkRes.registrable, true);
    assert.equal(checkRes.pricing?.registration_cost, 9.77);
    assert.equal(checkRes.pricing?.currency, 'USD');

    // 3. Spustenie cez runTool (domain_check)
    const orchestrator = AGENTS.find(a => a.id === 'orchestrator');
    const toolCheckRes = await runTool(mockEnv, orchestrator, 'domain_check', {
      domain: 'nova-super-domena.com'
    });
    assert.equal(toolCheckRes.registrable, true);
    assert.equal(toolCheckRes._evidence.effect, 'read');

    // 4. Reálna live registrácia cez registerDomain
    const liveRegRes = await registerDomain(mockEnv, {
      domain_name: 'nova-super-domena.com',
      years: 1,
      purchase_confirmed: true,
      max_price: 10,
      currency: 'USD',
      live_register: true,
      auto_renew: true
    });
    assert.equal(liveRegRes.domain.domain_name, 'nova-super-domena.com');
    assert.equal(liveRegRes.domain.registrar, 'cloudflare');
    assert.equal(liveRegRes.registration_receipt.live_registration, true);
    assert.equal(liveRegRes.registration_receipt.cloudflare_workflow_id, 'cf-reg-workflow-999');
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test('Live purchase requires a concrete confirmed price limit before any network mutation',async()=>{
 const env={DB:createDomainMockDB(),CF_API_TOKEN:'test-token',CF_ACCOUNT_ID:'test-account'};
 await assert.rejects(()=>registerDomain(env,{domain_name:'purchase.test',live_register:true}),/max_price/);
 await assert.rejects(()=>registerDomain(env,{domain_name:'purchase.test',live_register:true,purchase_confirmed:true,max_price:10,years:2}),/1 rok/);
});
test('Async registration remains pending and quote failures never buy a domain',async()=>{
 const old=globalThis.fetch;let purchases=0;const env={DB:createDomainMockDB(),CF_API_TOKEN:'test-token',CF_ACCOUNT_ID:'test-account'};
 try{globalThis.fetch=async url=>{if(url.includes('domain-check'))return Response.json({success:true,result:{domains:[{registrable:true,pricing:{registration_cost:'9.77',currency:'USD'}}]}});purchases++;return Response.json({success:true,result:{state:'in_progress',completed:false}},{status:202});};
 const r=await registerDomain(env,{domain_name:'purchase.test',live_register:true,purchase_confirmed:true,max_price:10});assert.equal(r.domain.status,'pending');assert.equal(r.registration_receipt.completed,false);assert.equal(r.domain.expires_at,null);assert.equal(purchases,1);
 await assert.rejects(()=>registerDomain(env,{domain_name:'too-expensive.test',live_register:true,purchase_confirmed:true,max_price:1}),/Cena/);assert.equal(purchases,1);
 }finally{globalThis.fetch=old;}
});

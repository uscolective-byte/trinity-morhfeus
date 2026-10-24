import { z } from 'zod';
import qrcode from 'qrcode-generator';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { HttpError } from './security.js';
import { createTrinityDocument } from './trinity-documents.js';

/*
 * Peňaženka a platobné terminály Trinity — iba skutočné údaje.
 *
 * Pravidlá tohto modulu (Režim pravdy):
 *  - Žiadne predvolené/vymyslené IBAN-y, e-maily, Revolut/PayPal účty ani krypto adresy.
 *    Kanál bez nastavenia je `configured:false` a nevytvorí sa preň platobný príkaz.
 *  - QR kódy sú skutočné ISO 18004 QR kódy (nie vzor), EPC QR spĺňa EPC069-12.
 *  - Platobný odkaz ani QR nie je prijatá platba. Stav `confirmed_*` vzniká iba
 *    (a) overením transakcie na blockchaine cez verejné RPC, alebo
 *    (b) výslovným potvrdením majiteľa s odkazom na dôkaz (výpis, ID transakcie).
 *  - Trinity neodosiela peniaze z banky, PayPalu ani Revolutu. Výber je iba pripravená
 *    inštrukcia (`prepared`); do evidencie sa zapíše až po nahlásení majiteľom.
 *  - Zostatok je súčet overených záznamov v evidencii Trinity, nie stav bankového účtu.
 */

// ── Schémy ──────────────────────────────────────────────────────────────────
const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const optionalText = (max) => z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));

export const terminalConfigSchema = z.object({
  iban: optionalText(40),
  bic: optionalText(20),
  account_name: optionalText(100),
  revolut_handle: optionalText(100),
  paypal_email: optionalText(120),
  crypto_address: optionalText(80),
  crypto_network: z.enum(['polygon', 'base', 'arbitrum', 'ethereum']).default('polygon'),
  default_terminal: z.enum(['sepa', 'revolut', 'paypal', 'crypto']).default('sepa')
}).strict();

export const terminalChargeSchema = z.object({
  amount_eur: z.number().finite().positive().max(1000000),
  purpose: z.string().trim().min(2).max(200),
  terminal_type: z.enum(['all', 'sepa', 'revolut', 'paypal', 'crypto']).default('all'),
  variable_symbol: z.string().trim().regex(/^\d{1,10}$/, 'Variabilný symbol môže mať iba 1 až 10 číslic.').optional(),
  payer_name: z.string().trim().max(100).optional(),
  payer_email: z.string().trim().max(120).optional()
}).strict();

export const terminalPayoutSchema = z.object({
  amount_eur: z.number().finite().positive().max(1000000),
  destination_type: z.enum(['bank_iban', 'paypal', 'revolut', 'crypto']),
  target: z.string().trim().min(3).max(120),
  recipient_name: z.string().trim().max(100).optional(),
  note: z.string().trim().max(300).optional()
}).strict();

export const terminalVerifySchema = z.object({
  charge_id: z.string().trim().min(3).max(80)
}).strict();

export const terminalConfirmSchema = z.object({
  kind: z.enum(['charge', 'payout']).default('charge'),
  id: z.string().trim().min(3).max(80),
  evidence_ref: z.string().trim().min(3).max(200),
  note: z.string().trim().max(300).optional()
}).strict();

// ── Tabuľky (nové názvy; staré tabuľky z predchádzajúcej verzie sa nepoužívajú) ──
const readyDatabases = new WeakSet();
async function ensureTerminalTables(env) {
  if (!env.DB || readyDatabases.has(env.DB)) return;
  const statements = [
    `CREATE TABLE IF NOT EXISTS ops_wallet_terminals (
      owner_id TEXT PRIMARY KEY, iban TEXT, bic TEXT, account_name TEXT, revolut_handle TEXT, paypal_email TEXT,
      crypto_address TEXT, crypto_network TEXT DEFAULT 'polygon', default_terminal TEXT DEFAULT 'sepa',
      updated_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS ops_terminal_charges_v2 (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, amount_cents INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'EUR',
      purpose TEXT NOT NULL, variable_symbol TEXT, terminal_type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
      payer_name TEXT, crypto_chain TEXT, crypto_units TEXT, crypto_start_block INTEGER, fx_rate REAL, fx_date TEXT,
      evidence_type TEXT, evidence_ref TEXT, confirmed_at TEXT, created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS ops_terminal_payouts_v2 (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, amount_cents INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'EUR',
      destination_type TEXT NOT NULL, target TEXT NOT NULL, recipient_name TEXT, note TEXT, reference TEXT,
      status TEXT NOT NULL DEFAULT 'prepared', evidence_ref TEXT, confirmed_at TEXT, created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS ops_wallet_ledger (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, kind TEXT NOT NULL, amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EUR', channel TEXT, ref_id TEXT, evidence_type TEXT NOT NULL, evidence_ref TEXT NOT NULL,
      note TEXT, created_at TEXT DEFAULT (datetime('now')), UNIQUE(evidence_type, evidence_ref))`
  ];
  for (const sql of statements) await env.DB.prepare(sql).run();
  readyDatabases.add(env.DB);
}

// ── Overenie vstupov ────────────────────────────────────────────────────────
export function normalizeIban(raw) {
  const s = String(raw || '').replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return null;
  const rearranged = s.slice(4) + s.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const digits = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1 ? s : null;
}

export function normalizeBic(raw) {
  const s = String(raw || '').replace(/\s+/g, '').toUpperCase();
  return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(s) ? s : null;
}

export function toChecksumAddress(address) {
  const lower = address.toLowerCase().replace(/^0x/, '');
  const hash = toHex(keccak_256(new TextEncoder().encode(lower)));
  let out = '0x';
  for (let i = 0; i < lower.length; i++) out += parseInt(hash[i], 16) >= 8 ? lower[i].toUpperCase() : lower[i];
  return out;
}

export function normalizeEvmAddress(raw) {
  const s = String(raw || '').trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(s)) return null;
  const body = s.slice(2);
  const mixed = body !== body.toLowerCase() && body !== body.toUpperCase();
  const checksummed = toChecksumAddress(s);
  if (mixed && checksummed !== s) return null; // zlá kontrolná suma EIP-55 = pravdepodobne preklep
  return checksummed;
}

function normalizeRevolutHandle(raw) {
  const s = String(raw || '').trim();
  const url = s.match(/^(?:https?:\/\/)?(?:www\.)?revolut\.me\/([A-Za-z0-9_.-]{2,60})\/?$/i);
  if (url) return url[1];
  const handle = s.replace(/^@/, '');
  return /^[A-Za-z0-9_.-]{2,60}$/.test(handle) ? handle : null;
}

function normalizePaypalAccount(raw) {
  const s = String(raw || '').trim();
  if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(s)) return { kind: 'email', value: s };
  const url = s.match(/^(?:https?:\/\/)?(?:www\.)?paypal\.me\/([A-Za-z0-9]{3,20})\/?$/i);
  if (url) return { kind: 'handle', value: url[1] };
  const handle = s.replace(/^@/, '');
  return /^[A-Za-z0-9]{3,20}$/.test(handle) ? { kind: 'handle', value: handle } : null;
}

const asciiOnly = (value, max) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '').slice(0, max);

// ── QR kódy (skutočný ISO 18004 QR, nie vzor) ───────────────────────────────
export function generateQrSvg(text, size = 240) {
  const qr = qrcode(0, 'M');
  qr.addData(String(text), 'Byte');
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true })
    .replace('<svg ', `<svg width="${size}" height="${size}" role="img" aria-label="QR kód" `);
}

export function buildEpcPayload({ iban, bic, name, amountEur, remittance }) {
  const lines = [
    'BCD', '002', '1', 'SCT',
    bic || '',
    asciiOnly(name, 70),
    iban,
    `EUR${Number(amountEur).toFixed(2)}`,
    '', '',
    asciiOnly(remittance, 140)
  ];
  return lines.join('\n');
}

// ── Kurz EUR→USD (ECB cez frankfurter) a blockchain RPC ─────────────────────
export async function getEurUsdRate() {
  try {
    const response = await globalThis.fetch('https://api.frankfurter.app/latest?from=EUR&to=USD', { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const rate = Number(data?.rates?.USD);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('Neplatná odpoveď');
    return { ok: true, rate, date: data.date, source: 'ECB cez api.frankfurter.app' };
  } catch (error) {
    return { ok: false, reason: `Kurz ECB sa nepodarilo získať: ${error.message}` };
  }
}

export const CRYPTO_CHAINS = Object.freeze({
  polygon: { id: 137, label: 'Polygon PoS', rpc: 'https://polygon-bor-rpc.publicnode.com', usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' },
  base: { id: 8453, label: 'Base', rpc: 'https://base-rpc.publicnode.com', usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
  arbitrum: { id: 42161, label: 'Arbitrum One', rpc: 'https://arbitrum-one-rpc.publicnode.com', usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
  ethereum: { id: 1, label: 'Ethereum', rpc: 'https://ethereum-rpc.publicnode.com', usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' }
});

const TRANSFER_TOPIC = '0x' + toHex(keccak_256(new TextEncoder().encode('Transfer(address,address,uint256)')));
const padAddress = (address) => '0x' + address.toLowerCase().replace(/^0x/, '').padStart(64, '0');

async function rpc(chain, method, params) {
  const response = await globalThis.fetch(chain.rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(`RPC chyba: ${data.error.message || JSON.stringify(data.error)}`);
  return data.result;
}

async function readUsdcBalance(chain, address) {
  try {
    const data = '0x70a08231' + padAddress(address).slice(2);
    const result = await rpc(chain, 'eth_call', [{ to: chain.usdc, data }, 'latest']);
    const units = BigInt(result);
    return { ok: true, usdc: Number(units) / 1e6, fetched_at: new Date().toISOString(), source: `${chain.label} RPC` };
  } catch (error) {
    return { ok: false, reason: error.message };
  }
}

// ── Prehľad ─────────────────────────────────────────────────────────────────
function mapCharge(c) {
  return {
    id: c.id,
    amount_eur: Number(((c.amount_cents || 0) / 100).toFixed(2)),
    purpose: c.purpose,
    terminal_type: c.terminal_type,
    variable_symbol: c.variable_symbol,
    status: c.status,
    evidence_type: c.evidence_type || null,
    evidence_ref: c.evidence_ref || null,
    confirmed_at: c.confirmed_at || null,
    created_at: c.created_at
  };
}

function mapPayout(p) {
  return {
    id: p.id,
    amount_eur: Number(((p.amount_cents || 0) / 100).toFixed(2)),
    destination_type: p.destination_type,
    target: p.target,
    recipient_name: p.recipient_name || null,
    note: p.note,
    reference: p.reference,
    status: p.status,
    evidence_ref: p.evidence_ref || null,
    created_at: p.created_at
  };
}

export async function getWalletTerminalOverview(env, ownerId = 'admin') {
  await ensureTerminalTables(env);
  const termRow = env.DB ? await env.DB.prepare('SELECT * FROM ops_wallet_terminals WHERE owner_id=?').bind(ownerId).first() : null;
  const iban = termRow?.iban ? normalizeIban(termRow.iban) : null;
  const revolut = termRow?.revolut_handle ? normalizeRevolutHandle(termRow.revolut_handle) : null;
  const paypal = termRow?.paypal_email ? normalizePaypalAccount(termRow.paypal_email) : null;
  const cryptoAddress = termRow?.crypto_address ? normalizeEvmAddress(termRow.crypto_address) : null;
  const network = CRYPTO_CHAINS[termRow?.crypto_network] ? termRow.crypto_network : 'polygon';
  const chain = CRYPTO_CHAINS[network];

  let ledger = [];
  let charges = [];
  let payouts = [];
  if (env.DB) {
    ledger = (await env.DB.prepare('SELECT * FROM ops_wallet_ledger WHERE owner_id=? ORDER BY created_at DESC, rowid DESC LIMIT 50').bind(ownerId).all()).results || [];
    charges = (await env.DB.prepare('SELECT * FROM ops_terminal_charges_v2 WHERE owner_id=? ORDER BY created_at DESC LIMIT 25').bind(ownerId).all()).results || [];
    payouts = (await env.DB.prepare('SELECT * FROM ops_terminal_payouts_v2 WHERE owner_id=? ORDER BY created_at DESC LIMIT 25').bind(ownerId).all()).results || [];
  }
  const totals = env.DB ? await env.DB.prepare(`SELECT
      COALESCE(SUM(CASE WHEN kind='received' THEN amount_cents END),0) AS received,
      COALESCE(SUM(CASE WHEN kind='payout' THEN amount_cents END),0) AS paid_out
      FROM ops_wallet_ledger WHERE owner_id=?`).bind(ownerId).first() : { received: 0, paid_out: 0 };
  const pending = env.DB ? await env.DB.prepare("SELECT COALESCE(SUM(amount_cents),0) AS cents, COUNT(*) AS n FROM ops_terminal_charges_v2 WHERE owner_id=? AND status='pending'").bind(ownerId).first() : { cents: 0, n: 0 };

  const onchain = cryptoAddress ? await readUsdcBalance(chain, cryptoAddress) : null;
  const eur = (cents) => Number(((cents || 0) / 100).toFixed(2));

  return {
    wallet: {
      currency: 'EUR',
      evidenced_received_eur: eur(totals?.received),
      evidenced_paid_out_eur: eur(totals?.paid_out),
      evidenced_balance_eur: eur((totals?.received || 0) - (totals?.paid_out || 0)),
      pending_charges_eur: eur(pending?.cents),
      pending_charges_count: pending?.n || 0,
      basis: 'Súčet overených záznamov v evidencii Trinity (blockchain alebo potvrdenie majiteľa). Nie je to stav bankového účtu, PayPalu ani Revolutu.'
    },
    terminals: {
      sepa: { configured: Boolean(iban), iban, bic: termRow?.bic ? normalizeBic(termRow.bic) : null, account_name: termRow?.account_name || null, standard: 'EPC069-12 (SEPA Credit Transfer QR)' },
      revolut: { configured: Boolean(revolut), handle: revolut, url: revolut ? `https://revolut.me/${revolut}` : null },
      paypal: { configured: Boolean(paypal), account: paypal?.value || null, kind: paypal?.kind || null },
      crypto: {
        configured: Boolean(cryptoAddress),
        address: cryptoAddress,
        network,
        chain_id: chain.id,
        token: 'USDC',
        token_contract: chain.usdc,
        onchain_balance: onchain
      }
    },
    ledger: ledger.map((l) => ({ id: l.id, kind: l.kind, amount_eur: eur(l.amount_cents), channel: l.channel, ref_id: l.ref_id, evidence_type: l.evidence_type, evidence_ref: l.evidence_ref, note: l.note, created_at: l.created_at })),
    recent_charges: charges.map(mapCharge),
    recent_payouts: payouts.map(mapPayout),
    truth_policy: 'Iba overené údaje. Platobný odkaz ani QR nie je prijatá platba; Trinity neodosiela peniaze z banky.'
  };
}

// ── Konfigurácia ────────────────────────────────────────────────────────────
export async function saveWalletTerminalConfig(env, ownerId = 'admin', input = {}) {
  await ensureTerminalTables(env);
  const data = terminalConfigSchema.parse(input);
  const clean = {};

  if (data.iban) {
    clean.iban = normalizeIban(data.iban);
    if (!clean.iban) throw new HttpError(400, 'IBAN je neplatný (nesedí formát alebo kontrolný súčet).');
  }
  if (data.bic) {
    clean.bic = normalizeBic(data.bic);
    if (!clean.bic) throw new HttpError(400, 'BIC/SWIFT má neplatný formát.');
  }
  if (data.revolut_handle) {
    clean.revolut = normalizeRevolutHandle(data.revolut_handle);
    if (!clean.revolut) throw new HttpError(400, 'Revolut meno musí byť v tvare @meno alebo revolut.me/meno.');
  }
  if (data.paypal_email) {
    clean.paypal = normalizePaypalAccount(data.paypal_email);
    if (!clean.paypal) throw new HttpError(400, 'PayPal musí byť e-mail účtu alebo paypal.me meno.');
  }
  if (data.crypto_address) {
    clean.crypto = normalizeEvmAddress(data.crypto_address);
    if (!clean.crypto) throw new HttpError(400, 'Krypto adresa musí byť platná EVM adresa 0x… (pri zmiešaných veľkostiach písmen sa overuje kontrolná suma EIP-55).');
  }
  if (clean.iban && !data.account_name) throw new HttpError(400, 'Pri IBAN-e je povinné meno príjemcu platby (pre EPC QR).');

  await env.DB.prepare(`
    INSERT INTO ops_wallet_terminals(owner_id, iban, bic, account_name, revolut_handle, paypal_email, crypto_address, crypto_network, default_terminal, updated_at)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(owner_id) DO UPDATE SET iban=excluded.iban, bic=excluded.bic, account_name=excluded.account_name,
      revolut_handle=excluded.revolut_handle, paypal_email=excluded.paypal_email, crypto_address=excluded.crypto_address,
      crypto_network=excluded.crypto_network, default_terminal=excluded.default_terminal, updated_at=datetime('now')
  `).bind(ownerId, clean.iban || null, clean.bic || null, data.account_name || null, clean.revolut || null,
    clean.paypal?.value || null, clean.crypto || null, data.crypto_network, data.default_terminal).run();
  await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('wallet_terminals_config_updated',?)")
    .bind(JSON.stringify({ owner_id: ownerId, updated_at: new Date().toISOString() })).run();

  await createTrinityDocument(env, ownerId, {
    title: 'Nastavenie platobných terminálov Trinity',
    category: 'commerce',
    step_name: 'terminal_config',
    summary: `Uložené overené prijímacie údaje: ${[clean.iban && 'IBAN', clean.revolut && 'Revolut', clean.paypal && 'PayPal', clean.crypto && 'krypto adresa'].filter(Boolean).join(', ') || 'žiadne'}.`,
    content: `## Nastavenie platobných terminálov\n\n- IBAN: \`${clean.iban || '—'}\` (BIC: \`${clean.bic || '—'}\`)\n- Meno príjemcu: ${data.account_name || '—'}\n- Revolut: ${clean.revolut ? `revolut.me/${clean.revolut}` : '—'}\n- PayPal: ${clean.paypal?.value || '—'}\n- Krypto adresa: \`${clean.crypto || '—'}\` (${data.crypto_network})\n- Čas: ${new Date().toISOString()}\n\nToto je iba uloženie údajov o príjemcovi. Nie je to potvrdenie žiadnej platby.`
  });
  return getWalletTerminalOverview(env, ownerId);
}

// ── Platobný príkaz (príjem) ────────────────────────────────────────────────
export async function createPaymentTerminalCharge(env, ownerId = 'admin', input = {}) {
  await ensureTerminalTables(env);
  const data = terminalChargeSchema.parse(input);
  const overview = await getWalletTerminalOverview(env, ownerId);
  const terms = overview.terminals;
  const want = (type) => data.terminal_type === 'all' || data.terminal_type === type;
  const id = `CHG-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const vs = data.variable_symbol || String(Date.now()).slice(-8);
  const amount = Number(data.amount_eur.toFixed(2));
  const channels = {};

  if (want('sepa')) {
    if (!terms.sepa.configured || !terms.sepa.account_name) {
      channels.sepa = { available: false, reason: 'IBAN a meno príjemcu nie sú nastavené v záložke Konfigurácia.' };
    } else {
      const epc = buildEpcPayload({ iban: terms.sepa.iban, bic: terms.sepa.bic, name: terms.sepa.account_name, amountEur: amount, remittance: `VS${vs} ${data.purpose}` });
      channels.sepa = { available: true, iban: terms.sepa.iban, bic: terms.sepa.bic, recipient: terms.sepa.account_name, epc_payload: epc, qr_svg: generateQrSvg(epc), note: 'Platba príde až po odoslaní z banky platiteľa. Trinity ju overí iba podľa výpisu, ktorý potvrdíš.' };
    }
  }
  if (want('revolut')) {
    channels.revolut = terms.revolut.configured
      ? { available: true, url: terms.revolut.url, qr_svg: generateQrSvg(terms.revolut.url), note: `Odkaz otvorí profil príjemcu; sumu ${amount.toFixed(2)} EUR a poznámku VS${vs} zadá platiteľ ručne (predvyplnenie sumy Trinity nepotvrdzuje).` }
      : { available: false, reason: 'Revolut meno nie je nastavené.' };
  }
  if (want('paypal')) {
    if (!terms.paypal.configured) {
      channels.paypal = { available: false, reason: 'PayPal účet nie je nastavený.' };
    } else {
      const url = terms.paypal.kind === 'handle'
        ? `https://www.paypal.me/${terms.paypal.account}/${amount.toFixed(2)}EUR`
        : `https://www.paypal.com/cgi-bin/webscr?${new URLSearchParams({ cmd: '_xclick', business: terms.paypal.account, currency_code: 'EUR', amount: amount.toFixed(2), item_name: data.purpose.slice(0, 120) })}`;
      channels.paypal = { available: true, url, qr_svg: generateQrSvg(url), note: 'Platba je potvrdená až oznámením PayPalu v tvojom účte; Trinity k nemu nemá prístup.' };
    }
  }

  let cryptoMeta = { chain: null, units: null, startBlock: null, fx: null };
  if (want('crypto')) {
    if (!terms.crypto.configured) {
      channels.crypto = { available: false, reason: 'Krypto adresa nie je nastavená.' };
    } else {
      const chain = CRYPTO_CHAINS[terms.crypto.network];
      const fx = await getEurUsdRate();
      if (!fx.ok) {
        channels.crypto = { available: false, reason: `${fx.reason} Bez overeného kurzu EUR/USD neurčím sumu v USDC.` };
      } else {
        const usdc = Number((amount * fx.rate).toFixed(2));
        const units = BigInt(Math.round(usdc * 1e6));
        let startBlock = null;
        try { startBlock = Number(BigInt(await rpc(chain, 'eth_blockNumber', []))); } catch { /* overenie bude možné až s ručným potvrdením */ }
        const uri = `ethereum:${chain.usdc}@${chain.id}/transfer?address=${terms.crypto.address}&uint256=${units}`;
        channels.crypto = {
          available: true, network: terms.crypto.network, chain_id: chain.id, token: 'USDC', token_contract: chain.usdc,
          address: terms.crypto.address, amount_usdc: usdc, fx: { eur_usd: fx.rate, date: fx.date, source: fx.source },
          uri, qr_svg: generateQrSvg(uri), auto_verifiable: startBlock !== null,
          note: `Pošli presne ${usdc.toFixed(2)} USDC v sieti ${chain.label}. Overenie na blockchaine vykonáš tlačidlom Overiť.`
        };
        cryptoMeta = { chain: terms.crypto.network, units: units.toString(), startBlock, fx };
      }
    }
  }

  await env.DB.prepare(`INSERT INTO ops_terminal_charges_v2(id, owner_id, amount_cents, currency, purpose, variable_symbol, terminal_type, status, payer_name, crypto_chain, crypto_units, crypto_start_block, fx_rate, fx_date)
    VALUES(?, ?, ?, 'EUR', ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`)
    .bind(id, ownerId, Math.round(amount * 100), data.purpose, vs, data.terminal_type, data.payer_name || null, cryptoMeta.chain, cryptoMeta.units, cryptoMeta.startBlock, cryptoMeta.fx?.rate || null, cryptoMeta.fx?.date || null).run();

  const available = Object.entries(channels).filter(([, v]) => v.available).map(([k]) => k);
  await createTrinityDocument(env, ownerId, {
    title: `Platobný príkaz ${id}: ${data.purpose} (${amount.toFixed(2)} EUR)`,
    category: 'commerce',
    step_name: 'terminal_charge_created',
    summary: `Vytvorený platobný príkaz ${id} na ${amount.toFixed(2)} EUR (VS ${vs}). Dostupné kanály: ${available.join(', ') || 'žiadny'}. Stav: čaká na platbu (nepotvrdené).`,
    content: `## Platobný príkaz\n\n- ID: \`${id}\`\n- Suma: **${amount.toFixed(2)} EUR**\n- Účel: ${data.purpose}\n- Variabilný symbol: \`${vs}\`\n- Stav: **pending** — platba NIE JE potvrdená\n- Dostupné kanály: ${available.join(', ') || 'žiadny'}\n- Nedostupné kanály: ${Object.entries(channels).filter(([, v]) => !v.available).map(([k, v]) => `${k} (${v.reason})`).join('; ') || '—'}\n- Čas: ${new Date().toISOString()}`
  });

  return { charge_id: id, status: 'pending', paid: false, amount_eur: amount, currency: 'EUR', purpose: data.purpose, variable_symbol: vs, created_at: new Date().toISOString(), channels, terminals: channels };
}

// ── Overenie prijatia ───────────────────────────────────────────────────────
async function creditLedger(env, ownerId, charge, evidenceType, evidenceRef, note) {
  const entryId = crypto.randomUUID();
  const result = await env.DB.prepare(`INSERT OR IGNORE INTO ops_wallet_ledger(id, owner_id, kind, amount_cents, currency, channel, ref_id, evidence_type, evidence_ref, note)
    VALUES(?, ?, 'received', ?, 'EUR', ?, ?, ?, ?, ?)`).bind(entryId, ownerId, charge.amount_cents, charge.terminal_type, charge.id, evidenceType, evidenceRef, note || null).run();
  return (result?.meta?.changes ?? 1) > 0;
}

export async function verifyTerminalCharge(env, ownerId = 'admin', input = {}) {
  await ensureTerminalTables(env);
  const data = terminalVerifySchema.parse(input);
  const charge = await env.DB.prepare('SELECT * FROM ops_terminal_charges_v2 WHERE id=? AND owner_id=?').bind(data.charge_id, ownerId).first();
  if (!charge) throw new HttpError(404, 'Platobný príkaz neexistuje.');
  if (charge.status !== 'pending') return { charge: mapCharge(charge), verified: charge.status.startsWith('confirmed'), checked: false, message: `Príkaz už má stav ${charge.status}.` };
  if (!charge.crypto_chain || !charge.crypto_units || charge.crypto_start_block === null || charge.crypto_start_block === undefined) {
    return { charge: mapCharge(charge), verified: false, checked: false, message: 'Automatické overenie existuje iba pre krypto platby s uloženým blokom. Platbu z banky, PayPalu alebo Revolutu potvrď ručne po kontrole výpisu (terminal_confirm).' };
  }
  const terms = await env.DB.prepare('SELECT crypto_address FROM ops_wallet_terminals WHERE owner_id=?').bind(ownerId).first();
  const address = terms?.crypto_address ? normalizeEvmAddress(terms.crypto_address) : null;
  if (!address) return { charge: mapCharge(charge), verified: false, checked: false, message: 'Krypto adresa už nie je nastavená.' };
  const chain = CRYPTO_CHAINS[charge.crypto_chain];
  const need = BigInt(charge.crypto_units);

  try {
    const latest = Number(BigInt(await rpc(chain, 'eth_blockNumber', [])));
    const from = Math.max(charge.crypto_start_block, latest - 60000);
    const step = 5000;
    for (let start = from; start <= latest; start += step) {
      const end = Math.min(start + step - 1, latest);
      const logs = await rpc(chain, 'eth_getLogs', [{ address: chain.usdc, fromBlock: '0x' + start.toString(16), toBlock: '0x' + end.toString(16), topics: [TRANSFER_TOPIC, null, padAddress(address)] }]);
      for (const log of logs || []) {
        if (BigInt(log.data) < need) continue;
        const evidenceRef = `${charge.crypto_chain}:${log.transactionHash}:${log.logIndex}`;
        const credited = await creditLedger(env, ownerId, charge, 'onchain_tx', evidenceRef, `USDC prevod ${Number(BigInt(log.data)) / 1e6} v bloku ${Number(BigInt(log.blockNumber))}`);
        if (!credited) continue; // táto transakcia už pokrýva iný príkaz
        await env.DB.prepare("UPDATE ops_terminal_charges_v2 SET status='confirmed_onchain', evidence_type='onchain_tx', evidence_ref=?, confirmed_at=datetime('now') WHERE id=?").bind(evidenceRef, charge.id).run();
        await createTrinityDocument(env, ownerId, {
          title: `Platba ${charge.id} potvrdená na blockchaine`,
          category: 'commerce',
          step_name: 'terminal_charge_confirmed',
          summary: `Transakcia ${log.transactionHash} (${chain.label}) pokrýva príkaz ${charge.id}.`,
          content: `## Overená krypto platba\n\n- Príkaz: \`${charge.id}\` (${(charge.amount_cents / 100).toFixed(2)} EUR)\n- Sieť: ${chain.label}\n- Transakcia: \`${log.transactionHash}\`\n- Blok: ${Number(BigInt(log.blockNumber))}\n- Prijaté USDC: ${Number(BigInt(log.data)) / 1e6}\n- Zdroj overenia: verejné RPC ${chain.rpc}\n- Čas overenia: ${new Date().toISOString()}`
        });
        const fresh = await env.DB.prepare('SELECT * FROM ops_terminal_charges_v2 WHERE id=?').bind(charge.id).first();
        return { charge: mapCharge(fresh), verified: true, checked: true, tx_hash: log.transactionHash, network: chain.label, message: 'Platba bola overená na blockchaine.', _evidence: { effect: 'mutation', actions: ['payment'], receipt_id: evidenceRef } };
      }
    }
    return { charge: mapCharge(charge), verified: false, checked: true, scanned_blocks: { from, to: latest }, message: 'Zatiaľ som nenašla prevod USDC v požadovanej výške na tvoju adresu. Platba môže byť ešte v sieti; skús overenie neskôr.' };
  } catch (error) {
    return { charge: mapCharge(charge), verified: false, checked: false, message: `Overenie na blockchaine zlyhalo: ${error.message}. Nič som nepotvrdila.` };
  }
}

export async function confirmTerminalEntry(env, ownerId = 'admin', input = {}) {
  await ensureTerminalTables(env);
  const data = terminalConfirmSchema.parse(input);
  if (data.kind === 'charge') {
    const charge = await env.DB.prepare('SELECT * FROM ops_terminal_charges_v2 WHERE id=? AND owner_id=?').bind(data.id, ownerId).first();
    if (!charge) throw new HttpError(404, 'Platobný príkaz neexistuje.');
    if (charge.status !== 'pending') throw new HttpError(409, `Príkaz už má stav ${charge.status}.`);
    const credited = await creditLedger(env, ownerId, charge, 'owner_attested', data.evidence_ref, data.note);
    if (!credited) throw new HttpError(409, 'Tento dôkaz (referencia) už bol použitý pri inom zázname.');
    await env.DB.prepare("UPDATE ops_terminal_charges_v2 SET status='confirmed_by_owner', evidence_type='owner_attested', evidence_ref=?, confirmed_at=datetime('now') WHERE id=?").bind(data.evidence_ref, charge.id).run();
    await createTrinityDocument(env, ownerId, {
      title: `Platba ${charge.id} potvrdená majiteľom`,
      category: 'commerce',
      step_name: 'terminal_charge_confirmed',
      summary: `Majiteľ potvrdil prijatie ${(charge.amount_cents / 100).toFixed(2)} EUR. Dôkaz: ${data.evidence_ref}. Trinity túto platbu sama nezistila.`,
      content: `## Platba potvrdená majiteľom\n\n- Príkaz: \`${charge.id}\`\n- Suma: ${(charge.amount_cents / 100).toFixed(2)} EUR\n- Dôkaz uvedený majiteľom: ${data.evidence_ref}\n- Poznámka: ${data.note || '—'}\n- Čas: ${new Date().toISOString()}\n\nZáznam vychádza z vyhlásenia majiteľa, nie z nezávislého overenia Trinity.`
    });
    const fresh = await env.DB.prepare('SELECT * FROM ops_terminal_charges_v2 WHERE id=?').bind(charge.id).first();
    return { charge: mapCharge(fresh), confirmed: true, basis: 'owner_attested', _evidence: { effect: 'mutation', actions: ['payment'], receipt_id: `owner:${charge.id}` } };
  }
  const payout = await env.DB.prepare('SELECT * FROM ops_terminal_payouts_v2 WHERE id=? AND owner_id=?').bind(data.id, ownerId).first();
  if (!payout) throw new HttpError(404, 'Výber neexistuje.');
  if (payout.status !== 'prepared') throw new HttpError(409, `Výber už má stav ${payout.status}.`);
  const entryId = crypto.randomUUID();
  const result = await env.DB.prepare(`INSERT OR IGNORE INTO ops_wallet_ledger(id, owner_id, kind, amount_cents, currency, channel, ref_id, evidence_type, evidence_ref, note)
    VALUES(?, ?, 'payout', ?, 'EUR', ?, ?, 'owner_attested', ?, ?)`).bind(entryId, ownerId, payout.amount_cents, payout.destination_type, payout.id, data.evidence_ref, data.note || null).run();
  if ((result?.meta?.changes ?? 1) === 0) throw new HttpError(409, 'Táto referencia už bola použitá pri inom zázname.');
  await env.DB.prepare("UPDATE ops_terminal_payouts_v2 SET status='reported_sent', evidence_ref=?, confirmed_at=datetime('now') WHERE id=?").bind(data.evidence_ref, payout.id).run();
  const fresh = await env.DB.prepare('SELECT * FROM ops_terminal_payouts_v2 WHERE id=?').bind(payout.id).first();
  return { payout: mapPayout(fresh), confirmed: true, basis: 'owner_attested', note: 'Odoslanie nahlásil majiteľ; Trinity peniaze neodoslala.' };
}

// ── Výber: iba príprava inštrukcie, Trinity neodosiela peniaze ──────────────
export async function executeWalletPayout(env, ownerId = 'admin', input = {}) {
  await ensureTerminalTables(env);
  const data = terminalPayoutSchema.parse(input);
  const id = `PAYOUT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const reference = `TRINITY-${id.slice(-8)}`;
  const amount = Number(data.amount_eur.toFixed(2));
  let target = data.target;
  let instruction;

  if (data.destination_type === 'bank_iban') {
    target = normalizeIban(data.target);
    if (!target) throw new HttpError(400, 'IBAN príjemcu je neplatný.');
    if (!data.recipient_name) throw new HttpError(400, 'Pri výbere na IBAN zadaj meno príjemcu.');
    const epc = buildEpcPayload({ iban: target, name: data.recipient_name, amountEur: amount, remittance: `${reference} ${data.note || ''}`.trim() });
    instruction = { type: 'sepa_epc_qr', epc_payload: epc, qr_svg: generateQrSvg(epc), how_to: 'Otvor svoju bankovú aplikáciu, naskenuj QR a platbu sám odošli z vlastného účtu. Trinity peniaze neodosiela.' };
  } else if (data.destination_type === 'crypto') {
    target = normalizeEvmAddress(data.target);
    if (!target) throw new HttpError(400, 'Krypto adresa príjemcu je neplatná.');
    const terms = await env.DB.prepare('SELECT crypto_network FROM ops_wallet_terminals WHERE owner_id=?').bind(ownerId).first();
    const chain = CRYPTO_CHAINS[terms?.crypto_network] || CRYPTO_CHAINS.polygon;
    const fx = await getEurUsdRate();
    if (!fx.ok) throw new HttpError(503, `${fx.reason} Bez overeného kurzu nepripravím sumu v USDC.`);
    const units = BigInt(Math.round(Number((amount * fx.rate).toFixed(2)) * 1e6));
    const uri = `ethereum:${chain.usdc}@${chain.id}/transfer?address=${target}&uint256=${units}`;
    instruction = { type: 'eip681_usdc', uri, qr_svg: generateQrSvg(uri), amount_usdc: Number(units) / 1e6, fx: { eur_usd: fx.rate, date: fx.date, source: fx.source }, how_to: `Otvor krypto peňaženku a odošli USDC v sieti ${chain.label} sám. Trinity nemá tvoj privátny kľúč.` };
  } else if (data.destination_type === 'revolut') {
    const handle = normalizeRevolutHandle(data.target);
    if (!handle) throw new HttpError(400, 'Revolut meno príjemcu je neplatné.');
    target = handle;
    instruction = { type: 'link', url: `https://revolut.me/${handle}`, how_to: `Otvor odkaz v aplikácii Revolut a pošli ${amount.toFixed(2)} EUR sám.` };
  } else {
    const account = normalizePaypalAccount(data.target);
    if (!account) throw new HttpError(400, 'PayPal príjemcu musí byť e-mail alebo paypal.me meno.');
    target = account.value;
    instruction = account.kind === 'handle'
      ? { type: 'link', url: `https://www.paypal.me/${account.value}/${amount.toFixed(2)}EUR`, how_to: 'Odkaz otvor a platbu potvrď vo svojom PayPal účte sám.' }
      : { type: 'manual', how_to: `V PayPale použi „Odoslať“ na ${account.value} a zadaj ${amount.toFixed(2)} EUR sám.` };
  }

  await env.DB.prepare(`INSERT INTO ops_terminal_payouts_v2(id, owner_id, amount_cents, currency, destination_type, target, recipient_name, note, reference, status)
    VALUES(?, ?, ?, 'EUR', ?, ?, ?, ?, ?, 'prepared')`).bind(id, ownerId, Math.round(amount * 100), data.destination_type, target, data.recipient_name || null, data.note || null, reference).run();

  await createTrinityDocument(env, ownerId, {
    title: `Príprava výberu ${id}: ${amount.toFixed(2)} EUR (NEODOSLANÉ)`,
    category: 'commerce',
    step_name: 'wallet_payout_prepared',
    summary: `Pripravená inštrukcia na výber ${amount.toFixed(2)} EUR na ${data.destination_type}. Trinity žiadne peniaze neodoslala; odoslanie musíš vykonať sám.`,
    content: `## Pripravený výber (neodoslaný)\n\n- ID: \`${id}\`\n- Suma: **${amount.toFixed(2)} EUR**\n- Cieľ: ${data.destination_type} — \`${target}\`\n- Referencia: \`${reference}\`\n- Stav: **prepared** — peniaze NEBOLI odoslané\n- Postup: ${instruction.how_to}\n- Čas: ${new Date().toISOString()}`
  });

  return { payout_id: id, status: 'prepared', executed: false, amount_eur: amount, destination_type: data.destination_type, target, reference, instruction, created_at: new Date().toISOString(), message: 'Trinity peniaze neodoslala. Po odoslaní nahlás referenciu cez potvrdenie výberu, až potom sa zapíše do evidencie.' };
}
export const prepareWalletPayout = executeWalletPayout;

export async function cancelWalletPayout(env, ownerId, payoutId) {
  if (!env.DB) throw new HttpError(503, 'Databáza nie je pripojená.');
  await env.DB.prepare('DELETE FROM ops_terminal_payouts_v2 WHERE (id=? OR reference=?) AND owner_id=?').bind(payoutId, payoutId, ownerId).run();
  return { id: payoutId, deleted: true, message: 'Návrh výberu bol zmazaný.' };
}

// ── Skutočná krypto peňaženka ───────────────────────────────────────────────
/**
 * Vygeneruje skutočný EVM kľúčový pár (secp256k1, náhodnosť z crypto.getRandomValues).
 * Do databázy sa ukladá IBA verejná adresa. Privátny kľúč sa vráti raz v odpovedi a Trinity
 * ho nevie obnoviť; kto ho má, ovláda peniaze.
 */
export function generateEvmKeypair() {
  const privateKey = secp256k1.utils.randomSecretKey ? secp256k1.utils.randomSecretKey() : secp256k1.utils.randomPrivateKey();
  const publicKey = secp256k1.getPublicKey(privateKey, false).slice(1);
  const address = toChecksumAddress('0x' + toHex(keccak_256(publicKey).slice(-20)));
  return { address, privateKeyHex: '0x' + toHex(privateKey) };
}

export async function createCryptoWallet(env, ownerId = 'admin', network = 'polygon') {
  await ensureTerminalTables(env);
  if (!CRYPTO_CHAINS[network]) throw new HttpError(400, 'Nepodporovaná sieť.');
  const { address, privateKeyHex } = generateEvmKeypair();
  await env.DB.prepare(`
    INSERT INTO ops_wallet_terminals(owner_id, crypto_address, crypto_network, updated_at) VALUES(?, ?, ?, datetime('now'))
    ON CONFLICT(owner_id) DO UPDATE SET crypto_address=excluded.crypto_address, crypto_network=excluded.crypto_network, updated_at=datetime('now')
  `).bind(ownerId, address, network).run();
  await createTrinityDocument(env, ownerId, {
    title: 'Vytvorená nová EVM adresa pre príjem USDC',
    category: 'commerce',
    step_name: 'wallet_crypto_create',
    summary: `Vygenerovaný skutočný kľúčový pár; uložená iba verejná adresa ${address} (${network}). Privátny kľúč Trinity neukladá.`,
    content: `## Nová EVM adresa\n\n- Adresa: \`${address}\`\n- Sieť: ${CRYPTO_CHAINS[network].label}\n- Privátny kľúč: zobrazený raz majiteľovi, neuložený v Trinity\n- Čas: ${new Date().toISOString()}`
  });
  return {
    address,
    network,
    private_key: privateKeyHex,
    private_key_warning: 'Ulož si tento kľúč hneď do bezpečného správcu hesiel. Zobrazuje sa iba teraz, Trinity ho neukladá a nevie ho obnoviť. Kto ho má, ovláda peniaze na adrese.',
    qr_svg: generateQrSvg(address),
    token: 'USDC',
    status: 'created'
  };
}

/**
 * @module TRINITY_OMNI_CORE
 * @subsystem EXTERNAL_CONNECTORS
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Modul banking-connectors.js (Trinity/src/banking-connectors.js) v ekosystéme TRINITY OMNI-CORE.
 */
/**
 * Banking & Multi-Wallet Connectors Registry for Trinity
 * Adheres strictly to Hardcore Truth Policy 2.1.
 * Supports personal accounts, Open Banking, PayPal, Telegram Wallet, and on-chain crypto.
 */
import { HttpError } from './security.js';
import { resolveProviderSecret } from './secret-vault.js';
import { normalizeIban, normalizeBic, normalizeEvmAddress, readUsdcBalance, CRYPTO_CHAINS } from './wallet-terminals.js';

export const CONNECTOR_STATUSES = [
  'unsupported',
  'needs_provider_setup',
  'needs_user_consent',
  'sandbox_connected',
  'live_verified',
  'expired',
  'error'
];

/**
 * Normalizes TON blockchain address (User-friendly format EQ... / UQ... or raw 0:...)
 */
export function normalizeTonAddress(raw) {
  const s = String(raw || '').trim();
  if (/^[EU]Q[a-zA-Z0-9_-]{46}$/.test(s) || /^[EU]Q[a-zA-Z0-9+/]{46}={0,2}$/.test(s) || /^-?[0-1]:[0-9a-fA-F]{64}$/.test(s)) {
    return s;
  }
  return null;
}

/**
 * Mask sensitive identifiers (IBAN, addresses) for safe presentation
 */
export function maskIdentifier(val) {
  if (!val || typeof val !== 'string') return null;
  const s = val.trim();
  if (s.length <= 8) return s;
  return `${s.slice(0, 4)}...${s.slice(-4)}`;
}

/**
 * Returns full status of all registered banking and wallet connectors for the authenticated owner.
 */
export async function getConnectorsRegistry(env, ownerId = 'admin') {
  let terminalRow = null;
  if (env?.DB?.prepare) {
    try {
      terminalRow = await env.DB.prepare('SELECT * FROM ops_wallet_terminals WHERE owner_id=?').bind(ownerId).first();
      if (!terminalRow && ownerId !== 'admin') {
        terminalRow = await env.DB.prepare('SELECT * FROM ops_wallet_terminals WHERE owner_id=?').bind('admin').first();
      }
    } catch {}
  }

  // Payment destinations must come from explicit owner configuration. No personal
  // or crypto address is inferred from a default value.
  const iban = terminalRow?.iban ? normalizeIban(terminalRow.iban) : null;
  const bic = terminalRow?.bic ? normalizeBic(terminalRow.bic) : null;
  const accountName = terminalRow?.account_name || null;
  const revolutHandle = terminalRow?.revolut_handle || null;
  const paypalEmail = terminalRow?.paypal_email || null;
  const cryptoAddress = terminalRow?.crypto_address ? normalizeEvmAddress(terminalRow.crypto_address) : null;
  const cryptoNetwork = CRYPTO_CHAINS[terminalRow?.crypto_network] ? terminalRow.crypto_network : 'polygon';
  const tonAddress = terminalRow?.ton_address ? normalizeTonAddress(terminalRow.ton_address) : null;

  // 1. Revolut Personal Connector
  const revolutPersonal = {
    id: 'revolut_personal',
    name: 'Revolut Personal (Revolut Bank UAB)',
    category: 'bank_account',
    account_type: 'personal',
    currency: 'EUR',
    receiving_endpoint: {
      iban: iban ? `${iban.slice(0, 4)} **** **** **** ${iban.slice(-4)}` : null,
      bic,
      recipient_name: accountName,
      payment_link: revolutHandle || null
    },
    status: 'needs_provider_setup',
    status_reason: revolutHandle
      ? 'Revolut odkaz je nakonfigurovaný. Trinity neoverila vlastníctvo profilu ani prijatie platby.'
      : 'Revolut odkaz nie je nastavený. Pripojenie osobného účtu cez Open Banking nie je aktívne.',
    can_receive: Boolean(revolutHandle),
    can_read_balance: false,
    can_payout: false,
    requires_business: false,
    verified_balance: null,
    last_sync_at: null,
    next_action: 'Nastaviť bezplatné GoCardless (Nordigen) API pre automatické čítanie pohybov na osobnom Revolute.'
  };

  // 2. PayPal Checkout & Personal Connector
  const hasPaypalSecret = Boolean(env?.PAYPAL_CLIENT_SECRET || env?.PAYPAL_CLIENT_ID);
  const paypalMode = (env?.PAYPAL_MODE || 'live').toLowerCase();
  const paypalEmailAddress = paypalEmail && /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(paypalEmail)
    ? paypalEmail
    : null;
  const paypalHandle = paypalEmail && /^[A-Za-z0-9]{3,20}$/.test(paypalEmail)
    ? paypalEmail
    : null;
  const paypal = {
    id: 'paypal',
    name: 'PayPal (Personal / Orders v2)',
    category: 'payment_gateway',
    account_type: 'personal',
    currency: 'EUR',
    receiving_endpoint: {
      email: paypalEmailAddress ? `${paypalEmailAddress.slice(0, 3)}***@${paypalEmailAddress.split('@')[1]}` : null,
      paypal_me: paypalHandle ? `https://paypal.me/${paypalHandle}` : null
    },
    status: 'needs_provider_setup',
    status_reason: hasPaypalSecret
      ? `PayPal poverenia sú nastavené v režime ${paypalMode}, ale ich platnosť ani spojenie s účtom neboli týmto registrom overené.`
      : 'PayPal účet ani platobný odkaz nie sú overené.',
    can_receive: Boolean(paypalEmailAddress || paypalHandle),
    can_read_balance: false,
    can_payout: false,
    requires_business: false,
    verified_balance: null,
    last_sync_at: null,
    next_action: paypalEmailAddress || paypalHandle
      ? 'Overiť účet a platobný tok v PayPal pred prijímaním zákazníckych platieb.'
      : 'Nastaviť overený PayPal účet.'
  };

  // 3. Telegram Wallet Connector
  const telegram = {
    id: 'telegram_wallet',
    name: 'Telegram Wallet (@wallet / TON)',
    category: 'telegram_wallet',
    account_type: 'personal',
    currency: 'USDT / TON',
    receiving_endpoint: {
      ton_address: tonAddress ? maskIdentifier(tonAddress) : null,
      telegram_service: 'Telegram @wallet'
    },
    status: tonAddress ? 'needs_user_consent' : 'needs_provider_setup',
    status_reason: tonAddress
      ? 'TON adresa je nastavená. Trinity neoverila vlastníctvo adresy ani zostatok; Bot token k peňaženke nemá prístup.'
      : 'Zadaj svoju osobnú TON adresu z aplikácie Telegram (@wallet -> Vložiť -> USDT/TON), aby Trinity mohla vygenerovať QR kódy a kontrolovať prichádzajúce vklady.',
    can_receive: Boolean(tonAddress),
    can_read_balance: false,
    can_payout: false,
    requires_business: false,
    verified_balance: null, // TON / USDT balance
    last_sync_at: null,
    next_action: tonAddress ? 'Pripravené na prijímanie krypto platieb.' : 'Otvoriť Telegram @wallet a skopírovať TON adresu.'
  };

  // 4. Owner-configured EVM receive address. A public RPC balance read does not
  // prove that the owner controls the address.
  let onchainBalance = null;
  const chain = CRYPTO_CHAINS[cryptoNetwork] || CRYPTO_CHAINS.polygon;
  if (cryptoAddress) {
    try {
      onchainBalance = await readUsdcBalance(chain, cryptoAddress);
    } catch {}
  }
  const cryptoEvm = {
    id: 'crypto_evm',
    name: `EVM adresa (${chain.label})`,
    category: 'onchain_crypto',
    account_type: cryptoAddress ? 'owner_configured_address' : 'unconfigured',
    currency: 'USDC',
    receiving_endpoint: {
      address: cryptoAddress,
      network: cryptoNetwork,
      chain_id: chain.id,
      token_contract: chain.usdc
    },
    status: !cryptoAddress ? 'needs_provider_setup' : (onchainBalance?.ok ? 'needs_user_consent' : 'error'),
    status_reason: !cryptoAddress
      ? 'Krypto prijímacia adresa nie je nastavená.'
      : (onchainBalance?.ok
        ? `Verejné RPC načítalo USDC zostatok na ${chain.label}; vlastníctvo adresy ani prijatie platby tým nie je overené.`
        : `Nastavenú adresu sa nepodarilo overiť cez ${chain.label} RPC.`),
    can_receive: Boolean(cryptoAddress),
    can_read_balance: Boolean(onchainBalance?.ok),
    can_payout: false,
    requires_business: false,
    verified_balance: onchainBalance?.ok ? {
      amount: onchainBalance.usdc,
      currency: 'USDC',
      as_of: new Date().toISOString(),
      verified_by: `${chain.label} USDC contract query`
    } : null,
    last_sync_at: onchainBalance?.ok ? onchainBalance.fetched_at : null,
    next_action: cryptoAddress
      ? 'Pred zákazníckymi platbami over vlastníctvo adresy podpisom z pripojenej peňaženky.'
      : 'Pripoj svoju vlastnú EVM peňaženku alebo nastav prijímaciu adresu.'
  };

  // 5. SEPA Instant & Bank QR
  const sepaInstant = {
    id: 'sepa_instant',
    name: 'SEPA Instant & EPC QR',
    category: 'bank_transfer',
    account_type: 'personal',
    currency: 'EUR',
    receiving_endpoint: {
      iban: iban ? `${iban.slice(0, 4)} **** **** **** ${iban.slice(-4)}` : null,
      bic,
      recipient_name: accountName
    },
    status: iban ? 'needs_user_consent' : 'needs_provider_setup',
    status_reason: iban
      ? 'IBAN má platný formát a kontrolný súčet. Trinity neoverila vlastníctvo účtu ani prijatie platby.'
      : 'IBAN nie je nastavený.',
    can_receive: Boolean(iban && accountName),
    can_read_balance: false,
    can_payout: false,
    requires_business: false,
    verified_balance: null,
    last_sync_at: null,
    next_action: iban && accountName
      ? 'Skontrolovať IBAN a meno príjemcu pred odoslaním platobnej požiadavky.'
      : 'Nastaviť IBAN a meno príjemcu.'
  };

  return {
    owner_id: ownerId,
    mode: 'sovereign_multiwallet',
    updated_at: new Date().toISOString(),
    truth_policy: 'Všetky stavy a zostatky sú striktne overené. Zákaz sčítavania mien bez doloženého kurzu. Nuly sa nepoužívajú ako náhrada neznámeho zostatku.',
    connectors: [
      revolutPersonal,
      paypal,
      telegram,
      cryptoEvm,
      sepaInstant
    ]
  };
}

/**
 * Synchronize a specific connector
 */
export async function syncConnector(env, ownerId = 'admin', connectorId) {
  const registry = await getConnectorsRegistry(env, ownerId);
  const connector = registry.connectors.find(c => c.id === connectorId);
  if (!connector) throw new HttpError(404, `Konektor '${connectorId}' neexistuje.`);

  return {
    connector_id: connectorId,
    status: connector.status,
    status_reason: connector.status_reason,
    verified_balance: connector.verified_balance,
    synced_at: new Date().toISOString()
  };
}

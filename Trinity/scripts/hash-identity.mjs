#!/usr/bin/env node
/**
 * @module TRINITY_OMNI_CORE
 * @subsystem AUTH_SECURITY
 * @description Generátor HMAC-SHA256 hashov pre autorizované identity Trinity.
 * Kľúč IDENTITY_HMAC_KEY sa číta výlučne z process.env a NIKDY sa necommituje do repozitára.
 */
import { createHmac } from 'node:crypto';

const key = process.env.IDENTITY_HMAC_KEY;
if (!key || key.length < 16) {
  console.error('CHYBA: Premenná prostredia IDENTITY_HMAC_KEY musí byť nastavená a mať aspoň 16 znakov.');
  console.error('Použitie:');
  console.error('  $env:IDENTITY_HMAC_KEY = "<silny_tajny_kluc>"');
  console.error('  node scripts/hash-identity.mjs "+421949009722" "saboivan2008@gmail.com" "saboi"');
  process.exit(1);
}

export function normalizeIdentity(value) {
  let cleaned = String(value || '').trim().toLowerCase().replace(/\s+/g, '');
  // Zjednotenie slovenských mobilných čísel na kanonický formát +421...
  if (cleaned.startsWith('09') && cleaned.length === 10) {
    cleaned = '+421' + cleaned.slice(1);
  } else if (cleaned.startsWith('4219') && cleaned.length === 12) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
}

export function computeHmac(value, hmacKey) {
  const norm = normalizeIdentity(value);
  return createHmac('sha256', hmacKey).update(norm).digest('hex');
}

const inputs = process.argv.slice(2);
if (inputs.length === 0) {
  console.log('Zadajte identity ako argumenty príkazového riadka.');
  process.exit(0);
}

console.log('--- TRINITY IDENTITY HMAC-SHA256 GENERÁTOR ---');
const hashes = [];
for (const v of inputs) {
  const normalized = normalizeIdentity(v);
  const hash = computeHmac(normalized, key);
  hashes.push(hash);
  console.log(`${hash} <- ${v}${normalized !== v ? ` (kanonicky: ${normalized})` : ''}`);
}

console.log('\n--- HODNOTA PRE WRANGLER SECRET ROOT_ID_HASHES ---');
console.log(hashes.join(','));

import test from 'node:test';
import assert from 'node:assert/strict';
import { ResonanceMatrix369, RESONANCE_FREQUENCIES } from '../src/resonance-matrix.js';

test('Fáza 3: Kolaps vlnovej funkcie zámeru (Pozorovateľský efekt)', () => {
  const input = "Prosím audit a overenie bezpečnostného kľúča v Trinity Ledger";
  const thesis = ResonanceMatrix369.collapseIntentWavefunction(input);

  assert.equal(thesis.frequency, RESONANCE_FREQUENCIES.THESIS_INPUT);
  assert.equal(thesis.phase, 'thesis');
  assert.equal(thesis.collapsedAgent, 'sentinel', 'Bezpečnostný audit musí kolabovať na uzol sentinel');
  assert.ok(thesis.coherenceScore > 0, 'Koherencia musí byť kladná');
  assert.ok(thesis.wavefunction.normalizedProbabilities.sentinel > 0.2);
});

test('Fáza 3: Kolaps pre bežný dialóg na chat', () => {
  const input = "Ahoj Trinity, ako sa máš?";
  const thesis = ResonanceMatrix369.collapseIntentWavefunction(input);

  assert.equal(thesis.frequency, 3);
  assert.ok(['chat', 'fast_chat'].includes(thesis.collapsedAgent));
});

test('Fáza 6: Antitéza a transformačný Guardian filter schváli platný stav', async () => {
  const input = "Vytvor nový skript a spusti testy";
  const thesis = ResonanceMatrix369.collapseIntentWavefunction(input);
  const antithesis = await ResonanceMatrix369.evaluateAntithesisFilter(thesis, { SOVEREIGN_LOCK_ACTIVE: 'true' });

  assert.equal(antithesis.frequency, RESONANCE_FREQUENCIES.ANTITHESIS_FILTER);
  assert.equal(antithesis.phase, 'antithesis');
  assert.equal(antithesis.filterStatus, 'PASSED');
  assert.ok(antithesis.guardianHarmonics.failClosedEnforced);
});

test('Fáza 6: Odmietne neplatný vstup mimo Fázy 3', async () => {
  await assert.rejects(async () => {
    await ResonanceMatrix369.evaluateAntithesisFilter({ frequency: 9 });
  }, /RESONANCE_INVALID_PHASE/);
});

test('Fáza 9: Syntéza, manifestácia a kryptografický doklad', async () => {
  const thesis = ResonanceMatrix369.collapseIntentWavefunction("Testovanie Ledgeru");
  const antithesis = await ResonanceMatrix369.evaluateAntithesisFilter(thesis);
  const synthesis = await ResonanceMatrix369.manifestSynthesisProof(thesis, antithesis, { ok: true });

  assert.equal(synthesis.frequency, RESONANCE_FREQUENCIES.SYNTHESIS_MANIFEST);
  assert.equal(synthesis.phase, 'synthesis');
  assert.ok(synthesis.receiptId.startsWith('SOV-369-'));
  assert.equal(typeof synthesis.blockHash, 'string');
  assert.equal(synthesis.blockHash.length, 64, 'SHA-256 musí mať 64 hex znakov');
  assert.equal(synthesis.status, 'VERIFIED_MANIFESTATION');
});

test('Kompletný cyklus 3-6-9 prejde s plnou koherenciou', async () => {
  const res = await ResonanceMatrix369.executeFullResonanceCycle("Naplánuj architektúru nového modulu");

  assert.equal(res.protocol, 'TRINITY_369_RESONANCE');
  assert.equal(res.success, true);
  assert.equal(res.cycle.thesis.frequency, 3);
  assert.equal(res.cycle.antithesis.frequency, 6);
  assert.equal(res.cycle.synthesis.frequency, 9);
  assert.ok(res.cycle.synthesis.receiptId.startsWith('SOV-369-'));
});

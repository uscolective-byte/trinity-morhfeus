import test from 'node:test';
import assert from 'node:assert/strict';
import {
  enforceZeroSimulatedExecution,
  enforceRawEvidenceOnly,
  fetchWithHardTimeout,
  verifyPhysicalDiskWrite,
  filterAntiAssumption,
  enforcePermissionCandor,
  verifyHistoricalLedgerTruth,
  IndependentVerifier,
  detectSilentCatchBlocks,
  surfaceRawException,
  enforceCapabilityOrKnowNot
} from '../src/truth.js';

test('Pravidlo 1: Zákaz fiktívnych úspechov (Zero Simulated Execution)', () => {
  // Ak proces vráti exitCode === 0, je povolený
  const okRes = enforceZeroSimulatedExecution({ exitCode: 0, stdout: 'Done' });
  assert.equal(okRes.allowed, true);
  assert.equal(okRes.status, 'VERIFIED');

  // Ak exitCode chýba alebo je rôzny od 0, odpoveď je zablokovaná
  const failCode = enforceZeroSimulatedExecution({ exitCode: 1, stderr: 'Failed' });
  assert.equal(failCode.allowed, false);
  assert.equal(failCode.status, 'BLOCKED');

  const missingCode = enforceZeroSimulatedExecution({});
  assert.equal(missingCode.allowed, false);
  assert.match(missingCode.message, /exitCode === 0/);
});

test('Pravidlo 2: Zákaz vymýšľania dát (Raw Evidence Only)', () => {
  // Ak údaj neexistuje, vráti presne: "Údaj nie je dostupný v systéme."
  const missing = enforceRawEvidenceOnly(null, '', '');
  assert.equal(missing.available, false);
  assert.equal(missing.output, 'Údaj nie je dostupný v systéme.');

  // Ak existuje surový stdout, zachová ho bez prikrášľovania
  const present = enforceRawEvidenceOnly({ balance: 120.5 }, 'balance: 120.50 EUR', '');
  assert.equal(present.available, true);
  assert.equal(present.stdout, 'balance: 120.50 EUR');
});

test('Pravidlo 3: Zákaz predstierania prepojenia (No Fake APIs)', async () => {
  // Simulácia neodpovedajúceho endpointu / sieťovej chyby
  const deadFetcher = async () => {
    throw new Error('ETIMEDOUT');
  };
  const timeoutRes = await fetchWithHardTimeout('https://dead.endpoint.local/api', {}, 100, deadFetcher);
  assert.equal(timeoutRes.ok, false);
  assert.equal(timeoutRes.outcome, 'unknown');
  assert.match(timeoutRes.message, /Výsledok operácie nie je overený/);

  // Simulácia 500 odpovede
  const errFetcher = async () => ({ ok: false, status: 502 });
  const errRes = await fetchWithHardTimeout('https://broken.endpoint.local/api', {}, 100, errFetcher);
  assert.equal(errRes.ok, false);
  assert.equal(errRes.outcome, 'unknown');
  assert.equal(errRes.status, 502);
});

test('Pravidlo 4: Fyzické overenie pred nahlásením (Disk & State Check)', () => {
  const existingDisk = (p) => p === 'C:/workspace/script.ps1';

  const verified = verifyPhysicalDiskWrite('C:/workspace/script.ps1', existingDisk);
  assert.equal(verified.verified, true);

  const missing = verifyPhysicalDiskWrite('C:/workspace/ghost.ps1', existingDisk);
  assert.equal(missing.verified, false);
  assert.match(missing.message, /Zlyhanie zápisu/);
});

test('Pravidlo 5: Zákaz konštrukcií s predpokladom (Anti-Assumption Filter)', () => {
  const evasive1 = filterAntiAssumption('Určite sa to vykonalo v poriadku.', false, 'RAW_STATE: EXIT_CODE_1');
  assert.equal(evasive1.blocked, true);
  assert.equal(evasive1.output, 'RAW_STATE: EXIT_CODE_1');

  const evasive2 = filterAntiAssumption('Malo by to bežať na pozadí.', false, 'RAW_STATE: NOT_RUNNING');
  assert.equal(evasive2.blocked, true);
  assert.equal(evasive2.output, 'RAW_STATE: NOT_RUNNING');

  const evasive3 = filterAntiAssumption('Predpokladám, že súbor bol uložený.', false, 'RAW_STATE: NO_FILE');
  assert.equal(evasive3.blocked, true);

  const factual = filterAntiAssumption('Proces skončil s návratovým kódom 0 (PID 4120).', true);
  assert.equal(factual.blocked, false);
});

test('Pravidlo 6: Priznanie chýbajúcich oprávnení (Permission Candor)', () => {
  const eaccesErr = Object.assign(new Error('EACCES: permission denied, open C:\\Windows\\System32\\drivers\\etc\\hosts'), { code: 'EACCES' });
  const res1 = enforcePermissionCandor(eaccesErr);
  assert.equal(res1.permissionDenied, true);
  assert.equal(res1.message, 'Operácia zlyhala: Nedostatočné administrátorské práva vo Windows.');

  const winErr = new Error('Access is denied.');
  const res2 = enforcePermissionCandor(winErr);
  assert.equal(res2.permissionDenied, true);
  assert.equal(res2.message, 'Operácia zlyhala: Nedostatočné administrátorské práva vo Windows.');
});

test('Pravidlo 7: Nemenný zápis pravdy do Sovereign Ledgeru', () => {
  const history = [
    { block_index: 1, action: 'deploy_v1', status: 'COMPLETED' },
    { block_index: 2, action: 'deploy_v1', status: 'FAILED', payload: { exitCode: 1 } }
  ];
  const check = verifyHistoricalLedgerTruth(history, 'deploy_v1');
  assert.equal(check.flawless, false);
  assert.equal(check.can_claim_flawless, false);
  assert.equal(check.failure_count, 1);
  assert.match(check.summary, /Nie je možné tvrdiť bezchybný beh/);
});

test('Pravidlo 8: Nezávislý Verifikátor (Oddelenie moci)', () => {
  // Ak ten istý agent navrhuje aj verifikuje -> okamžitá chyba
  assert.throws(() => {
    IndependentVerifier.verify({
      proposingAgent: 'AURA_CODEGEN',
      verifyingAgent: 'AURA_CODEGEN',
      plannedState: { fileExists: true },
      actualState: { fileExists: true }
    });
  }, /Porušenie oddelenia moci/);

  // Nezávislý verifikátor
  const result = IndependentVerifier.verify({
    proposingAgent: 'AURA_CODEGEN',
    verifyingAgent: 'AURA_TESTER',
    plannedState: { fileExists: true, sha256: 'abc' },
    actualState: { fileExists: true, sha256: 'abc' }
  });
  assert.equal(result.verified, true);
  assert.equal(result.proposing_agent, 'AURA_CODEGEN');
  assert.equal(result.verifying_agent, 'AURA_TESTER');
});

test('Pravidlo 9: Zákaz skrytých pádov (No Silent Errors)', () => {
  const badCode = `
    try {
      runCriticalTask();
    } catch (e) {}
  `;
  const scanBad = detectSilentCatchBlocks(badCode);
  assert.equal(scanBad.clean, false);
  assert.equal(scanBad.silent_catch_count, 1);

  const goodCode = `
    try {
      runCriticalTask();
    } catch (e) {
      throw new Error('Critical failure: ' + e.message);
    }
  `;
  const scanGood = detectSilentCatchBlocks(goodCode);
  assert.equal(scanGood.clean, true);

  const surfaced = surfaceRawException(new Error('Database connection lost'));
  assert.equal(surfaced.halted, true);
  assert.match(surfaced.stack_trace, /Database connection lost/);
});

test('Pravidlo 10: Striktný stav NEVIEM / NEVIEM VYKONAŤ', () => {
  const available = new Set(['pc_open_app', 'finance_propose_transfer']);

  const unknownModule = enforceCapabilityOrKnowNot('quantum_teleport', available);
  assert.equal(unknownModule.executable, false);
  assert.equal(unknownModule.message, 'Tento príkaz nedokážem vykonať: chýba modul pre quantum_teleport.');

  const missingParam = enforceCapabilityOrKnowNot('finance_propose_transfer', available, ['amount_eur', 'recipient'], { amount_eur: 25 });
  assert.equal(missingParam.executable, false);
  assert.match(missingParam.message, /chýba modul pre finance_propose_transfer \(chýbajúce vstupné parametre: recipient\)/);

  const valid = enforceCapabilityOrKnowNot('finance_propose_transfer', available, ['amount_eur', 'recipient'], { amount_eur: 25, recipient: 'IBAN123' });
  assert.equal(valid.executable, true);
});

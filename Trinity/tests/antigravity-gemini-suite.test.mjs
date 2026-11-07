/**
 * @module Trinity/tests/antigravity-gemini-suite.test.mjs
 * @description Verifikačná testovacia sada pre Antigravity Tool Suite a Gemini API agenta Trinity
 * v súlade s Truth Policy 2.1 a Sovereign Ledger architektúrou.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  antigravityReadFile,
  antigravityWriteFile,
  antigravityEditFile,
  antigravityRunCommand,
  antigravityManageTask,
  antigravitySearchMarketplace,
  sanitizeSafePath
} from '../src/antigravity-bridge.js';
import { executeGeminiGemAgent, GEMINI_MODEL_CASCADE } from '../src/gemini-gem-agent.js';
import { runTool, TOOL_SCHEMAS, INTERNAL_TOOLS } from '../src/tools.js';
import { selectTeam, agentById } from '../src/registry.js';

const workspaceRoot = path.resolve(import.meta.dirname, '..');

test('Antigravity Suite 1: Path sanitization and protection', () => {
  // Povolená cesta
  const safe = sanitizeSafePath(workspaceRoot, 'package.json');
  assert.equal(path.resolve(safe), path.resolve(workspaceRoot, 'package.json'));

  // Blokovaná cesta s path traversal
  assert.throws(() => {
    sanitizeSafePath(workspaceRoot, '../../windows/system32');
  }, /mimo povoleného priestoru|chránená/);

  // Blokovaný .env súbor
  assert.throws(() => {
    sanitizeSafePath(workspaceRoot, '.env');
  }, /chránená/);
});

test('Antigravity Suite 2: read_file line range slicing and sha256', () => {
  const result = antigravityReadFile(workspaceRoot, {
    Path: 'package.json',
    StartLine: 1,
    EndLine: 5
  });

  assert.equal(result.path, 'package.json');
  assert.ok(result.content.includes('{'));
  assert.equal(result.startLine, 1);
  assert.equal(result.endLine, 5);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
  assert.equal(result._evidence.type, 'file');
});

test('Antigravity Suite 3: write_file and edit_file lifecycle with verification', () => {
  const tmpFile = path.join(os.tmpdir(), `trinity-antigravity-test-${Date.now()}.txt`);
  const root = os.tmpdir();
  const relPath = path.basename(tmpFile);

  try {
    // 1. Vytvorenie súboru
    const created = antigravityWriteFile(root, {
      Path: relPath,
      Content: 'Line 1: Alpha\nLine 2: Beta\nLine 3: Gamma'
    });
    assert.equal(created.success, true);
    assert.equal(created.action, 'create');
    assert.match(created.sha256, /^[a-f0-9]{64}$/);

    // 2. Zabránenie nechcenému prepísaniu bez Overwrite
    assert.throws(() => {
      antigravityWriteFile(root, {
        Path: relPath,
        Content: 'Attempted overwrite'
      });
    }, /už existuje/);

    // 3. edit_file: Presné nahradenie Target -> Replacement
    const edited = antigravityEditFile(root, {
      Path: relPath,
      Target: 'Beta',
      Replacement: 'Omega'
    });
    assert.equal(edited.success, true);
    assert.equal(edited.action, 'edit');
    assert.notEqual(edited.beforeHash, edited.afterHash);

    // 4. Overenie obsahu po úprave
    const verified = antigravityReadFile(root, { Path: relPath });
    assert.ok(verified.content.includes('Omega'));
    assert.ok(!verified.content.includes('Beta'));
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
});

test('Antigravity Suite 4: run_command execution and destructive pattern blocking', () => {
  // Bezpečný príkaz
  const safeCmd = antigravityRunCommand(workspaceRoot, {
    CommandLine: 'node -v',
    WaitMsBeforeAsync: 5000,
    toolSummary: 'Check Node version'
  });
  assert.equal(safeCmd.success, true);
  assert.equal(safeCmd.exitCode, 0);
  assert.match(safeCmd.stdout, /^v\d+\.\d+\.\d+/);

  // Blokovanie nebezpečného príkazu
  assert.throws(() => {
    antigravityRunCommand(workspaceRoot, {
      CommandLine: 'rm -rf /'
    });
  }, /porušuje bezpečnostné pravidlá/);
});

test('Antigravity Suite 5: search_marketplace catalog discovery', () => {
  const result = antigravitySearchMarketplace({
    queries: ['planning'],
    kind: 'skill',
    limit: 5
  });

  assert.equal(result.status, 'success');
  assert.ok(result.matches.length > 0);
  assert.ok(result.matches.some(m => m.id === 'planning'));
});

test('Antigravity Suite 6: Gemini API agent fallback and provider-managed limits', async () => {
  assert.ok(GEMINI_MODEL_CASCADE.length >= 5);

  // Prázdna úloha zlyhá
  await assert.rejects(async () => {
    await executeGeminiGemAgent({}, '');
  }, /nesmie byť prázdna/);

  // Mock beh cez Workers AI Edge Fallback
  const mockEnv = {
    AI: {
      run: async (model, payload) => ({
        response: 'Sovereign response from Gemini GEM fallback engine.'
      })
    }
  };

  const output = await executeGeminiGemAgent(mockEnv, 'Vygeneruj architektúru.');
  assert.equal(output.success, true);
  assert.equal(output.agent, 'gemini-gem');
  assert.equal(output.limits.status, 'not_verified');
  assert.equal(output.limits.policy, 'provider_managed');
  assert.equal(output.tier, 'sovereign-edge');
  assert.ok(output.result.includes('Sovereign response'));
});

test('Antigravity Suite 7: runTool dispatch for Antigravity tools and Triad telemetry', async () => {
  const agent = agentById('orchestrator');

  // 1. read_file cez runTool
  const readRes = await runTool({}, agent, 'read_file', {
    Path: 'package.json',
    StartLine: 1,
    EndLine: 3
  });
  assert.ok(readRes.content.includes('{'));

  // 2. search_marketplace cez runTool
  const searchRes = await runTool({}, agent, 'search_marketplace', {
    queries: ['cloud-operations'],
    kind: 'skill'
  });
  assert.ok(searchRes.matches.length > 0);

  // 3. triad_status cez runTool
  const triadRes = await runTool({}, agent, 'triad_status', {});
  assert.equal(triadRes.status, 'active');
  assert.equal(triadRes.triad.trinity.role, 'Sovereign Orchestrator');
  assert.equal(triadRes.gemini_gem.status, 'configured_in_code');
  assert.equal(triadRes.gemini_gem.user_gem_linked, false);
  assert.equal(triadRes.gemini_gem.execution, 'inference_only');
});

test('Antigravity Suite 8: Agent registry and team routing for gemini-gem', () => {
  const gemAgent = agentById('gemini-gem');
  assert.ok(gemAgent, 'gemini-gem agent exists in registry');
  assert.equal(gemAgent.cluster, 'Riadenie');
  assert.ok(gemAgent.tools.includes('read_file'));
  assert.ok(gemAgent.tools.includes('execute_gemini_gem'));

  // selectTeam routing
  const team = selectTeam('Potrebujem bezlimitny gemini model na analyzu.');
  assert.equal(team[0], 'gemini-gem');
});

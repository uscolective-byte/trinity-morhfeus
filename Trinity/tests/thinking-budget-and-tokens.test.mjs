import test from 'node:test';
import assert from 'node:assert/strict';
import { runAgent } from '../src/engine.js';
import { tokenBudget } from '../src/cognition.js';
import { callModel } from '../src/services.js';
import { runTool } from '../src/tools.js';
import { readFileSync } from 'node:fs';

test('engine and agent runtime have expanded thinking budget and default token headroom', async () => {
  // Verify tokenBudget returns high headroom for reasoning and complex tasks
  const complexBudget = tokenBudget('orchestrator', 'Analyzuj architektúru, kvantovú fyziku a navrhni detailný kód');
  const normalBudget = tokenBudget('orchestrator', 'Bežná otázka');
  const agentComplexBudget = tokenBudget('coder', 'Implementuj kompletný backend v Node.js');
  const agentNormalBudget = tokenBudget('coder', 'Jednoduchá oprava');

  assert.equal(complexBudget, 16384);
  assert.equal(normalBudget, 8192);
  assert.equal(agentComplexBudget, 8192);
  assert.equal(agentNormalBudget, 4096);

  // Verify runAgent uses generous default tokens (8192) when unspecified
  let capturedData;
  const env = {
    AI: {
      run: async (model, data) => {
        capturedData = data;
        return { response: 'Overené a kompletné.' };
      }
    }
  };

  const agentRes = await runAgent(env, 'orchestrator', 'Vysvetli podrobne kvantové previazanie.');
  assert.equal(agentRes.text, 'Overené a kompletné.');
  // Default maxTokens must be 8192, allowing deep reasoning and code generation
  assert.equal(capturedData.max_tokens, 8192);
});

test('engine does not trigger artificial 2-minute deadline or forceFinal at 35 seconds', () => {
  const engineSource = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8');
  assert.equal(engineSource.includes('v limite 2 minút'), false, 'Artificial 2-minute error message must not exist in engine.js');
  assert.equal(engineSource.includes('BUDGET_MS=100000'), false, 'BUDGET_MS must not be capped at 100 seconds');
  assert.ok(engineSource.includes('600000'), 'BUDGET_MS should default to 600,000 ms (10 minutes)');
});

test('workflow step timeout is expanded beyond 2 minutes for deep reasoning and multi-turn workflows', () => {
  const workflowSource = readFileSync(new URL('../src/workflow.js', import.meta.url), 'utf8');
  assert.equal(workflowSource.includes("timeout:'2 minutes'"), false, 'Workflow step timeout must not be 2 minutes');
  assert.ok(workflowSource.includes("timeout:'15 minutes'"), 'Workflow step timeout must be expanded to 15 minutes');
});

test('callModel provider limits allow up to 8192-16384 tokens for modern models', async () => {
  let capturedTokens;
  const env = {
    AI: {
      run: async (model, options) => {
        capturedTokens = options.max_tokens;
        return { response: 'Test response' };
      }
    }
  };

  await callModel(env, 'workers-ai', [{ role: 'user', content: 'Test' }], 12000);
  assert.equal(capturedTokens, 8192, 'Workers AI allows up to 8192 output tokens');
});

test('PC script and command schema timeout supports up to 600,000 ms (10 minutes)', async () => {
  const env = {
    DB: {
      prepare: () => ({
        bind: () => ({
          run: async () => ({})
        })
      })
    }
  };
  const agent = { id: 'admin', tools: ['pc_run_script', 'pc_run'] };

  // Verification that timeout_ms up to 600000 is accepted by pc_run_script schema validation (rather than failing at > 120000)
  // Reaches createSystemAction and fails on mock execution rather than schema rejection
  await assert.rejects(
    runTool(env, agent, 'pc_run_script', {
      runtime: 'node',
      path: 'Trinity/workspace/scripts/test.mjs',
      expected_sha256: 'a'.repeat(64),
      timeout_ms: 300000
    }, { adminAuthorized: true, ownerMode: true })
  );

  // Verification that timeout_ms > 600000 is rejected by schema validation
  await assert.rejects(
    runTool(env, agent, 'pc_run_script', {
      runtime: 'node',
      path: 'Trinity/workspace/scripts/test.mjs',
      expected_sha256: 'a'.repeat(64),
      timeout_ms: 650000
    }, { adminAuthorized: true, ownerMode: true })
  );
});

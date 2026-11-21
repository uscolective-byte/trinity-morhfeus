import test from 'node:test';
import assert from 'node:assert/strict';
import { executeClaudeAgent, CLAUDE_MODEL_CASCADE } from '../src/claude-agent.js';
import { dualEngineDeliberate } from '../src/dual-engine-orchestrator.js';
import { runTool } from '../src/tools.js';
import { resolveProviderSecret } from '../src/secret-vault.js';

const fakeClaudeKey = 'sk-ant-api03-' + 'c'.repeat(40);
const fakeGeminiKey = 'AIza' + 'g'.repeat(32);

const fakeDB = {
  prepare() {
    return {
      first: async () => null,
      all: async () => ({ results: [] }),
      run: async () => ({ success: true }),
      bind() {
        return {
          first: async () => null,
          all: async () => ({ results: [] }),
          run: async () => ({ success: true })
        };
      }
    };
  }
};

test('Secrets Store resolves TRINITY_MASTER_CLAUDE asynchronously for anthropic and claude', async () => {
  let reads = 0;
  const env = {
    TRINITY_MASTER_CLAUDE: {
      get: async () => {
        reads++;
        return fakeClaudeKey;
      }
    }
  };

  const keyAnthropic = await resolveProviderSecret(env, 'anthropic');
  assert.equal(keyAnthropic, fakeClaudeKey);
  assert.equal(reads, 1);

  const keyClaude = await resolveProviderSecret(env, 'claude');
  assert.equal(keyClaude, fakeClaudeKey);
  assert.equal(reads, 2);
});

test('executeClaudeAgent executes with mocked Anthropic Messages API', async () => {
  const originalFetch = globalThis.fetch;
  let calledUrl = '';
  let calledBody = null;

  globalThis.fetch = async (url, opts) => {
    calledUrl = url;
    calledBody = JSON.parse(opts.body);
    return new Response(JSON.stringify({
      id: 'msg_test_claude_123',
      type: 'message',
      role: 'assistant',
      model: calledBody.model,
      content: [{ type: 'text', text: 'Anthropic Claude suverénna odpoveď pre Trinity.' }],
      usage: { input_tokens: 15, output_tokens: 12 }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const env = {
      DB: fakeDB,
      TRINITY_MASTER_CLAUDE: { get: async () => fakeClaudeKey }
    };

    const res = await executeClaudeAgent(env, 'Vysvetli architektúru Trinity.', {
      model: 'claude-3-7-sonnet-20250219'
    });

    assert.equal(res.success, true);
    assert.equal(calledUrl, 'https://api.anthropic.com/v1/messages');
    assert.equal(calledBody.model, 'claude-3-7-sonnet-20250219');
    assert.match(res.text, /Anthropic Claude suverénna odpoveď/);
    assert.equal(res.receipt.status, 'success');
    assert.equal(res.receipt.tool, 'claude_agent');
    assert.ok(res.receipt.receiptId);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('executeClaudeAgent cascades to next model on 404 or 529 error', async () => {
  const originalFetch = globalThis.fetch;
  const attemptedModels = [];

  globalThis.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    attemptedModels.push(body.model);
    if (body.model === CLAUDE_MODEL_CASCADE[0]) {
      return new Response(JSON.stringify({
        error: { message: 'Overloaded' }
      }), { status: 529, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({
      id: 'msg_cascade_success',
      type: 'message',
      role: 'assistant',
      model: body.model,
      content: [{ type: 'text', text: 'Odpoveď z kaskádového modelu Claude.' }],
      usage: { input_tokens: 10, output_tokens: 8 }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const env = {
      DB: fakeDB,
      TRINITY_MASTER_CLAUDE: { get: async () => fakeClaudeKey }
    };

    const res = await executeClaudeAgent(env, 'Test kaskády.');
    assert.equal(res.success, true);
    assert.equal(attemptedModels[0], CLAUDE_MODEL_CASCADE[0]);
    assert.equal(attemptedModels[1], CLAUDE_MODEL_CASCADE[1]);
    assert.equal(res.model, CLAUDE_MODEL_CASCADE[1]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('dualEngineDeliberate synthesizes Gemini analysis and Claude review into consensus', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body || '{}') });
    if (url.includes('generativelanguage.googleapis.com')) {
      return new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{ text: 'Google Gemini počiatočná analýza a štruktúra riešenia.' }]
          }
        }],
        usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 15 }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('api.anthropic.com')) {
      return new Response(JSON.stringify({
        id: 'msg_deliberation_consensus',
        type: 'message',
        role: 'assistant',
        model: 'claude-3-7-sonnet-20250219',
        content: [{ type: 'text', text: 'Definitívna Claude syntéza po revízii Gemini analýzy.' }],
        usage: { input_tokens: 40, output_tokens: 25 }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('Not found', { status: 404 });
  };

  try {
    const env = {
      DB: fakeDB,
      GEMINI_API_KEY: fakeGeminiKey,
      ANTHROPIC_API_KEY: fakeClaudeKey
    };

    const result = await dualEngineDeliberate(env, 'Navrhni duálnu kognitívnu architektúru.', {
      mode: 'deliberate'
    });

    assert.equal(result.success, true);
    assert.equal(result.mode, 'deliberate');
    assert.match(result.gemini_raw_analysis, /Google Gemini počiatočná analýza/);
    assert.match(result.text, /Definitívna Claude syntéza/);
    assert.equal(result.receipt.status, 'success');
    assert.equal(result.receipt.tool, 'dual_engine_orchestrator');
    assert.equal(result.receipt.action, 'deliberate');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('runTool supports execute_claude and dual_engine_deliberate', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, opts) => {
    if (url.includes('api.anthropic.com')) {
      return new Response(JSON.stringify({
        id: 'msg_tool_test',
        type: 'message',
        role: 'assistant',
        model: 'claude-3-5-sonnet-20241022',
        content: [{ type: 'text', text: 'Odpoveď cez runTool execute_claude.' }],
        usage: { input_tokens: 5, output_tokens: 5 }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const env = {
      DB: fakeDB,
      ANTHROPIC_API_KEY: fakeClaudeKey
    };
    const agent = { id: 'test-agent' };

    const claudeToolRes = await runTool(env, agent, 'execute_claude', {
      task: 'Ahoj Claude z nástroja.',
      model: 'claude-3-5-sonnet-20241022'
    });

    assert.equal(claudeToolRes.success, true);
    assert.match(claudeToolRes.text, /Odpoveď cez runTool execute_claude/);

    const triadRes = await runTool(env, agent, 'triad_status', {});
    assert.equal(triadRes.status, 'active');
    assert.ok(triadRes.claude_agent);
    assert.equal(triadRes.claude_agent.provider, 'Anthropic Messages API');
    assert.equal(triadRes.dual_engine.status, 'active');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

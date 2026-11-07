import test from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_SCHEMAS, TOOL_HELP, INTERNAL_TOOLS, runTool } from '../src/tools.js';
import { agentById } from '../src/registry.js';
import { skillRegistry } from '../src/skillRegistry.js';
import { runAgent } from '../src/engine.js';

function createMockDb() {
  const events = [];
  return {
    events,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() {
              if (sql.includes('ops_events')) {
                events.push({ sql, args });
              }
              return { success: true };
            },
            async first() { return null; },
            async all() { return { results: [] }; }
          };
        },
        async run() { return { success: true }; },
        async first() { return null; },
        async all() { return { results: [] }; }
      };
    }
  };
}

test('Step 1: Tool Registry - diagnostic_ping and omni/triad tools are registered', () => {
  // Check diagnostic_ping registration
  assert.ok(TOOL_SCHEMAS.diagnostic_ping, 'diagnostic_ping must be registered in TOOL_SCHEMAS');
  assert.ok(TOOL_HELP.diagnostic_ping, 'diagnostic_ping must have documentation in TOOL_HELP');
  assert.ok(INTERNAL_TOOLS.has('diagnostic_ping'), 'diagnostic_ping must be recognized in INTERNAL_TOOLS');

  // Check agent tool list
  const orchestrator = agentById('orchestrator');
  assert.ok(orchestrator, 'orchestrator agent must exist');
  assert.ok(orchestrator.tools.includes('diagnostic_ping'), 'orchestrator must have diagnostic_ping in tools');

  // Check previously blocked 18 omni/triad tools
  const missingOmniTools = [
    'cf_d1_query', 'cf_kv_store', 'cf_r2_manage', 'cf_self_deploy',
    'mail_engine', 'http_fetch_pro', 'pc_fs_read', 'pc_fs_write',
    'pc_fs_patch', 'pc_shell_exec', 'pc_system_telemetry', 'apply_self_evolution',
    'triad_subagent_run', 'triad_deep_research', 'triad_code_patch',
    'triad_test_matrix', 'triad_copilot_sync', 'triad_status'
  ];
  for (const tool of missingOmniTools) {
    assert.ok(INTERNAL_TOOLS.has(tool), `Tool ${tool} must be present in INTERNAL_TOOLS to avoid disabled extension lock`);
    assert.ok(orchestrator.tools.includes(tool), `Tool ${tool} must be in orchestrator tool registry`);
  }
});

test('Step 2: SkillRegistry - diagnostic_ping is registered and executable', async () => {
  assert.ok(skillRegistry.has('diagnostic_ping'), 'skillRegistry must have diagnostic_ping');
  const mockDb = createMockDb();
  const env = { DB: mockDb };

  const result = await skillRegistry.execute('diagnostic_ping', { message: 'skill-ping-test' }, env);
  assert.equal(result.status, 'healthy');
  assert.equal(result.tool, 'diagnostic_ping');
  assert.equal(result.echo, 'skill-ping-test');
  assert.match(result.receipt_id, /^DIAG-RCPT-[0-9A-Z]+-[0-9A-Z]+$/);
  assert.equal(result.executor, 'trinity-tool-executor');
});

test('Step 3: Tool Executor - runTool executes diagnostic_ping and records verifiable audit receipt', async () => {
  const mockDb = createMockDb();
  const env = { DB: mockDb };
  const orchestrator = agentById('orchestrator');

  const result = await runTool(env, orchestrator, 'diagnostic_ping', { message: 'executor-audit-test' }, { ownerMode: true });

  assert.equal(result.status, 'healthy');
  assert.equal(result.tool, 'diagnostic_ping');
  assert.equal(result.echo, 'executor-audit-test');
  assert.match(result.receipt_id, /^DIAG-RCPT-[0-9A-Z]+-[0-9A-Z]+$/);
  assert.equal(result._evidence.effect, 'read');
  assert.equal(result._evidence.receipt_id, result.receipt_id);

  // Check audit log in ops_events
  assert.equal(mockDb.events.length, 1, 'One ops_events entry must be logged');
  const logged = JSON.parse(mockDb.events[0].args[0]);
  assert.equal(logged.tool, 'diagnostic_ping');
  assert.equal(logged.receipt_id, result.receipt_id);
  assert.equal(logged.output.status, 'healthy');
  assert.equal(logged.output.echo, 'executor-audit-test');
  assert.equal(logged.executed_by, 'orchestrator');
});

test('Step 4: Tool Executor - security boundary blocks unauthorized execution', async () => {
  const mockDb = createMockDb();
  const env = { DB: mockDb };
  const restrictedAgent = { id: 'restricted', tools: ['web_search'] };

  // Agent does not have diagnostic_ping in its tools
  await assert.rejects(
    async () => {
      await runTool(env, restrictedAgent, 'diagnostic_ping', { message: 'should-fail' }, { ownerMode: false });
    },
    /Tool not allowed/
  );
});

test('Step 5: Agent Runtime - full loop from model tool call to executed outcome and audit', async () => {
  const mockDb = createMockDb();
  let step = 0;

  // Mock AI simulates a model that calls diagnostic_ping first, then provides final response
  const mockAi = {
    async run({ messages }) {
      step++;
      if (step === 1) {
        return {
          response: JSON.stringify({
            tool: 'diagnostic_ping',
            arguments: { message: 'runtime-chain-verified' }
          })
        };
      }
      return {
        response: 'Diagnostický ping prebehol úspešne. Systém nástrojov Trinity je v stave healthy.'
      };
    }
  };

  const env = {
    DB: mockDb,
    AI: mockAi
  };

  const runtimeResult = await runAgent(
    env,
    'orchestrator',
    'Vykonaj diagnostický test nástrojov Trinity cez diagnostic_ping.',
    '',
    'fast'
  );

  // Verification of full execution chain
  assert.ok(runtimeResult.text, 'Runtime must produce final text');
  assert.equal(runtimeResult.tool_log.length, 1, 'Runtime must log 1 executed tool');
  assert.equal(runtimeResult.tool_log[0].tool, 'diagnostic_ping');
  assert.equal(runtimeResult.tool_log[0].status, 'completed');
  assert.match(runtimeResult.tool_log[0].receipt_id, /^DIAG-RCPT-/);

  // Audit Log verification
  assert.ok(mockDb.events.length >= 1, 'Audit log event must be captured');
  const loggedEvent = JSON.parse(mockDb.events[0].args[0]);
  assert.equal(loggedEvent.tool, 'diagnostic_ping');
  assert.equal(loggedEvent.receipt_id, runtimeResult.tool_log[0].receipt_id);
});

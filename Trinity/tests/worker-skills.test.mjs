import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { skillRegistry, skills, extendedEngineeringSkills } from '../src/skillRegistry.js';
import { copilotPluginRegistry } from '../src/copilot-plugins.js';
import { AGENTS } from '../src/registry.js';

test('Extended engineering skills execute correctly', async () => {
  // codeRefactor
  const refactored = extendedEngineeringSkills.codeRefactor('  let x = 1;   \n  let y = 2;   ', { ensureTrailingNewline: true });
  assert.equal(refactored.refactored_code, '  let x = 1;\n  let y = 2;\n');

  // sqlValidate
  const sqlValid = extendedEngineeringSkills.sqlValidate('SELECT id, name FROM users WHERE active = 1');
  assert.equal(sqlValid.valid, true);
  assert.equal(sqlValid.is_select, true);
  assert.equal(sqlValid.is_mutating, false);

  const sqlUnsafe = extendedEngineeringSkills.sqlValidate('SELECT * FROM users; -- DROP TABLE users;');
  assert.equal(sqlUnsafe.valid, false);
  assert.equal(sqlUnsafe.has_unsafe_comment, true);

  // cryptoHash
  const hashRes = await extendedEngineeringSkills.cryptoHash('hello trinity');
  assert.equal(hashRes.algorithm, 'SHA-256');
  assert.equal(typeof hashRes.hash, 'string');
  assert.equal(hashRes.hash.length, 64);

  // diffCompare
  const diff = extendedEngineeringSkills.diffCompare('a\nb\nc', 'a\nb\nx');
  assert.equal(diff.identical, false);
  assert.equal(diff.added_lines, 1);
  assert.equal(diff.deleted_lines, 1);

  // semverCheck
  const semver = extendedEngineeringSkills.semverCheck('v2.4.1');
  assert.equal(semver.valid, true);
  assert.equal(semver.major, 2);
  assert.equal(semver.minor, 4);
  assert.equal(semver.patch, 1);

  // htmlSanitize
  const cleanHtml = extendedEngineeringSkills.htmlSanitize('<div>Safe<script>alert("hack")</script></div>');
  assert.equal(cleanHtml, '<div>Safe</div>');

  // csvParse
  const csv = extendedEngineeringSkills.csvParse('id,name,role\n1,Ivan,owner\n2,Trinity,ai');
  assert.equal(csv.row_count, 2);
  assert.equal(csv.rows[0].name, 'Ivan');
  assert.equal(csv.rows[1].role, 'ai');

  // base64Codec
  const encoded = extendedEngineeringSkills.base64Codec('Trinity AI');
  assert.equal(encoded.result, 'VHJpbml0eSBBSQ==');
  const decoded = extendedEngineeringSkills.base64Codec('VHJpbml0eSBBSQ==', 'decode');
  assert.equal(decoded.result, 'Trinity AI');

  // urlParse
  const parsedUrl = extendedEngineeringSkills.urlParse('https://auru.dev/api/status?format=json#overview');
  assert.equal(parsedUrl.hostname, 'auru.dev');
  assert.equal(parsedUrl.pathname, '/api/status');
  assert.equal(parsedUrl.params.format, 'json');

  // ipCheck
  const ipV4 = extendedEngineeringSkills.ipCheck('192.168.1.100');
  assert.equal(ipV4.valid, true);
  assert.equal(ipV4.type, 'IPv4');
  assert.equal(ipV4.is_private, true);
});

test('SkillRegistry contains all extended skills and executes dynamically', async () => {
  const allSkills = skillRegistry.list();
  assert.ok(allSkills.length >= 45, `Expected >= 45 skills, got ${allSkills.length}`);

  const cryptoRes = await skillRegistry.execute('cryptoHash', 'test-payload');
  assert.ok(cryptoRes.hash);

  const semverRes = await skillRegistry.execute('semverCheck', '3.1.2');
  assert.equal(semverRes.major, 3);
});

test('Copilot Plugin Registry exposes all built-in and extended plugins', () => {
  const plugins = copilotPluginRegistry.list();
  assert.ok(plugins.length >= 10, `Expected >= 10 plugins, got ${plugins.length}`);
  const pluginIds = plugins.map(p => p.id);
  assert.ok(pluginIds.includes('security-devops'));
  assert.ok(pluginIds.includes('data-intelligence'));
  assert.ok(pluginIds.includes('web-standards'));
  assert.ok(pluginIds.includes('cloud-worker-ops'));
});

test('All 46 Trinity agent roles have access to execute_skill, copilot_chat, ecosystem_synthesize, ecosystem_search', () => {
  assert.equal(AGENTS.length, 46);
  for (const agent of AGENTS) {
    assert.ok(agent.tools.includes('execute_skill'), `${agent.id} missing execute_skill`);
    assert.ok(agent.tools.includes('copilot_chat'), `${agent.id} missing copilot_chat`);
    assert.ok(agent.tools.includes('ecosystem_synthesize'), `${agent.id} missing ecosystem_synthesize`);
    assert.ok(agent.tools.includes('ecosystem_search'), `${agent.id} missing ecosystem_search`);
  }
});

test('Sub-worker source files declare listSkills, listPlugins, and executeSkill entrypoints', () => {
  const workers = [
    { name: 'Integrations-Worker', path: resolve('../Integrations-Worker/src/index.js'), skills: 'INTEGRATION_SKILLS', plugins: 'INTEGRATION_PLUGINS' },
    { name: 'Knowledge-Worker', path: resolve('../Knowledge-Worker/src/index.js'), skills: 'KNOWLEDGE_SKILLS', plugins: 'KNOWLEDGE_PLUGINS' },
    { name: 'Capacity-Worker', path: resolve('../Capacity-Worker/src/index.js'), skills: 'CAPACITY_SKILLS', plugins: 'CAPACITY_PLUGINS' },
    { name: 'PC-Bridge-Worker', path: resolve('../PC-Bridge-Worker/src/index.js'), skills: 'PC_BRIDGE_SKILLS', plugins: 'PC_BRIDGE_PLUGINS' }
  ];

  for (const w of workers) {
    const src = readFileSync(w.path, 'utf8');
    assert.ok(src.includes(w.skills), `${w.name} missing ${w.skills}`);
    assert.ok(src.includes(w.plugins), `${w.name} missing ${w.plugins}`);
    assert.ok(src.includes('listSkills'), `${w.name} missing listSkills`);
    assert.ok(src.includes('listPlugins'), `${w.name} missing listPlugins`);
    assert.ok(src.includes('executeSkill'), `${w.name} missing executeSkill`);
  }
});

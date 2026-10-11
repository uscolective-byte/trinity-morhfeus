import test from 'node:test';
import assert from 'node:assert/strict';
import {SKILLS} from '../src/practical-skills.js';
import {PLUGINS} from '../src/plugins.js';

test('Trinity exposes exactly 150 executable skills',()=>{
  assert.equal(SKILLS.length,150);
  assert.equal(new Set(SKILLS.map(item=>item.id)).size,150);
  for(const skill of SKILLS) {
    assert.ok(skill.id && skill.name && skill.description);
    assert.ok(Array.isArray(skill.clusters));
  }
});

test('Trinity exposes exactly 150 trusted plugins',()=>{
  assert.equal(PLUGINS.length,150);
  assert.equal(new Set(PLUGINS.map(item=>item.id)).size,150);
  for(const plugin of PLUGINS) {
    assert.ok(plugin.id && plugin.name && plugin.description);
    assert.ok(Array.isArray(plugin.tools));
    assert.equal(plugin.trusted === false, false);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = name => fs.readFileSync(new URL('../public/assistant/' + name, import.meta.url), 'utf8');

test('Trinity assistant UI script parses', () => {
  assert.doesNotThrow(() => new vm.Script(read('chat.js.txt')));
});

test('Settings controls exist and are wired', () => {
  const html = read('chat.html');
  const js = read('chat.js.txt');
  const css = read('chat.css');
  for (const id of ['settings-search', 'settings-reset-search', 'settings-refresh',
    'settings-compact', 'settings-less-motion', 'settings-filter-info']) {
    assert.match(html, new RegExp('id="' + id + '"'));
    assert.ok(js.includes("'" + id + "'"), 'Missing JavaScript handler for ' + id);
  }
  for (const section of ['system', 'ai', 'connections', 'security']) {
    assert.ok(html.includes('data-settings-category="' + section + '"'));
  }
  assert.match(css, /\.settings-search-row/);
  assert.ok(html.includes('PC BRIDGE (CORE)'));
  assert.ok(html.includes('WEBOVÝ VÝSKUM'));
});

test('Settings filter cannot reveal restricted panels without API permissions', () => {
  const js = read('chat.js.txt');
  const start = js.lastIndexOf('let refreshSettingsNavigator=null;');
  assert.ok(start > 0, 'navigator code not found');
  const body = js.slice(start);
  function node(id = '', classes = [], textContent = '') {
    const handlers = {};
    const attrs = {};
    const active = new Set(classes);
    return {
      id, textContent, hidden: false, dataset: {}, checked: false, value: '', attrs, focus() {},
      classList: {
        contains: cls => active.has(cls),
        toggle: (cls, yes) => { if (yes) active.add(cls); else active.delete(cls); }
      },
      addEventListener: (event, callback) => { handlers[event] = callback; },
      fire: event => handlers[event]?.(),
      setAttribute: (key, value) => { attrs[key] = value; }
    };
  }
  const status = node('', ['settings-status-grid'], 'Status');
  const modules = node('', ['panel'], 'Moduly Trinity');
  const integrations = node('', ['panel', 'integration-panel'], 'Pripojenia');
  const secret = node('settings-secret-panel', ['panel'], 'API trezor');
  const users = node('settings-users-panel', ['panel'], 'Používatelia');
  const ai = node('settings-ai-provider-panel', ['panel'], 'AI modely');
  const keys = node('settings-api-key-panel', ['panel'], 'API kľúče');
  const wallet = node('settings-wallet-panel', ['panel'], 'Sandbox');
  const general = node('', ['panel', 'info-settings'], 'O Trinity');
  const apiProjects = node('', ['panel', 'api-project-panel'], 'API projekty');
  const cards = [modules, integrations, secret, users, ai, keys, wallet, general, apiProjects];
  const search = node('settings-search');
  const info = node('settings-filter-info');
  const reset = node('settings-reset-search');
  const refresh = node('settings-refresh');
  const compact = node('settings-compact');
  const motion = node('settings-less-motion');
  const tabs = ['all', 'system', 'ai', 'connections', 'security'].map(category => {
    const button = node();
    button.dataset.settingsCategory = category;
    return button;
  });
  const view = node('settings-view');
  view.querySelector = selector => selector === '.settings-status-grid' ? status :
    selector === '#settings-modules' ? { closest: () => modules } : null;
  view.querySelectorAll = selector => selector === '.settings-grid > .panel' ? cards :
    selector === '[data-settings-category]' ? tabs : [];
  const elements = Object.fromEntries([view, search, info, reset, refresh, compact, motion].map(el => [el.id, el]));
  const storage = new Map();
  const context = vm.createContext({
    document: { getElementById: id => elements[id] || null },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, val) => storage.set(key, val) },
    safe: fn => fn,
    loadSettings: async () => {},
    notice: () => {}
  });
  vm.runInContext(body, context);
  assert.equal(secret.hidden, true);
  assert.equal(users.hidden, true);
  vm.runInContext('refreshSettingsNavigator({manage_api_keys:false,manage_secrets:false,manage_users:false,manage_trading:false})', context);
  tabs.find(b => b.dataset.settingsCategory === 'security').fire('click');
  assert.equal(secret.hidden, true, 'Secret vault visible to ordinary user');
  assert.equal(users.hidden, true, 'User management visible to ordinary user');
  tabs.find(b => b.dataset.settingsCategory === 'all').fire('click');
  assert.equal(integrations.hidden, false);
  vm.runInContext('refreshSettingsNavigator({manage_api_keys:true,manage_secrets:true,manage_users:true,manage_trading:true})', context);
  assert.equal(secret.hidden, false);
  assert.equal(users.hidden, false);
  search.value = 'neexistujúca sekcia';
  search.fire('input');
  assert.equal(secret.hidden, true);
  reset.fire('click');
  assert.equal(secret.hidden, false);
  assert.equal(search.value, '');
  vm.runInContext('refreshSettingsNavigator({manage_api_keys:false,manage_secrets:false,manage_users:false,manage_trading:false})', context);
  assert.equal(secret.hidden, true, 'Revoked permission must hide secret vault');
});

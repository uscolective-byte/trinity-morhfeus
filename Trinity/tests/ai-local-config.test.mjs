import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import helper from '../scripts/prepare-ai-local.cjs';
const {parseJSONC,prepareConfig,prepare} = helper;

test('JSONC parsing preserves URLs, escaped strings and comma-looking text', () => {
  const text = '\ufeff{\n// comment\n"url":"https://example.test/a//b", /* block */\n' +
    '"quoted":"quote: \\" /* string */", "array":[1,2,], "literal":",}",\n}';
  assert.deepEqual(parseJSONC(text),{url:'https://example.test/a//b',quoted:'quote: " /* string */',array:[1,2],literal:',}'});
  assert.throws(()=>parseJSONC('{"a":1 /*'),/Unterminated/);
  assert.throws(()=>parseJSONC('{"a":1,,}'));
});
test('only AI is remote, including environments; original and ordinary vars stay unchanged', () => {
  const base={name:'trinity',ai:{binding:'AI'},vars:{AI_MODEL:'model',REMOTE_PREFERENCE:true},
    d1_databases:[{binding:'DB',remote:true}],services:[{binding:'PC',remote:true}],
    r2_buckets:[{binding:'FILES'}],browser:{binding:'BROWSER',remote:true},
    env:{staging:{ai:{binding:'AI',remote:false},kv_namespaces:[{binding:'KV',remote:true}]}}};
  const original=structuredClone(base),cfg=prepareConfig(base);
  assert.deepEqual(base,original);assert.equal(cfg.ai.remote,true);
  assert.equal(cfg.d1_databases[0].remote,false);assert.equal(cfg.services[0].remote,false);
  assert.equal(cfg.browser.remote,false);assert.equal(cfg.env.staging.ai.remote,true);
  assert.equal(cfg.env.staging.kv_namespaces[0].remote,false);
  assert.deepEqual(cfg.vars,base.vars);
  assert.throws(()=>prepareConfig({name:'another',ai:{binding:'AI'}}));
});
test('inline secrets are refused before writing another configuration', () => {
  assert.throws(()=>prepareConfig({name:'trinity',ai:{binding:'AI'},vars:{OPENAI_API_KEY:'example'}}),/Inline/);
  assert.throws(()=>prepareConfig({name:'trinity',ai:{binding:'AI'},unsafe:{bindings:[{type:'secret_text'}]}}),/Inline/);
});
function fixture() {
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'trinity-ai-local-')),root=path.join(tmp,'project'),backups=path.join(tmp,'backups');
  fs.mkdirSync(path.join(root,'Trinity'),{recursive:true});
  const original='{"name":"trinity","ai":{"binding":"AI"},"d1_databases":[{"binding":"DB","remote":true}]}';
  fs.writeFileSync(path.join(root,'Trinity/wrangler.jsonc'),original);
  return {tmp,root,backups,original};
}
test('production config unchanged, owned launcher backed up, repeated preparation safe', () => {
  const x=fixture();
  try {
    const old='@echo off\r\ncd /d "%~dp0Trinity"\r\ncall npx --no-install wrangler dev --local --ip 127.0.0.1\r\npause\r\n';
    fs.writeFileSync(path.join(x.root,'Start-Trinity-OneDrive.cmd'),old);
    const r=prepare(x.root,x.backups);
    assert.equal(fs.readFileSync(path.join(x.root,'Trinity/wrangler.jsonc'),'utf8'),x.original);
    assert.equal(r.originalConfigUnchanged,true);assert.equal(r.primaryLauncherUpdated,true);
    assert.equal(fs.readFileSync(r.launcherBackup,'utf8'),old);
    assert.equal(parseJSONC(fs.readFileSync(r.developmentConfig,'utf8')).d1_databases[0].remote,false);
    assert.doesNotMatch(fs.readFileSync(r.launcher,'utf8'),/--local|--remote|\bdeploy\b/);
    assert.equal(prepare(x.root,x.backups).primaryLauncherUpdated,false);
  } finally {fs.rmSync(x.tmp,{recursive:true,force:true});}
});
test('user-owned config/launchers and symlinks are not overwritten', () => {
  const x=fixture();
  try {
    fs.writeFileSync(path.join(x.root,'Start-Trinity-OneDrive.cmd'),'USER SCRIPT');
    prepare(x.root,x.backups);
    assert.equal(fs.readFileSync(path.join(x.root,'Start-Trinity-OneDrive.cmd'),'utf8'),'USER SCRIPT');
    const cfg=path.join(x.root,'Trinity/wrangler.ai-local.jsonc');
    fs.writeFileSync(cfg,'USER CONFIG');
    assert.throws(()=>prepare(x.root,x.backups),/not owned/);
    assert.equal(fs.readFileSync(cfg,'utf8'),'USER CONFIG');
    fs.unlinkSync(cfg);
    const outside=path.join(x.tmp,'outside.json');fs.writeFileSync(outside,'OUTSIDE');
    fs.symlinkSync(outside,cfg);
    assert.throws(()=>prepare(x.root,x.backups),/Linked/);
    assert.equal(fs.readFileSync(outside,'utf8'),'OUTSIDE');
  } finally {fs.rmSync(x.tmp,{recursive:true,force:true});}
});
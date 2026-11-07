import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sharedMutableBindings,reportEnvironmentIsolation} from '../scripts/cloudflare-env-audit.mjs';

test('tracked staging config has distinct D1, KV and R2 identifiers',()=>{
  const cfg=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
  const report=reportEnvironmentIsolation(cfg);
  assert.equal(report.isolated,true);
  assert.equal(report.checked,'configuration-only');
  assert.deepEqual(report.shared_mutable_resources,[]);
  assert.deepEqual(cfg.routes,[{pattern:'auru.space',custom_domain:true}]);
  assert.deepEqual(cfg.env.staging.routes,[{pattern:'auru.dev',custom_domain:true}]);
  assert.equal(cfg.env.staging.vars.TRINITY_PREVIEW_MODE,undefined);
});
test('staging audit still rejects shared mutable resources',()=>{
  const cfg={
    name:'trinity',d1_databases:[{binding:'DB',database_id:'same-db'}],
    kv_namespaces:[{binding:'CACHE',id:'same-cache'}],
    r2_buckets:[{binding:'DATA',bucket_name:'same-data'}],
    env:{staging:{name:'trinity-staging',
      d1_databases:[{binding:'DB',database_id:'same-db'}],
      kv_namespaces:[{binding:'CACHE',id:'same-cache'}],
      r2_buckets:[{binding:'DATA',bucket_name:'same-data'}]}}
  };
  const report=reportEnvironmentIsolation(cfg);
  assert.equal(report.isolated,false);
  assert.deepEqual(new Set(sharedMutableBindings(cfg).map(x=>x.type)),new Set(['D1','KV','R2']));
  assert.ok(report.shared_mutable_resources.every(x=>x.isolation_verified===false));
});

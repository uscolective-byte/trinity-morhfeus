import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TRINITY_SOURCE} from '../src/version.js';

test('auru.space serves hard production Worker and auru.dev serves isolated staging/development Worker',()=>{
 const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
 assert.equal(config.name,'trinity');
 assert.deepEqual(config.routes,[{pattern:'auru.space',custom_domain:true}]);
 assert.equal(config.vars.TRINITY_ENV,'production');
 assert.equal(config.vars.TRINITY_GITHUB_REPO,TRINITY_SOURCE.repository);
 assert.equal(config.vars.TRINITY_GITHUB_BRANCH,TRINITY_SOURCE.branch);
 assert.equal(Object.hasOwn(config.vars,'GOOGLE_CLIENT_SECRET'),false,'OAuth secrets must not be committed in Wrangler vars');
 const callback=new URL(config.vars.GOOGLE_REDIRECT_URI);
 assert.equal(callback.origin,'https://auru.space');
 assert.ok(['/api/auth/google/callback','/auth/google/callback'].includes(callback.pathname));
 assert.equal(callback.search,'');assert.equal(callback.hash,'');
 const staging=config.env?.staging;
 assert.equal(staging.name,'trinity-staging');
 assert.deepEqual(staging.routes,[{pattern:'auru.dev',custom_domain:true}]);
 assert.equal(staging.vars.TRINITY_ENV,'staging');
 assert.equal(staging.vars.TRINITY_PREVIEW_MODE,undefined);
 assert.deepEqual(staging.triggers,{crons:[]},'staging must not inherit production schedules');
 assert.equal(staging.vars.TRINITY_GITHUB_REPO,TRINITY_SOURCE.repository);
 assert.equal(staging.vars.TRINITY_GITHUB_BRANCH,TRINITY_SOURCE.branch);
 assert.deepEqual(staging.d1_databases.find(binding=>binding.binding==='DB'),{
  binding:'DB',database_name:'trinity-development',database_id:'1cce5249-e044-4c93-868c-0df534a778b5',migrations_dir:'migrations'
 });
 assert.equal(staging.d1_databases.some(binding=>binding.binding==='DB'&&binding.database_name==='trinity-v03'),false);
 assert.ok(staging.kv_namespaces.some(binding=>binding.binding==='Mastermind'));
 assert.ok(staging.r2_buckets.some(binding=>binding.binding==='ARTIFACTS'));
 assert.ok(staging.durable_objects.bindings.some(binding=>binding.name==='Brain'));
 assert.ok(staging.workflows.some(binding=>binding.binding==='OPS_WORKFLOW'));
 assert.equal(staging.services.length,config.services.length);
 assert.ok(staging.services.some(binding=>binding.binding==='KNOWLEDGE_SERVICE'));
 assert.equal(staging.vars.TRINITY_AUTO_IMPROVE,'false');
 assert.equal(staging.vars.TRINITY_AUTO_MERGE,'false');
});

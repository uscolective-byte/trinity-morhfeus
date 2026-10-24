import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TRINITY_SOURCE} from '../src/version.js';

test('one repository and main serve two domains with separate writable storage',()=>{
 const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
 const development=config.env.development;
 for(const [environment,domain,name,mode] of [[config,'auru.space','trinity','production'],[development,'auru.dev','trinity-development','development']]){
  assert.equal(environment.name,name);
  assert.deepEqual(environment.routes,[{pattern:domain,custom_domain:true}]);
  assert.equal(environment.vars.TRINITY_ENV,mode);
  assert.equal(environment.vars.TRINITY_GITHUB_REPO,TRINITY_SOURCE.repository);
  assert.equal(environment.vars.TRINITY_GITHUB_BRANCH,TRINITY_SOURCE.branch);
  assert.equal(Object.hasOwn(environment.vars,'GOOGLE_CLIENT_SECRET'),false,'OAuth secrets must not be committed in Wrangler vars');
  const callback=new URL(environment.vars.GOOGLE_REDIRECT_URI);
  assert.equal(callback.origin,`https://${domain}`);
  assert.ok(['/api/auth/google/callback','/auth/google/callback'].includes(callback.pathname));
  assert.equal(callback.search,'');assert.equal(callback.hash,'');
 }
 for(const [property,key] of [['d1_databases','database_id'],['kv_namespaces','id'],['r2_buckets','bucket_name'],['workflows','name']]){
  const productionResources=new Set(config[property].map(resource=>resource[key]));
  for(const resource of development[property])assert.ok(!productionResources.has(resource[key]),`${property} shares a production resource`);
 }
 assert.deepEqual(development.triggers.crons,[]);
});

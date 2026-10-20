import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hostStudioProject} from '../src/infrastructure.js';
const projectId='11111111-1111-4111-8111-111111111111';
function environment(){const writes=[];return {writes,CF_ACCOUNT_ID:'test-account',CF_API_TOKEN:'test-token',TRINITY_HOSTING_ACCESS_KEY:'test-only-private-key-at-least-32-characters',ARTIFACTS:{get:async()=>({text:async()=>'<html><head></head><body>Private</body></html>'})},DB:{prepare(sql){return {bind(...params){this.params=params;return this;},async first(){return {id:projectId,owner_id:'primary',name:'Test',version:1,html_key:'test.html'};},async all(){return {results:[]};},async run(){writes.push({sql,params:this.params});return {success:true};}};}}};}
test('private hosting compiles access control, stores a verified receipt and never puts the key in URLs or code',async()=>{
 const env=environment(),old=globalThis.fetch;let source='';
 try{globalThis.fetch=async(url,options={})=>{
  if(url.startsWith('https://api.cloudflare.com/')){
   if(options.body instanceof FormData)source=await options.body.get('site.mjs').text();
   return Response.json({success:true,result:url.endsWith('/workers/subdomain')?{subdomain:'test-account'}:{id:'deployment-test'}});
  }
  return options.headers?.Authorization?new Response('<html><head></head><body>Private</body></html>'):new Response('Private',{status:401});
 };
 const receipt=await hostStudioProject(env,{project_id:projectId});assert.equal(receipt.status,'verified');assert.equal(receipt.visibility,'private');assert.match(receipt.url,/workers.dev$/);assert.doesNotMatch(receipt.url,/token|key|#/);assert.equal(source.includes(env.TRINITY_HOSTING_ACCESS_KEY),false);assert.equal(JSON.stringify(receipt).includes(env.TRINITY_HOSTING_ACCESS_KEY),false);assert.match(source,/SHA-256/);assert.equal(env.writes.length,2);
 }finally{globalThis.fetch=old;}
});
test('private hosting requires a separate strong key before provisioning',async()=>{
 const env=environment();delete env.TRINITY_HOSTING_ACCESS_KEY;
 await assert.rejects(()=>hostStudioProject(env,{project_id:projectId}),/HOSTING_ACCESS_KEY/);
 assert.equal(env.writes.length,0);
});

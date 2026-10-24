import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../public/auth-bootstrap.js.txt',import.meta.url),'utf8');
function setup(fetcher,hash='#login='+'a'.repeat(64)){
 const events=[],location={hash,pathname:'/',search:'?auth=pending'};
 const context={fetch:fetcher,AbortSignal,location,history:{replaceState(a,b,url){events.push(['url',url]);location.hash='';}}};
 vm.runInNewContext(source,context);
 return {auth:context.TrinityAuth,events,options:{configure:async()=>events.push(['configure']),initialize:async()=>events.push(['initialize']),lock:()=>events.push(['lock']),notice:message=>events.push(['notice',message])}};
}
test('one-time link is removed before config and initialization follows successful redemption',async()=>{
 const calls=[],s=setup(async(path,options)=>{calls.push([path,JSON.parse(options.body)]);return Response.json({ok:true});});
 await s.auth.start(s.options);
 assert.deepEqual(s.events,[['url','/?auth=pending'],['configure'],['initialize']]);
 assert.equal(calls[0][0],'/api/ops/redeem');assert.equal(calls[0][1].ticket,'a'.repeat(64));
});
test('expired or forbidden ticket shows the server error and never falls back to development login',async()=>{
 for(const status of [401,403]){
  const paths=[],s=setup(async path=>{paths.push(path);return Response.json({error:'Odkaz vypršal.'},{status});});
  await s.auth.start(s.options);
  assert.deepEqual(paths,['/api/ops/redeem']);assert.equal(s.events.some(event=>event[0]==='initialize'),false);
  assert.deepEqual(s.events.slice(-2),[['lock'],['notice','Odkaz vypršal.']]);
 }
});
test('normal login is available when development access is denied; other failures remain visible',async()=>{
 for(const status of [401,403,503]){
  const s=setup(async()=>Response.json({error:'Nedostupné'},{status}),'#dashboard');
  await s.auth.start(s.options);
  assert.equal(s.events.some(event=>event[0]==='initialize'),status!==503);
  assert.equal(s.events.some(event=>event[0]==='notice'),status===503);
 }
});
test('configuration failure clears the ticket and leaves a recoverable login screen',async()=>{
 const s=setup(async()=>{throw new Error('must not fetch');});s.options.configure=async()=>{throw new Error('Konfigurácia nedostupná');};
 await s.auth.start(s.options);
 assert.deepEqual(s.events,[['url','/?auth=pending'],['lock'],['notice','Konfigurácia nedostupná']]);
});
test('invalid JSON, network failure and timeout produce readable errors',async()=>{
 for(const fetcher of [async()=>new Response('<html>error</html>'),async()=>{throw new TypeError('network');},async()=>{throw Object.assign(new Error('timeout'),{name:'TimeoutError'});}]){
  const s=setup(fetcher);await s.auth.start(s.options);
  assert.equal(s.events.at(-1)[0],'notice');assert.ok(s.events.at(-1)[1].length>20);
  assert.equal(s.events.some(event=>event[0]==='initialize'),false);
 }
});

test('login configuration rejects invalid JSON shapes instead of silently enabling a fallback',async()=>{
 for(const data of [null,{},[],{google_enabled:true},{google_enabled:'false',google_required:false}]){
  const s=setup(async()=>Response.json(data));await assert.rejects(s.auth.config(),/Konfigurácia prihlásenia/);
 }
 const data={google_enabled:true,google_required:true};
 assert.deepEqual(await setup(async()=>Response.json(data)).auth.config(),data);
});

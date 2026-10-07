import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {fileURLToPath} from 'node:url';
const mf=new Miniflare(convertV4MiniflareOptions({workers:[
 {name:'knowledge',compatibilityDate:'2026-10-01',modules:[{type:'ESModule',path:fileURLToPath(new URL('../dist/index.js',import.meta.url))}],durableObjects:{KNOWLEDGE:{className:'KnowledgeStore',useSQLite:true}}},
 {name:'caller',compatibilityDate:'2026-10-01',modules:true,serviceBindings:{KNOW:'knowledge'},script:`export default {async fetch(r,env){const {method,input}=await r.json();try{return Response.json(await env.KNOW[method](input));}catch{return new Response('Rejected',{status:400});}}};`}
]}));
after(()=>mf.dispose());
async function rpc(method,input){return (await mf.getWorker('caller')).fetch('https://internal/',{method:'POST',body:JSON.stringify({method,input})});}
async function data(method,input){const r=await rpc(method,input);assert.equal(r.status,200);return r.json();}
test('imports persist with provenance, digest, chunk retrieval and duplicate detection',async()=>{
 const input={source_id:'owner-project',title:'Trinity project',text:'Úlohy a pamäť Trinity. '.repeat(180)};
 const first=await data('importDocument',input);assert.equal(first.origin,'user-import');assert.match(first.hash,/^[a-f0-9]{64}$/);
 assert.equal((await data('importDocument',input)).unchanged,true);
 assert.equal((await data('getDocument',input.source_id)).text,input.text.trim());
 const found=await data('search','pamäť');assert.ok(found.passages.length>1);assert.equal(found.verified_content,false);assert.equal(found.untrusted_context,true);assert.equal(found.passages[0].source_id,input.source_id);
 await data('importDocument',{...input,text:'New milestone deployment'});
 assert.equal((await data('search','pamäť')).passages.length,0);
 assert.equal((await data('search','deployment')).passages.length,1);
});
test('RPC rejects invalid imports and HTTP exposes nothing',async()=>{
 assert.equal((await rpc('importDocument',{source_id:'bad/id',title:'x',text:'x'})).status,400);
 assert.deepEqual((await data('search','')).passages,[]);
 assert.equal((await (await mf.getWorker('knowledge')).fetch('https://internal/')).status,404);
});

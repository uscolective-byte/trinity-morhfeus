import test from 'node:test';
import assert from 'node:assert/strict';
import {document,terms,htmlText,download} from '../src/policy.js';
test('bounded import and multilingual query validation',()=>{
 assert.throws(()=>document({source_id:'../x',title:'x',text:'x'}));
 assert.throws(()=>document({source_id:'x',title:'x',text:'ž'.repeat(60000)}));
 assert.deepEqual(terms('pamäť PAMÄŤ Trinity'),['pamäť','trinity']);
 assert.equal(htmlText('<script>bad</script><p>Hello &amp; world</p>'),'Hello & world');
});
test('internet sources use fixed catalog and redirects are disabled',async()=>{
 let calls=0;
 const fetcher=async(url,opts)=>{calls++;assert.equal(url,'https://developers.cloudflare.com/workers/');assert.equal(opts.redirect,'error');return new Response('<p>Workers reference</p>',{headers:{'content-type':'text/html'}});};
 assert.equal((await download('cloudflare-workers',fetcher)).text,'Workers reference');
 await assert.rejects(download('https://localhost/',fetcher));assert.equal(calls,1);
});
test('oversized and unsupported downloads are rejected',async()=>{
 await assert.rejects(download('cloudflare-workers',async()=>new Response('a'.repeat(256001),{headers:{'content-type':'text/plain'}})));
 await assert.rejects(download('cloudflare-workers',async()=>new Response('{}',{headers:{'content-type':'application/json'}})));
});

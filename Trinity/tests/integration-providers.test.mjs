import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedSource,scrape,publishFirebase} from '../services/integration-providers.js';
test('source URL allowlist rejects credentials, queries, other hosts and HTTP',()=>{
 for(const url of ['http://firebase.google.com/','https://localhost/','https://firebase.google.com/?token=x','https://x:y@firebase.google.com/'])assert.throws(()=>allowedSource(url));
 assert.equal(allowedSource('https://firebase.google.com/docs/'),'https://firebase.google.com/docs/');
});
test('missing credentials fail before external calls',async()=>{
 const fail=()=>{throw Error('Unexpected network request');};
 await assert.rejects(scrape({}, {url:'https://firebase.google.com/'},fail),e=>e.status===503);
 await assert.rejects(publishFirebase({FIREBASE_PROJECT_ID:'wrong'}, {},fail),e=>e.status===503);
 await assert.rejects(publishFirebase({FIREBASE_PROJECT_ID:'morfeus-ac7ed',FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify({project_id:'wrong'})},{},fail),e=>e.status===503);
});
test('scrape uses v2 markdown API and preserves source in knowledge text',async()=>{
 const result=await scrape({FIRECRAWL_API_KEY:'test-only-key'}, {url:'https://firebase.google.com/docs/'},async(url,opts)=>{
  assert.equal(url,'https://api.firecrawl.dev/v2/scrape');assert.equal(opts.redirect,'error');
  assert.deepEqual(JSON.parse(opts.body).formats,['markdown']);
  return Response.json({success:true,data:{markdown:'Firebase documentation',metadata:{title:'Firebase'}}});
 });
 assert.match(result.source_id,/^firecrawl-[a-f0-9]{40}$/);assert.match(result.text,/Source: https:\/\/firebase.google.com\/docs\//);
});
test('provider failure and excessive content propagate without truncation',async()=>{
 const env={FIRECRAWL_API_KEY:'test-only-key'},input={url:'https://firebase.google.com/'};
 await assert.rejects(scrape(env,input,async()=>new Response('',{status:429})),e=>e.status===429);
 await assert.rejects(scrape(env,input,async()=>Response.json({success:true,data:{markdown:'x'.repeat(100001)}})),e=>e.status===413);
});

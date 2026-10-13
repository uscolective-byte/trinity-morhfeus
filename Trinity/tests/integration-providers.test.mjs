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

test('Firebase signs a verifiable assertion and publishes only service status',async()=>{
 const {generateKeyPairSync,verify}=await import('node:crypto');
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const env={FIREBASE_PROJECT_ID:'morfeus-ac7ed',FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify({project_id:'morfeus-ac7ed',client_email:'test@morfeus-ac7ed.iam.gserviceaccount.com',private_key:privateKey.export({type:'pkcs8',format:'pem'})})};
 let calls=0;
 const result=await publishFirebase(env,{version:'8.0.0',status:'serving',private_chat:'must never export'},async(url,options)=>{
  calls++;
  if(calls===1){
   assert.equal(url,'https://oauth2.googleapis.com/token');
   const jwt=new URLSearchParams(options.body).get('assertion');const [header,payload,signature]=jwt.split('.');
   assert.ok(verify('RSA-SHA256',Buffer.from(header+'.'+payload),publicKey,Buffer.from(signature,'base64url')));
   const claims=JSON.parse(Buffer.from(payload,'base64url'));assert.equal(claims.aud,'https://oauth2.googleapis.com/token');assert.equal(claims.scope,'https://www.googleapis.com/auth/datastore');assert.equal(claims.exp-claims.iat,3600);
   return Response.json({access_token:'test-only-access-token'});
  }
  assert.equal(url,'https://firestore.googleapis.com/v1/projects/morfeus-ac7ed/databases/(default)/documents/trinity_status/current');
  assert.equal(options.method,'PATCH');assert.equal(options.headers.Authorization,'Bearer test-only-access-token');
  const fields=JSON.parse(options.body).fields;assert.deepEqual(Object.keys(fields).sort(),['service','status','updated_at','version']);
  return Response.json({name:'test-document'});
 });
 assert.equal(calls,2);assert.equal(result.published,true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, createSign, webcrypto} from 'node:crypto';
import {configReady, verifyEntraToken, AuthError} from '../src/auth.mjs';
import {handleRequest, tasksEnabled} from '../src/index.mjs';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const tenant = '11111111-2222-4333-8444-555555555555';
const oid = '22222222-3333-4333-8333-666666666666';
const client = '33333333-4444-4444-8444-777777777777';
const audience = 'api://44444444-5555-4555-8555-888888888888';
const {privateKey, publicKey} = generateKeyPairSync('rsa', {modulusLength: 2048});
const key = {...publicKey.export({format: 'jwk'}),kid:'test-signing-key',alg:'RS256',use:'sig'};
const env = () => ({
  ENTRA_TENANT_ID: tenant,
  ENTRA_AUDIENCE: audience,
  ENTRA_ALLOWED_USER_OIDS: oid,
  ENTRA_ALLOWED_CLIENT_IDS: client,
  COPILOT_TRINITY_READ_KEY: 'trn_live_read_test_key',
  COPILOT_TRINITY_TASK_KEY: 'trn_live_task_test_key',
  ENTRA_ENABLE_TASKS: 'true',
  TRINITY: {
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === '/api/health') return Response.json({service:'Trinity',version:'9.4.3',status:'serving',agents:40});
      if (path === '/ready') return Response.json({ready:true,status:'ready',internal_binding_details:'not-exposed'});
      if (path.endsWith('/agents')) return Response.json({agents:[{id:'orchestrator',name:'Trinity',cluster:'Riadenie',private:'hidden'}]});
      if (path === '/api/integrations/copilot/tasks' && request.method === 'POST') {
        const data=await request.json();
        if (/delete everything/i.test(data.message)) return Response.json({error:'not permitted'}, {status:403});
        return Response.json({id:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',status:'queued'}, {status:202});
      }
      if (path.endsWith('/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')) return Response.json({
        id:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',status:'completed',result:'Skutočný výsledok.',secret:'not-exposed'
      });
      return Response.json({error:'missing'}, {status:404});
    }
  }
});
const now = () => Math.floor(Date.now() / 1000);
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function token(overrides = {}) {
  const head = encode({alg:'RS256',typ:'JWT',kid:key.kid});
  const payload = encode({
    ver:'2.0',tid:tenant,iss:`https://login.microsoftonline.com/${tenant}/v2.0`,aud:audience,
    oid,azp:client,scp:'Trinity.Read Trinity.Execute',nbf:now()-10,exp:now()+3600,...overrides
  });
  const signingInput = head+'.'+payload;
  const signature = createSign('RSA-SHA256').update(signingInput).end().sign(privateKey).toString('base64url');
  return signingInput+'.'+signature;
}
const keys = async () => [key];
const authHeaders = () => ({Authorization:'Bearer '+token()});
async function request(path,method='GET',body=null,environment=env()){
  return handleRequest(new Request('https://copilot.test'+path,{
    method,headers:{...authHeaders(),...(body?{'content-type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  }),environment,{getKeys:keys});
}

test('fails closed when tenant, user or client allowlist is missing',()=>{
  assert.equal(configReady(env()),true);
  assert.equal(configReady({...env(),ENTRA_ALLOWED_USER_OIDS:''}),false);
  assert.equal(configReady({...env(),ENTRA_ALLOWED_CLIENT_IDS:'invalid'}),false);
});
test('only one explicitly allowed owner may submit delegated tasks',()=>{
  assert.equal(tasksEnabled(env()),true);
  assert.equal(tasksEnabled({...env(),ENTRA_ALLOWED_USER_OIDS:oid+',aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'}),false);
  assert.equal(tasksEnabled({...env(),ENTRA_ENABLE_TASKS:'false'}),false);
});
test('accepts signed Entra v2 delegated JWT with correct tenant, client, user and scope',async()=>{
  const identity = await verifyEntraToken(token(),env(),keys);
  assert.equal(identity.oid,oid);
  await assert.rejects(()=>verifyEntraToken(token({scp:'Trinity.Read'}),env(),keys,'Trinity.Execute'),
    e=>e instanceof AuthError&&e.status===403);
});
test('rejects invalid signature, audience, tenant, subject and expired token',async()=>{
  const bad=[
    token({aud:'api://wrong'}),token({oid:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'}),
    token({tid:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'}),
    token({exp:now()-120}),
    token().slice(0,-8)+'AAAAAAAA'
  ];
  for(const t of bad)await assert.rejects(()=>verifyEntraToken(t,env(),keys),e=>e instanceof AuthError&&[401,403].includes(e.status));
});
test('unauthenticated request is denied before reaching Trinity',async()=>{
  const response=await handleRequest(new Request('https://copilot.test/v1/trinity/status'),env(),{getKeys:keys});
  assert.equal(response.status,401);
});
test('returns only allowlisted status/readiness/agents fields',async()=>{
  let response=await request('/v1/trinity/status');
  assert.equal(response.status,200);
  assert.deepEqual(Object.keys(await response.json()).sort(),['agents_count','service','status','version']);
  response=await request('/v1/trinity/readiness');
  assert.deepEqual(await response.json(),{ready:true,status:'ready'});
  response=await request('/v1/trinity/agents');
  const result=await response.json();
  assert.equal(result.agents[0].name,'Trinity');
  assert.equal('private' in result.agents[0],false);
});
test('queues delegated tasks, does not claim completion or require SCHVAL',async()=>{
  const response=await request('/v1/trinity/tasks','POST',{message:'Vysvetli architektúru Trinity.'});
  assert.equal(response.status,202);
  const body=await response.json();
  assert.equal(body.status,'queued');
  assert.equal(body.completed,false);
  assert.equal(JSON.stringify(body).includes('SCHVÁĽ'),false);
  const receipt=await request('/v1/trinity/tasks/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
  const result=await receipt.json();
  assert.equal(result.result,'Skutočný výsledok.');
  assert.equal('secret' in result,false);
});
test('rejects blocked tasks and malformed bodies',async()=>{
  const disallowed=await request('/v1/trinity/tasks','POST',{message:'delete everything'});
  assert.equal(disallowed.status,403);
  const malformed=await request('/v1/trinity/tasks','POST',{message:'a',admin:true});
  assert.equal(malformed.status,400);
  const disabled=await request('/v1/trinity/tasks','POST',{message:'Test'},{
    ...env(),ENTRA_ENABLE_TASKS:'false'
  });
  assert.equal(disabled.status,503);
});

test('project edits require separate enablement and Execute scope; receipts remain proposals',async()=>{
 const id='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
 const environment={...env(),ENTRA_ENABLE_PROJECT_EDITS:'true',TRINITY:{async fetch(req){
  assert.equal(new URL(req.url).pathname,'/api/integrations/copilot/project-actions');
  assert.equal((await req.json()).operation,'edit');
  return Response.json({id,status:'proposed',receipt:{secret:'never-forward'}},{status:202});
 }}};
 const payload={operation:'edit',path:'Trinity/src/example.js',content:'export const x=1;',rationale:'Improve the source file'};
 const r=await request('/v1/trinity/project-actions','POST',payload,environment);
 assert.equal(r.status,202);assert.deepEqual(await r.json(),{id,status:'proposed',approval_required:true,completed:false});
 assert.equal((await request('/v1/trinity/project-actions','POST',payload,env())).status,503);
 const denied=await handleRequest(new Request('https://copilot.test/v1/trinity/project-actions',{method:'POST',headers:{Authorization:'Bearer '+token({scp:'Trinity.Read'}),'content-type':'application/json'},body:JSON.stringify(payload)}),environment,{getKeys:keys});
 assert.equal(denied.status,403);
});

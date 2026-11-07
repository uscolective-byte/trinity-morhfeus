import test from 'node:test';
import assert from 'node:assert/strict';
import {accessHeaders, diagnoseAccess, probeEndpoint, readAccessMetadata,
  resolveEnvCredentials, targetsWorker, validateOrigin, verifyMcp} from '../scripts/lib/cloudflare-access.mjs';

const credentials = {CLOUDFLARE_ACCESS_CLIENT_ID: 'fixture-client', CLOUDFLARE_ACCESS_CLIENT_SECRET: 'fixture-secret'};

test('missing credentials do not manufacture a service identity', () => {
  assert.deepEqual(accessHeaders({}), {});
});

test('both documented credential aliases resolve without mixing pairs', () => {
  assert.deepEqual(accessHeaders(credentials), {'CF-Access-Client-Id': 'fixture-client', 'CF-Access-Client-Secret': 'fixture-secret'});
  assert.deepEqual(accessHeaders({CF_ACCESS_CLIENT_ID: 'short-id', CF_ACCESS_CLIENT_SECRET: 'short-secret'}),
    {'CF-Access-Client-Id': 'short-id', 'CF-Access-Client-Secret': 'short-secret'});
});

test('partial or conflicting alias pairs fail closed', () => {
  assert.throws(() => accessHeaders({CLOUDFLARE_ACCESS_CLIENT_ID: 'one'}), /incomplete_access_credentials/);
  assert.throws(() => accessHeaders({...credentials, CF_ACCESS_CLIENT_ID: 'other', CF_ACCESS_CLIENT_SECRET: 'other-secret'}),
    /conflicting_access_credentials/);
});

test('equal complete aliases are accepted without exposing a second identity', () => {
  assert.equal(accessHeaders({...credentials, CF_ACCESS_CLIENT_ID: 'fixture-client', CF_ACCESS_CLIENT_SECRET: 'fixture-secret'})['CF-Access-Client-Id'], 'fixture-client');
});

test('only exact Trinity HTTPS origins can receive authentication', () => {
  assert.equal(validateOrigin('https://auru.space'), 'https://auru.space');
  assert.equal(validateOrigin('https://auru.dev/'), 'https://auru.dev');
  for (const value of ['http://auru.space', 'https://auru.space.attacker.example', 'https://auru.space/mcp', 'https://user:pass@auru.space', 'https://auru.space/?key=x'])
    assert.throws(() => validateOrigin(value));
});

test('an Access login redirect is identified without following or disclosing its query', async () => {
  let calls = 0;
  const result = await probeEndpoint({origin: 'https://auru.space', path: '/health', headers: accessHeaders(credentials),
    fetcher: async (url, init) => {
      calls++; assert.equal(url, 'https://auru.space/health'); assert.equal(init.redirect, 'manual');
      return new Response(null, {status: 302, headers: {location: 'https://team.cloudflareaccess.com/cdn-cgi/access/login?token=must-not-print'}});
    }});
  assert.equal(calls, 1); assert.equal(result.access_login_redirect, true); assert.equal(result.application_json, false);
  assert.doesNotMatch(JSON.stringify(result), /must-not-print|fixture-secret/);
});

test('application JSON is filtered rather than echoing upstream credentials or arbitrary fields', async () => {
  const result = await probeEndpoint({origin:'https://auru.space', path:'/ready', fetcher: async () => Response.json({
    ready: true, version: '11.1.0', environment: 'production', OPENAI_API_KEY: 'private-fixture', deployment: {id: 'version-id', secret: 'also-private'}
  })});
  assert.equal(result.ready, true); assert.equal(result.application_json, true);
  assert.doesNotMatch(JSON.stringify(result), /private-fixture|also-private|OPENAI_API_KEY/);
});

test('HTML with HTTP200 is not an application readiness pass', async () => {
  const result = await probeEndpoint({origin:'https://auru.space', path:'/ready', fetcher: async () =>
    new Response('<h1>Login</h1>', {headers:{'Content-Type':'text/html'}})});
  assert.equal(result.application_json, false);
});

test('oversized JSON cannot consume an unbounded diagnostic response', async () => {
  await assert.rejects(probeEndpoint({origin:'https://auru.space', path:'/health', fetcher: async () =>
    Response.json({data: 'x'.repeat(70000)})}), /response_too_large/);
});

test('an unsupported probe path is rejected before network access', async () => {
  await assert.rejects(probeEndpoint({origin:'https://auru.space', path:'/api/delete', fetcher: () => { throw new Error('must not fetch'); }}), /probe_path_not_allowed/);
});

test('native Workers destinations are recognized even when the app has no domain field', () => {
  assert.equal(targetsWorker({destinations:[{type:'worker',worker_id:'native-worker'}]}, {workerId:'native-worker',hostname:'auru.space'}), 'specific_worker');
  assert.equal(targetsWorker({destinations:[{type:'all_workers'}]}, {workerId:'native-worker',hostname:'auru.space'}), 'all_workers');
  assert.equal(targetsWorker({domain:'auru.space/mcp'}, {workerId:'native-worker',hostname:'auru.space'}), 'hostname');
  assert.equal(targetsWorker({destinations:[{type:'worker',worker_id:'different'}]}, {workerId:'native-worker',hostname:'auru.space'}), null);
});

test('metadata requests stay on the fixed Cloudflare API origin and retain only policy metadata', async () => {
  const calls=[];
  const metadata = await readAccessMetadata({accountId:'a'.repeat(32),appId:'018042bf-984f-4cf6-bf68-cbb760d9a6da',apiToken:'private-api-fixture',
    fetcher:async (url,init) => {
      calls.push(url);assert.equal(init.redirect,'error');assert.equal(new URL(url).origin,'https://api.cloudflare.com');
      return Response.json({success:true,result:url.endsWith('/policies') ? [{id:'policy',name:'Agents',decision:'non_identity',
        include:[{service_token:{token_id:'service-id'}}],require:[],exclude:[],unexpected_secret:'do-not-print'}] :
        {id:'app',name:'Trinity',type:'self_hosted',destinations:[{type:'worker',worker_id:'worker'}],client_secret:'do-not-print'}});
    }});
  assert.equal(calls.length,2);assert.deepEqual(metadata.policies[0].service_token_ids,['service-id']);
  assert.doesNotMatch(JSON.stringify(metadata), /private-api-fixture|do-not-print|client_secret/);
});

test('missing credentials and login redirects produce an honest incomplete report', async () => {
  const report = await diagnoseAccess({env:{},fetcher:async()=>new Response(null,{status:302,headers:{location:'https://team.cloudflareaccess.com/login'}})});
  assert.equal(report.credentials_configured,false);assert.equal(report.access_verified,false);assert.equal(report.application_ready,false);
  assert.equal(report.authenticated.length,0);assert.equal(report.cloud_mutations_performed,false);
});

test('authenticated probes are separate from anonymous protection checks', async () => {
  const report = await diagnoseAccess({env:credentials,fetcher:async (_url,init)=>init.headers['CF-Access-Client-Id'] ?
    Response.json({version:'11.1.0',ready:true}) : new Response(null,{status:302,headers:{location:'https://team.cloudflareaccess.com/login'}})});
  assert.equal(report.access_verified,true);assert.equal(report.application_ready,true);
  assert.ok(report.anonymous.every(probe=>probe.access_login_redirect));
  assert.doesNotMatch(JSON.stringify(report), /fixture-client|fixture-secret/);
});

test('successful Access authentication does not turn ready:false into a pass', async () => {
  const report=await diagnoseAccess({env:credentials,fetcher:async()=>Response.json({ready:false})});
  assert.equal(report.access_verified,true);assert.equal(report.application_ready,false);
});

test('invalid credential configuration never sends a partial pair', async () => {
  const report=await diagnoseAccess({env:{CLOUDFLARE_ACCESS_CLIENT_ID:'only-one'},fetcher:async(_url,init)=>{
    assert.equal(init.headers['CF-Access-Client-Id'],undefined);return Response.json({ready:true});
  }});
  assert.equal(report.credential_error,'incomplete_access_credentials');assert.equal(report.access_verified,false);
});

test('MCP verification cannot invent success without the application credential', async () => {
  assert.deepEqual(await verifyMcp({origin:'https://auru.space',env:{}}), {verified:false,reason:'trinity_mcp_credential_missing'});
});

test('real MCP SDK initialization and tool catalog use both layers of auth without invoking tools', async () => {
  const methods=[];
  const fetcher=async (_url,init)=>{
    assert.equal(init.redirect,'error');
    const headers=new Headers(init.headers);
    assert.equal(headers.get('CF-Access-Client-Secret'),'fixture-secret');
    assert.equal(headers.get('Authorization'),'Bearer fixture-mcp');
    if(init.method==='GET')return new Response(null,{status:405});
    const request=JSON.parse(String(init.body));methods.push(request.method);
    if(request.method==='notifications/initialized')return new Response(null,{status:202});
    const result=request.method==='initialize'?{protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'fixture',version:'1'}}:
      {tools:[{name:'trinity_status',inputSchema:{type:'object'}}]};
    return Response.json({jsonrpc:'2.0',id:request.id,result});
  };
  const result=await verifyMcp({origin:'https://auru.space',env:{...credentials,TRINITY_MCP_API_KEY:'fixture-mcp'},fetcher});
  assert.equal(result.verified,true);assert.equal(result.tools_count,1);assert.equal(result.mutating_tools_called,false);
  assert.deepEqual(methods,['initialize','notifications/initialized','tools/list']);
});

test('TRINITY_MCP_TOKEN alias is accepted for MCP verification', async () => {
  const fetcher = async (_url, init) => {
    const headers = new Headers(init.headers);
    assert.equal(headers.get('Authorization'), 'Bearer token-alias');
    if (init.method === 'GET') return new Response(null, {status: 405});
    const request = JSON.parse(String(init.body));
    if (request.method === 'notifications/initialized') return new Response(null, {status: 202});
    const result = request.method === 'initialize'
      ? {protocolVersion: '2025-11-25', capabilities: {tools: {}}, serverInfo: {name: 'fixture', version: '1'}}
      : {tools: [{name: 'trinity_status', inputSchema: {type: 'object'}}]};
    return Response.json({jsonrpc: '2.0', id: request.id, result});
  };
  const result = await verifyMcp({origin: 'https://auru.space', env: {...credentials, TRINITY_MCP_TOKEN: 'token-alias'}, fetcher});
  assert.equal(result.verified, true);
  assert.equal(result.tools_count, 1);
});

test('resolveEnvCredentials preserves existing environment credentials without mutating input', () => {
  const custom = {
    CLOUDFLARE_ACCESS_CLIENT_ID: 'custom-id',
    CLOUDFLARE_ACCESS_CLIENT_SECRET: 'custom-secret',
    TRINITY_MCP_API_KEY: 'custom-key'
  };
  const resolved = resolveEnvCredentials(custom);
  assert.equal(resolved.CLOUDFLARE_ACCESS_CLIENT_ID, 'custom-id');
  assert.equal(resolved.CLOUDFLARE_ACCESS_CLIENT_SECRET, 'custom-secret');
  assert.equal(resolved.TRINITY_MCP_API_KEY, 'custom-key');
});

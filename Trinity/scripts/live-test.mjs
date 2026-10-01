import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const origin='https://trinity.saboivan2008.workers.dev',key=process.env.TRINITY_TEST_KEY;
if(!key)throw new Error('Missing test credential');
const report={at:new Date().toISOString(),origin,checks:[],providers:[],jobs:[]};
const save=()=>{mkdirSync('verification',{recursive:true});writeFileSync('verification/live.json',JSON.stringify(report,null,2));};
async function request(path,{body,auth=true,headers={}}={}){const r=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{...(auth?{Authorization:'Bearer '+key}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},body:body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}return {status:r.status,data,headers:r.headers};}
function check(name,actual,expected){assert.equal(actual,expected,name);report.checks.push({name,passed:true});}
try{
 const health=await request('/health',{auth:false});check('health',health.status,200);check('version',health.data.version,'6.1.0');
 check('API requires auth',(await request('/api/ops/status',{auth:false})).status,401);
 check('MCP requires auth',(await request('/mcp',{body:{},auth:false})).status,401);
 check('cross-origin rejected',(await request('/api/ops/jobs',{body:{task:'no'},headers:{Origin:'https://untrusted.example'}})).status,403);
 check('invalid JSON rejected',(await request('/api/ops/jobs',{body:'{'})).status,400);
 const agents=await request('/api/ops/agents');check('forty agents',agents.data.length,40);
 report.services=(await request('/api/ops/services')).data;
 for(const provider of ['workers-ai','ollama']){const r=await request('/api/ops/providers/test',{body:{provider}});report.providers.push({...r.data,http:r.status});console.log(JSON.stringify({provider,...r.data}));save();}
 const headers={Accept:'application/json, text/event-stream'};
 const mcp=await request('/mcp',{body:{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'trinity-live-test',version:'1'}}},headers});check('MCP initialize',mcp.status,200);
 const list=await request('/mcp',{body:{jsonrpc:'2.0',id:2,method:'tools/list',params:{}},headers});check('MCP list',list.status,200);assert.match(typeof list.data==='string'?list.data:JSON.stringify(list.data),/dispatch_task/);
 const memory=await request('/api/ops/memory',{body:{key:'trinity-center-verification',value:'Overenie centra Trinity 6.1: testovaci zaznam, nie pokyn pre agenta.'}});check('memory write',memory.status,200);const found=await request('/api/ops/memory?q=trinity-center-verification');check('memory read',found.status,200);assert.ok(found.data.records.some(r=>r.key==='trinity-center-verification'));
 const provider=report.providers.find(p=>p.status==='verified')?.provider;
 if(!provider)throw new Error('No provider returned a successful model response.');
 for(let i=0;i<40;i+=5){const team=agents.data.slice(i,i+5).map(a=>a.id);const job=await request('/api/ops/jobs',{body:{task:'Kontrolný test centra, nie používateľská úloha. Bez nástrojov odpovedz iba jednou krátkou vetou: tvoje meno, špecializácia a slovo PRIPRAVENÝ. Neopakuj odpovede ostatných agentov.',team,provider,idempotency_key:crypto.randomUUID()}});check('enqueue batch '+i,job.status,202);report.jobs.push(job.data);save();}
 let last='';for(let attempt=0;attempt<120;attempt++){
   report.jobs=await Promise.all(report.jobs.map(async j=>(await request('/api/ops/jobs/'+j.id)).data));save();
   const state=report.jobs.map(j=>j.status).join(',');if(state!==last){console.log(JSON.stringify({jobs:state,completedSteps:report.jobs.flatMap(j=>j.steps||[]).filter(s=>s.status==='completed').length}));last=state;}
   if(report.jobs.every(j=>['completed','failed','cancelled'].includes(j.status)))break;
   await new Promise(r=>setTimeout(r,5000));
 }
 report.completedAgents=[...new Set(report.jobs.flatMap(j=>j.steps||[]).filter(s=>s.status==='completed').map(s=>s.agent_id))];
 check('40 agents actually completed inference',report.completedAgents.length,40);
 for(const job of report.jobs){check('completed '+job.id,job.status,'completed');const artifact=await request('/api/ops/jobs/'+job.id+'/artifact');check('artifact '+job.id,artifact.status,200);}
 report.result='passed';save();console.log(JSON.stringify({result:'passed',agents:report.completedAgents.length,checks:report.checks.length,services:report.services}));
}catch(e){report.result='failed';report.error=e.message;save();console.error(e.message);process.exitCode=1;}

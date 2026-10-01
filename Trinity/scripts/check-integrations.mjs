import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const key=process.env.TRINITY_TEST_KEY,origin='https://trinity.saboivan2008.workers.dev';
const report=JSON.parse(readFileSync('verification/live.json','utf8'));
async function api(path,body,headers={}){const r=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(90000)});const text=await r.text();if(!r.ok)throw new Error(path+' HTTP '+r.status+' '+text.slice(0,1000));return text.startsWith('event:')?text:JSON.parse(text);}
report.providers=[];for(const provider of ['workers-ai','ollama'])report.providers.push(await api('/api/ops/providers/test',{provider}));
report.services=await api('/api/ops/services');
const jobs=[];
for(const task of [
 {agent:'memory-curator',provider:'workers-ai',task:'Kontrolný test. Použi nástroj search_memory s query trinity-center-verification. Potom stručne uveď obsah nájdeného záznamu a že si ho skutočne prečítal. Nevymýšľaj záznam.'},
 {agent:'researcher',provider:'ollama',task:'Kontrolný test webového nástroja. Použi web_search s query Cloudflare MCP createMcpHandler documentation. Potom uveď jediný nájdený odkaz na oficiálnu dokumentáciu. Nepíš návod.'}
])jobs.push(await api('/api/ops/jobs',{...task,idempotency_key:crypto.randomUUID()}));
for(let t=0;t<90;t++){
 report.integrationJobs=await Promise.all(jobs.map(j=>api('/api/ops/jobs/'+j.id)));
 if(report.integrationJobs.every(j=>['completed','failed'].includes(j.status)))break;
 await new Promise(r=>setTimeout(r,4000));
}
const mc=await api('/mcp',{jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'search_memory',arguments:{query:'trinity-center-verification'}}},{Accept:'application/json, text/event-stream'});
report.mcpMemoryVerified=JSON.stringify(mc).includes('trinity-center-verification');
report.integrationCheckedAt=new Date().toISOString();
writeFileSync('verification/live.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({providers:report.providers,services:report.services.map(s=>({binding:s.binding,status:s.status})),integrations:report.integrationJobs.map(j=>({id:j.id,status:j.status,result:j.result,error:j.error,tools:j.steps.map(s=>s.tool_log)})),mcp:report.mcpMemoryVerified}));
assert.ok(report.providers.every(p=>p.status==='verified'));
assert.ok(report.services.every(s=>s.status==='reachable'));
for(const j of report.integrationJobs){assert.equal(j.status,'completed');assert.ok(j.steps.some(s=>s.tool_log.some(t=>t.status==='completed')));}

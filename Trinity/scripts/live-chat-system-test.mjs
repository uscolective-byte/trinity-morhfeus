import {writeFileSync} from 'node:fs';
const key=process.env.TRINITY_TEST_KEY;if(!key)throw new Error('TRINITY_TEST_KEY is required.');
const base='https://auru.dev';const headers={Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
async function api(path,options={}){const response=await fetch(base+path,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(25_000)});const text=await response.text();let data={};try{data=JSON.parse(text);}catch{}if(!response.ok)throw new Error(`${path} ${response.status}: ${data.error||text}`);return data;}
const before=await api('/api/system/actions');const known=new Set(before.items.map(item=>item.id));
const job=await api('/api/ops/jobs',{method:'POST',body:JSON.stringify({task:'Použi interný nástroj request_system_action. Vytvor bezpečný návrh read pre súbor README.md s dôvodom overenie spojenia. Ak nástroj vráti ID, povedz mi jeho stav.',team:['orchestrator'],provider:'workers-ai',language:'sk',idempotency_key:crypto.randomUUID()})});
let final;for(let attempt=0;attempt<80;attempt++){await new Promise(resolve=>setTimeout(resolve,750));final=await api(`/api/ops/jobs/${job.id}`);if(['completed','failed'].includes(final.status))break;}
const after=await api('/api/system/actions');const created=after.items.find(item=>!known.has(item.id)&&item.requested_by==='agent:orchestrator');
const result={checked_at:new Date().toISOString(),job_id:job.id,job_status:final?.status,result:final?.result||null,system_action:created?{id:created.id,action:created.action,status:created.status,requested_by:created.requested_by}:null};
writeFileSync(new URL('../verification/system-capabilities-chat-live.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
if(final?.status!=='completed'||!created)process.exitCode=1;

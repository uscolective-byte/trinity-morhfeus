import {writeFileSync} from 'node:fs';

const key=process.env.TRINITY_TEST_KEY;if(!key)throw new Error('TRINITY_TEST_KEY is required.');
const base=(process.env.TRINITY_URL||'https://auru.dev').replace(/\/$/,'');
const auth={Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
async function api(path,body){const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:auth,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30_000)});const text=await response.text();let data={};try{data=JSON.parse(text);}catch{}if(!response.ok)throw new Error(`${path} HTTP ${response.status}: ${data.error||'invalid response'}`);return data;}
const session=crypto.randomUUID();
const job=await api('/api/assistant/chat',{message:'Odpovedz jednou krátkou vetou po slovensky: lokálne PC prepojenie funguje.',session,language:'sk',engine:'local',remember:false,allow_files:false});
let completedJob;
for(let i=0;i<150;i++){await new Promise(resolve=>setTimeout(resolve,1500));const current=await api('/api/ops/jobs/'+job.id);if(['completed','failed'].includes(current.status)){completedJob=current;break;}}
if(!completedJob||completedJob.status!=='completed')throw new Error(completedJob?.error||'Lokálny model nedokončil test.');
const desktop=await api('/api/system/actions',{action:'run',payload:{task:'desktop-control',operation:'launch',app:'calculator'},rationale:'Živý test povoleného ovládania počítača'});
await api(`/api/system/actions/${desktop.action.id}/approve`,{confirmation:desktop.action.id});
let completedDesktop;
for(let i=0;i<40;i++){await new Promise(resolve=>setTimeout(resolve,750));const current=await api(`/api/system/actions/${desktop.action.id}`);if(['completed','failed'].includes(current.action.status)){completedDesktop=current.action;break;}}
if(!completedDesktop||completedDesktop.status!=='completed')throw new Error(completedDesktop?.error||'Desktop test sa nedokončil.');
if(completedDesktop.receipt?.desktop?.opened!==true)throw new Error('Desktop akcia nemá potvrdené otvorené okno.');
const result={checked_at:new Date().toISOString(),worker_version:(await api('/health')).version,gateway:'connected',local_job_id:job.id,local_job_status:completedJob.status,local_model:completedJob.steps?.at(-1)?.model||null,local_response:completedJob.result?.slice(0,500),desktop_action_id:desktop.action.id,desktop_status:completedDesktop.status,desktop_receipt:completedDesktop.receipt};
writeFileSync(new URL('../verification/pc-bridge-live.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));

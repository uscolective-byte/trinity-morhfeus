import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const key=process.env.TRINITY_TEST_KEY;
if(!key)throw new Error('TRINITY_TEST_KEY is required.');
const base=(process.env.TRINITY_URL||'https://auru.dev').replace(/\/$/,'');
const target='Trinity/verification/system-capabilities-6.4-live.txt';
const full=new URL('../verification/system-capabilities-6.4-live.txt',import.meta.url);
const auth={Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
async function api(path,options={}){const response=await fetch(base+path,{...options,headers:{...auth,...options.headers},signal:AbortSignal.timeout(20_000)});const text=await response.text();let data={};try{data=JSON.parse(text);}catch{}if(!response.ok)throw new Error(`${path} HTTP ${response.status}: ${data.error||text}`);return data;}
const existing=existsSync(full);const expected=existing?createHash('sha256').update(readFileSync(full)).digest('hex'):'absent';
const content=`TRINITY SYSTEM CAPABILITIES 6.4 LIVE VERIFIED\nCloud -> Local Gateway -> Morhfeus -> Cloud receipt\n${new Date().toISOString()}\n`;
const created=await api('/api/system/actions',{method:'POST',body:JSON.stringify({action:existing?'edit':'write',payload:{path:target,expected_sha256:expected,content},rationale:'Live end-to-end verification of the private local gateway'})});
const id=created.action.id;
await api(`/api/system/actions/${id}/approve`,{method:'POST',body:JSON.stringify({confirmation:id})});
let final;
for(let attempt=0;attempt<40;attempt++){await new Promise(resolve=>setTimeout(resolve,750));const state=await api(`/api/system/actions/${id}`);if(['completed','failed'].includes(state.action.status)){final=state.action;break;}}
if(!final)throw new Error('System action did not finish.');
const [health,status,gatewayHealth]=await Promise.all([api('/health'),api('/api/assistant/status'),fetch('http://127.0.0.1:8791/health').then(r=>r.json())]);
const result={checked_at:new Date().toISOString(),worker_version:health.version,gateway_health:gatewayHealth,action_id:id,action:final.action,status:final.status,receipt:final.receipt,error:final.error,file_exists:existsSync(full),system_tools_public:status.tools.some(tool=>/system_action|selfwrite|deploy/.test(tool))};
writeFileSync(new URL('../verification/system-capabilities-live.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
if(result.status!=='completed'||!result.file_exists||result.system_tools_public)process.exitCode=1;

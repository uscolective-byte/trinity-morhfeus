import {writeFileSync} from 'node:fs';

const key=process.env.TRINITY_TEST_KEY;
if(!key)throw new Error('TRINITY_TEST_KEY is required.');
const base=(process.env.TRINITY_URL||'https://auru.dev').replace(/\/$/,'');
const response=await fetch(base+'/api/assistant/studio/projects',{
  method:'POST',
  headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
  body:JSON.stringify({name:'Trinity Studio Live Test',prompt:'Vytvor moderný jednostránkový web pre kreatívne štúdio Morhfeus. Použi tmavomodrú, fialovú a koralovú, výrazný úvod, tri služby a kontaktnú výzvu bez formulára.'}),
  signal:AbortSignal.timeout(140000)
});
const text=await response.text();let data={};try{data=JSON.parse(text);}catch{}
if(!response.ok)throw new Error(`Studio HTTP ${response.status}: ${data.error||'invalid response'}`);
const project=data.project||{},result={
  checked_at:new Date().toISOString(),
  endpoint:base,
  project_id:project.id,
  name:project.name,
  version:project.version,
  status:project.status,
  model:project.versions?.[0]?.model||null,
  html_complete:/<!doctype html>/i.test(project.html)&&/<\/html>/i.test(project.html),
  csp_present:/content-security-policy/i.test(project.html),
  html_size:new TextEncoder().encode(project.html||'').length
};
writeFileSync(new URL('../verification/studio-live.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
if(!result.project_id||result.version!==1||!result.html_complete||!result.csp_present)process.exitCode=1;

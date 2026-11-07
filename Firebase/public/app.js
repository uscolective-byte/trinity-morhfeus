'use strict';
const state=document.getElementById('state');
const detail=document.getElementById('detail');
fetch('https://auru.space/health',{
  headers:{Accept:'application/json'},signal:AbortSignal.timeout(5000),redirect:'error'
}).then(async response=>{
  if(!response.ok)throw new Error('Health request failed');
  const data=await response.json();
  if(data.service!=='Trinity'||data.status!=='serving'||data.environment!=='production'||
    typeof data.version!=='string')throw new Error('Invalid health response');
  document.getElementById('signal').classList.add('online');
  state.textContent='Trinity '+data.version+' je online';
  detail.textContent='Cloudflare · '+data.status+' · overené '+new Date().toLocaleTimeString('sk-SK');
}).catch(()=>{
  state.textContent='Spojenie sa nepodarilo overiť';
  detail.textContent='Stav produkčného jadra momentálne nie je overený.';
});

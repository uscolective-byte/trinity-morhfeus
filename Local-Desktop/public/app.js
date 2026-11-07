/**
 * @module TRINITY_OMNI_CORE
 * @subsystem LOCAL_DESKTOP_UI
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Modul app.js (Local-Desktop/public/app.js) v ekosystéme TRINITY OMNI-CORE.
 */
const $=id=>document.getElementById(id);
const fragment=new URLSearchParams(location.hash.slice(1));
if(fragment.get('token')){sessionStorage.setItem('trinity-token',fragment.get('token'));history.replaceState(null,'',location.pathname);}
const token=sessionStorage.getItem('trinity-token')||'';
let activeProvider='ollama';
let session=localStorage.getItem('trinity-session')||crypto.randomUUID(),sha=null,openedPath=null,pending=false;
localStorage.setItem('trinity-session',session);
async function api(path,body){const response=await fetch(path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});const value=await response.json();if(!response.ok)throw new Error(value.error||'Operácia zlyhala.');return value;}
function notice(text,success=false){$('notice').hidden=false;$('notice').textContent=text;$('notice').classList.toggle('success',success);}
async function streamTrinityChat(input,bubble){
  const response=await fetch('/api/chat/stream',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(input)});
  if(!response.ok){const value=await response.json();throw new Error(value.error||'Trinity odmietla požiadavku.');}
  const reader=response.body.getReader(),decoder=new TextDecoder(),parts=new Map();let buffer='',result;
  while(true){const {done,value}=await reader.read();buffer+=decoder.decode(value||new Uint8Array(),{stream:!done});const blocks=buffer.split(/\r?\n\r?\n/);buffer=blocks.pop();
    for(const block of blocks){const data=block.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');if(!data)continue;const event=JSON.parse(data);
      if(event.type==='trinity.chat.error')throw new Error(event.error);
      if(event.type==='trinity.chat.result')result=event.result;
      if(event.type==='agent.session.turn.output_text.delta'||event.type==='agent.session.turn.output_text.done'){
        const key=[event.item_id,event.output_index,event.content_index].join(':');parts.set(key,event.type.endsWith('.done')?event.text:(parts.get(key)||'')+(event.delta||''));bubble.textContent=[...parts.values()].join('\n');
      }
    }if(done)break;
  }
  if(!result)throw new Error('Stream sa prerušil bez potvrdeného výsledku. Pôvodná úloha sa automaticky neopakuje.');return result;
}
function protect(fn){return async event=>{try{await fn(event);}catch(error){notice(error.message);}};}
function switchView(view){for(const el of document.querySelectorAll('.view'))el.hidden=el.id!=='view-'+view;for(const el of document.querySelectorAll('nav button'))el.classList.toggle('active',el.dataset.view===view);$('page-title').textContent=({chat:'Rozhovor',files:'Súbory',notes:'Pamäť',settings:'Nastavenia',connections:'Prepojenia',tasks:'Úlohy',apps:'Aplikácie & Auth'})[view]||'Rozhovor';if(view==='files')loadFiles().catch(e=>notice(e.message));if(view==='notes')loadNotes().catch(e=>notice(e.message));if(view==='tasks')loadTasks().catch(e=>notice(e.message));if(view==='connections')loadStatus().catch(e=>notice(e.message));if(view==='apps')loadDesktopApprovals().catch(e=>notice(e.message));}
for(const button of document.querySelectorAll('nav button'))button.addEventListener('click',()=>switchView(button.dataset.view));
function openMediaModal({type,src,title='Médiá Trinity'}){
  const modal=$('media-modal'),body=$('media-modal-body'),titleEl=$('media-modal-title'),dl=$('media-modal-download');
  if(!modal||!body)return;
  body.innerHTML='';
  titleEl.textContent=title;
  dl.href=src;
  dl.download=title.replace(/[^a-z0-9_-]/gi,'_');
  if(type==='image'){
    const img=document.createElement('img');img.src=src;img.alt=title;body.append(img);
  }else if(type==='video'){
    const vid=document.createElement('video');vid.src=src;vid.controls=true;vid.autoplay=true;body.append(vid);
  }else if(type==='audio'){
    const aud=document.createElement('audio');aud.src=src;aud.controls=true;aud.autoplay=true;body.append(aud);
  }
  modal.hidden=false;
}

function speakText(text,btn=null){
  if(!('speechSynthesis' in window))return;
  if(window.speechSynthesis.speaking){
    window.speechSynthesis.cancel();
    if(btn){btn.textContent='🔊 Prehrať';btn.classList.remove('speaking');}
    return;
  }
  const clean=text.replace(/\x1b\[[0-9;]*m/g,'').replace(/\[[^\]]+\]\([^)]+\)/g,'').slice(0,1000);
  const utter=new SpeechSynthesisUtterance(clean);
  utter.lang='sk-SK';
  utter.rate=1.0;
  if(btn){
    btn.textContent='⏹️ Zastaviť';
    btn.classList.add('speaking');
    utter.onend=()=>{btn.textContent='🔊 Prehrať';btn.classList.remove('speaking');};
    utter.onerror=()=>{btn.textContent='🔊 Prehrať';btn.classList.remove('speaking');};
  }
  window.speechSynthesis.speak(utter);
}

function renderMediaInBubble(bubble,text){
  // Video detection (.mp4, .webm, data:video)
  const videoMatches=Array.from(text.matchAll(/https?:\/\/[^\s"'>]+\.(mp4|webm|mov)|data:video\/[^;]+;base64,[^\s"'>]+/gi));
  for(const vm of videoMatches){
    const vUrl=vm[0];
    const box=document.createElement('div');box.className='media-container';
    box.innerHTML=`<video controls preload="metadata" src="${vUrl}"></video><div class="media-action-bar"><span>🎬 Video záznam</span><button type="button">🔍 Otvoriť vo veľkom prehrávači</button></div>`;
    box.querySelector('button').onclick=()=>openMediaModal({type:'video',src:vUrl,title:'Video záznam'});
    bubble.append(box);
  }

  // Image detection (.png, .jpg, .webp, data:image)
  const imgMatches=Array.from(text.matchAll(/https?:\/\/[^\s"'>]+\.(png|jpe?g|webp|svg|gif)|data:image\/[^;]+;base64,[^\s"'>]+/gi));
  for(const im of imgMatches){
    const iUrl=im[0];
    const box=document.createElement('div');box.className='media-container';
    box.innerHTML=`<img src="${iUrl}" alt="Fotka Trinity" loading="lazy"><div class="media-action-bar"><span>📸 Fotka / Obrázok</span><button type="button">🔍 Otvoriť detail</button></div>`;
    box.querySelector('img').onclick=()=>openMediaModal({type:'image',src:iUrl,title:'Fotka / Obrázok'});
    box.querySelector('button').onclick=()=>openMediaModal({type:'image',src:iUrl,title:'Fotka / Obrázok'});
    bubble.append(box);
  }

  // Audio detection (.mp3, .wav, .ogg, data:audio)
  const audMatches=Array.from(text.matchAll(/https?:\/\/[^\s"'>]+\.(mp3|wav|ogg|m4a)|data:audio\/[^;]+;base64,[^\s"'>]+/gi));
  for(const am of audMatches){
    const aUrl=am[0];
    const box=document.createElement('div');box.className='media-container';
    box.innerHTML=`<audio controls preload="metadata" src="${aUrl}"></audio><div class="media-action-bar"><span>🎵 Zvukový záznam / Hudba</span><button type="button">🔍 Prehrávač</button></div>`;
    box.querySelector('button').onclick=()=>openMediaModal({type:'audio',src:aUrl,title:'Zvukový záznam'});
    bubble.append(box);
  }
}

function append(role,text,receipts=[]){
  const welcome=document.querySelector('.welcome');if(welcome)welcome.remove();
  const wrapper=document.createElement('article');wrapper.className='message '+role;
  const who=document.createElement('div');who.className='who';who.textContent=role==='user'?'Basterix':'Trinity';
  const bubble=document.createElement('div');bubble.className='bubble';bubble.textContent=text;
  
  // Render media attachments
  renderMediaInBubble(bubble,text);

  wrapper.append(who,bubble);

  if(role==='assistant'){
    const footer=document.createElement('div');
    footer.style.cssText='display:flex;gap:8px;align-items:center;margin-top:6px;';
    const spBtn=document.createElement('button');
    spBtn.type='button';
    spBtn.className='speak-btn';
    spBtn.textContent='🔊 Prehrať';
    spBtn.onclick=()=>speakText(text,spBtn);
    footer.append(spBtn);
    wrapper.append(footer);

    if($('auto-speak')?.checked){
      speakText(text,spBtn);
    }
  }

  if(receipts.length){
    const details=document.createElement('div');details.className='receipts';
    details.textContent=receipts.map(r=>(r.success?'✓ ':'✕ ')+r.tool+(r.path?' · '+r.path:'')+(r.error?' · '+r.error:'')).join(' | ');
    wrapper.append(details);
  }
  $('messages').append(wrapper);
  $('messages').scrollTop=$('messages').scrollHeight;
  return bubble;
}
async function loadStatus(){const state=await api('/api/status');const active=state.connections.provider;const ready=active==='ollama'?(state.ollama.available&&state.ollama.model_installed):!!state.connections.configured[active==='cloud'?'cloud-'+state.connections.environment:active];$('connection').textContent=ready?'● '+state.ollama.model+' · lokálne':'○ AI čaká na nastavenie';$('connection').classList.toggle('ready',ready);$('model').value=state.ollama.model;$('model-detail').textContent=ready?'Model je stiahnutý a Ollama odpovedá.':state.ollama.available?'Ollama beží, ale zvolený model nie je stiahnutý. Spusti 2-NASTAVIT-AI.cmd.':state.ollama.error;const c=state.connections;activeProvider=c.provider;$('provider').value=c.provider;$('environment').value=c.environment;$('gemini-model').value=c.gemini_model;$('auto-sync').checked=c.cloud_sync;$('mcp-writes').checked=c.mcp_writes;$('connection-details').textContent=JSON.stringify(c,null,2);if(c.provider!=='ollama'){$('connection').textContent='Trinity · '+c.provider+' · over v Prepojeniach';} $('models').replaceChildren(...state.ollama.models.map(name=>{const option=document.createElement('option');option.value=name;return option;}));$('workspace-path').textContent='Pracovný priestor: '+state.workspace;if(!ready)notice(active==='ollama'?'Rozhranie, súbory a pamäť fungujú. Pre AI chat spusti 2-NASTAVIT-AI.cmd.':'Nastav prístupový kľúč pre zvolený model v Prepojeniach.');if(c.provider==='trinity'){const a=c.trinity_agent;$('connection').textContent=a?.last_error?'Trinity · API zablokované':a?.api_key_configured?'Trinity · API nastavené':'Trinity · chýba API kľúč';$('connection').classList.toggle('ready',a?.last_outcome==='completed');$('model-detail').textContent='OpenAI agent · '+(a?.model||'gpt-6-astra')+'. Prístupový kľúč je uložený na serveri.';if(a?.last_error)notice(a.last_error);}return state;}
$('chat-form').addEventListener('submit',protect(async event=>{event.preventDefault();if(pending)return;
  if(desktopAttachments.length){
    let attText = '';
    for(const att of desktopAttachments){
      if(att.type === 'file' && att.content){
        attText += `\n[Priložený súbor: ${att.name}]\nObsah:\n${att.content.slice(0, 8000)}\n\n`;
      } else if(att.type === 'photo' && att.dataUrl){
        attText += `\n[Priložená fotka: ${att.name}] ${att.dataUrl}\n`;
      } else if(att.type === 'video' && att.src){
        attText += `\n[Priložené video: ${att.name}] ${att.src}\n`;
      } else if(att.type === 'audio' && att.src){
        attText += `\n[Priložený zvuk: ${att.name}] ${att.src}\n`;
      }
    }
    if(attText){
      $('message').value = attText + $('message').value;
      desktopAttachments = [];
      renderDesktopAttachmentTray();
    }
  }const message=$('message').value.trim();if(!message)return;pending=true;$('send').disabled=true;append('user',message);$('message').value='';const bubble=append('assistant','Premýšľam…');try{const input={message,session_id:session,allow_writes:$('allow-writes').checked};const result=activeProvider==='trinity'?await streamTrinityChat(input,bubble):await api('/api/chat',input);bubble.parentElement.remove();append('assistant',result.content,result.receipts);$('notice').hidden=true;}catch(error){bubble.textContent=error.message;notice(error.message);}finally{pending=false;$('send').disabled=false;$('message').focus();}}));
$('message').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();$('chat-form').requestSubmit();}});
for(const button of document.querySelectorAll('[data-prompt]'))button.addEventListener('click',()=>{$('message').value=button.dataset.prompt;$('message').focus();});
$('new-chat').addEventListener('click',()=>{if(pending)return;session=crypto.randomUUID();localStorage.setItem('trinity-session',session);$('messages').replaceChildren();append('assistant','Nový rozhovor je pripravený.');});
async function loadFiles(){const {files}=await api('/api/files');$('file-list').replaceChildren();if(!files.length)$('file-list').textContent='Zatiaľ tu nie sú súbory.';for(const file of files){const button=document.createElement('button');button.textContent=file.path;button.addEventListener('click',protect(async()=>{const value=await api('/api/file?path='+encodeURIComponent(file.path));$('file-name').value=value.path;$('file-content').value=value.content;sha=value.sha256;openedPath=value.path;}));$('file-list').append(button);}}
$('refresh-files').addEventListener('click',protect(loadFiles));
$('new-file').addEventListener('click',()=>{sha=null;openedPath=null;$('file-name').value='';$('file-content').value='';$('file-name').focus();});
$('file-form').addEventListener('submit',protect(async event=>{event.preventDefault();const name=$('file-name').value.trim();const result=await api('/api/file',{path:name,content:$('file-content').value,expected_sha256:name===openedPath?sha:undefined});sha=result.sha256;openedPath=result.path;notice('Súbor je uložený: '+result.path,true);await loadFiles();}));
async function loadNotes(){const {notes}=await api('/api/notes');$('notes-list').replaceChildren();for(const note of notes.slice().reverse()){const card=document.createElement('article');card.className='note-card';const text=document.createElement('p');text.textContent=note.text;const footer=document.createElement('footer');const time=document.createElement('span');time.textContent=new Date(note.created_at).toLocaleString('sk');const remove=document.createElement('button');remove.className='subtle';remove.textContent='Odstrániť';remove.addEventListener('click',protect(async()=>{if(!confirm('Odstrániť túto poznámku?'))return;await api('/api/notes/delete',{id:note.id});await loadNotes();}));footer.append(time,remove);card.append(text,footer);if(note.sync_conflict){const preview=document.createElement('pre');preview.textContent='Cloudová verzia: '+note.sync_conflict.text;card.append(preview);for(const keep of ['local','cloud']){const choose=document.createElement('button');choose.className='secondary';choose.textContent=keep==='local'?'Zachovať lokálnu':'Použiť cloudovú';choose.addEventListener('click',protect(async()=>{await api('/api/cloud/conflict',{id:note.id,keep});await loadNotes();notice('Konflikt vyriešený. Znovu synchronizuj pamäť.',true);}));card.append(choose);}}$('notes-list').append(card);}}
$('note-form').addEventListener('submit',protect(async event=>{event.preventDefault();await api('/api/notes',{text:$('note').value});$('note').value='';await loadNotes();notice('Poznámka je uložená v lokálnej pamäti.',true);}));
$('settings-form').addEventListener('submit',protect(async event=>{event.preventDefault();await api('/api/settings',{model:$('model').value.trim()});await loadStatus();notice('Model bol nastavený.',true);}));
$('refresh-status').addEventListener('click',protect(loadStatus));
$('stop').addEventListener('click',protect(async()=>{if(!confirm('Ukončiť lokálnu Trinity?'))return;await api('/api/shutdown',{});notice('Trinity bola ukončená. Znova ju otvor cez 1-SPUSTIT-TRINITY.cmd.',true);}));
if(!token)notice('Aplikáciu otvor cez 1-SPUSTIT-TRINITY.cmd v rozbalenom priečinku.');else{loadStatus().catch(e=>notice(e.message));api('/api/history?session='+encodeURIComponent(session)).then(({messages})=>{for(const message of messages)append(message.role,message.content);}).catch(e=>notice(e.message));}

$('connections-form').addEventListener('submit',protect(async e=>{e.preventDefault();const input={provider:$('provider').value,environment:$('environment').value,cloud_sync:$('auto-sync').checked,mcp_writes:$('mcp-writes').checked};if($('gemini-model').value.trim())input.gemini_model=$('gemini-model').value.trim();await api('/api/connections',input);notice('Nastavenia sú uložené. Živé spojenie over samostatne.',true);await loadStatus();}));
$('credential-form').addEventListener('submit',protect(async e=>{e.preventDefault();await api('/api/connections',{credential:$('credential').value,value:$('credential-value').value,environment:$('environment').value});$('credential-value').value='';notice('Kľúč bol uložený vo Windows úložisku.',true);await loadStatus();}));
$('verify-gemini').addEventListener('click',protect(async()=>{const result=await api('/api/gemini/models',{});$('gemini-models').replaceChildren(...result.models.map(name=>{const o=document.createElement('option');o.value=name;return o;}));notice('Gemini potvrdilo '+result.models.length+' modelov. Vyber model a ulož nastavenia.',true);}));
$('verify-cloud').addEventListener('click',protect(async()=>{const result=await api('/api/cloud/status');notice('Cloud odpovedá: '+result.mcp_version+' · pripravenosť '+result.ready,true);}));
$('sync-now').addEventListener('click',protect(async()=>{const result=await api('/api/cloud/sync',{});notice('Synchronizácia: '+result.status,result.status==='connected');await loadStatus();}));
$('start-gateway').addEventListener('click',protect(async()=>{await api('/api/gateway/start',{});notice('PC most bol spustený. Stav spojenia over v Prepojeniach.',true);}));
async function loadTasks(){const data=await api('/api/tasks');$('task-list').replaceChildren();for(const task of data.tasks.slice().reverse()){const box=document.createElement('article');box.className='note-card';const title=document.createElement('p');title.textContent=task.task;const status=document.createElement('pre');status.textContent=task.status+' · '+(task.cloud_id||'lokálny outbox')+'\n'+(task.result||task.error||'');box.append(title,status);$('task-list').append(box);}}
$('task-form').addEventListener('submit',protect(async e=>{e.preventDefault();const result=await api('/api/cloud/task',{task:$('task-text').value});notice('Stav úlohy: '+result.status,!!result.cloud_id);$('task-text').value='';await loadTasks();}));
$('refresh-tasks').addEventListener('click',protect(async()=>{await api('/api/tasks/refresh',{});await loadTasks();}));
$('export-data').addEventListener('click',protect(async()=>{const value=await api('/api/export');const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='trinity-pamat-ulohy.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}));

// === Guarded Actions Approval & Desktop Apps Integration ===

async function loadDesktopApprovals(){
  const list = $('desktop-approvals-list');
  if(!list) return;
  list.innerHTML = '<p class="hint">Načítavam čakajúce autorizácie...</p>';
  try {
    const res = await api('/api/system/actions');
    const items = (res.items || []).filter(x => x.status === 'proposed');
    if(!items.length){
      list.innerHTML = '<p class="hint" style="color:#10b981;">✓ Žiadne čakajúce autorizácie. Systém je v bezpečnom stave.</p>';
      return;
    }
    list.innerHTML = '';
    for(const item of items){
      const card = document.createElement('div');
      card.className = 'guarded-approval-card panel';
      card.dataset.actionId = item.id;
      card.style.cssText = 'border:1px solid #f59e0b;padding:12px;border-radius:8px;background:rgba(245,158,11,0.05);margin-bottom:10px;';
      
      const payloadStr = typeof item.payload === 'object' ? JSON.stringify(item.payload, null, 2) : String(item.payload || '');
      
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <b style="color:#f59e0b;font-size:12px;">⚠️ Vyžaduje autorizáciu (${item.action || 'akcia'})</b>
          <small style="font-family:monospace;color:var(--muted);font-size:10px;">${item.id}</small>
        </div>
        <p style="font-size:12px;margin:4px 0;color:var(--text);"><b>Dôvod:</b> ${item.rationale || 'Bez popisu'}</p>
        <pre style="background:#0c131c;padding:8px;border-radius:6px;font-size:11px;max-height:120px;overflow-y:auto;color:#cbd5e1;border:1px solid var(--border);">${payloadStr.slice(0, 500)}</pre>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="approve-btn" style="background:#10b981;color:#fff;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;font-weight:600;font-size:11px;">⚡ Schváliť a vykonať</button>
          <button class="reject-btn" style="background:#ef4444;color:#fff;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;font-weight:600;font-size:11px;">❌ Odmietnuť</button>
        </div>
        <p class="status-box" style="display:none;margin-top:6px;font-size:11px;"></p>
      `;

      const apBtn = card.querySelector('.approve-btn');
      const rjBtn = card.querySelector('.reject-btn');
      const stBox = card.querySelector('.status-box');

      apBtn.onclick = async () => {
        apBtn.disabled = true;
        rjBtn.disabled = true;
        stBox.style.display = 'block';
        stBox.style.color = '#38bdf8';
        stBox.textContent = 'Odosielam autorizáciu...';
        try {
          try {
            await api('/api/system/actions/' + encodeURIComponent(item.id) + '/approve', { confirmation: item.id, id: item.id });
          } catch(err) {
            await api('/api/system/actions/approve', { id: item.id, confirmation: item.id });
          }
          card.style.borderColor = '#10b981';
          stBox.style.color = '#10b981';
          stBox.textContent = '✓ Akcia bola schválená a zaradená na vykonanie!';
          notice('Akcia ' + item.id + ' bola schválená.', true);
          setTimeout(loadDesktopApprovals, 1500);
        } catch(e) {
          stBox.style.color = '#ef4444';
          stBox.textContent = 'Chyba: ' + e.message;
          apBtn.disabled = false;
          rjBtn.disabled = false;
        }
      };

      rjBtn.onclick = async () => {
        apBtn.disabled = true;
        rjBtn.disabled = true;
        stBox.style.display = 'block';
        stBox.style.color = '#ef4444';
        stBox.textContent = 'Odosielam zamietnutie...';
        try {
          try {
            await api('/api/system/actions/' + encodeURIComponent(item.id) + '/reject', { confirmation: item.id, id: item.id });
          } catch(err) {
            await api('/api/system/actions/reject', { id: item.id, confirmation: item.id });
          }
          card.style.borderColor = '#ef4444';
          stBox.textContent = '✓ Akcia bola zamietnutá.';
          notice('Akcia ' + item.id + ' bola zamietnutá.', true);
          setTimeout(loadDesktopApprovals, 1500);
        } catch(e) {
          stBox.textContent = 'Chyba: ' + e.message;
          apBtn.disabled = false;
          rjBtn.disabled = false;
        }
      };

      list.append(card);
    }
  } catch(e) {
    list.innerHTML = '<p class="hint" style="color:#ef4444;">Chyba pri načítaní autorizácií: ' + e.message + '</p>';
  }
}

if($('refresh-desktop-approvals')) $('refresh-desktop-approvals').addEventListener('click', protect(loadDesktopApprovals));

if($('verify-microsoft-connector')){
  $('verify-microsoft-connector').addEventListener('click', protect(async () => {
    const statusBox = $('microsoft-health-status');
    if(statusBox){
      statusBox.style.display = 'block';
      statusBox.style.color = '#38bdf8';
      statusBox.textContent = 'Preverujem stav konektorov Microsoft...';
    }
    try {
      const data = await api('/api/connectors/microsoft/health');
      if(statusBox){
        statusBox.style.color = data.status === 'healthy' ? '#10b981' : '#f59e0b';
        statusBox.textContent = `Stav: ${data.status} · Tenant: ${data.tenant?.status || 'n/a'} · Osobný: ${data.personal?.status || 'n/a'} · Copilot: ${data.copilotStudio?.status || 'n/a'}`;
      }
      notice(`Microsoft konektory: ${data.status}`, data.status === 'healthy');
    } catch(err) {
      if(statusBox){
        statusBox.style.color = '#ef4444';
        statusBox.textContent = 'Chyba: ' + err.message;
      }
      notice('Overenie zlyhalo: ' + err.message);
    }
  }));
}



// Voice Input & Media Modal Listeners
let desktopSpeechRec = null;
let desktopIsRecording = false;

function setupDesktopVoice(){
  const voiceBtn = $('voice-btn');
  const msgInput = $('message');
  if(!voiceBtn || !msgInput) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(SpeechRecognition){
    desktopSpeechRec = new SpeechRecognition();
    desktopSpeechRec.continuous = false;
    desktopSpeechRec.interimResults = true;
    desktopSpeechRec.lang = 'sk-SK';

    desktopSpeechRec.onstart = () => {
      desktopIsRecording = true;
      voiceBtn.classList.add('recording');
      voiceBtn.title = 'Nahrávam... Klikni pre zastavenie';
      notice('Hlasový vstup aktívny. Hovor po slovensky...');
    };

    desktopSpeechRec.onresult = (e) => {
      let interim = '', final = '';
      for(let i = e.resultIndex; i < e.results.length; ++i){
        if(e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      const captured = (final || interim).trim();
      if(captured){
        msgInput.value = captured;
      }
    };

    desktopSpeechRec.onerror = (e) => {
      console.warn('Speech error:', e.error);
      desktopIsRecording = false;
      voiceBtn.classList.remove('recording');
      voiceBtn.title = 'Hovoriť do mikrofónu';
      notice('Hlasový vstup: ' + (e.error === 'not-allowed' ? 'Prístup k mikrofónu bol zamietnutý.' : e.error));
    };

    desktopSpeechRec.onend = () => {
      desktopIsRecording = false;
      voiceBtn.classList.remove('recording');
      voiceBtn.title = 'Hovoriť do mikrofónu';
      if($('auto-speak')?.checked && msgInput.value.trim()){
        notice('Odosielam hlasovú správu...', true);
        $('chat-form').requestSubmit();
      }
    };

    voiceBtn.onclick = () => {
      if(desktopIsRecording){
        desktopSpeechRec.stop();
      } else {
        msgInput.focus();
        desktopSpeechRec.start();
      }
    };
  } else {
    voiceBtn.onclick = () => {
      notice('Váš prehliadač nepodporuje Web Speech API. Odporúčame Chrome/Edge pre hlasový diktát.');
    };
  }

  // Media Modal close events
  $('media-modal-close')?.addEventListener('click', () => { if($('media-modal')) $('media-modal').hidden = true; });
  $('media-modal-backdrop')?.addEventListener('click', () => { if($('media-modal')) $('media-modal').hidden = true; });
  window.addEventListener('keydown', (e) => {
    if(e.key === 'Escape' && $('media-modal') && !$('media-modal').hidden){
      $('media-modal').hidden = true;
    }
  });
}
setupDesktopVoice();


// Local-Desktop ChatGPT-Style Plus Menu & Attachments Controller
let desktopAttachments = [];

function renderDesktopAttachmentTray(){
  const tray = $('desktop-attachment-tray');
  if(!tray) return;
  if(!desktopAttachments.length){
    tray.hidden = true;
    tray.innerHTML = '';
    return;
  }
  tray.hidden = false;
  tray.innerHTML = '';
  desktopAttachments.forEach((att, idx) => {
    const chip = document.createElement('div');
    chip.className = 'attachment-chip';
    if(att.type === 'photo' && att.dataUrl){
      chip.innerHTML = `<img src="${att.dataUrl}" alt="Náhľad"><span class="attachment-chip-name">${att.name}</span><button type="button" class="attachment-chip-remove" title="Odstrániť">✕</button>`;
    } else if(att.type === 'video'){
      chip.innerHTML = `<span>🎬</span><span class="attachment-chip-name">${att.name}</span><button type="button" class="attachment-chip-remove" title="Odstrániť">✕</button>`;
    } else if(att.type === 'audio'){
      chip.innerHTML = `<span>🎵</span><span class="attachment-chip-name">${att.name}</span><button type="button" class="attachment-chip-remove" title="Odstrániť">✕</button>`;
    } else {
      chip.innerHTML = `<span>📄</span><span class="attachment-chip-name">${att.name}</span><button type="button" class="attachment-chip-remove" title="Odstrániť">✕</button>`;
    }
    chip.querySelector('.attachment-chip-remove').onclick = () => {
      desktopAttachments.splice(idx, 1);
      renderDesktopAttachmentTray();
    };
    tray.append(chip);
  });
}

function initDesktopPlusMenu(){
  const btn = $('desktop-plus-btn');
  const menu = $('desktop-plus-menu');
  if(!btn || !menu) return;

  function toggleMenu(force){
    const show = typeof force === 'boolean' ? force : menu.hidden;
    menu.hidden = !show;
    btn.classList.toggle('open', show);
  }

  btn.onclick = (e) => {
    e.stopPropagation();
    toggleMenu();
  };

  document.addEventListener('click', (e) => {
    if(!menu.hidden && !menu.contains(e.target) && e.target !== btn){
      toggleMenu(false);
    }
  });

  window.addEventListener('keydown', (e) => {
    if(e.key === 'Escape' && !menu.hidden){
      toggleMenu(false);
    }
  });

  // 1. Súbor
  $('dplus-opt-file')?.addEventListener('click', () => {
    toggleMenu(false);
    const fi = $('desktop-file-input');
    if(fi){ fi.value = ''; fi.click(); }
  });

  $('desktop-file-input')?.addEventListener('change', async () => {
    const file = $('desktop-file-input').files[0];
    if(!file) return;
    notice(`Načítavam súbor ${file.name}…`);
    try {
      const reader = new FileReader();
      reader.onload = () => {
        desktopAttachments.push({
          type: 'file',
          name: file.name,
          size: file.size,
          content: typeof reader.result === 'string' ? reader.result : ''
        });
        renderDesktopAttachmentTray();
        notice(`Súbor ${file.name} pripojený do kontextu.`, true);
      };
      reader.readAsText(file);
    } catch(err){
      notice('Chyba pri čítaní súboru: ' + err.message);
    }
  });

  // 2. Fotka
  $('dplus-opt-photo')?.addEventListener('click', () => {
    toggleMenu(false);
    const pi = $('desktop-photo-input');
    if(pi){ pi.value = ''; pi.click(); }
  });

  $('desktop-photo-input')?.addEventListener('change', async () => {
    const file = $('desktop-photo-input').files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      desktopAttachments.push({
        type: 'photo',
        name: file.name,
        size: file.size,
        dataUrl: reader.result
      });
      renderDesktopAttachmentTray();
      notice(`Fotka ${file.name} pripravená.`, true);
    };
    reader.readAsDataURL(file);
  });

  // 3. Video
  $('dplus-opt-video')?.addEventListener('click', () => {
    toggleMenu(false);
    const vi = $('desktop-video-input');
    if(vi){ vi.value = ''; vi.click(); }
  });

  $('desktop-video-input')?.addEventListener('change', async () => {
    const file = $('desktop-video-input').files[0];
    if(!file) return;
    const url = URL.createObjectURL(file);
    desktopAttachments.push({
      type: 'video',
      name: file.name,
      size: file.size,
      src: url
    });
    renderDesktopAttachmentTray();
    notice(`Video záznam ${file.name} pripojený.`, true);
  });

  // 4. Audio
  $('dplus-opt-audio')?.addEventListener('click', () => {
    toggleMenu(false);
    const ai = $('desktop-audio-input');
    if(ai){ ai.value = ''; ai.click(); }
  });

  $('desktop-audio-input')?.addEventListener('change', async () => {
    const file = $('desktop-audio-input').files[0];
    if(!file) return;
    const url = URL.createObjectURL(file);
    desktopAttachments.push({
      type: 'audio',
      name: file.name,
      size: file.size,
      src: url
    });
    renderDesktopAttachmentTray();
    notice(`Zvukový záznam ${file.name} pripravený.`, true);
  });

  // 5. Nástroje
  $('dplus-opt-workspace')?.addEventListener('click', () => {
    toggleMenu(false);
    switchView('files');
  });

  $('dplus-opt-notes')?.addEventListener('click', () => {
    toggleMenu(false);
    switchView('notes');
  });

  $('dplus-opt-gateway')?.addEventListener('click', () => {
    toggleMenu(false);
    switchView('connections');
  });
}
initDesktopPlusMenu();

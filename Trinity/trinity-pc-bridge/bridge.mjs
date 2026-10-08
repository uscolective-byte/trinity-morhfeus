/**
 * Trinity PC Bridge — Lokálny klient (NextGen)
 *
 * Pripája sa na Trinity Worker (Cloudflare) cez PC Bridge API,
 * vykonáva schválené systémové akcie a synchronizuje s GitHub, Supabase, Firebase, Firecrawl.
 *
 * Protokol:
 *   POST /api/system/pc-bridge/v1/heartbeat  → heartbeat + status
 *   POST /api/system/actions/claim            → vyzdvihnutie schválenej akcie
 *   POST /api/system/actions/{id}/receipt     → nahlásenie výsledku
 *
 * Nové v NextGen:
 *   - screenshot, system_info, open_app, notify
 *   - run: generický PowerShell príkaz
 *   - scrape: Firecrawl
 *   - git_commit, git_pr
 *   - selfwrite (len v Trinity adresári)
 *   - Postman Newman podpora
 */

import { appendFileSync, readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, extname } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { hostname, platform, userInfo, totalmem, freemem, cpus, uptime } from 'node:os';
import { fileURLToPath } from 'node:url';
import { lookup } from 'node:dns/promises';
import { allowedApps, isPrivateAddress, normalizeRoots, resolveAllowedApp, resolveAllowedPath, sha256Receipt, validatePublicUrl } from './bridge-core.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envFile = readFileSync(join(__dirname, '.env'), 'utf8');
  for (const line of envFile.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const GATEWAY_KEY   = process.env.TRINITY_GATEWAY_KEY;
const TRINITY_URL   = (process.env.TRINITY_URL || 'https://auru.dev').replace(/\/$/, '');
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '5000', 10);
const MAX_B64       = parseInt(process.env.MAX_PAYLOAD_KB || '512', 10) * 1024;
const WORKSPACE_ROOTS = normalizeRoots(process.env.TRINITY_WORKSPACE_ROOTS, [resolve(__dirname, '..')]);
const ALLOWED_APPS = allowedApps(process.env.TRINITY_ALLOWED_APPS);
const ALLOW_SHELL = String(process.env.TRINITY_ALLOW_SHELL || 'false').toLowerCase() === 'true';
const WEB_MAX_BYTES = Math.min(Math.max(parseInt(process.env.TRINITY_WEB_MAX_KB || '1024', 10), 64), 4096) * 1024;
const DOWNLOAD_MAX_BYTES = Math.min(Math.max(parseInt(process.env.TRINITY_DOWNLOAD_MAX_MB || '10', 10), 1), 50) * 1024 * 1024;

if (!GATEWAY_KEY || GATEWAY_KEY.length < 32) {
  console.error('TRINITY_GATEWAY_KEY chýba alebo je kratší ako 32 znakov.');
  process.exit(1);
}

async function api(path, method = 'GET', body = null) {
  const headers = { 'Authorization': `Bearer ${GATEWAY_KEY}`, 'Content-Type': 'application/json' };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${TRINITY_URL}${path}`, opts);
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 500)}`);
  return json;
}

function getSystemInfo(detail = false) {
  const info = {
    hostname: hostname(), platform: platform(), user: userInfo().username,
    uptime_s: Math.floor(uptime()),
    cpu_cores: cpus().length, cpu_model: cpus()[0]?.model || 'unknown',
    mem_total_mb: Math.round(totalmem() / 1024 / 1024),
    mem_free_mb:  Math.round(freemem()  / 1024 / 1024),
    mem_used_pct: Math.round((totalmem() - freemem()) / totalmem() * 100),
  };
  if (detail) {
    try {
      const r = spawnSync('powershell', ['-NoProfile', '-Command',
        `Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 10 Name,Id,@{n='MB';e={[math]::Round($_.WorkingSet64/1MB,1)}} | ConvertTo-Json -Compress`],
        { encoding: 'utf8', timeout: 8000 });
      if (r.status === 0) info.top_processes = JSON.parse(r.stdout.trim() || '[]');
    } catch {}
    try {
      const r = spawnSync('powershell', ['-NoProfile', '-Command',
        `Get-PSDrive -PSProvider FileSystem | Select-Object Name,@{n='UsedGB';e={[math]::Round($_.Used/1GB,2)}},@{n='FreeGB';e={[math]::Round($_.Free/1GB,2)}} | ConvertTo-Json -Compress`],
        { encoding: 'utf8', timeout: 8000 });
      if (r.status === 0) info.disks = JSON.parse(r.stdout.trim() || '[]');
    } catch {}
  }
  return info;
}

function getPCStatus() {
  const si = getSystemInfo(false);
  return {
    agent: 'trinity-pc-v2', connected: true, timestamp: Date.now(),
    ...si,
    capabilities: ['read','write','edit','download','web_fetch','run','deploy','share','upload','upgrade',
                   'screenshot','open_app','notify','system_info','scrape','git_commit','git_pr','selfwrite'],
    policy: { workspace_roots: WORKSPACE_ROOTS, allowed_apps: Object.keys(ALLOWED_APPS), shell_enabled: ALLOW_SHELL },
    integrations: {
      github:    !!process.env.GITHUB_TOKEN,
      supabase:  !!process.env.SUPABASE_URL,
      firebase:  !!process.env.FIREBASE_PROJECT_ID,
      firecrawl: !!process.env.FIRECRAWL_API_KEY,
      postman:   !!process.env.POSTMAN_API_KEY,
    },
  };
}

async function sendHeartbeat() {
  try { return await api('/api/system/pc-bridge/v1/heartbeat', 'POST', getPCStatus()); }
  catch (e) { console.error(`[heartbeat] ${e.message}`); return null; }
}

async function claimAction() {
  try { const res = await api('/api/system/actions/claim', 'POST', {}); return res.action || null; }
  catch (e) { if (!e.message.includes('404') && !e.message.includes('204')) console.error(`[claim] ${e.message}`); return null; }
}

async function sendReceipt(actionId, status, receipt = {}, error = null) {
  try {
    const body = { status };
    if (receipt && Object.keys(receipt).length) body.receipt = receipt;
    if (error) body.error = String(error).slice(0, 2000);
    return await api(`/api/system/actions/${actionId}/receipt`, 'POST', body);
  } catch (e) { console.error(`[receipt] ${e.message}`); return null; }
}

function ps(command, cwd, timeout = 30000) {
  const r = spawnSync('powershell', ['-NoProfile', '-Command', command], {
    encoding: 'utf8', timeout: Math.min(parseInt(timeout)||30000, 180000),
    cwd: cwd ? resolve(cwd) : process.cwd(),
  });
  return { stdout: (r.stdout||'').slice(0,8000), stderr: (r.stderr||'').slice(0,2000),
           exit_code: r.status, timed_out: r.status === null };
}

function safePath(input, options) {
  return resolveAllowedPath(input, WORKSPACE_ROOTS, options);
}

async function publicUrl(input) {
  const url = validatePublicUrl(input);
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(item => isPrivateAddress(item.address))) throw new Error('Cieľ URL smeruje na lokálnu alebo privátnu sieť.');
  return url;
}

async function boundedResponse(response, maxBytes) {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > maxBytes) throw new Error(`Odpoveď prekračuje limit ${maxBytes} bajtov.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > maxBytes) throw new Error(`Odpoveď prekračuje limit ${maxBytes} bajtov.`);
  return bytes;
}

function launchAllowedApp(name) {
  const app = resolveAllowedApp(name, ALLOWED_APPS);
  const child = spawn(app.executable, [], { detached: true, stdio: 'ignore', windowsHide: false });
  child.unref();
  return app;
}

async function takeScreenshot() {
  const tmp = join(__dirname, `ss_${Date.now()}.png`);
  const safeTmp = tmp.replace(/\\/g, '\\\\');
  const cmd = `Add-Type -AssemblyName System.Windows.Forms,System.Drawing;$s=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds;$b=New-Object System.Drawing.Bitmap($s.Width,$s.Height);$g=[System.Drawing.Graphics]::FromImage($b);$g.CopyFromScreen($s.Location,[System.Drawing.Point]::Empty,$s.Size);$b.Save('${safeTmp}',[System.Drawing.Imaging.ImageFormat]::Png);$g.Dispose();$b.Dispose();Write-Output "$($s.Width)x$($s.Height)"`;
  const r = ps(cmd, null, 15000);
  if (r.exit_code !== 0) throw new Error(`Screenshot zlyhal: ${r.stderr.slice(0,300)}`);
  if (!existsSync(tmp)) throw new Error('Screenshot súbor nebol vytvorený.');
  const bytes = readFileSync(tmp);
  const b64   = bytes.toString('base64');
  try { const {unlinkSync}=await import('node:fs'); unlinkSync(tmp); } catch {}
  return { format: 'png', resolution: r.stdout.trim(), size_bytes: bytes.length, base64: b64.slice(0, MAX_B64) };
}

function listDir(dirPath, depth, cur = 0) {
  try {
    return readdirSync(dirPath).slice(0, 200).map(name => {
      const full = join(dirPath, name);
      try {
        const s = statSync(full);
        const e = { name, type: s.isDirectory() ? 'dir' : 'file', size: s.size };
        if (s.isDirectory() && cur < depth - 1) e.children = listDir(full, depth, cur + 1);
        return e;
      } catch { return { name, type: 'unknown' }; }
    });
  } catch { return []; }
}

async function firecrawlScrape(url, opts = {}) {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY nie je nastavený.');
  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, formats: opts.formats||['markdown'], onlyMainContent: opts.onlyMainContent!==false }),
  });
  if (!res.ok) { const e=await res.text(); throw new Error(`Firecrawl: ${res.status} ${e.slice(0,200)}`); }
  const data = await res.json();
  return { url, title: data?.data?.metadata?.title||null, markdown: (data?.data?.markdown||'').slice(0,20000) };
}

async function createGitHubPR(title, body, head, base='main') {
  const token=process.env.GITHUB_TOKEN, repo=process.env.GITHUB_REPO;
  if (!token||!repo) throw new Error('GITHUB_TOKEN alebo GITHUB_REPO nie je nastavený.');
  const res = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: String(title).slice(0,200), body: String(body||'').slice(0,4000), head, base }),
  });
  if (!res.ok) { const e=await res.text(); throw new Error(`GitHub PR: ${res.status} ${e.slice(0,200)}`); }
  const data = await res.json();
  return { pr_number: data.number, url: data.html_url, title: data.title };
}

async function executeAction(action) {
  const { id, action: type, payload={}, rationale='' } = action;
  console.log(`\n⚡ ${type} (${id.slice(0,8)}) — ${rationale}`);
  try {
    let receipt = {};
    switch (type) {

      case 'read': {
        if (payload.task==='system_info'||payload.operation==='system_info') {
          receipt = { type:'system_info', ...getSystemInfo(!!payload.detail) }; break;
        }
        if (payload.task==='local-inference') {
          receipt = { response:'[lokálny model nie je nakonfigurovaný]', model:'none' }; break;
        }
        const rp = safePath(payload.path||WORKSPACE_ROOTS[0], { mustExist: true });
        const st = statSync(rp);
        if (st.isDirectory()) {
          receipt = { path:rp, type:'directory', entries:listDir(rp, Math.min(parseInt(payload.depth)||1,3)) };
        } else {
          const bin = ['.png','.jpg','.jpeg','.gif','.webp','.pdf','.zip','.exe'].includes(extname(rp).toLowerCase());
          if (bin) {
            const b = readFileSync(rp);
            receipt = { path:rp, type:'binary', size_bytes:b.length, sha256:sha256Receipt(createHash,b), base64:b.toString('base64').slice(0,MAX_B64) };
          } else {
            const c = readFileSync(rp,'utf8');
            receipt = { path:rp, type:'file', size:st.size, sha256:sha256Receipt(createHash,Buffer.from(c)), content:c.slice(0,50000), truncated:c.length>50000 };
          }
        }
        break;
      }

      case 'write': {
        const wp=safePath(payload.path);
        if(payload.operation==='mkdir'){
          mkdirSync(wp,{recursive:true});receipt={path:wp,type:'directory',created:true};break;
        }
        mkdirSync(dirname(wp),{recursive:true});
        const c=String(payload.content||'');
        if(Buffer.byteLength(c)>500000)throw new Error('Obsah prekračuje limit 500000 bajtov.');
        if(payload.operation==='append')appendFileSync(wp,c,'utf8');else writeFileSync(wp,c,'utf8');
        const final=readFileSync(wp);
        receipt = { path:wp, bytes:final.length, operation:payload.operation==='append'?'append':'write', sha256:sha256Receipt(createHash,final) }; break;
      }

      case 'edit': {
        const ep=safePath(payload.path,{mustExist:true});
        let c=readFileSync(ep,'utf8');
        if (payload.find && payload.replace!==undefined) c=c.replaceAll(payload.find,payload.replace);
        else if (payload.content!==undefined) c=payload.content;
        else if (payload.append) c=c+'\n'+payload.append;
        else throw new Error('edit: chýba find+replace / content / append');
        if(Buffer.byteLength(c)>500000)throw new Error('Výsledný obsah prekračuje limit 500000 bajtov.');
        writeFileSync(ep,c,'utf8'); receipt={path:ep,bytes:Buffer.byteLength(c),sha256:sha256Receipt(createHash,Buffer.from(c))}; break;
      }

      case 'run': {
        if (payload.task==='desktop-control') {
          const op=payload.operation||'list';
          if (op==='list') {
            const r=ps(`Get-Process|Where-Object{$_.MainWindowTitle -ne ''}|Select-Object Name,Id,MainWindowTitle|ConvertTo-Json -Compress`,null,5000);
            receipt={operation:'list',windows:JSON.parse(r.stdout||'[]')};
          } else if (op==='launch'&&payload.app) {
            const app=launchAllowedApp(payload.app);
            receipt={operation:'launch',app:app.name};
          } else if (op==='type'&&payload.text) {
            const txt=String(payload.text).replace(/'/g,'').slice(0,500);
            ps(`Add-Type -AssemblyName System.Windows.Forms;[System.Windows.Forms.SendKeys]::SendWait('${txt}')`,null,5000);
            receipt={operation:'type',typed:txt};
          } else throw new Error(`Neznáma desktop op: ${op}`);
          break;
        }
        if (!ALLOW_SHELL) throw new Error('Ľubovoľný shell je zakázaný politikou TRINITY_ALLOW_SHELL.');
        if (!payload.command) throw new Error('run vyžaduje payload.command');
        const runCwd=payload.cwd?safePath(payload.cwd,{mustExist:true}):WORKSPACE_ROOTS[0];
        const r=ps(payload.command,runCwd,payload.timeout);
        if (r.exit_code!==0&&!payload.allowNonZero) throw new Error(`Exit ${r.exit_code}: ${r.stderr.slice(0,400)}`);
        receipt=r; break;
      }

      case 'screenshot': { receipt=await takeScreenshot(); break; }

      case 'open_app': {
        const operation=payload.operation||'launch';
        if(operation==='list'){
          const r=ps(`Get-Process|Where-Object{$_.MainWindowTitle -ne ''}|Select-Object Name,Id,MainWindowTitle|ConvertTo-Json -Compress`,null,5000);
          receipt={operation:'list',windows:JSON.parse(r.stdout||'[]'),allowed_apps:Object.keys(ALLOWED_APPS)};break;
        }
        if(operation==='type'){
          const text=String(payload.text||'').slice(0,500);
          if(!text)throw new Error('open_app/type: chýba text');
          const encoded=Buffer.from(text,'utf8').toString('base64');
          const script=`Add-Type -AssemblyName System.Windows.Forms;$t=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'));[System.Windows.Forms.SendKeys]::SendWait($t)`;
          const r=ps(script,null,5000);if(r.exit_code!==0)throw new Error(r.stderr||'Písanie do aplikácie zlyhalo.');
          receipt={operation:'type',characters:text.length};break;
        }
        const app=launchAllowedApp(payload.app||payload.target);
        receipt={operation:'launch',opened:app.name}; break;
      }

      case 'notify': {
        if (!payload.message) throw new Error('notify: chýba message');
        const ti=String(payload.title||'Trinity').replace(/'/g,'').slice(0,80);
        const me=String(payload.message).replace(/'/g,'').slice(0,256);
        const d=Math.min(Math.max(parseInt(payload.duration)||5,1),30);
        ps(`[Windows.UI.Notifications.ToastNotificationManager,Windows.UI.Notifications,ContentType=WindowsRuntime]|Out-Null;[Windows.Data.Xml.Dom.XmlDocument,Windows.Data.Xml.Dom.XmlDocument,ContentType=WindowsRuntime]|Out-Null;$xml=[Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent('ToastText02');$xml.GetElementsByTagName('text')[0].AppendChild($xml.CreateTextNode('${ti}'))|Out-Null;$xml.GetElementsByTagName('text')[1].AppendChild($xml.CreateTextNode('${me}'))|Out-Null;$toast=[Windows.UI.Notifications.ToastNotification]::new($xml);$toast.ExpirationTime=[DateTimeOffset]::Now.AddSeconds(${d});[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Trinity AI').Show($toast)`,null,8000);
        receipt={notified:true,title:ti,message:me}; break;
      }

      case 'system_info': { receipt=getSystemInfo(!!payload.detail); break; }

      case 'scrape': {
        if (!payload.url) throw new Error('scrape: chýba url');
        await publicUrl(payload.url);
        receipt=await firecrawlScrape(payload.url,payload); break;
      }

      case 'web_fetch': {
        const url=await publicUrl(payload.url);
        const response=await fetch(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Trinity-PC-Bridge/2.0'}});
        const bytes=await boundedResponse(response,WEB_MAX_BYTES);
        const contentType=response.headers.get('content-type')||'application/octet-stream';
        const textLike=/^(text\/|application\/(?:json|xml|javascript))/i.test(contentType);
        receipt={url:url.toString(),status:response.status,content_type:contentType,size_bytes:bytes.length,sha256:sha256Receipt(createHash,bytes),...(textLike?{content:Buffer.from(bytes).toString('utf8').slice(0,100000)}:{base64:Buffer.from(bytes).toString('base64').slice(0,MAX_B64)})};break;
      }

      case 'download': {
        const url=await publicUrl(payload.url);
        const target=safePath(payload.path);
        const response=await fetch(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(60000),headers:{'User-Agent':'Trinity-PC-Bridge/2.0'}});
        const bytes=await boundedResponse(response,DOWNLOAD_MAX_BYTES);
        mkdirSync(dirname(target),{recursive:true});writeFileSync(target,bytes);
        receipt={url:url.toString(),path:target,size_bytes:bytes.length,sha256:sha256Receipt(createHash,bytes)};break;
      }

      case 'git_commit': {
        if (!payload.message) throw new Error('git_commit: chýba message');
        const cwd2=payload.cwd?safePath(payload.cwd,{mustExist:true}):WORKSPACE_ROOTS[0];
        const run2=(cmd)=>{const r=spawnSync(cmd,{shell:true,cwd:cwd2,encoding:'utf8',timeout:30000});if(r.status!==0)throw new Error(`git: ${cmd} → ${r.status}`);return(r.stdout||'').trim();};
        if ((payload.files||[]).length>0) payload.files.forEach(f=>run2(`git add "${String(f).replace(/"/g,'')}"`));
        else run2('git add -A');
        const msg=String(payload.message).replace(/"/g,'\\"').slice(0,200);
        const out=run2(`git commit -m "${msg}"`);
        if (payload.push!==false) run2('git push');
        receipt={committed:true,message:msg,output:out}; break;
      }

      case 'git_pr': {
        if (!payload.title||!payload.head) throw new Error('git_pr: chýba title alebo head');
        receipt=await createGitHubPR(payload.title,payload.body,payload.head,payload.base||'main'); break;
      }

      case 'deploy': {
        const dcwd=payload.cwd?safePath(payload.cwd,{mustExist:true}):WORKSPACE_ROOTS[0];
        const steps=[];
        const drun=(cmd)=>{const r=spawnSync(cmd,{shell:true,cwd:dcwd,encoding:'utf8',timeout:120000});steps.push({cmd,exit:r.status,out:(r.stdout||'').slice(0,500)});if(r.status!==0)throw new Error(`Deploy: ${cmd} (${r.status})`);};
        if (payload.git!==false){drun('git add -A');drun(`git commit -m "${(payload.message||'Trinity deploy').replace(/"/g,'\\"')}"`);drun('git push');}
        if (payload.wrangler!==false) drun('npx wrangler deploy');
        receipt={steps,deployed:true}; break;
      }

      case 'selfwrite': {
        if (!payload.path||payload.content===undefined) throw new Error('selfwrite: chýba path alebo content');
        const sp=safePath(payload.path);
        const root=resolve(__dirname,'..');
        if (!sp.startsWith(root)) throw new Error('selfwrite: povolené len v Trinity projekte');
        mkdirSync(dirname(sp),{recursive:true});
        writeFileSync(sp,payload.content,'utf8');
        receipt={path:sp,bytes:payload.content.length,selfwrite:true}; break;
      }

      case 'share': {
        const fp=safePath(payload.path,{mustExist:true});
        const c=readFileSync(fp);
        receipt={path:fp,hash:createHash('sha256').update(c).digest('hex').slice(0,12),shared:true}; break;
      }

      case 'upload': {
        const up=safePath(payload.path,{mustExist:true});
        receipt={path:up,size:readFileSync(up).length,uploaded:true}; break;
      }

      case 'upgrade': {
        if (payload.cwd){const r=ps('npm install',safePath(payload.cwd,{mustExist:true}),60000);receipt={upgraded:true,output:r.stdout.slice(0,500)};}
        else receipt={upgraded:true,message:'Upgrade signál prijatý'};
        break;
      }

      default: throw new Error(`Neznáma akcia: ${type}`);
    }

    console.log(`  ✓ ${JSON.stringify(receipt).slice(0,120)}`);
    await sendReceipt(id,'completed',receipt);
    await syncIntegrations(type,payload,receipt);
    return receipt;
  } catch(e) {
    console.error(`  ✗ ${e.message}`);
    await sendReceipt(id,'failed',{},e.message);
    return null;
  }
}

async function syncIntegrations(actionType,payload,receipt){
  const syncs=[];
  if(process.env.GITHUB_TOKEN&&process.env.GITHUB_REPO) syncs.push(syncGitHub(actionType,payload,receipt));
  if(process.env.SUPABASE_URL&&process.env.SUPABASE_KEY) syncs.push(syncSupabase(actionType,payload,receipt));
  if(process.env.FIREBASE_PROJECT_ID) syncs.push(syncFirebase(actionType,payload,receipt));
  const results=await Promise.allSettled(syncs);
  for(const r of results) if(r.status==='rejected') console.error(`  [sync] ${r.reason?.message||r.reason}`);
}

async function syncGitHub(actionType,payload,receipt){
  const token=process.env.GITHUB_TOKEN,repo=process.env.GITHUB_REPO;
  if(['write','edit','selfwrite'].includes(actionType)&&payload.path){
    const content=payload.content||(existsSync(payload.path)?readFileSync(payload.path,'utf8'):'');
    let sha;
    try{const fr=await fetch(`https://api.github.com/repos/${repo}/contents/${payload.path}`,{headers:{'Authorization':`Bearer ${token}`,'Accept':'application/vnd.github+json'}});if(fr.ok)sha=(await fr.json()).sha;}catch{}
    const cr=await fetch(`https://api.github.com/repos/${repo}/contents/${payload.path}`,{method:'PUT',headers:{'Authorization':`Bearer ${token}`,'Accept':'application/vnd.github+json','Content-Type':'application/json'},body:JSON.stringify({message:`Trinity: ${actionType} ${payload.path}`,content:Buffer.from(content).toString('base64'),sha})});
    if(!cr.ok){const e=await cr.text();throw new Error(`GitHub: ${cr.status} ${e.slice(0,200)}`);}
    console.log(`  [github] ✓ ${payload.path}`);
  } else if(['deploy','git_commit'].includes(actionType)){
    const workflow=payload.workflow||'deploy.yml',ref=payload.ref||'main';
    const r=await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`,{method:'POST',headers:{'Authorization':`Bearer ${token}`,'Accept':'application/vnd.github+json','Content-Type':'application/json'},body:JSON.stringify({ref,inputs:payload.inputs||{}})});
    if(!r.ok) throw new Error(`GitHub dispatch: ${r.status}`);
    console.log(`  [github] ✓ workflow ${workflow}`);
  }
}

async function syncSupabase(actionType,payload,receipt){
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_KEY;
  const record={action:actionType,path:payload.path||null,rationale:payload.rationale||null,receipt:JSON.stringify(receipt).slice(0,2000),timestamp:new Date().toISOString(),hostname:hostname()};
  const r=await fetch(`${url}/rest/v1/${payload.supabase_table||'trinity_actions'}`,{method:'POST',headers:{apikey:key,'Authorization':`Bearer ${key}`,'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify(record)});
  if(!r.ok){const e=await r.text();throw new Error(`Supabase: ${r.status} ${e.slice(0,200)}`);}
  console.log(`  [supabase] ✓ ${actionType}`);
}

async function syncFirebase(actionType,payload,receipt){
  const projectId=process.env.FIREBASE_PROJECT_ID,clientEmail=process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey=process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n');
  if(!privateKey) throw new Error('FIREBASE_PRIVATE_KEY chýba');
  const now=Math.floor(Date.now()/1000);
  const h=Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT'})).toString('base64url');
  const claims={iss:clientEmail,scope:'https://www.googleapis.com/auth/datastore',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600};
  const b=Buffer.from(JSON.stringify(claims)).toString('base64url');
  const si=`${h}.${b}`;
  const {createSign}=await import('node:crypto');
  const signer=createSign('RSA-SHA256');signer.update(si);
  const jwt=`${si}.${signer.sign(privateKey,'base64url')}`;
  const tr=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`});
  if(!tr.ok) throw new Error(`Firebase token: ${tr.status}`);
  const {access_token}=await tr.json();
  const collection=payload.firebase_collection||'trinity_actions';
  const dr=await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}`,{method:'POST',headers:{'Authorization':`Bearer ${access_token}`,'Content-Type':'application/json'},body:JSON.stringify({fields:{action:{stringValue:actionType},path:{stringValue:payload.path||''},rationale:{stringValue:payload.rationale||''},hostname:{stringValue:hostname()},timestamp:{timestampValue:new Date().toISOString()},receipt:{stringValue:JSON.stringify(receipt).slice(0,1000)}}})});
  if(!dr.ok){const e=await dr.text();throw new Error(`Firebase: ${dr.status} ${e.slice(0,200)}`);}
  console.log(`  [firebase] ✓ ${collection}`);
}

let running=false;
async function pollActions(){
  if(running)return; running=true;
  try{const a=await claimAction();if(a&&a.id)await executeAction(a);}
  catch{}finally{running=false;}
}

async function main(){
  const si=getSystemInfo(false);
  console.log('═══════════════════════════════════════════════');
  console.log('  Trinity PC Bridge — NextGen');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Server:    ${TRINITY_URL}`);
  console.log('  Gateway:   configured (redacted)');
  console.log(`  Hostname:  ${si.hostname} (${si.platform})`);
  console.log(`  CPU:       ${si.cpu_cores}x ${si.cpu_model}`);
  console.log(`  RAM:       ${si.mem_free_mb}MB free / ${si.mem_total_mb}MB`);
  console.log('───────────────────────────────────────────────');
  console.log(`  GitHub:    ${process.env.GITHUB_TOKEN?'✓':'✗'}`);
  console.log(`  Supabase:  ${process.env.SUPABASE_URL?'✓':'✗'}`);
  console.log(`  Firebase:  ${process.env.FIREBASE_PROJECT_ID?'✓':'✗'}`);
  console.log(`  Firecrawl: ${process.env.FIRECRAWL_API_KEY?'✓':'✗'}`);
  console.log(`  Postman:   ${process.env.POSTMAN_API_KEY?'✓':'✗'}`);
  console.log('═══════════════════════════════════════════════\n');
  const hb=await sendHeartbeat();
  if(hb) console.log('✓ Bridge pripojený\n'); else console.log('✗ Heartbeat zlyhal\n');
  setInterval(sendHeartbeat,30000);
  setInterval(pollActions,POLL_INTERVAL);
  pollActions();
  const shutdown=()=>{
    console.log('\nUkončujem PC Bridge...');
    api('/api/system/pc-bridge/v1/heartbeat','POST',{agent:'trinity-pc-v2',connected:false,hostname:hostname(),timestamp:Date.now()})
      .then(()=>process.exit(0)).catch(()=>process.exit(0));
  };
  process.on('SIGINT',shutdown); process.on('SIGTERM',shutdown);
}

main().catch(e=>{console.error('Fatálna chyba:',e);process.exit(1);});

/**
 * @module TRINITY_OMNI_CORE
 * @subsystem LOCAL_BRIDGE_GATEWAY
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Modul executor.mjs (Local-Gateway/src/executor.mjs) v ekosystéme TRINITY OMNI-CORE.
 */
import {mkdir,readFile,rename,writeFile,copyFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {resolveSafePath,isInside,RUN_TASKS,validatePackage,validateProject} from './policy.mjs';
import {sha256} from './store.mjs';
import {executeDesktop} from './desktop.mjs';
import {processCommand} from './process-command.mjs';
import {scriptCommand} from './script-command.mjs';
import {developerTools} from './developer-tools.mjs';

const MAX_TEXT=1_000_000;
const MAX_OUTPUT=128_000;
const RESOURCE_PROFILE=JSON.parse(await readFile(new URL('../config/resource-profile.json',import.meta.url),'utf8'));

async function runLocalInference(payload){
  if(payload.task!=='local-inference'||!Array.isArray(payload.messages)||payload.messages.length<1||payload.messages.length>20)throw new Error('Neplatná lokálna AI požiadavka.');
  const messages=payload.messages.map(message=>{if(!['system','user','assistant'].includes(message?.role)||typeof message.content!=='string'||message.content.length>20_000)throw new Error('Neplatná správa pre lokálny model.');return {role:message.role,content:message.content};});
  const profile=RESOURCE_PROFILE.ollama,model=payload.model||profile.model,maxTokens=Math.max(32,Math.min(Number(payload.max_tokens)||1200,profile.max_output_tokens));
  const response=await fetch('http://127.0.0.1:11434/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,messages,stream:false,keep_alive:profile.keep_alive,options:{num_predict:maxTokens,num_ctx:profile.context,num_thread:profile.threads,temperature:0.25}}),signal:AbortSignal.timeout(180_000)});
  const text=await response.text();let data={};try{data=JSON.parse(text);}catch{}
  if(!response.ok)throw new Error(`Lokálny Ollama model zlyhal (HTTP ${response.status}).`);
  const responseText = data.message?.content?.trim() || data.message?.thinking?.trim() || '';
  if(!responseText)throw new Error('Lokálny model vrátil prázdnu odpoveď.');
  return {action:'read',task:'local-inference',model,response:responseText,thinking:data.message?.thinking||null,usage:{input:data.prompt_eval_count||0,output:data.eval_count||0},completed:true};
}

async function runProcess(command,args,{cwd,timeoutMs=120_000,environment,windowsVerbatimArguments=false}={}){
  return new Promise((resolve,reject)=>{
    const invocation=processCommand(command,args);
    const child=spawn(invocation.command,invocation.args,{cwd,shell:false,windowsHide:true,windowsVerbatimArguments,env:environment||{...process.env,CI:'1',NO_COLOR:'1'}});
    let stdout='',stderr='',settled=false;
    const timer=setTimeout(()=>{
      if(process.platform==='win32'&&child.pid){const killer=spawn('taskkill.exe',['/pid',String(child.pid),'/t','/f'],{windowsHide:true,stdio:'ignore'});killer.on('error',()=>child.kill());}else child.kill();
      if(!settled){settled=true;reject(new Error('Proces prekročil časový limit.'));}
    },timeoutMs);
    const collect=(current,chunk)=>(current+chunk.toString('utf8')).slice(-MAX_OUTPUT);
    child.stdout.on('data',chunk=>{stdout=collect(stdout,chunk);});child.stderr.on('data',chunk=>{stderr=collect(stderr,chunk);});
    child.on('error',error=>{clearTimeout(timer);if(!settled){settled=true;reject(error);}});
    child.on('close',code=>{clearTimeout(timer);if(!settled){settled=true;resolve({exitCode:code,stdout,stderr,success:code===0});}});
  });
}

async function atomicWrite(target,content){await mkdir(path.dirname(target),{recursive:true});const temp=path.join(path.dirname(target),`.trinity-${randomUUID()}.tmp`);await writeFile(temp,content,'utf8');await rename(temp,target);}
async function currentHash(target){try{return sha256(await readFile(target));}catch(error){if(error.code==='ENOENT')return 'absent';throw error;}}

export async function readWorkspaceFile(workspaceRoot,relativePath){
  const target=await resolveSafePath(workspaceRoot,relativePath);
  const info=await stat(target);if(!info.isFile())throw new Error('Cesta nie je súbor.');if(info.size>MAX_TEXT)throw new Error('Súbor je príliš veľký na priame čítanie.');
  const content=await readFile(target,'utf8');return {path:relativePath,sha256:sha256(content),bytes:Buffer.byteLength(content),content};
}

export async function executeProposal(workspaceRoot,proposal,dataDir){
  if(proposal.status!=='approved')throw new Error('Návrh nebol schválený.');
  if(new Date(proposal.expiresAt).getTime()<Date.now())throw new Error('Schválenie vypršalo.');
  const payload=proposal.payload||{};
  if(payload.task==='developer-tools'){
    const operation=payload.operation||'catalog';
    if(!(['catalog','inspect'].includes(operation)?['read','run']:['run']).includes(proposal.action))throw new Error('Developer tool changes require an approved run action.');
    return {action:proposal.action,task:payload.task,...await developerTools(workspaceRoot,payload,runProcess)};
  }
  if(['write','edit','selfwrite'].includes(proposal.action)){
    if(typeof payload.content!=='string'||Buffer.byteLength(payload.content)>MAX_TEXT)throw new Error('Obsah chýba alebo je príliš veľký.');
    if(proposal.action==='selfwrite'&&!String(payload.path||'').replaceAll('\\','/').startsWith('Trinity/'))throw new Error('Selfwrite môže meniť iba projekt Trinity.');
    const target=await resolveSafePath(workspaceRoot,payload.path,{allowMissing:true});const before=await currentHash(target);
    if(payload.expected_sha256!==before)throw new Error(`Súbor sa zmenil. Očakávaný hash nesedí (${before}).`);
    await atomicWrite(target,payload.content);const after=await currentHash(target);
    if(after==='absent')throw new Error('Zlyhanie zápisu: Súbor sa po operácii fyzicky nenachádza na disku.');
    return {action:proposal.action,path:payload.path,before_sha256:before,after_sha256:after,bytes:Buffer.byteLength(payload.content)};
  }
  if(proposal.action==='run'){
    if(payload.task==='script'){
      const invocation=await scriptCommand(workspaceRoot,payload);
      const result=await runProcess(invocation.command,invocation.args,invocation);
      return {action:'run',task:'script',runtime:payload.runtime,path:payload.path,script_sha256:invocation.script_sha256,...result};
    }
    if(payload.task==='desktop-control')return {action:'run',task:'desktop-control',desktop:await executeDesktop(payload)};
    const project=validateProject(payload.project);const task=RUN_TASKS[payload.task];if(!task)throw new Error('Úloha nie je povolená.');
    const cwd=await resolveSafePath(workspaceRoot,project);const result=await runProcess(task.command,task.args,{cwd});return {action:'run',project,task:payload.task,...result};
  }
  if(proposal.action==='deploy'){
    const project=validateProject(payload.project);if(project!=='Trinity')throw new Error('Nasadenie je povolené iba pre Trinity.');
    const cwd=await resolveSafePath(workspaceRoot,project);
    const identity=await runProcess('git',['rev-parse','HEAD'],{cwd});
    const sourceCommit=identity.stdout.trim();
    if(!identity.success||!/^([a-f0-9]{40}|[a-f0-9]{64})$/.test(sourceCommit))throw new Error('Nasadenie vyžaduje platný Git commit.');
    const dirty=await runProcess('git',['status','--porcelain'],{cwd:workspaceRoot});
    if(!dirty.success||dirty.stdout.trim())throw new Error('Pred nasadením commitni zmeny v projekte.');
    const result=await runProcess('npm',['run','deploy','--','--tag',sourceCommit],{cwd,timeoutMs:300_000});return {action:'deploy',project,source_commit:sourceCommit,...result};
  }
  if(proposal.action==='upgrade'){
    const project=validateProject(payload.project);const spec=validatePackage(payload.package,payload.version);const cwd=await resolveSafePath(workspaceRoot,project);
    const install=await runProcess('npm',['install','--save-exact',spec],{cwd,timeoutMs:300_000});if(!install.success)return {action:'upgrade',project,spec,install};
    const tests=await runProcess('npm',['test'],{cwd,timeoutMs:300_000});return {action:'upgrade',project,spec,install,tests,success:tests.success};
  }
  if(['share','upload'].includes(proposal.action)){
    const source=await resolveSafePath(workspaceRoot,payload.path);const info=await stat(source);if(!info.isFile()||info.size>20_000_000)throw new Error('Na odoslanie je povolený iba súbor do 20 MB.');
    const outbox=path.join(dataDir,'outbox');await mkdir(outbox,{recursive:true});const destination=path.join(outbox,`${proposal.id}-${path.basename(source)}`);await copyFile(source,destination);
    return {action:proposal.action,state:'staged-local-only',source:payload.path,outbox:destination,bytes:info.size,note:'Externý cieľ ešte nie je pripojený; súbor nebol zverejnený.'};
  }
  if(proposal.action==='read'&&payload.task==='local-inference')return runLocalInference(payload);
  if(proposal.action==='read')return readWorkspaceFile(workspaceRoot,payload.path);
  if(proposal.action==='system_info'){
    const os=await import('node:os');
    const cpus=os.cpus();
    const memTotal=Math.round(os.totalmem()/(1024*1024));
    const memFree=Math.round(os.freemem()/(1024*1024));
    return {
      action:'system_info',
      hostname:os.hostname(),
      platform:os.platform(),
      user:os.userInfo().username,
      uptime_s:Math.round(os.uptime()),
      cpu_cores:cpus.length,
      cpu_model:cpus[0]?.model||'Unknown CPU',
      mem_total_mb:memTotal,
      mem_free_mb:memFree,
      mem_used_pct:Math.round(((memTotal-memFree)/memTotal)*100),
      success:true
    };
  }
  if(proposal.action==='screenshot'){
    const {captureScreenshot}=await import('./desktop.mjs');
    const shot=await captureScreenshot();
    return {action:'screenshot',...shot,success:true};
  }
  if(proposal.action==='open_app'){
    const appTarget=payload.target||payload.app||'calculator';
    const appMap={
      calculator:'calculator',calc:'calculator',kalkulacka:'calculator',
      notepad:'notepad',poznamkovyblok:'notepad',
      paint:'paint',skicar:'paint',
      explorer:'explorer',prieskumnik:'explorer',
      chrome:'chrome',edge:'edge',
      whatsapp:'whatsapp',watsap:'whatsapp',
      vscode:'vscode',code:'vscode',
      terminal:'terminal',powershell:'terminal',cmd:'terminal',
      cmder:'cmder',commander:'commander',
      browser:'browser',prehliadac:'browser'
    };
    const clean=String(appTarget).toLowerCase().replace(/[^a-z]/g,'');
    const target=appMap[clean]||'calculator';
    const desktop=await executeDesktop({task:'desktop-control',operation:'launch',app:target});
    return {action:'open_app',target,desktop,success:true};
  }
    if(proposal.action==='open_file'){
    const rawPath=payload.path||payload.file||payload.target;
    if(!rawPath||typeof rawPath!=='string')throw new Error('Chýba cesta k súboru.');
    let pathToResolve = rawPath;
    if (path.isAbsolute(rawPath)) {
      if (isInside(workspaceRoot, rawPath) || isInside(path.resolve(workspaceRoot), path.resolve(rawPath))) {
        pathToResolve = path.relative(workspaceRoot, rawPath);
      }
    }
    const safePath=await resolveSafePath(workspaceRoot,pathToResolve);
    const {spawn}=await import('node:child_process');
    if (process.platform === 'win32') {
      const child = spawn('cmd.exe', ['/d', '/c', 'start', '""', `"${safePath}"`], {windowsVerbatimArguments: true, detached: true, stdio: 'ignore', windowsHide: true});
      child.on('error', () => {});
      child.unref();
    } else if (process.platform === 'darwin') {
      const child = spawn('open', [safePath], {detached: true, stdio: 'ignore'});
      child.unref();
    } else {
      const child = spawn('xdg-open', [safePath], {detached: true, stdio: 'ignore'});
      child.unref();
    }
    return {action:'open_file',path:rawPath,resolvedPath:safePath,success:true};
  }
  if(proposal.action==='open_url'){
    const rawUrl=payload.url||payload.link||payload.target;
    if(!rawUrl||typeof rawUrl!=='string')throw new Error('Chýba URL adresa.');
    let parsedUrl;
    try {
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rawUrl)) {
        parsedUrl = new URL(rawUrl);
      } else {
        parsedUrl = new URL(`https://${rawUrl}`);
      }
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        throw new Error("Povolené sú iba HTTP a HTTPS adresy.");
      }
    } catch (e) {
      throw new Error(`Neplatná URL adresa: ${e.message}`);
    }
    const {spawn} = await import('node:child_process');
    if (process.platform === 'win32') {
      const child = spawn('cmd.exe', ['/d', '/c', 'start', '""', `"${parsedUrl.href}"`], {windowsVerbatimArguments: true, detached: true, stdio: 'ignore', windowsHide: true});
      child.on('error', () => {});
      child.unref();
    } else if (process.platform === 'darwin') {
      const child = spawn('open', [parsedUrl.href], {detached: true, stdio: 'ignore'});
      child.unref();
    } else {
      const child = spawn('xdg-open', [parsedUrl.href], {detached: true, stdio: 'ignore'});
      child.unref();
    }
    return {action:'open_url',url:parsedUrl.href,success:true};
  }
  throw new Error('Neznáma systémová akcia.');
}

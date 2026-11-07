/**
 * @module TRINITY_OMNI_CORE
 * @subsystem LOCAL_BRIDGE_GATEWAY
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Modul policy.mjs (Local-Gateway/src/policy.mjs) v ekosystéme TRINITY OMNI-CORE.
 */
import path from 'node:path';
import {lstat, realpath} from 'node:fs/promises';

export const CAPABILITIES=Object.freeze([
  {id:'read',risk:'read',approval:false},
  {id:'write',risk:'change',approval:true},
  {id:'edit',risk:'change',approval:true},
  {id:'selfwrite',risk:'high',approval:true},
  {id:'run',risk:'change',approval:true},
  {id:'deploy',risk:'critical',approval:true},
  {id:'share',risk:'critical',approval:true},
  {id:'upload',risk:'critical',approval:true},
  {id:'upgrade',risk:'critical',approval:true},
  {id:'open_app',risk:'change',approval:true},
  {id:'open_url',risk:'read',approval:false},
  {id:'open_file',risk:'read',approval:false},
  {id:'screenshot',risk:'read',approval:false},
  {id:'notify',risk:'read',approval:false},
  {id:'system_info',risk:'read',approval:false}
]);

export const ACTIONS=new Set(CAPABILITIES.map(item=>item.id));
const BLOCKED_SEGMENTS=new Set(['.git','.credentials','.wrangler','node_modules']);
const BLOCKED_NAMES=[/^\.env(?:\..+)?$/i,/\.dpapi$/i,/\.(?:pem|pfx|p12|key)$/i,/^(?:id_rsa|id_ed25519)$/i];

export function isInside(root,target){
  const relative=path.relative(root,target);
  return relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));
}

async function nearestExisting(target){
  let current=target;
  while(true){
    try{await lstat(current);return current;}catch(error){if(error.code!=='ENOENT')throw error;}
    const parent=path.dirname(current);
    if(parent===current)throw new Error('Nenašiel sa existujúci nadradený priečinok.');
    current=parent;
  }
}

export async function resolveSafePath(workspaceRoot,relativePath,{allowMissing=false}={}){
  if(typeof relativePath!=='string'||!relativePath.trim()||relativePath.includes('\0'))throw new Error('Cesta musí byť relatívna k Morhfeus.');
  const root=await realpath(workspaceRoot);
  let relPath=relativePath;
  if(path.isAbsolute(relativePath)){
    const resolvedCandidate=path.resolve(relativePath);
    let realCandidate=resolvedCandidate;
    try{realCandidate=await realpath(resolvedCandidate);}catch{}
    if(!isInside(root,resolvedCandidate)||!isInside(root,realCandidate))throw new Error('Cesta je mimo pracovného priestoru.');
    relPath=path.relative(root,resolvedCandidate);
    if(relPath==='')relPath='.';
  }
  const segments=relPath.replaceAll('\\','/').split('/').filter(Boolean);
  if(segments.some(segment=>segment==='..'||BLOCKED_SEGMENTS.has(segment.toLowerCase())||BLOCKED_NAMES.some(rule=>rule.test(segment))))throw new Error('Táto cesta je chránená.');
  // root resolved above
  const target=path.resolve(root,...segments);
  if(!isInside(root,target))throw new Error('Cesta je mimo pracovného priestoru.');
  const existing=await nearestExisting(target);
  const existingReal=await realpath(existing);
  if(!isInside(root,existingReal))throw new Error('Cesta smeruje mimo pracovného priestoru.');
  let cursor=root;
  for(const segment of path.relative(root,existing).split(path.sep).filter(Boolean)){
    cursor=path.join(cursor,segment);
    if((await lstat(cursor)).isSymbolicLink())throw new Error('Symbolické odkazy nie sú povolené.');
  }
  if(!allowMissing&&existing!==target)throw new Error('Súbor neexistuje.');
  return target;
}

export const RUN_TASKS=Object.freeze({
  'node-version':{command:process.execPath,args:['--version']},
  'python-version':{command:process.env.TRINITY_PYTHON_PATH||'python',args:['--version']},
  'cmd-version':{command:'cmd.exe',args:['/d','/c','ver']},
  'git-status':{command:'git',args:['status','--short']},
  'diff-check':{command:'git',args:['diff','--check']},
  tests:{command:'npm',args:['test']},
  build:{command:'npm',args:['run','build']},
  deploy:{command:'npm',args:['run','deploy']},
  start:{command:'npm',args:['start']},
  'run-start':{command:'npm',args:['run','start']},
  'docker-compose-up':{command:'docker',args:['compose','up','-d']},
  'docker-compose-ps':{command:'docker',args:['compose','ps']},
  'docker-ps':{command:'docker',args:['ps']},
  'git-log':{command:'git',args:['log','-n','5','--oneline']}
});

export function validateProject(value){
  if(!['Trinity','Local-Gateway'].includes(value))throw new Error('Projekt nie je v zozname povolených projektov.');
  return value;
}

export function validatePackage(name,version){
  if(!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i.test(name||''))throw new Error('Neplatný názov balíka.');
  if(!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version||''))throw new Error('Aktualizácia vyžaduje presnú verziu.');
  return `${name}@${version}`;
}

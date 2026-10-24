import path from 'node:path';
import {readFile,stat} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolveSafePath} from './policy.mjs';
import {sha256} from './store.mjs';

export function scriptEnvironment(source=process.env){
  const allowed=new Set(['path','systemroot','windir','comspec','temp','tmp','pathext']);
  return {...Object.fromEntries(Object.entries(source).filter(([key])=>allowed.has(key.toLowerCase()))),CI:'1',NO_COLOR:'1',PYTHONNOUSERSITE:'1'};
}

function defaultPython() {
  if (process.env.TRINITY_PYTHON_PATH) return process.env.TRINITY_PYTHON_PATH;
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    const cand = path.join(process.env.LOCALAPPDATA, 'Python', 'bin', 'python.exe');
    if (existsSync(cand)) return cand;
  }
  return 'python';
}

export async function scriptCommand(root,payload,{platform=process.platform,python=defaultPython(),node=process.execPath}={}){
  const extensions={node:['.js','.mjs','.cjs'],python:['.py'],cmd:['.cmd','.bat']};
  if(!Object.hasOwn(extensions,payload.runtime))throw new Error('Nepovolený runtime.');
  const relative=payload.path;
  if(typeof relative!=='string'||!/^Trinity\/workspace\/scripts\/[A-Za-z0-9_./-]+$/.test(relative)||!extensions[payload.runtime].includes(path.extname(relative)))throw new Error('Skript musí byť v Trinity/workspace/scripts a mať správnu príponu.');
  if(!/^[a-f0-9]{64}$/.test(payload.expected_sha256||''))throw new Error('Spustenie vyžaduje presný SHA-256 skriptu.');
  const target=await resolveSafePath(root,relative);
  const info=await stat(target);if(!info.isFile()||info.size>500000)throw new Error('Skript musí byť súbor do 500000 bajtov.');
  const hash=sha256(await readFile(target));if(hash!==payload.expected_sha256)throw new Error('Skript sa zmenil; hash nesedí.');
  const args=payload.args??[];
  if(!Array.isArray(args)||args.length>20||args.some(a=>typeof a!=='string'||a.length>2000||/[\0\r\n]/.test(a)))throw new Error('Neplatné argumenty skriptu.');
  const timeoutMs=payload.timeout_ms??30000;
  if(!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>120000)throw new Error('Neplatný časový limit.');
  let invocation;
  if(payload.runtime==='node')invocation={command:node,args:['--',target,...args]};
  if(payload.runtime==='python')invocation={command:python,args:['-I','-u',target,...args]};
  if(payload.runtime==='cmd'){
    if(platform!=='win32')throw new Error('CMD je dostupné iba vo Windows.');
    if(/[&|<>^%!"()\r\n]/.test(target)||args.some(a=>! /^[\p{L}\p{N} _.:/@=,+-]*$/u.test(a)))throw new Error('CMD argumenty obsahujú nepovolené shellové znaky.');
    invocation={command:path.win32.join(process.env.SystemRoot||'C:\\Windows','System32','cmd.exe'),args:['/d','/s','/c',`""${target}" ${args.map(a=>`"${a}"`).join(' ')}"`],windowsVerbatimArguments:true};
  }
  return {...invocation,cwd:path.dirname(target),timeoutMs,environment:scriptEnvironment(),script_sha256:hash};
}

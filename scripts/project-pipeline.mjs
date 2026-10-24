import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {readdirSync,existsSync} from 'node:fs';
import {checkSource} from './source-policy.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const npm=process.platform==='win32'?'npm.cmd':'npm';
const mode=process.argv[2]||'check';
const workers=['Trinity','Knowledge-Worker','Integrations-Worker','Capacity-Worker','PC-Bridge-Worker'];
const projects=[...workers,'Local-Gateway','Local-Desktop','Audit-Worker'];
function run(command,args,cwd=root){
 console.log(`[pipeline] ${command} ${args.join(' ')} (${cwd===root?'root':cwd.slice(root.length)})`);
 if(process.platform==='win32'&&command===npm){
  if(!process.env.npm_execpath){console.error('Run this pipeline through npm run so npm_execpath is available on Windows.');process.exit(1);}
  args=[process.env.npm_execpath,...args];command=process.execPath;
 }
 const result=spawnSync(command,args,{cwd,stdio:'inherit',env:process.env});
 if(result.error){console.error(result.error.message);process.exit(1);}
 if(result.status!==0)process.exit(result.status||1);
}
function script(project,name){run(npm,['run',name],resolve(root,project));}
function sourceGuard(){checkSource(root);}
function docs(){run(process.execPath,['scripts/sync-release-docs.mjs','--check']);}
function build(){
 docs();
 for(const project of workers)script(project,'build');
 script('Trinity','build:development');
 run(npm,['exec','--','wrangler','deploy','--config','wrangler.integrations.jsonc','--dry-run','--outdir','dist-integrations'],resolve(root,'Trinity'));
}
function test(){
 docs();
 for(const project of projects.filter(p=>p!=='Integrations-Worker'))script(project,'test');
 script('Integrations-Worker','build');
 run(npm,['exec','--','wrangler','deploy','--config','wrangler.integrations.jsonc','--dry-run','--outdir','dist-integrations'],resolve(root,'Trinity'));
 run(process.execPath,['--test','tests/integrations.runtime.mjs'],resolve(root,'Trinity'));
 run(process.execPath,['--test',...readdirSync(resolve(root,'tests')).filter(name=>name.endsWith('.test.mjs')).map(name=>'tests/'+name)]);
 run(npm,['audit','--audit-level=high'],resolve(root,'Trinity'));
}
if(mode==='setup'){
 for(const project of [...workers,'Local-Gateway'])run(npm,['ci','--ignore-scripts','--no-audit','--no-fund'],resolve(root,project));
}else if(mode==='build')build();
else if(['test','check'].includes(mode))test();
else if(mode==='sync'){
 sourceGuard();
 run('git',['fetch','origin','main']);run('git',['merge','--ff-only','origin/main']);test();
}else if(mode==='deploy'){
 sourceGuard();docs();
 // Existing guarded deployment requires Bash, Cloudflare auth and a private D1 backup.
 const bash=process.platform==='win32'?resolve(process.env.ProgramFiles||'C:/Program Files','Git/bin/bash.exe'):'bash';
 if(process.platform==='win32'&&!existsSync(bash)){console.error('Git Bash is required for the guarded deployment script.');process.exit(1);}
 run(bash,[resolve(root,'scripts/trinity-environment.sh').replace(/\\/g,'/'),'deploy']);
}else{console.error('Usage: node scripts/project-pipeline.mjs setup|build|test|check|sync|deploy');process.exit(2);}
console.log(`[pipeline] ${mode} completed`);

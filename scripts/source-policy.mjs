import {TRINITY_SOURCE} from '../Trinity/src/version.js';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export function requireCanonicalSource({branch,remote,upstream,dirty}){
 const allowed=[`https://github.com/${TRINITY_SOURCE.repository}`,`https://github.com/${TRINITY_SOURCE.repository}.git`,`git@github.com:${TRINITY_SOURCE.repository}.git`];
 if(branch!==TRINITY_SOURCE.branch||!allowed.includes(remote)||upstream!==`origin/${TRINITY_SOURCE.branch}`)throw new Error(`Use ${TRINITY_SOURCE.repository} on ${TRINITY_SOURCE.branch}, tracking origin/main.`);
 if(dirty.trim())throw new Error('Commit or preserve local changes before synchronization or deployment.');
}

export function checkSource(root=fileURLToPath(new URL('../',import.meta.url))){
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
 requireCanonicalSource({branch:git('branch','--show-current'),remote:git('remote','get-url','origin'),upstream:git('rev-parse','--abbrev-ref','@{upstream}'),dirty:git('status','--porcelain')});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{checkSource();console.log('Canonical main checkout is clean.');}catch(error){console.error(error.message);process.exitCode=1;}
}

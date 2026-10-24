import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {TRINITY_SOURCE,TRINITY_VERSION} from '../Trinity/src/version.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const pkg=JSON.parse(readFileSync(resolve(root,'Trinity/package.json'),'utf8'));
const config=JSON.parse(readFileSync(resolve(root,'Trinity/wrangler.jsonc'),'utf8'));
if(pkg.version!==TRINITY_VERSION)throw new Error('Package and runtime versions differ.');
const rows=[[config,'production'],[config.env.development,'development']].map(([env,mode])=>{
 if(Object.hasOwn(env.vars,'GOOGLE_CLIENT_SECRET'))throw new Error('GOOGLE_CLIENT_SECRET must be stored in Cloudflare Secrets, never in tracked vars.');
 if(env.vars.TRINITY_GITHUB_REPO!==TRINITY_SOURCE.repository||env.vars.TRINITY_GITHUB_BRANCH!==TRINITY_SOURCE.branch||env.vars.TRINITY_ENV!==mode)throw new Error('Source or environment configuration differs.');
 return `| ${env.routes[0].pattern} | ${mode} | \`${env.name}\` |`;
});
const begin='<!-- trinity-release:start -->',end='<!-- trinity-release:end -->';
const block=[begin,`Verzia zdroja: **${pkg.version}**. Repozitár: [${TRINITY_SOURCE.repository}](https://github.com/${TRINITY_SOURCE.repository}), vetva **\`${TRINITY_SOURCE.branch}\`**.`,'','| Doména | Prostredie | Worker |','|---|---|---|',...rows,'','Tieto údaje sa generujú zo zdrojov a konfigurácie. Aktuálne nasadenie over cez `/health`, `/ready` a commit tag; nejde o živý stav integrácií.',end].join('\n');
let stale=false;
for(const name of ['README.md','Trinity/README.md']){
 const path=resolve(root,name),text=readFileSync(path,'utf8').replace(/\r\n/g,'\n');
 const first=text.indexOf(begin),last=text.indexOf(end);
 if(first<0||last<first)throw new Error(`Missing release markers in ${name}`);
 const updated=text.slice(0,first)+block+text.slice(last+end.length);
 if(updated!==text){stale=true;if(!process.argv.includes('--check'))writeFileSync(path,updated);console.log(`${name}: ${process.argv.includes('--check')?'out of date':'updated'}`);}
}
if(stale&&process.argv.includes('--check')){console.error('Run npm run docs:sync and commit the synchronized documentation.');process.exitCode=1;}

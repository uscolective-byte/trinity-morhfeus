import {readFile} from 'node:fs/promises';
const [origin,expectedTag]=process.argv.slice(2);
if(!/^https:\/\/(?:auru\.dev|auru\.space)$/.test(origin)||!expectedTag)throw new Error('Usage: node scripts/verify-deployment.mjs https://auru.dev|https://auru.space COMMIT_SHA');
const {version}=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
let last='No response';
for(let attempt=0;attempt<6;attempt++){
 try{
  const health=await fetch(origin+'/health',{signal:AbortSignal.timeout(10000),redirect:'error'});
  const data=await health.json();
  const ready=await fetch(origin+'/ready',{signal:AbortSignal.timeout(10000),redirect:'error'});
  if(health.ok&&ready.ok&&data.version===version&&data.deployment?.tag===expectedTag){console.log(JSON.stringify({verified:true,origin,version,commit:expectedTag,deployment:data.deployment}));process.exit(0);}
  last=`Expected ${version}/${expectedTag}; got ${data.version}/${data.deployment?.tag}; ready HTTP ${ready.status}`;
 }catch(error){last=error.message;}
 if(attempt<5)await new Promise(resolve=>setTimeout(resolve,10000));
}
throw new Error('Deployment verification failed: '+last);

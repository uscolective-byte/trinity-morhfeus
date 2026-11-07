import {readFile} from 'node:fs/promises';
import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {TRINITY_SOURCE} from '../src/version.js';

try {
  if (existsSync('C:\\Users\\saboi\\.env')) {
    const lines = readFileSync('C:\\Users\\saboi\\.env', 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^\s*(CLOUDFLARE_ACCESS_CLIENT_ID|CLOUDFLARE_ACCESS_CLIENT_SECRET)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  }
} catch {}

export function verificationTarget(args){
 const [origin,selector,value,...extra]=args;
 if(!/^https:\/\/(?:auru\.dev|auru\.space)$/.test(origin||'')||extra.length)throw new Error('Usage: verify-deployment.mjs ORIGIN COMMIT_SHA | ORIGIN --version-id VERSION_ID');
 if(selector==='--version-id'){
  if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value||''))throw new Error('A Cloudflare version UUID is required.');
  return {origin,expectedVersionId:value};
 }
 if(value||!/^[0-9a-f]{7,40}$/i.test(selector||''))throw new Error('A commit SHA is required.');
 return {origin,expectedTag:selector};
}
export async function verifyDeployment({origin,expectedTag,expectedVersionId,version,attempts=6,delayMs=10000,fetcher=fetch}){
 let last='No response';
 const headers={
  Accept:'application/json',
  'User-Agent':'Mozilla/5.0',
  ...(process.env.CLOUDFLARE_ACCESS_CLIENT_ID ? {
    'CF-Access-Client-Id': process.env.CLOUDFLARE_ACCESS_CLIENT_ID,
    'CF-Access-Client-Secret': process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET
  } : {})
 };
 const expectedEnvironment=origin==='https://auru.dev'?'staging':'production';
 for(let attempt=0;attempt<attempts;attempt++){
  try{
   const health=await fetcher(origin+'/health',{headers,signal:AbortSignal.timeout(10000),redirect:'error'});
   const data=await health.json();
   const ready=await fetcher(origin+'/ready',{headers,signal:AbortSignal.timeout(10000),redirect:'error'});
   const readiness=await ready.json();
   const matched=expectedVersionId?data.deployment?.id===expectedVersionId:data.deployment?.tag===expectedTag;
   const sourceMatches=[data,readiness].every(result=>result.source?.repository===TRINITY_SOURCE.repository&&result.source?.branch===TRINITY_SOURCE.branch);
   const envMatches=data.environment===expectedEnvironment&&readiness.environment===expectedEnvironment;
   if(health.ok&&ready.ok&&matched&&sourceMatches&&data.version===version&&readiness.version===version&&envMatches&&readiness.ready===true){
    return {verified:true,origin,version,environment:data.environment,source:data.source,...(expectedTag?{commit:expectedTag}:{}),deployment:data.deployment};
   }
   last=`Expected ${version}/${expectedVersionId||expectedTag} (${expectedEnvironment}) from ${TRINITY_SOURCE.repository}@${TRINITY_SOURCE.branch}; got ${data.version}/${data.deployment?.id}/${data.deployment?.tag} (${data.environment}); source=${JSON.stringify(data.source)}, readiness source=${JSON.stringify(readiness.source)}; ready HTTP ${ready.status}, ready=${readiness.ready}`;
  }catch(error){last=error.message;}
  if(attempt<attempts-1)await new Promise(resolve=>setTimeout(resolve,delayMs));
 }
 throw new Error('Deployment verification failed: '+last);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const target=verificationTarget(process.argv.slice(2));
 const {version}=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
 console.log(JSON.stringify(await verifyDeployment({...target,version})));
}

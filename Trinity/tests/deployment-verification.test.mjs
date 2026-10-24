import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verificationTarget,verifyDeployment} from '../scripts/verify-deployment.mjs';
import {TRINITY_SOURCE,sourceMetadata} from '../src/version.js';
const id='863ecc84-3985-4aea-9114-fdc18b723555';
const commit='a'.repeat(40);
const config={origin:'https://auru.space',expectedVersionId:id,version:'11.0.0',attempts:1};
const fake=(health={},ready={})=>async url=>Response.json(url.endsWith('/health')?{version:'11.0.0',environment:'production',source:TRINITY_SOURCE,deployment:{id,tag:null},...health}:{version:'11.0.0',environment:'production',source:TRINITY_SOURCE,ready:true,...ready});

test('both domains require the canonical repository and main branch',async()=>{
 assert.deepEqual(sourceMetadata({}),TRINITY_SOURCE);
 assert.deepEqual(sourceMetadata({TRINITY_GITHUB_REPO:'another/repo',TRINITY_GITHUB_BRANCH:'other'}),{repository:'another/repo',branch:'other'});
 for(const source of [undefined,{...TRINITY_SOURCE,repository:'another/repo'},{...TRINITY_SOURCE,branch:'other'}]){
  await assert.rejects(verifyDeployment({...config,fetcher:fake({source})}),/verification failed/);
  await assert.rejects(verifyDeployment({...config,fetcher:fake({},{source})}),/verification failed/);
 }
 const development={environment:'development'};
 const result=await verifyDeployment({...config,origin:'https://auru.dev',fetcher:fake(development,development)});
 assert.equal(result.environment,'development');assert.deepEqual(result.source,TRINITY_SOURCE);
});
test('deployment verifier accepts a real version receipt when Workers Builds has no commit tag',async()=>{
 const target=verificationTarget(['https://auru.space','--version-id',id]);assert.equal(target.expectedVersionId,id);
 assert.equal((await verifyDeployment({...config,fetcher:fake()})).verified,true);
 await assert.rejects(verifyDeployment({...config,expectedVersionId:undefined,expectedTag:commit,fetcher:fake()}),/verification failed/);
});
test('deployment verification requires readiness, correct environment, package version and deployment',async()=>{
 for(const [health,ready] of [[{version:'old'},{}],[{environment:'development'},{}],[{deployment:{id:crypto.randomUUID()}},{}],[{},{ready:false}],[{},{environment:'development'}],[{},{version:'old'}]])await assert.rejects(verifyDeployment({...config,fetcher:fake(health,ready)}),/verification failed/);
});
test('deployment CLI preserves commit-tag verification and rejects ambiguous or arbitrary targets',async()=>{
 assert.deepEqual(verificationTarget(['https://auru.dev',commit]),{origin:'https://auru.dev',expectedTag:commit});
 assert.equal((await verifyDeployment({...config,expectedVersionId:undefined,expectedTag:commit,fetcher:fake({deployment:{id,tag:commit}})})).verified,true);
 for(const args of [['https://evil.example',commit],['https://auru.space','--version-id','bad'],['https://auru.space',commit,'extra'],['https://auru.space','short']])assert.throws(()=>verificationTarget(args));
});

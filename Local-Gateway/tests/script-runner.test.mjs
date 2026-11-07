import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {executeProposal} from '../src/executor.mjs';
import {sha256} from '../src/store.mjs';
import {scriptCommand,scriptEnvironment} from '../src/script-command.mjs';
import {spawnSync} from 'node:child_process';

async function script(runtime,content,args=[]){
 const root=await mkdtemp(path.join(os.tmpdir(),'trinity script '));
 const dir=path.join(root,'Trinity/workspace/scripts');await mkdir(dir,{recursive:true});
 const file='Trinity/workspace/scripts/probe.'+({node:'mjs',python:'py',cmd:'cmd'}[runtime]);
 await writeFile(path.join(root,file),content);
 const proposal={status:'approved',expiresAt:new Date(Date.now()+60000).toISOString(),action:'run',payload:{task:'script',runtime,path:file,args,expected_sha256:sha256(content)}};
 return {root,proposal,run:()=>executeProposal(root,proposal,path.join(root,'data'))};
}
test('Node and Python execute scripts with exact arguments and no inherited bridge secrets',async()=>{
 process.env.TRINITY_GATEWAY_KEY='TEST_SECRET_MUST_NOT_REACH_SCRIPT';
 try{
  const runtimes = [['node', "console.log(JSON.stringify({arg:process.argv[2],secret:process.env.TRINITY_GATEWAY_KEY??null}))"]];
   try { if (spawnSync('python', ['-c', 'import sys; sys.exit(0)']).status === 0) runtimes.push(['python', "import os,sys,json\nprint(json.dumps({'arg':sys.argv[1],'secret':os.getenv('TRINITY_GATEWAY_KEY')}))"]); } catch {}
   for(const [runtime,content] of runtimes){
   const fixture=await script(runtime,content,['space value & literal']);const receipt=await fixture.run();
   assert.equal(receipt.success,true,receipt.stderr);assert.deepEqual(JSON.parse(receipt.stdout),{arg:'space value & literal',secret:null});
   assert.equal(receipt.script_sha256,sha256(content));
  }
 }finally{delete process.env.TRINITY_GATEWAY_KEY;}
});
test('CMD supports a quoted script path and rejects shell expansion in arguments',{skip:process.platform!=='win32'},async()=>{
 const fixture=await script('cmd','@echo off\r\necho %~1\r\n',['hello world']);const receipt=await fixture.run();
 assert.equal(receipt.success,true,receipt.stderr);assert.equal(receipt.stdout.trim(),'hello world');
 for(const arg of ['x & whoami','%PATH%','!PATH!','x"','x|more'])await assert.rejects(scriptCommand(fixture.root,{...fixture.proposal.payload,args:[arg]}),/shellové/);
});
test('script execution rejects changed files, paths outside script directory and nonzero processes',async()=>{
 const fixture=await script('node','process.exit(7)');
 assert.equal((await fixture.run()).exitCode,7);
 await writeFile(path.join(fixture.root,fixture.proposal.payload.path),'console.log("changed")');
 await assert.rejects(fixture.run(),/hash/);
 await assert.rejects(scriptCommand(fixture.root,{...fixture.proposal.payload,path:'Trinity/package.json'}),/Skript/);
 await assert.rejects(scriptCommand(fixture.root,{...fixture.proposal.payload,path:'Trinity/workspace/scripts/../../../outside.mjs'}),/chránená/);
 assert.deepEqual(scriptEnvironment({PATH:'allowed',TRINITY_GATEWAY_KEY:'secret',OPENAI_API_KEY:'secret'}),{PATH:'allowed',CI:'1',NO_COLOR:'1',PYTHONNOUSERSITE:'1'});
});
test('runaway scripts reach a bounded timeout and report failure',async()=>{
 const fixture=await script('node','setInterval(()=>{},100)');fixture.proposal.payload.timeout_ms=1000;
 await assert.rejects(fixture.run(),/časový limit/);
});

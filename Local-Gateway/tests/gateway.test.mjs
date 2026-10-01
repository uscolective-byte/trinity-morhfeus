import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {resolveSafePath,validatePackage,RUN_TASKS} from '../src/policy.mjs';
import {ProposalStore,sha256} from '../src/store.mjs';
import {executeProposal,readWorkspaceFile} from '../src/executor.mjs';
import {validateDesktopRequest} from '../src/desktop.mjs';

async function workspace(){const root=await mkdtemp(path.join(os.tmpdir(),'trinity-gateway-'));await mkdir(path.join(root,'Trinity'),{recursive:true});await writeFile(path.join(root,'Trinity','a.txt'),'old','utf8');return root;}

test('safe path stays in workspace and blocks secrets',async()=>{
  const root=await workspace();assert.equal(await resolveSafePath(root,'Trinity/a.txt'),path.join(root,'Trinity','a.txt'));
  await assert.rejects(()=>resolveSafePath(root,'../outside.txt'),/chránená|mimo/);
  await assert.rejects(()=>resolveSafePath(root,'Trinity/.env'),/chránená/);
  await assert.rejects(()=>resolveSafePath(root,'.credentials/token.dpapi',{allowMissing:true}),/chránená/);
});

test('proposal requires one-time transition',async()=>{
  const root=await workspace();const store=new ProposalStore(path.join(root,'data'));const proposal=await store.create('write',{path:'Trinity/b.txt'});
  assert.equal(proposal.status,'proposed');await store.transition(proposal.id,['proposed'],'approved');
  await assert.rejects(()=>store.transition(proposal.id,['proposed'],'approved'),/approved/);
});

test('write is atomic and bound to expected hash',async()=>{
  const root=await workspace();const before=sha256('old');const proposal={id:'p',action:'edit',status:'approved',expiresAt:new Date(Date.now()+60_000).toISOString(),payload:{path:'Trinity/a.txt',expected_sha256:before,content:'new'}};
  const receipt=await executeProposal(root,proposal,path.join(root,'data'));assert.equal(receipt.before_sha256,before);assert.equal(await readFile(path.join(root,'Trinity','a.txt'),'utf8'),'new');
  await assert.rejects(()=>executeProposal(root,proposal,path.join(root,'data')),/hash/);
});

test('selfwrite cannot alter gateway or secrets',async()=>{
  const root=await workspace();const proposal={id:'p',action:'selfwrite',status:'approved',expiresAt:new Date(Date.now()+60_000).toISOString(),payload:{path:'Local-Gateway/src/policy.mjs',expected_sha256:'absent',content:'bad'}};
  await assert.rejects(()=>executeProposal(root,proposal,path.join(root,'data')),/iba projekt Trinity/);
});

test('read returns evidence hash',async()=>{const root=await workspace();const value=await readWorkspaceFile(root,'Trinity/a.txt');assert.equal(value.content,'old');assert.equal(value.sha256,sha256('old'));});
test('commands and packages are allowlisted',()=>{assert.deepEqual(Object.keys(RUN_TASKS).sort(),['build','diff-check','git-status','tests']);assert.equal(validatePackage('zod','4.6.5'),'zod@4.6.5');assert.throws(()=>validatePackage('zod','latest'),/presnú verziu/);});
test('remote action import is idempotent',async()=>{const root=await workspace();const store=new ProposalStore(path.join(root,'data'));const remote={id:'8a8a8a8a-1234-4123-8123-123456789abc',action:'read',payload:{path:'Trinity/a.txt'},expires_at:Date.now()+60_000};const first=await store.importApproved(remote);const second=await store.importApproved(remote);assert.equal(first.id,second.id);assert.equal((await store.list()).length,1);});
test('desktop controller is allowlisted and rejects broad control',()=>{
  assert.deepEqual(validateDesktopRequest({task:'desktop-control',operation:'launch',app:'calculator'}),{operation:'launch',app:'calculator',text:null});
  assert.throws(()=>validateDesktopRequest({task:'desktop-control',operation:'launch',app:'powershell'}),/povolenom zozname/);
  assert.throws(()=>validateDesktopRequest({task:'desktop-control',operation:'type',app:'explorer',text:'x'}),/Poznámkovom bloku/);
  assert.throws(()=>validateDesktopRequest({task:'desktop-control',operation:'click',app:'notepad'}),/nie je povolená/);
});

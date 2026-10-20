import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createSelfImprovementProposal,approveSelfImprovementProposal,applySelfImprovementProposal,reconcileSelfImprovements} from '../src/self-improvement.js';
function environment(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec("CREATE TABLE self_improvement_proposals(id TEXT PRIMARY KEY,title TEXT,description TEXT,kind TEXT,plugin_id TEXT,status TEXT,created_by TEXT,approved_by TEXT,result_json TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);CREATE TABLE ops_events(action TEXT,details TEXT);");
 const DB={prepare(sql){let values=[];const stmt=sqlite.prepare(sql);return {bind(...params){values=params;return this;},async first(){return stmt.get(...values)||null;},async all(){return {results:stmt.all(...values)};},async run(){return stmt.run(...values);}};}};
 return {DB,sqlite,TRINITY_GITHUB_TOKEN:'test-only-token',AI:{async run(){return {response:JSON.stringify({summary:'Fix a real off-by-one error.',changes:[{path:'Trinity/src/sample.js',before:'return 1;',after:'return 2;'}]})};}}};
}
test('approved proposal executes the branch/PR protocol sequence and records source integration separately from deployment',async()=>{
 const env=environment(),old=globalThis.fetch,calls=[];let merged=false;
 try{globalThis.fetch=async(url,options)=>{const method=options.method;calls.push({url,method});
 if(url.includes('/pulls?'))return Response.json([]);
 if(url.includes('/git/ref/heads/'))return Response.json({object:{sha:'a'.repeat(40)}});
 if(url.includes('/git/trees/')&&url.includes('recursive'))return Response.json({sha:'b'.repeat(40),tree:[{path:'Trinity/src/sample.js',type:'blob',sha:'c'.repeat(40),size:40}],truncated:false});
 if(url.includes('/contents/'))return Response.json({sha:'c'.repeat(40),encoding:'base64',size:40,content:Buffer.from('export function value(){return 1;}').toString('base64')});
 if(url.endsWith('/git/trees')){const body=JSON.parse(options.body);assert.match(body.tree[0].content,/return 2/);assert.equal(body.base_tree,'b'.repeat(40));return Response.json({sha:'d'.repeat(40)});}
 if(url.endsWith('/git/commits'))return Response.json({sha:'e'.repeat(40)});
 if(url.endsWith('/git/refs')){assert.match(JSON.parse(options.body).ref,/refs\/heads\/trinity\/evolution-/);return Response.json({});}
 if(url.endsWith('/pulls')&&method==='POST')return Response.json({number:17,html_url:'https://github.com/test/pull/17'});
 if(url.endsWith('/pulls/17'))return Response.json({number:17,merged_at:merged?'2026-10-20T12:00:00Z':null,merge_commit_sha:'f'.repeat(40)});
 throw new Error('Unexpected test request '+url);
 };
 const proposal=await createSelfImprovementProposal(env,{title:'Fix value calculation',description:'Correct the off by one in sample.js and validate the result.',kind:'code_improvement'},'owner');
 await approveSelfImprovementProposal(env,proposal.id,'owner');
 const result=await applySelfImprovementProposal(env,proposal.id,'owner');assert.equal(result.status,'approved');assert.equal(result.result_json.status,'pull_request_created');assert.equal(result.result_json.deployed,false);
 const count=calls.length;await applySelfImprovementProposal(env,proposal.id,'owner');assert.equal(calls.length,count,'repeated apply must not create a duplicate PR');
 merged=true;const integrated=await reconcileSelfImprovements(env);assert.equal(integrated[0].status,'merged');assert.equal(integrated[0].deployed,false);assert.equal(env.sqlite.prepare('SELECT status FROM self_improvement_proposals').get().status,'applied');
 }finally{globalThis.fetch=old;env.sqlite.close();}
});
test('model patch failure is persisted as failed, not applied',async()=>{
 const env=environment();const proposal=await createSelfImprovementProposal(env,{title:'Failed preparation',description:'Demonstrate a disconnected GitHub endpoint without claiming success.',kind:'code_improvement'},'owner');await approveSelfImprovementProposal(env,proposal.id,'owner');
 const old=globalThis.fetch;try{globalThis.fetch=async()=>new Response('unavailable',{status:503});await assert.rejects(()=>applySelfImprovementProposal(env,proposal.id,'owner'),/GitHub/);const row=env.sqlite.prepare('SELECT * FROM self_improvement_proposals').get();assert.equal(row.status,'approved');assert.equal(JSON.parse(row.result_json).status,'failed');}finally{globalThis.fetch=old;env.sqlite.close();}
});

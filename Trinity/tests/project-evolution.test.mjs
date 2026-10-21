import {test} from 'node:test';
import assert from 'node:assert/strict';
import {editableSource,rankProjectFiles,validateSourcePatch,inspectProject,prepareCodeImprovement} from '../src/project-evolution.js';
import {publicWebUrl,fetchPublicWeb} from '../src/web-access.js';
import {infrastructureStatus} from '../src/infrastructure.js';
test('source inspection ranks relevant paths and excludes secrets and traversal',()=>{
 for(const path of ['.env','Trinity/wrangler.jsonc','Trinity/src/../secret.js','Trinity/src/secret-vault.js','Trinity/src/.env.js','Trinity/src/a.js/../../a.js'])assert.equal(editableSource(path),false,path);
 const tree=['Trinity/src/domains.js','Trinity/src/cognition.js','Trinity/src/secret-vault.js'].map(path=>({path,type:'blob',size:100}));
 assert.equal(rankProjectFiles(tree,'domains')[0].path,'Trinity/src/domains.js');assert.equal(rankProjectFiles(tree).length,2);
});
test('patch applies only once to supplied files and preserves literal replacement characters',()=>{
 const files=[{path:'Trinity/src/domains.js',content:'const x=1;'}];
 const result=validateSourcePatch({summary:'Correct a specific calculation.',changes:[{path:files[0].path,before:'x=1',after:'x="$&"'}]},files);
 assert.equal(result.files[0].content,'const x="$&";');
 for(const change of [{path:'Trinity/src/unknown.js',before:'x',after:'y'},{path:files[0].path,before:'missing',after:'y'},{path:files[0].path,before:'x',after:'x'}])assert.throws(()=>validateSourcePatch({summary:'Correct a specific calculation.',changes:[change]},files));
 assert.throws(()=>validateSourcePatch({summary:'Ambiguous source must fail.',changes:[{path:files[0].path,before:'x',after:'y'}]},[{path:files[0].path,content:'x x'}]));
});
test('inspection pins tree to resolved commit and rejects a truncated tree',async()=>{
 const original=globalThis.fetch,calls=[];try{globalThis.fetch=async url=>{calls.push(url);return Response.json(url.includes('/git/ref/')?{object:{sha:'a'.repeat(40)}}:{sha:'b'.repeat(40),truncated:true,tree:[]});};
 await assert.rejects(()=>inspectProject({TRINITY_GITHUB_TOKEN:'test-token'}),/neúplný/);assert.match(calls[1],new RegExp('trees/'+'a'.repeat(40)));}finally{globalThis.fetch=original;}
});
test('repeated proposal returns existing PR without generating or overwriting code',async()=>{
 const original=globalThis.fetch;try{globalThis.fetch=async()=>Response.json([{number:7,html_url:'https://github.com/example/pull/7',head:{sha:'abc'}}]);
 const r=await prepareCodeImprovement({TRINITY_GITHUB_TOKEN:'test-token'},{id:'test-id'});assert.equal(r.pull_request,7);assert.equal(r.status,'pull_request_created');}finally{globalThis.fetch=original;}
});
test('proposal retry reuses a verified orphan branch after PR creation failed',async()=>{
 const original=globalThis.fetch;let branchSha=null,modelCalls=0,prAttempts=0;
 const env={TRINITY_GITHUB_TOKEN:'test-token',AI:{async run(){modelCalls++;return {response:JSON.stringify({summary:'Correct a verified calculation regression.',changes:[{path:'Trinity/src/sample.js',before:'return 1;',after:'return 2;'}]})};}}};
 try{
  globalThis.fetch=async(url,options)=>{
   const method=options.method;
   if(url.includes('/pulls?'))return Response.json([]);
   if(url.includes('/git/ref/heads/trinity%2Fevolution-retry-id'))return branchSha?Response.json({object:{sha:branchSha}}):Response.json({message:'Not Found'},{status:404});
   if(url.includes('/git/ref/heads/main'))return Response.json({object:{sha:'a'.repeat(40)}});
   if(url.includes('/git/trees/')&&url.includes('recursive'))return Response.json({sha:'b'.repeat(40),tree:[{path:'Trinity/src/sample.js',type:'blob',sha:'c'.repeat(40),size:40}],truncated:false});
   if(url.includes('/contents/'))return Response.json({sha:'c'.repeat(40),encoding:'base64',size:40,content:Buffer.from('export function value(){return 1;}').toString('base64')});
   if(url.endsWith('/git/trees'))return Response.json({sha:'d'.repeat(40)});
   if(url.endsWith('/git/commits')){assert.match(JSON.parse(options.body).message,/Proposal: retry-id/);return Response.json({sha:'e'.repeat(40)});}
   if(url.endsWith('/git/refs')){branchSha='e'.repeat(40);return Response.json({});}
   if(url.endsWith(`/git/commits/${'e'.repeat(40)}`))return Response.json({message:'Trinity improvement: Retry PR\n\nProposal: retry-id'});
   if(url.endsWith('/pulls')&&method==='POST'){
    prAttempts++;
    if(prAttempts===1)return Response.json({message:'temporary failure'},{status:503});
    return Response.json({number:23,html_url:'https://github.com/test/pull/23'});
   }
   throw new Error('Unexpected test request '+url);
  };
  const proposal={id:'retry-id',title:'Retry PR',description:'Recover a verified branch without regenerating code.'};
  await assert.rejects(()=>prepareCodeImprovement(env,proposal),/GitHub POST \/pulls: HTTP 503/);
  const recovered=await prepareCodeImprovement(env,proposal);
  assert.equal(recovered.pull_request,23);assert.equal(recovered.head_sha,'e'.repeat(40));assert.equal(modelCalls,1);assert.equal(prAttempts,2);
 }finally{globalThis.fetch=original;}
});
test('proposal retry rejects an existing branch without its proposal receipt',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async url=>{
   calls++;
   if(url.includes('/pulls?'))return Response.json([]);
   if(url.includes('/git/ref/heads/'))return Response.json({object:{sha:'e'.repeat(40)}});
   if(url.includes('/git/commits/'))return Response.json({message:'Unrelated commit'});
   throw new Error('Unexpected test request '+url);
  };
  await assert.rejects(()=>prepareCodeImprovement({TRINITY_GITHUB_TOKEN:'test-token'},{id:'foreign-id',title:'Foreign branch',description:'Do not trust unrelated branch content.'}),/overiteľný pôvod/);
  assert.equal(calls,3);
 }finally{globalThis.fetch=original;}
});
test('public web rejects credentials, private literals, numeric IP aliases and local hosts',()=>{
 for(const url of ['file:///etc/passwd','https://user:pass@example.com','http://127.1','http://2130706433','http://0x7f000001','http://[::1]','http://10.0.0.1','http://service.internal','http://localhost','https://example.com:8080'])assert.throws(()=>publicWebUrl(url),url);
 assert.equal(publicWebUrl('https://example.com/a#b').href,'https://example.com/a');
});
test('web checks DNS and each redirect, strips scripts and never forwards credentials',async()=>{
 const original=globalThis.fetch,calls=[];try{globalThis.fetch=async(url,options)=>{calls.push({url,options});if(url.startsWith('https://cloudflare-dns.com/'))return Response.json({Answer:[{type:1,data:'93.184.216.34'}]});return new Response('<h1>Hello</h1><script>secret()</script><p>World</p>',{headers:{'Content-Type':'text/html'}});};
 const result=await fetchPublicWeb('https://example.com');assert.match(result.content,/Hello World/);assert.doesNotMatch(result.content,/secret/);assert.equal(calls.at(-1).options.headers.Authorization,undefined);
 globalThis.fetch=async url=>url.startsWith('https://cloudflare-dns.com/')?Response.json({Answer:[{type:1,data:'10.0.0.1'}]}):new Response('must not be fetched');await assert.rejects(()=>fetchPublicWeb('https://example.com'),/verejnú adresu/);
 globalThis.fetch=async url=>url.startsWith('https://cloudflare-dns.com/')?Response.json({Answer:[{type:1,data:'93.184.216.34'}]}):new Response(null,{status:302,headers:{Location:'http://127.0.0.1'}});await assert.rejects(()=>fetchPublicWeb('https://example.com'),/verejnú HTTP/);
 }finally{globalThis.fetch=original;}
});
test('infrastructure status contains configuration states, no secrets',()=>{const report=infrastructureStatus({CF_ACCOUNT_ID:'account',CF_API_TOKEN:'secret-token',TRINITY_GITHUB_TOKEN:'github-secret'});assert.equal(report.registrar.configured,true);assert.equal(report.evolution.configured,true);assert.equal(report.hosting.default_visibility,'private');assert.doesNotMatch(JSON.stringify(report),/secret-token|github-secret/);});

test('automatic integration is limited to presentation and documentation, not privileged source',async()=>{
 const {automaticMergeAllowed}=await import('../src/project-evolution.js');
 assert.equal(automaticMergeAllowed([{path:'Trinity/public/assistant/chat.css'}]),true);
 assert.equal(automaticMergeAllowed([{path:'Trinity/src/security.js'}]),false);
 assert.equal(automaticMergeAllowed([{path:'.github/workflows/ci.yml'}]),false);
 assert.equal(automaticMergeAllowed([]),false);
});

test('automatic merge checks actual GitHub filenames and successful CI for the exact head',async()=>{
 const {mergeVerifiedImprovement}=await import('../src/project-evolution.js');const old=globalThis.fetch;let mergeCalls=0,checksPassed=false;
 try{globalThis.fetch=async(url,options)=>{
  if(url.includes('/files?'))return Response.json([{filename:'Trinity/public/assistant/chat.css'}]);
  if(url.includes('/check-runs?')){assert.match(url,/commits\/exact-head\/check-runs/);return Response.json({total_count:1,check_runs:[{name:'Cloudflare build, tests, dependency and AI policy',app:{slug:'github-actions'},status:'completed',conclusion:checksPassed?'success':'failure'}]});}
  mergeCalls++;assert.equal(JSON.parse(options.body).sha,'exact-head');return Response.json({merged:true,sha:'merged-sha'});
 };
 const env={TRINITY_GITHUB_TOKEN:'test-only',TRINITY_AUTO_MERGE:'true'},pr={number:1,changed_files:1,mergeable:true,mergeable_state:'clean',head:{sha:'exact-head'}};
 assert.equal((await mergeVerifiedImprovement(env,pr)).status,'waiting_for_checks');assert.equal(mergeCalls,0);
 checksPassed=true;assert.equal((await mergeVerifiedImprovement(env,pr)).status,'merged');assert.equal(mergeCalls,1);
 }finally{globalThis.fetch=old;}
});

test('UI scope reads only presentation files from the pinned commit',async()=>{
 const old=globalThis.fetch;let treeRead=false;
 try{
  globalThis.fetch=async url=>{
   if(url.includes('/git/ref/'))return Response.json({object:{sha:'a'.repeat(40)}});
   assert.match(url,new RegExp('/git/trees/'+'a'.repeat(40)));treeRead=true;
   return Response.json({sha:'b'.repeat(40),tree:[
    {path:'Trinity/src/engine.js',type:'blob',size:10},
    {path:'Trinity/public/assistant/chat.html',type:'blob',size:20},
    {path:'Trinity/public/assistant/theme.css',type:'blob',size:20},
    {path:'Trinity/public/assistant/chat.js.txt',type:'blob',size:20}
   ]});
  };
  const result=await inspectProject({TRINITY_GITHUB_TOKEN:'test'},'uprav UI','ui');
  assert.equal(treeRead,true);assert.equal(result.base_sha,'a'.repeat(40));
  assert.deepEqual(result.candidates.map(f=>f.path).sort(),['Trinity/public/assistant/chat.html','Trinity/public/assistant/theme.css']);
 }finally{globalThis.fetch=old;}
});
test('UI patch keeps existing controls and rejects removal, duplicate IDs and source escape',async()=>{
 const {validateUIPatch}=await import('../src/project-evolution.js');
 const path='Trinity/public/assistant/chat.html',original=[{path,content:'<button id="send">Send</button>'}];
 assert.doesNotThrow(()=>validateUIPatch({files:[{path,content:'<button class="primary" id="send">Odoslať</button>'}]},original));
 for(const content of ['<button>Send</button>','<button id="send"></button><input id="send">']){
  assert.throws(()=>validateUIPatch({files:[{path,content}]},original),/ID/);
 }
 assert.throws(()=>validateUIPatch({files:[{path:'Trinity/src/engine.js',content:'changed'}]},original),/mimo/);
});

test('existing closed PR is not reported as open or regenerated; merged PR remains merged',async()=>{
 const original=globalThis.fetch;
 try{
  for(const [pr,status] of [
   [{number:7,state:'closed',merged_at:null,head:{sha:'abc'},html_url:'https://github.com/example/pull/7'},'pull_request_closed'],
   [{number:7,state:'closed',merged_at:'2026-10-21T10:00:00Z',head:{sha:'abc'},html_url:'https://github.com/example/pull/7'},'merged'],
   [{number:7,state:'open',merged_at:null,head:{sha:'abc'},html_url:'https://github.com/example/pull/7'},'pull_request_created']
  ]){
   let calls=0;
   globalThis.fetch=async(url,options)=>{calls++;assert.equal(options.method,'GET');return Response.json([pr]);};
   const result=await prepareCodeImprovement({TRINITY_GITHUB_TOKEN:'test-token'},{id:'test-id'});
   assert.equal(result.status,status);assert.equal(result.deployed,false);assert.equal(calls,1);
  }
 }finally{globalThis.fetch=original;}
});

test('UI ID guard distinguishes data attributes and recognizes HTML attribute casing',async()=>{
 const {validateUIPatch}=await import('../src/project-evolution.js');
 const path='Trinity/public/assistant/chat.html';
 const cases=[
  {
    "before": "<button id=\"send\">Send</button>",
    "after": "<button data-id=\"send\">Send</button>",
    "reject": true
  },
  {
    "before": "<button id=\"send\">Send</button>",
    "after": "<button id=\"send\" data-id=\"send\">Send</button>",
    "reject": false
  },
  {
    "before": "<button ID=\"send\">Send</button>",
    "after": "<button data-id=\"send\">Send</button>",
    "reject": true
  },
  {
    "before": "<button id=\"send\">Send</button>",
    "after": "<button ID=\"send\">Send</button>",
    "reject": false
  },
  {
    "before": "<button id=\"send\">Send</button>",
    "after": "<button id=\"send\"></button><input ID=\"send\">",
    "reject": true
  },
  {
    "before": "<button id=\"send\">Send</button>",
    "after": "<button\nid='send'>Send</button>",
    "reject": false
  },
  {
    "before": "<button data-id=\"send\">Send</button>",
    "after": "<button data-id=\"other\">Send</button>",
    "reject": false
  },
  {
    "before": "<button id=\"send\">Send</button>",
    "after": "<button id=\"other\">Send</button>",
    "reject": true
  }
];
 for(const item of cases){
  const run=()=>validateUIPatch({files:[{path,content:item.after}]},[{path,content:item.before}]);
  if(item.reject)assert.throws(run,/ID/,item.after);
  else assert.doesNotThrow(run,item.after);
 }
});

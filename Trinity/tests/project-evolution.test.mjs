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

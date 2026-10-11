import test from 'node:test';
import assert from 'node:assert/strict';
import {KNOWLEDGE_SOURCES,listKnowledgeSources,readKnowledgeSource} from '../src/knowledge-sources.js';
import {formatMemoryContext,selectMemoryRecords} from '../src/memory-context.js';
import {VERIFIED_ARCHITECTURE_CONTEXT} from '../src/architecture.js';

const now=Date.parse('2026-10-11T16:00:00Z');
const text=content=>new Response(content,{headers:{'Content-Type':'text/markdown'}});

test('official source selection is bounded and accent-insensitive',()=>{
  assert.equal(KNOWLEDGE_SOURCES.length,5);
  assert.ok(KNOWLEDGE_SOURCES.every(s=>new URL(s.url).protocol==='https:'));
  assert.ok(listKnowledgeSources('lokálna databáza').some(s=>s.id==='d1-local-development'));
  assert.ok(listKnowledgeSources('Qwen').some(s=>s.id==='ollama-api'));
  assert.equal(listKnowledgeSources('unknown topic').length,0);
});

test('source reader sends no credentials or private task text and attributes fetched content',async()=>{
  let requested;
  const result=await readKnowledgeSource({},'ollama-api',{now,fetchImpl:async(url,options)=>{
    requested={url,options};return text('# Ollama\nLocal API documentation.');
  }});
  assert.equal(requested.url,'https://docs.ollama.com/api/introduction');
  assert.equal(requested.options.redirect,'error');
  assert.deepEqual(Object.keys(requested.options.headers),['Accept']);
  assert.equal(result.source_url,requested.url);
  assert.equal(result.fetched_at,new Date(now).toISOString());
  assert.equal(result.cache,'miss');assert.equal(result.untrusted_data,true);
  assert.equal(Date.parse(result.expires_at)-now,3600000);
});

test('unknown source IDs never cause network requests',async()=>{
  let calls=0;
  for(const id of ['https://127.0.0.1','file:///etc/passwd','not-in-catalog']){
    await assert.rejects(readKnowledgeSource({},id,{fetchImpl:async()=>{calls++;return text('x');}}));
  }
  assert.equal(calls,0);
});

test('expired, mismatched and future cache records are refreshed',async()=>{
  const source=KNOWLEDGE_SOURCES[0];
  for(const bad of [
    {id:source.id,source_url:source.url,content:'old',fetched_at:new Date(now-7200000).toISOString(),expires_at:new Date(now-1).toISOString()},
    {id:source.id,source_url:'https://example.com',content:'wrong',fetched_at:new Date(now).toISOString(),expires_at:new Date(now+1000).toISOString()},
    {id:source.id,source_url:source.url,content:'future',fetched_at:new Date(now+1000).toISOString(),expires_at:new Date(now+2000).toISOString()},
  ]){
    let calls=0;
    const result=await readKnowledgeSource({Mastermind:{get:async()=>bad}},source.id,{now,fetchImpl:async()=>{calls++;return text('fresh');}});
    assert.equal(calls,1);assert.equal(result.content,'fresh');
  }
});

test('valid cached references are redacted and cannot leak arbitrary cache fields',async()=>{
  const source=KNOWLEDGE_SOURCES[0];
  const cached={id:source.id,source_url:source.url,content:'Bearer abcdefghijklmnopqrstuvwxyz',fetched_at:new Date(now).toISOString(),
    expires_at:new Date(now+1000).toISOString(),private_token:'do-not-return'};
  const result=await readKnowledgeSource({Mastermind:{get:async()=>cached}},source.id,{now,fetchImpl:async()=>{throw new Error('must not fetch');}});
  assert.equal(result.cache,'hit');assert.ok(result.content.includes('[redacted]'));
  assert.equal(result.private_token,undefined);
});

test('bounded documents remove HTML scripts and record truncation',async()=>{
  const html=new Response('<main><script>do not execute</script><p>Useful documentation</p></main>',{headers:{'Content-Type':'text/html'}});
  const result=await readKnowledgeSource({},'ollama-api',{now,fetchImpl:async()=>html});
  assert.ok(result.content.includes('Useful documentation'));assert.ok(!result.content.includes('do not execute'));
  const large=await readKnowledgeSource({},'ollama-api',{now,fetchImpl:async()=>text('x'.repeat(210000))});
  assert.equal(large.content.length,10000);assert.equal(large.truncated,true);
});

test('source HTTP failures, empty and binary responses never become knowledge',async()=>{
  for(const response of [
    new Response('not allowed',{status:403}),
    new Response('binary',{headers:{'Content-Type':'application/octet-stream'}}),
    text(''),
  ])await assert.rejects(readKnowledgeSource({},'ollama-api',{now,fetchImpl:async()=>response}));
});

test('public source snapshots have stable keys and cannot overwrite user-authored memories',async()=>{
  let sql,values,stored;
  const env={DB:{prepare:query=>{sql=query;return {bind(...args){values=args;return this;},run:async()=>({success:true})};}},
    Mastermind:{get:async()=>null,put:async(_,value)=>{stored=JSON.parse(value);}}};
  await readKnowledgeSource(env,'ollama-api',{now,fetchImpl:async()=>text('Bearer abcdefghijklmnopqrstuvwxyz')});
  assert.match(sql,/WHERE ops_memory.source=excluded.source/);
  assert.equal(values[0],'web/ollama-api');
  assert.equal(values[2],'web:https://docs.ollama.com/api/introduction');
  assert.ok(values[1].includes('[redacted]'));assert.ok(stored.content.includes('[redacted]'));
});

test('memory context distinguishes profiles, history and web references without treating them as live proof',()=>{
  const records=[
    {key:'profil/project',value:'Preferujem OneDrive',source:'user:explicit'},
    {key:'old/note',value:'Ollama kedysi bezala.',source:'legacy:memory'},
    {key:'web/ollama',value:'Documentation',source:'web:https://docs.ollama.com/api/introduction'},
  ];
  const parsed=JSON.parse(formatMemoryContext(records));
  assert.equal(parsed[0].record_type,'user-profile');
  assert.equal(parsed[1].record_type,'historical');
  assert.equal(parsed[2].record_type,'web-reference');
  assert.equal(parsed[2].fact_status,'reference-not-live');
  assert.equal(parsed[2].untrusted_data,true);
  assert.equal(selectMemoryRecords(records,'OneDrive')[0].key,'profil/project');
});

test('architecture reference does not teach obsolete versions, test counts or PC readiness',()=>{
  assert.doesNotMatch(VERIFIED_ARCHITECTURE_CONTEXT,/8\.0\.0|79\/79|4\/4|gateway ready|cloud connected/);
  assert.match(VERIFIED_ARCHITECTURE_CONTEXT,/OpenAI, Google Gemini/);
  assert.match(VERIFIED_ARCHITECTURE_CONTEXT,/nie živý health check/);
  assert.match(VERIFIED_ARCHITECTURE_CONTEXT,/nikdy pamäť/);
});
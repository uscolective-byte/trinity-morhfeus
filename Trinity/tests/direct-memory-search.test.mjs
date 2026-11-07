import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {runAgent} from '../src/engine.js';
import {directChatTool} from '../src/fast-chat.js';

function memoryEnv(t) {
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 db.exec(`CREATE TABLE ops_memory(key TEXT,value TEXT,source TEXT,updated_at TEXT);
 CREATE TABLE memory_long(key TEXT,value TEXT,category TEXT,importance INTEGER);`);
 db.prepare('INSERT INTO ops_memory VALUES(?,?,?,?)').run('projekt/Žilina','Stretnutie tímu v Žiline.','user','2026-11-04');
 db.prepare('INSERT INTO memory_long VALUES(?,?,?,?)').run('archív/Košice','Uložený plán pre Košice.','user',10);
 return {DB:{prepare(sql){
  let params=[];
  const stmt={bind(...values){params=values;return stmt;},
   async first(){if(sql.includes('ops_plugins'))return {installed:1,enabled:1};return db.prepare(sql).get(...params)||null;},
   async all(){
    if(sql.includes('ops_plugins'))return {results:[{id:'memory',installed:1,enabled:1}]};
    if(sql.includes('self_improvement_proposals'))return {results:[]};
    return {results:db.prepare(sql).all(...params)};
   }};return stmt;
 }}};
}

test('memory intent normalization preserves the exact accented query payload',()=>{
 assert.deepEqual(directChatTool('Prosím hľadaj v pamäti Žilina',['search_memory']),{name:'search_memory',arguments:{query:'Žilina'}});
 assert.deepEqual(directChatTool('najdi v pamati report_100%',['search_memory'])?.arguments,{query:'report_100%'});
});

test('direct chat shows matching canonical records from actual SQLite LIKE queries',async t=>{
 const env=memoryEnv(t);
 for(const [query,expected] of [['Žilina','Stretnutie tímu v Žiline.'],['Košice','Uložený plán pre Košice.']]){
  const result=await runAgent(env,'orchestrator',`Hľadaj v pamäti ${query}`,'','fast');
  assert.match(result.text,new RegExp(expected));
  assert.doesNotMatch(result.text,/nenašiel|undefined/);
  assert.equal(result.tool_log[0].tool,'search_memory');
 }
});

test('a real empty memory lookup remains empty and wildcard input stays literal',async t=>{
 const env=memoryEnv(t);
 for(const query of ['Neznámy projekt','%','_']){
  const result=await runAgent(env,'orchestrator',`Hľadaj v pamäti ${query}`,'','fast');
  assert.match(result.text,/nenašiel žiadny záznam/);
  assert.doesNotMatch(result.text,/Stretnutie|Uložený plán/);
 }
});

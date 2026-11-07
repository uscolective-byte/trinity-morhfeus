import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {loadConversationHistory} from '../src/conversation-history.js';

function fixture(t) {
  const db=new DatabaseSync(':memory:');t.after(()=>db.close());
  db.exec('CREATE TABLE ops_jobs(id TEXT,session_id TEXT,task TEXT,result TEXT,status TEXT,created_at TEXT)');
  const insert=(id,session,task,result,status='completed',time='2026-11-04 00:00:00')=>db.prepare('INSERT INTO ops_jobs VALUES(?,?,?,?,?,?)').run(id,session,task,result,status,time);
  const env={DB:{prepare(sql){let params=[];const statement={bind(...p){params=p;return statement;},async all(){return {results:db.prepare(sql).all(...params)};}};return statement;}}};
  return {env,insert};
}

test('same-second conversation context selects the latest four turns in chronological order',async t=>{
  const {env,insert}=fixture(t);
  for(let i=1;i<=7;i++)insert(String(i),'session',`Správa ${i}`,`Odpoveď ${i}`);
  insert('current','session','Aktuálna správa','Nezahrnúť');
  insert('other','other-session','Cudzí rozhovor','Nezahrnúť');
  insert('failed','session','Zlyhaná správa','Nezahrnúť','failed');
  const rows=await loadConversationHistory(env,'session','current');
  assert.deepEqual(rows.map(row=>row.task),['Správa 4','Správa 5','Správa 6','Správa 7']);
  assert.deepEqual(rows.map(row=>row.result),['Odpoveď 4','Odpoveď 5','Odpoveď 6','Odpoveď 7']);
});

test('timestamps take priority over insertion order and context remains bounded',async t=>{
  const {env,insert}=fixture(t);
  insert('new','session','Novšia', 'Obsah odpovede. '.repeat(150),'completed','2026-11-04 00:00:01');
  insert('old','session','Staršia', 'Staršia odpoveď','completed','2026-11-03 23:59:59');
  const rows=await loadConversationHistory(env,'session','current');
  assert.deepEqual(rows.map(row=>row.task),['Staršia','Novšia']);
  assert.equal(rows[1].result.length,1600);
  assert.deepEqual(await loadConversationHistory(env,'empty','current'),[]);
});

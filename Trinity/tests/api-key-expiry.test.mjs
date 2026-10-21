import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {authenticateApiKey} from '../src/api-keys.js';
import {hash} from '../src/security.js';
test('API key expiration compares timestamps rather than ISO text against SQLite datetime',async()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec("CREATE TABLE ops_api_access_keys(id TEXT,owner_id TEXT,name TEXT,key_hash TEXT,status TEXT,expires_at TEXT,scopes_json TEXT,rate_limit_per_minute INTEGER,last_used_at TEXT); CREATE TABLE ops_api_key_usage(key_id TEXT,minute_window INTEGER,request_count INTEGER,PRIMARY KEY(key_id,minute_window));");
  const secret='trn_live_'+('x'.repeat(43));
  db.prepare('INSERT INTO ops_api_access_keys VALUES(?,?,?,?,?,?,?,?,NULL)').run('key','owner','Test',await hash(secret),'active',new Date(Date.now()-10000).toISOString(),'["mcp:read"]',60);
  const env={DB:{prepare(sql){return {bind(...args){return {first:async()=>db.prepare(sql).get(...args),run:async()=>db.prepare(sql).run(...args)};}};}}};
  const request=new Request('https://auru.space/mcp',{headers:{Authorization:'Bearer '+secret}});
  await assert.rejects(authenticateApiKey(request,env,'mcp:read'),e=>e.status===401);
  db.prepare('UPDATE ops_api_access_keys SET expires_at=?').run(new Date(Date.now()+3600000).toISOString());
  const key=await authenticateApiKey(request,env,'mcp:read');assert.equal(key.id,'key');
  assert.equal(db.prepare('SELECT request_count FROM ops_api_key_usage').get().request_count,1);
 }finally{db.close();}
});

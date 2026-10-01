import {DurableObject,WorkerEntrypoint} from 'cloudflare:workers';
import {sanitizeActionEvent,sanitizeHeartbeat} from './policy.js';

const VERSION='2.0.0';
const encoder=new TextEncoder();
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});

async function equalSecret(provided,expected){
  const [left,right]=await Promise.all([crypto.subtle.digest('SHA-256',encoder.encode(provided||'')),crypto.subtle.digest('SHA-256',encoder.encode(expected||''))]);
  return crypto.subtle.timingSafeEqual(new Uint8Array(left),new Uint8Array(right));
}

async function authorize(request,env){
  const provided=request.headers.get('Authorization')?.replace(/^Bearer\s+/i,'')||'';
  return typeof env.BRIDGE_KEY==='string'&&env.BRIDGE_KEY.length>=32&&provided.length>=32&&await equalSecret(provided,env.BRIDGE_KEY);
}

async function readJSON(request,limit=32_000){
  const length=Number(request.headers.get('Content-Length')||0);if(length>limit)throw Object.assign(new Error('Požiadavka je príliš veľká.'),{status:413});
  const text=await request.text();if(text.length>limit)throw Object.assign(new Error('Požiadavka je príliš veľká.'),{status:413});
  try{return JSON.parse(text||'{}');}catch{throw Object.assign(new Error('Neplatný JSON.'),{status:400});}
}

export class PCBridgeDurableObject extends DurableObject {
  constructor(ctx,env){
    super(ctx,env);
    ctx.blockConcurrencyWhile(async()=>{
      this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS bridge_state (
        id INTEGER PRIMARY KEY CHECK (id=1), gateway_id TEXT NOT NULL, version TEXT NOT NULL,
        capabilities_json TEXT NOT NULL, last_seen INTEGER NOT NULL
      )`);
      this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS action_events (
        id TEXT PRIMARY KEY, action TEXT NOT NULL, status TEXT NOT NULL,
        requested_by TEXT NOT NULL, updated_at INTEGER NOT NULL
      )`);
      this.ctx.storage.sql.exec('CREATE INDEX IF NOT EXISTS idx_action_events_updated ON action_events(updated_at DESC)');
    });
  }

  async heartbeat(input){
    const data=sanitizeHeartbeat(input),now=Date.now();
    this.ctx.storage.sql.exec(`INSERT INTO bridge_state(id,gateway_id,version,capabilities_json,last_seen)
      VALUES(1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET gateway_id=excluded.gateway_id,version=excluded.version,
      capabilities_json=excluded.capabilities_json,last_seen=excluded.last_seen`,data.gateway_id,data.version,JSON.stringify(data.capabilities),now);
    return {accepted:true,last_seen:now};
  }

  async recordAction(input){
    const data=sanitizeActionEvent(input);
    this.ctx.storage.sql.exec(`INSERT INTO action_events(id,action,status,requested_by,updated_at) VALUES(?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET action=excluded.action,status=excluded.status,
      requested_by=excluded.requested_by,updated_at=excluded.updated_at`,data.id,data.action,data.status,data.requested_by,data.updated_at);
    this.ctx.storage.sql.exec(`DELETE FROM action_events WHERE id IN (
      SELECT id FROM action_events ORDER BY updated_at DESC LIMIT -1 OFFSET 500
    )`);
    return {recorded:true,id:data.id,status:data.status};
  }

  async status(){
    const state=this.ctx.storage.sql.exec('SELECT gateway_id,version,capabilities_json,last_seen FROM bridge_state WHERE id=1').toArray()[0]||null;
    const counts=this.ctx.storage.sql.exec('SELECT status,COUNT(*) AS count FROM action_events GROUP BY status').toArray();
    const recent=this.ctx.storage.sql.exec('SELECT id,action,status,requested_by,updated_at FROM action_events ORDER BY updated_at DESC LIMIT 10').toArray();
    const lastSeen=state?.last_seen||0;
    return {connected:Date.now()-lastSeen<45_000,gateway_id:state?.gateway_id||null,gateway_version:state?.version||null,
      capabilities:state?JSON.parse(state.capabilities_json):[],last_seen:lastSeen||null,
      actions:Object.fromEntries(counts.map(row=>[row.status,Number(row.count)])),recent};
  }
}

export default class PCBridgeService extends WorkerEntrypoint {
  coordinator(){return this.env.PC_BRIDGE.getByName('trinity-primary-pc');}
  async heartbeat(event){return this.coordinator().heartbeat(event);}
  async recordAction(event){return this.coordinator().recordAction(event);}
  async getStatus(){return this.coordinator().status();}

  async fetch(request){
    const url=new URL(request.url);
    try{
      if(request.method==='GET'&&url.pathname==='/health'){
        const status=await this.getStatus();
        return json({service:'Trinity PC Bridge',version:VERSION,status:'serving',pc_connected:status.connected});
      }
      if(!await authorize(request,this.env))return json({error:'Unauthorized'},401);
      if(request.method==='POST'&&url.pathname==='/v1/heartbeat')return json(await this.coordinator().heartbeat(await readJSON(request)));
      if(request.method==='GET'&&url.pathname==='/v1/status')return json(await this.getStatus());
      return json({error:'Not found'},404);
    }catch(error){
      console.error(JSON.stringify({event:'pc_bridge_error',path:url.pathname,message:error instanceof Error?error.message:String(error)}));
      return json({error:error instanceof Error?error.message:'Internal error'},error?.status||500);
    }
  }
}

import {z} from 'zod';
import {hash,equal,HttpError} from './security.js';

export const SYSTEM_CAPABILITIES=Object.freeze([
  {id:'read',      approval:false, risk:'read'},
  {id:'write',     approval:true,  risk:'change'},
  {id:'edit',      approval:true,  risk:'change'},
  {id:'selfwrite', approval:true,  risk:'high'},
  {id:'run',       approval:true,  risk:'change'},
  {id:'deploy',    approval:true,  risk:'critical'},
  {id:'share',     approval:true,  risk:'critical'},
  {id:'upload',    approval:true,  risk:'critical'},
  {id:'upgrade',   approval:true,  risk:'critical'},
  // ── NextGen PC akcie ──
  {id:'screenshot', approval:false, risk:'read'},
  {id:'open_app',   approval:true,  risk:'change'},
  {id:'notify',     approval:false, risk:'read'},
  {id:'system_info',approval:false, risk:'read'},
  {id:'scrape',     approval:false, risk:'read'},
  {id:'git_commit', approval:true,  risk:'change'},
  {id:'git_pr',     approval:true,  risk:'change'},
]);
const actionNames=SYSTEM_CAPABILITIES.map(item=>item.id);
export const systemActionSchema=z.object({
  action:z.enum(actionNames),
  payload:z.record(z.string(),z.unknown()).default({}),
  rationale:z.string().min(3).max(1000)
}).strict();

const parseRow=row=>row?{...row,payload:JSON.parse(row.payload_json),receipt:row.receipt_json?JSON.parse(row.receipt_json):null,payload_json:undefined,receipt_json:undefined}:null;

async function mirrorBridge(env,row){
  // Action execution already uses the authenticated claim/receipt API below.
  // Only mirror to an explicitly compatible HTTP endpoint; service-binding
  // property checks are unreliable because RPC proxies expose unknown methods.
  if(!row||env.PC_BRIDGE_MIRROR_ACTIONS!=='true'||!env.PC_BRIDGE_V2?.fetch)return;
  try{
    const response=await env.PC_BRIDGE_V2.fetch(new Request('https://pc-bridge.internal/v1/actions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:row.id,action:row.action,status:row.status,requested_by:row.requested_by||'trinity',updated_at:Date.now()})}));
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
  }
  catch(error){console.error(JSON.stringify({event:'pc_bridge_mirror_failed',action_id:row.id,message:error instanceof Error?error.message:String(error)}));}
}

export async function getPCBridgeStatus(env){
  const bridge=env.PC_BRIDGE_V2||env.PC_BRIDGE_SERVICE;
  if(!bridge?.fetch)return {connected:false,status:'not-configured'};
  try{
    const path=env.PC_BRIDGE_V2?'/v1/status':'/health';
    const response=await bridge.fetch(new Request(`https://pc-bridge.internal${path}`));
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const data=await response.json();
    const connected=typeof data.online==='boolean'?data.online:data.connected===true||data.status==='ready'||data.status==='serving';
    return {...data,connected,status:connected?'available':'offline'};
  }
  catch(error){console.error(JSON.stringify({event:'pc_bridge_status_failed',message:error instanceof Error?error.message:String(error)}));return {connected:false,status:'unavailable'};}
}

export async function createSystemAction(env,input,requestedBy='trinity'){
  const data=systemActionSchema.parse(input);const definition=SYSTEM_CAPABILITIES.find(item=>item.id===data.action);const id=crypto.randomUUID();const now=Date.now();const status=definition.approval?'proposed':'approved';
  await env.DB.prepare(`INSERT INTO ops_system_actions(id,action,payload_json,rationale,status,requested_by,approved_by,approved_at,expires_at,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`).bind(id,data.action,JSON.stringify(data.payload),data.rationale,status,requestedBy,definition.approval?null:'policy:auto-read',definition.approval?null:now,now+30*60_000).run();
  await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('system_action_proposed',?)").bind(JSON.stringify({id,action:data.action,status,requested_by:requestedBy})).run();
  const row=await getSystemAction(env,id);await mirrorBridge(env,row);return row;
}

export async function getSystemAction(env,id){return parseRow(await env.DB.prepare('SELECT * FROM ops_system_actions WHERE id=?').bind(id).first());}
export async function listSystemActions(env){return (await env.DB.prepare('SELECT * FROM ops_system_actions ORDER BY created_at DESC LIMIT 50').all()).results.map(parseRow);}

export async function approveSystemAction(env,id,approvedBy='user'){
  const now=Date.now();const row=await env.DB.prepare("UPDATE ops_system_actions SET status='approved',approved_by=?,approved_at=?,updated_at=datetime('now') WHERE id=? AND status='proposed' AND expires_at>? RETURNING *").bind(approvedBy,now,id,now).first();
  if(!row){const current=await getSystemAction(env,id);throw new HttpError(current?409:404,current?`Akcia je v stave ${current.status}.`:'Akcia neexistuje.');}
  await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('system_action_approved',?)").bind(JSON.stringify({id,action:row.action,approved_by:approvedBy})).run();
  const parsed=parseRow(row);await mirrorBridge(env,parsed);return parsed;
}

export async function rejectSystemAction(env,id,rejectedBy='user'){
  const row=await env.DB.prepare("UPDATE ops_system_actions SET status='rejected',approved_by=?,updated_at=datetime('now') WHERE id=? AND status IN ('proposed','approved') RETURNING *").bind(rejectedBy,id).first();
  if(!row)throw new HttpError(409,'Akciu už nemožno odmietnuť.');const parsed=parseRow(row);await mirrorBridge(env,parsed);return parsed;
}

export async function claimSystemAction(env,gatewayId){
  const now=Date.now(),lease=now+90_000;
  const expired=await env.DB.prepare(`UPDATE ops_system_actions SET status='failed',error='Platnosť systémovej akcie vypršala pred dokončením.',lease_until=NULL,completed_at=?,updated_at=datetime('now')
    WHERE expires_at<=? AND status IN ('proposed','approved','claimed') RETURNING *`).bind(now,now).all();
  for(const item of expired.results||[])await mirrorBridge(env,parseRow(item));
  const row=await env.DB.prepare(`UPDATE ops_system_actions SET status='claimed',claimed_by=?,lease_until=?,attempts=attempts+1,updated_at=datetime('now')
    WHERE id=(SELECT id FROM ops_system_actions WHERE expires_at>? AND (status='approved' OR (status='claimed' AND lease_until<?)) ORDER BY created_at LIMIT 1)
    RETURNING *`).bind(gatewayId,lease,now,now).first();
  const parsed=parseRow(row);await mirrorBridge(env,parsed);return parsed;
}

export async function finishSystemAction(env,id,gatewayId,input){
  const data=z.object({status:z.enum(['completed','failed']),receipt:z.record(z.string(),z.unknown()).optional(),error:z.string().max(4000).optional()}).strict().parse(input);
  if(data.status==='completed'&&!data.receipt)throw new HttpError(400,'Dokončenie vyžaduje potvrdenie.');
  const row=await env.DB.prepare(`UPDATE ops_system_actions SET status=?,receipt_json=?,error=?,lease_until=NULL,completed_at=?,updated_at=datetime('now')
    WHERE id=? AND status='claimed' AND claimed_by=? RETURNING *`).bind(data.status,data.receipt?JSON.stringify(data.receipt):null,data.error||null,Date.now(),id,gatewayId).first();
  if(!row)throw new HttpError(409,'Akcia nie je pridelená tejto lokálnej bráne.');
  await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('system_action_finished',?)").bind(JSON.stringify({id,action:row.action,status:data.status,gateway:gatewayId})).run();
  const parsed=parseRow(row);await mirrorBridge(env,parsed);return parsed;
}

export async function authenticateGateway(request,env){
  const token=request.headers.get('Authorization')?.replace(/^Bearer\s+/i,'')||request.headers.get('X-Trinity-Gateway');
  if(typeof token!=='string'||token.length<32||typeof env.TRINITY_GATEWAY_KEY!=='string'||env.TRINITY_GATEWAY_KEY.length<32)throw new HttpError(401,'Lokálna brána nie je autorizovaná.');
  if(!await equal(token,env.TRINITY_GATEWAY_KEY))throw new HttpError(401,'Lokálna brána nie je autorizovaná.');
  return `gateway:${(await hash(token)).slice(0,16)}`;
}

export function actionEvidence(action){
  const claims={
    read:['verify'],write:['change','create_file'],edit:['change'],selfwrite:['change'],
    run:['execute'],deploy:['deploy'],share:['send','publish'],upload:['publish'],upgrade:['install','change'],
    screenshot:['verify'],open_app:['execute'],notify:['send'],system_info:['verify'],
    scrape:['verify'],git_commit:['change','publish'],git_pr:['change','publish'],
  };
  return claims[action]||[];
}

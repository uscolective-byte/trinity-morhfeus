import {assertPublicHttps,boundedString,idempotent,json,readCall,requireApproval,safeFailure} from './worker-runtime.js';

const ROLE='connectors';
function parseConfig(value){if(value===undefined)return {};if(typeof value==='object'&&value&&!Array.isArray(value))return value;if(typeof value==='string'){try{const parsed=JSON.parse(value);if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))return parsed;}catch{}}throw Object.assign(new Error('config must be a JSON object'),{status:400});}
export default {async fetch(request,env){
  if(request.method==='GET'&&new URL(request.url).pathname==='/health'){
    try{await env.DB.prepare('SELECT id FROM connectors LIMIT 1').all();return json({ok:true,service:'trinity-connectors',version:'2.0.0',bindings:{DB:true}});}
    catch{return json({ok:false,service:'trinity-connectors',status:'degraded'},503);}
  }
  let traceId=crypto.randomUUID();
  try{
    const call=await readCall(request);traceId=call.traceId;const d=call.data;
    if(call.action==='connect.list'){
      const rows=await env.DB.prepare('SELECT id,name,type,status,config,created_at,updated_at FROM connectors ORDER BY name ASC LIMIT 100').all();
      return json({ok:true,result:rows.results,traceId,from:ROLE});
    }
    if(call.action==='connect.integrations'){
      const rows=await env.DB.prepare('SELECT id,service,status,config,connected_at,created_at FROM integrations ORDER BY created_at DESC LIMIT 100').all();
      return json({ok:true,result:rows.results,traceId,from:ROLE});
    }
    if(call.action==='connect.register'){
      requireApproval(call.approval);const name=boundedString(d.name,'name',{required:true,min:2,max:100});const type=boundedString(d.type??'api','type',{min:2,max:50});const config=parseConfig(d.config);
      if(config.endpoint)assertPublicHttps(config.endpoint);
      const result=await idempotent(env,call.idempotencyKey,async()=>{const id=crypto.randomUUID();await env.DB.prepare("INSERT INTO connectors(id,name,type,status,config,created_at,updated_at) VALUES(?,?,?,'active',?,datetime('now'),datetime('now'))").bind(id,name,type,JSON.stringify(config)).run();return {id};});
      return json({ok:true,result,traceId,from:ROLE});
    }
    if(call.action==='connect.test'){
      requireApproval(call.approval);const id=boundedString(d.id,'id',{required:true,max:100});const connector=await env.DB.prepare('SELECT id,config FROM connectors WHERE id=?').bind(id).first();
      if(!connector)return json({ok:false,error:'Not found',traceId,from:ROLE},404);
      const endpoint=assertPublicHttps(parseConfig(connector.config).endpoint);
      const response=await fetch(endpoint,{method:'HEAD',redirect:'manual',signal:AbortSignal.timeout(10000)});
      return json({ok:true,result:{status:response.status,ok:response.ok},traceId,from:ROLE});
    }
    throw Object.assign(new Error('Unknown action'),{status:400});
  }catch(error){return safeFailure(ROLE,error,traceId);}
}};

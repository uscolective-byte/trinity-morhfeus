export function json(body,status=200,headers={}){
  return Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});
}

export async function readCall(request,maxBytes=64_000){
  if(request.method!=='POST')throw Object.assign(new Error('Method not allowed'),{status:405});
  const length=Number(request.headers.get('content-length')||0);
  if(length>maxBytes)throw Object.assign(new Error('Request body is too large'),{status:413});
  let call;
  try{call=await request.json();}catch{throw Object.assign(new Error('Invalid JSON'),{status:400});}
  if(!call||typeof call!=='object'||Array.isArray(call)||typeof call.action!=='string'||
    (call.data!==undefined&&(!call.data||typeof call.data!=='object'||Array.isArray(call.data)))){
    throw Object.assign(new Error('Invalid request schema'),{status:400});
  }
  return {action:call.action,data:call.data||{},traceId:typeof call.traceId==='string'&&call.traceId.length<=100?call.traceId:crypto.randomUUID(),approval:call.approval||null,idempotencyKey:call.idempotency_key||null};
}

export function boundedString(value,name,{min=0,max=1000,required=false}={}){
  if(value===undefined||value===null){if(required)throw Object.assign(new Error(`${name} is required`),{status:400});return '';}
  if(typeof value!=='string')throw Object.assign(new Error(`${name} must be a string`),{status:400});
  const result=value.trim();
  if(result.length<min||result.length>max)throw Object.assign(new Error(`${name} has an invalid length`),{status:400});
  return result;
}

export function boundedLimit(value,fallback=50){
  const limit=value===undefined?fallback:Number(value);
  if(!Number.isInteger(limit)||limit<1||limit>100)throw Object.assign(new Error('limit must be an integer from 1 to 100'),{status:400});
  return limit;
}

export function requireApproval(approval){
  if(approval?.approved!==true||!['owner','admin'].includes(approval?.role||approval?.actor_role))
    throw Object.assign(new Error('Owner or admin approval is required'),{status:403});
}

export async function idempotent(env,key,operation){
  if(!env.IDEMPOTENCY)return operation();
  if(typeof key!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key))
    throw Object.assign(new Error('A UUID idempotency_key is required'),{status:400});
  const storageKey=`worker-idempotency:${key}`;
  const existing=await env.IDEMPOTENCY.get(storageKey,'json');
  if(existing)return {...existing,idempotent_replay:true};
  const result=await operation();
  await env.IDEMPOTENCY.put(storageKey,JSON.stringify(result),{expirationTtl:86400});
  return result;
}

export function safeFailure(role,error,traceId){
  const status=Number.isInteger(error?.status)?error.status:500;
  console.error(JSON.stringify({event:'worker_request_failed',role,traceId,status,message:String(error?.message||error).slice(0,300)}));
  return json({ok:false,error:status===500?'Internal service error':error.message,traceId,from:role},status);
}

export function assertPublicHttps(value){
  let url;
  try{url=new URL(value);}catch{throw Object.assign(new Error('A valid HTTPS endpoint is required'),{status:400});}
  if(url.protocol!=='https:'||url.username||url.password||url.port)
    throw Object.assign(new Error('Only credential-free HTTPS endpoints on the default port are allowed'),{status:400});
  const host=url.hostname.toLowerCase().replace(/\.$/,'');
  if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host==='0.0.0.0'||host==='169.254.169.254'||
    /^127\./.test(host)||/^10\./.test(host)||/^192\.168\./.test(host)||/^172\.(1[6-9]|2\d|3[01])\./.test(host)||host==='::1'||host.startsWith('fc')||host.startsWith('fd'))
    throw Object.assign(new Error('Private or local endpoints are not allowed'),{status:403});
  return url;
}

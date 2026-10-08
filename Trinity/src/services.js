import {createSystemAction,getSystemAction} from './system-actions.js';
import {getConfiguredAIProvider} from './ai-providers.js';

export const SERVICES = {
  CORE: { name:'Jadro', path:'/health' }, BUILDER:{name:'Vývoj',path:'/health'},
  DISPATCHER:{name:'Dispatcher',path:'/health'}, MEMORY:{name:'Pamäť',path:'/api/stats'},
  CONNECTORS:{name:'Konektory',path:'/health'}, GUARDIAN:{name:'Guardian',path:'/health'},
  SENTINEL:{name:'Monitoring',path:'/api/health'}, SKILLS:{name:'Zručnosti',path:'/health'},
  AURA_ANALYZER:{name:'Analýza',path:'/health'}, AURA_ARCHITECT:{name:'Architektúra',path:'/health'},
  AURA_CODEGEN:{name:'Generovanie kódu',path:'/health'}, AURA_DEPLOYER:{name:'Návrh nasadenia',path:'/health'},
  AURA_EVOLVER:{name:'Zlepšovanie',path:'/health'}, AURA_MEMORY:{name:'Pamäťový špecialista',path:'/health'},
  AURA_OPTIMIZER:{name:'Optimalizácia',path:'/health'}, AURA_PLANNER:{name:'Plánovanie',path:'/health'},
  AURA_SENTINEL:{name:'Bezpečnostný špecialista',path:'/health'}, AURA_TESTER:{name:'Testovanie',path:'/health'}
};
export async function boundedText(response, limit = 40000) {
  if (!response.body) return '';
  const reader = response.body.getReader(); let size=0; const chunks=[];
  while(true) {const {value,done}=await reader.read();if(done)break;size+=value.length;
    if(size>limit){await reader.cancel();throw new Error('Response exceeds limit');}chunks.push(value);}
  return Buffer.concat(chunks).toString('utf8');
}
export async function serviceStatus(env, requested) {
  const names = requested ? [requested] : Object.keys(SERVICES);
  return Promise.all(names.map(async binding => {
    const spec = SERVICES[binding]; if(!spec) throw new Error('Unknown service');
    if(!env[binding]) return {binding,name:spec.name,status:'not_configured'};
    const start=Date.now();
    try {
      const response=await env[binding].fetch(`https://trinity.internal${spec.path}`,{signal:AbortSignal.timeout(12000)});
      const text=await boundedText(response); let data;
      try{data=JSON.parse(text);}catch{throw new Error('Invalid JSON response');}
      return {binding,name:spec.name,status:response.ok&&!data.error?'reachable':'error',http:response.status,duration_ms:Date.now()-start,
        note:'Dostupnosť endpointu; nepotvrdzuje vykonanie AI úlohy.'};
    } catch { return {binding,name:spec.name,status:'error',duration_ms:Date.now()-start}; }
  }));
}
export async function runScheduledHealth(env,cron){
  const checks=await serviceStatus(env),reachable=checks.filter(item=>item.status==='reachable').length,
    failed=checks.filter(item=>item.status==='error').map(item=>item.binding),summary={cron,reachable,total:checks.length,failed,checked_at:new Date().toISOString()};
  await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('scheduled_health_check',?)").bind(JSON.stringify(summary)).run();
  console.log(JSON.stringify({event:'scheduled_health_check',...summary}));
  return summary;
}
export async function getOllamaKey(env) {
  const key = env.OLLAMA_API_KEY || (env.OLLAMA_SECRET ? await env.OLLAMA_SECRET.get() : '');
  if (!key || /^(ssh-|-----BEGIN)/.test(key.trim())) throw new Error('Ollama vyžaduje API kľúč; device key nie je API kľúč.');
  return key.trim();
}
export function extractModelText(result) {
  if(typeof result==='string')return result;
  if(typeof result?.output_text==='string')return result.output_text;
  if(typeof result?.response==='string')return result.response;
  if(typeof result?.choices?.[0]?.message?.content==='string')return result.choices[0].message.content;
  if(Array.isArray(result?.output)){
    return result.output.flatMap(item=>Array.isArray(item?.content)?item.content:[])
      .filter(part=>['output_text','text'].includes(part?.type)||typeof part?.text==='string')
      .map(part=>part.text||'').join('\n');
  }
  if(result?.response&&typeof result.response==='object')return JSON.stringify(result.response);
  return '';
}
export function extractGeminiInteractionText(result){
  if(typeof result?.output_text==='string')return result.output_text.trim();
  const blocks=(result?.steps||[]).flatMap(step=>Array.isArray(step?.content)?step.content:Array.isArray(step?.output)?step.output:[]);
  return blocks.filter(block=>block?.type==='text'||typeof block?.text==='string').map(block=>block.text||'').join('\n').trim();
}
export async function callModel(env, provider, messages, maxTokens = 1200) {
  if(provider==='local'){
    if(!env.TRINITY_GATEWAY_KEY)throw new Error('Lokálna brána nie je nakonfigurovaná.');
    const recent=messages.filter(message=>message.role!=='system').slice(-6).map(message=>({role:message.role,content:message.content.slice(0,5000)}));
    const localMessages=[{role:'system',content:'Si Trinity, súkromná lokálna AI asistentka. Odpovedaj prirodzene v jazyku používateľa. Nevymýšľaj vykonané akcie, prístup k súborom ani internet. Ak treba aktuálne dáta alebo externú akciu, jasne povedz, že sa má použiť cloudový režim Trinity.'},...recent];
    const action=await createSystemAction(env,{action:'read',payload:{task:'local-inference',messages:localMessages,max_tokens:Math.min(maxTokens,320)},rationale:'Lokálna AI odpoveď na používateľovu požiadavku'},'provider:local');
    for(let attempt=0;attempt<180;attempt++){
      await new Promise(resolve=>setTimeout(resolve,1000));const current=await getSystemAction(env,action.id);
      if(current?.status==='completed')return {text:current.receipt.response,model:current.receipt.model,provider:'local',usage:current.receipt.usage||null};
      if(current?.status==='failed')throw new Error(current.error||'Lokálny model zlyhal.');
    }
    throw new Error('Lokálny model neodpovedal v časovom limite.');
  }
  if(provider==='ollama') {
    const key=await getOllamaKey(env);
    const model=env.OLLAMA_MODEL || 'gemma4:31b';
    const response=await fetch('https://ollama.com/api/chat',{
      method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({model,messages,stream:false,options:{num_predict:maxTokens,temperature:0.25}}),
      signal:AbortSignal.timeout(65000),redirect:'manual'
    });
    if(!response.ok) throw new Error(`Ollama HTTP ${response.status}`);
    const data=JSON.parse(await boundedText(response,100000));
    if(!data.message?.content?.trim()) throw new Error('Ollama vrátila prázdnu odpoveď.');
    return {text:data.message.content,model,provider,usage:{input:data.prompt_eval_count||0,output:data.eval_count||0}};
  }
  if(provider==='gemini') {
    const {apiKey,model}=await getConfiguredAIProvider(env,'gemini');
    const system=messages.filter(message=>message.role==='system').map(message=>message.content).join('\n\n').slice(0,40000);
    const input=messages.filter(message=>message.role!=='system').slice(-12)
      .map(message=>`${message.role==='assistant'?'TRINITY':'POUŽÍVATEĽ'}:\n${String(message.content).slice(0,20000)}`).join('\n\n');
    const interactionModel=String(model).replace(/^models\//,'');
    const response=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{
      method:'POST',headers:{'x-goog-api-key':apiKey,'Content-Type':'application/json'},
      body:JSON.stringify({model:interactionModel,input,system_instruction:system||undefined,store:false,
        generation_config:{max_output_tokens:Math.min(maxTokens,8192),temperature:0.25}}),
      signal:AbortSignal.timeout(65000),redirect:'manual'
    });
    const data=JSON.parse(await boundedText(response,250000));
    if(!response.ok)throw new Error(`Gemini HTTP ${response.status}: ${data.error?.message||'požiadavka zlyhala'}`);
    const text=extractGeminiInteractionText(data);
    if(!text)throw new Error('Gemini vrátilo prázdnu odpoveď.');
    return {text,model,provider,usage:{input:data.usageMetadata?.promptTokenCount||0,output:data.usageMetadata?.candidatesTokenCount||0}};
  }
  if(provider!=='workers-ai') throw new Error('Unknown provider');
  const model=env.AI_MODEL || '@cf/openai/gpt-oss-120b';
  let timer,result;
  try {result=await Promise.race([env.AI.run(model,{messages,max_tokens:maxTokens,temperature:0.25}),
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Workers AI timeout')),65000);})]);}
  finally {clearTimeout(timer);}
  const text=extractModelText(result);
  if(!text.trim()) throw new Error('Workers AI vrátilo prázdnu odpoveď.');
  return {text,model,provider,usage:result.usage||null};
}

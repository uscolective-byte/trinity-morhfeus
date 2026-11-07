import {configuredBridgeToken,registeredBridgeTunnelUrl} from '../../packages/contracts/src/bridge-auth.js';
/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CORE_RUNTIME
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Modul services.js (Trinity/src/services.js) v ekosystéme TRINITY OMNI-CORE.
 */
import {createSystemAction,getSystemAction} from './system-actions.js';
import {getConfiguredAIProvider,sanitizeApiKey} from './ai-providers.js';
import {resolveProviderSecret} from './secret-vault.js';

export const SERVICES = {
  KNOWLEDGE_SERVICE:{name:'Znalostná knižnica',rpc:'getStatus'},
  CORE: {name:'Jadro',action:'core.state.get'}, BUILDER:{name:'Vývoj',action:'build.list'},
  DISPATCHER:{name:'Dispatcher',action:'job.list'},
  MEMORY:{name:'Pamäť',path:'/health'},
  CONNECTORS:{name:'Konektory',action:'connect.list'}, GUARDIAN:{name:'Guardian',action:'audit.list'},
  SENTINEL:{name:'Monitoring',action:'monitor.health'}, SKILLS:{name:'Zručnosti',action:'skill.list'},
  AURA_ANALYZER:{name:'Analýza',action:'aura.status'}, AURA_ARCHITECT:{name:'Architektúra',action:'aura.status'},
  AURA_CODEGEN:{name:'Generovanie kódu',action:'aura.status'}, AURA_DEPLOYER:{name:'Návrh nasadenia',action:'aura.status'},
  AURA_EVOLVER:{name:'Zlepšovanie',action:'aura.status'}, AURA_MEMORY:{name:'Pamäťový špecialista',action:'aura.status'},
  AURA_OPTIMIZER:{name:'Optimalizácia',action:'aura.status'}, AURA_PLANNER:{name:'Plánovanie',action:'aura.status'},
  AURA_SENTINEL:{name:'Bezpečnostný špecialista',action:'aura.status'}, AURA_TESTER:{name:'Testovanie',action:'aura.status'}
};
export const EXTENDED_SERVICES = {
  ...SERVICES,
  CAPACITY_SERVICE:{name:'Kapacitný manažér',rpc:'getStatus'},
  INTEGRATIONS_SERVICE:{name:'Integračné centrum',rpc:'getStatus'},
  AUDIT_SERVICE:{name:'Auditný motor',rpc:'getStatus'},
  JERICHO_SERVICE:{name:'Jericho Engine',path:'/health'},
  PC_BRIDGE_SERVICE:{name:'PC Bridge',path:'/api/status'},
  PC_BRIDGE_V2:{name:'PC Bridge V2',path:'/api/status'},
  CHAT_INFERENCE_SERVICE:{name:'Chat Inference',path:'/health'},
  RESEARCHER_SERVICE:{name:'Výskumný špecialista',path:'/health'},
  GEMINI_BRIDGE_SERVICE:{name:'Gemini AI Bridge',path:'/health'},
  OPS_SERVICE:{name:'Ops Proxy',path:'/health'},
  CHAT_MAINTAINER_SERVICE:{name:'Chat Maintainer',rpc:'getStatus'},
  DEPLOYER_SERVICE:{name:'Deployer',path:'/health'},
  SEEDER_SERVICE:{name:'Seeder',path:'/health'}
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
    const spec = EXTENDED_SERVICES[binding]; if(!spec) throw new Error('Unknown service');
    if(!env[binding]) return {binding,name:spec.name,status:'not_configured'};
    const start=Date.now();
    try {
      if(spec.rpc && typeof env[binding][spec.rpc]==='function'){
        let timer;let data;
        try{data=await Promise.race([env[binding][spec.rpc](),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('RPC timeout')),12000);})]);}finally{clearTimeout(timer);}
        const ok=data?.ready===true||data?.ok===true||data?.status==='ready'||data?.status==='serving';
        return {binding,name:spec.name,status:ok?'reachable':'error',duration_ms:Date.now()-start,probe:spec.rpc,note:'Overený prístup k úložisku dokumentov; nepotvrdzuje správnosť ich obsahu.'};
      }
      const path=spec.path||'/';
      const init={method:spec.action?'POST':'GET',signal:AbortSignal.timeout(12000)};
      if(spec.action){init.headers={'Content-Type':'application/json'};init.body=JSON.stringify({action:spec.action,data:{limit:1},traceId:crypto.randomUUID()});}
      const response=await env[binding].fetch(`https://trinity.internal${path}`,init);
      const text=await boundedText(response); let data;
      try{data=JSON.parse(text);}catch{throw new Error('Invalid JSON response');}
      const accepted=spec.expected?.includes(response.status)||(response.ok&&data.ok!==false&&!data.error);
      return {binding,name:spec.name,status:accepted?'reachable':'error',http:response.status,duration_ms:Date.now()-start,
        probe:spec.action||path,note:'Dostupnosť role a jej úložiska; nepotvrdzuje vykonanie AI úlohy.'};
    } catch { return {binding,name:spec.name,status:'error',duration_ms:Date.now()-start}; }
  }));
}
export async function readiness(env) {
  const missing=[];
  const criticalBindings=['DB','ARTIFACTS','OPS_WORKFLOW'];
  for(const binding of criticalBindings)if(!env[binding])missing.push(binding);
  let schema=false;
  try {
    const tables=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('conversations','ops_jobs')").all();
    const names=new Set((tables.results||[]).map(row=>row.name));
    if(names.has('conversations')){
      const result=await env.DB.prepare("PRAGMA table_info('conversations')").all();
      schema=Array.isArray(result.results)&&result.results.some(column=>column.name==='message_count');
    } else schema=names.has('ops_jobs');
    const tickets=await env.DB.prepare("PRAGMA table_info('ops_login_tickets')").all();
    schema=schema&&Array.isArray(tickets.results)&&tickets.results.some(column=>column.name==='email');
  } catch {}
  if(!schema)missing.push('DB.schema');
  return {ready:missing.length===0,status:missing.length===0?'ready':'degraded',checks:{bindings:criticalBindings.every(binding=>!!env[binding]),schema,cache:!!env.Mastermind},missing};
}
export async function runScheduledHealth(env,cron){
  const checks=await serviceStatus(env),reachable=checks.filter(item=>item.status==='reachable').length,
    failed=checks.filter(item=>item.status!=='reachable').map(item=>item.binding),
    not_configured=checks.filter(item=>item.status==='not_configured').map(item=>item.binding),
    summary={cron,reachable,total:checks.length,failed,not_configured,healthy:reachable===checks.length,checked_at:new Date().toISOString()};
  await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('scheduled_health_check',?)").bind(JSON.stringify(summary)).run();
  console.log(JSON.stringify({event:'scheduled_health_check',...summary}));
  return summary;
}
export async function getOllamaKey(env) {
  let key = env.OLLAMA_API_KEY || (env.OLLAMA_SECRET ? await env.OLLAMA_SECRET.get() : '');
  if (!key) key = await resolveProviderSecret(env, 'ollama');
  if (!key || /^(ssh-|-----BEGIN)/.test(String(key).trim())) throw new Error('Ollama vyžaduje API kľúč; device key nie je API kľúč.');
  return sanitizeApiKey(key);
}
export function extractModelText(result) {
  if(typeof result==='string')return result;
  if(typeof result?.output_text==='string')return result.output_text;
  if(typeof result?.response==='string')return result.response;
  const choiceMsg = result?.choices?.[0]?.message;
  if(Array.isArray(choiceMsg?.tool_calls) && choiceMsg.tool_calls.length) return JSON.stringify({ tool_calls: choiceMsg.tool_calls });
  if(choiceMsg?.function_call) return JSON.stringify({ type: 'function', function: choiceMsg.function_call });
  if(typeof choiceMsg?.content === 'string') return choiceMsg.content;
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
  if(Array.isArray(result?.candidates?.[0]?.content?.parts)){
    const fnPart = result.candidates[0].content.parts.find(p => p.functionCall);
    if(fnPart?.functionCall) return JSON.stringify({ functionCall: fnPart.functionCall });
    const partsText=result.candidates[0].content.parts.map(p=>p.text||'').join('\n').trim();
    if(partsText)return partsText;
  }
  const blocks=(result?.steps||[]).flatMap(step=>Array.isArray(step?.content)?step.content:Array.isArray(step?.output)?step.output:[]);
  return blocks.filter(block=>block?.type==='text'||typeof block?.text==='string').map(block=>block.text||'').join('\n').trim();
}
export function deduplicateRepeatedParagraphs(text) {
  if (typeof text !== 'string' || !text.trim()) return text;
  // Rozdelenie na odstavce (dva a viac nových riadkov)
  const paragraphs = text.split(/\n{2,}/);
  if (paragraphs.length <= 1) return text;
  
  const seen = new Set();
  const cleaned = [];
  for (const p of paragraphs) {
    const normalized = p.trim().replace(/\s+/g, ' ');
    if (normalized.length > 20) {
      if (seen.has(normalized)) continue;
      seen.add(normalized);
    }
    cleaned.push(p);
  }
  return cleaned.join('\n\n');
}

export function stripInternalToolsDump(text) {
  if (typeof text !== 'string') return '';
  return text
    // Odstránenie celého bloku číslovaného zoznamu nástrojov (napr. 1. knowledge_search: ... až po koniec zoznamu)
    .replace(/(?:Môj zoznam nástrojov|Zoznam nástrojov|Dostupné nástroje)[^\n]*\n+(?:\s*\d+\.\s+[a-z0-9_-]+:[^\n]*\n*)+/gi, '')
    // Odstránenie vety o interných JSON volaniach
    .replace(/Môj zoznam nástrojov je interný[^\n]*/gi, '')
    .replace(/Nie je možné, aby ste si mali prístup k zoznamu nástrojov[^\n]*/gi, '')
    .replace(/Nástroje sú určené výhradne na interné volania[^\n]*/gi, '')
    .trim();
}

export function cleanModelResponse(text) {
  if (typeof text !== 'string') return '';
  let cleaned = stripInternalToolsDump(text);
  if (/152\s+expertných\s+zručností|248\s+Copilot\s+skillov/i.test(cleaned)) {
    cleaned = cleaned.replace(/Sabo Ivan, rád sa ti oznam[^\n]*\n*/gi, '')
      .replace(/Mám 152 expertných zručností[^\n]*\n*/gi, '')
      .replace(/Som založená na Cloudflare Edge a mám 29 servisných workerov[^\n]*\n*/gi, '')
      .replace(/Môj primárny AI provider je Cloudflare Workers AI[^\n]*\n*/gi, '')
      .replace(/Môj účel je slúžiť vám, Sabo Ivanovi[^\n]*\n*/gi, '')
      .replace(/Môj jazyk je prirodzený a komunikujem s vámi[^\n]*\n*/gi, '');
  }
  return deduplicateRepeatedParagraphs(cleaned).trim();
}

export function usableModelText(text) {
  const compact = text.replace(/\s/g, '');
  if (!compact) return false;
  const repeated = compact.match(/(.)\1{79,}/gu) || [];
  return repeated.reduce((size, run) => size + run.length, 0) < compact.length * 0.8;
}
async function readModelResponse(response,provider) {
  if(!response.ok){
    await response.body?.cancel().catch(()=>{});
    const reason=[401,403].includes(response.status)?'Poskytovateľ odmietol prístup.':
      response.status===429?'Poskytovateľ oznámil limit požiadaviek.':
      response.status>=500?'Služba poskytovateľa je dočasne nedostupná.':'Požiadavka zlyhala.';
    throw new Error(`${provider} HTTP ${response.status}: ${reason}`);
  }
  try{return JSON.parse(await boundedText(response,250000));}
  catch{throw new Error(`${provider} vrátil neplatnú odpoveď.`);}
}

export async function callModel(env, provider, messages, maxTokens = 8192, customModel = null) {
  if(provider==='local'){
    if(!env.TRINITY_GATEWAY_KEY)throw new Error('Lokálna brána nie je nakonfigurovaná.');
    const recent=messages.filter(message=>message.role!=='system').slice(-6).map(message=>({role:message.role,content:message.content.slice(0,5000)}));
    const localMessages=[{role:'system',content:'Si Trinity, súkromná lokálna AI asistentka. Odpovedaj prirodzene v jazyku používateľa. Nevymýšľaj vykonané akcie, prístup k súborom ani internet. Ak treba aktuálne dáta alebo externú akciu, jasne povedz, že sa má použiť cloudový režim Trinity.'},...recent];
    const action=await createSystemAction(env,{action:'read',payload:{task:'local-inference',messages:localMessages,max_tokens:Math.min(maxTokens,4096)},rationale:'Lokálna AI odpoveď na používateľovu požiadavku'},'provider:local');
    for(let attempt=0;attempt<180;attempt++){
      await new Promise(resolve=>setTimeout(resolve,1000));const current=await getSystemAction(env,action.id);
      if(current?.status==='completed')return {text:current.receipt.response,model:current.receipt.model,provider:'local',usage:current.receipt.usage||null};
      if(current?.status==='failed')throw new Error(current.error||'Lokálny model zlyhal.');
    }
    throw new Error('Lokálny model neodpovedal v časovom limite.');
  }
  if(provider==='ollama'||provider==='ollama-local') {
    let tunnelMeta=null;
    if(env.PC_STATE){try{tunnelMeta=JSON.parse(await env.PC_STATE.get('bridge:tunnel_meta')||'null');}catch{}}
    if(!tunnelMeta&&env.Mastermind){try{tunnelMeta=JSON.parse(await env.Mastermind.get('bridge:tunnel_meta')||'null');}catch{}}
    const tunnelUrl=registeredBridgeTunnelUrl(tunnelMeta);
    const bridgeToken=configuredBridgeToken(env);
    if(tunnelUrl&&bridgeToken){
      try {
        const res=await fetch(tunnelUrl+'/api/ollama/chat',{
          method:'POST',
          headers:{'Content-Type':'application/json','X-Trinity-Bridge-Token':bridgeToken},
          body:JSON.stringify({messages,max_tokens:maxTokens,model:customModel||env.OLLAMA_MODEL||'qwen3.5:4b'}),
          signal:AbortSignal.timeout(120_000),redirect:'manual'
        });
        if(res.ok){
          const data=await res.json();
          if(data.text)return {text:data.text,model:data.model||'qwen3.5:4b',provider:'ollama-local',usage:data.usage||null};
        }
      } catch {}
    }
    try {
      const key=await getOllamaKey(env);
      const model=customModel||env.OLLAMA_MODEL||'gemma4:31b';
      const response=await fetch('https://ollama.com/api/chat',{
        method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
        body:JSON.stringify({model,messages,stream:false,options:{num_predict:maxTokens,temperature:0.25}}),
        signal:AbortSignal.timeout(120000),redirect:'manual'
      });
      if(response.ok){
        const data=JSON.parse(await boundedText(response,100000));
        if(data.message?.content?.trim())return {text:data.message.content,model,provider:'ollama-cloud',usage:{input:data.prompt_eval_count||0,output:data.eval_count||0}};
      }
    } catch {}
    throw new Error('Ollama nie je dostupná (lokálny tunel ani cloud kľúč neodpovedajú).');
  }
  if(provider==='gemini') {
    const {apiKey:rawKey,model}=await getConfiguredAIProvider(env,'gemini');
    const apiKey=sanitizeApiKey(rawKey,/AIza[A-Za-z0-9_-]{25,}/);
    const system=messages.filter(message=>message.role==='system').map(message=>message.content).join('\n\n').slice(0,40000);
    const input=messages.filter(message=>message.role!=='system').slice(-12)
      .map(message=>`${message.role==='assistant'?'TRINITY':'POUŽÍVATEĽ'}:\n${String(message.content).slice(0,20000)}`).join('\n\n');
    const interactionModel=String(model).replace(/^models\//,'');
    let response=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{
      method:'POST',headers:{'x-goog-api-key':apiKey,'Content-Type':'application/json'},
      body:JSON.stringify({model:interactionModel,input,system_instruction:system||undefined,store:false,
        generation_config:{max_output_tokens:Math.min(maxTokens,16384),temperature:0.25}}),
      signal:AbortSignal.timeout(120000),redirect:'manual'
    });
    let usedModel=model;
    if(!response.ok && (response.status===404 || response.status===400)){
      const contents=[];
      if(system)contents.push({role:'user',parts:[{text:`Systémové inštrukcie:\n${system}`}]},{role:'model',parts:[{text:'Rozumiem inštrukciám.'}]});
      contents.push({role:'user',parts:[{text:input}]});
      // Discover supported Gemini models instead of guessing model names.
      // The API key is sent only through the x-goog-api-key header.
      let models=[];
      try{
        const catalog=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',{
          headers:{'x-goog-api-key':apiKey},signal:AbortSignal.timeout(10000),redirect:'manual'
        });
        if(catalog.ok){
          const listing=await catalog.json();
          models=Array.isArray(listing.models)?listing.models
            .filter(m=>Array.isArray(m.supportedGenerationMethods)&&m.supportedGenerationMethods.includes('generateContent'))
            .map(m=>String(m.name||'').replace(/^models\//,''))
            .filter(m=>/^gemini-[a-zA-Z0-9_.-]+$/.test(m)):[];
        }
      }catch{
        // Catalog failure cannot justify claiming a working fallback.
      }
      const fallbackCandidates=[...new Set([interactionModel,...models.filter(m=>/flash/i.test(m)),...models])];
      for(const candidateModel of fallbackCandidates.slice(0,4)){
        const fallbackUrl=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidateModel)}:generateContent`;
        const fallbackResponse=await fetch(fallbackUrl,{
          method:'POST',
          headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},
          body:JSON.stringify({
            contents,
            generationConfig:{maxOutputTokens:Math.min(maxTokens,16384),temperature:0.25}
          }),
          signal:AbortSignal.timeout(120000),
          redirect:'manual'
        });
        response=fallbackResponse;
        if(fallbackResponse.ok){
          usedModel=candidateModel;
          break;
        }
        // Trying another model is only a compatibility fallback. It cannot
        // repair rejected credentials, provider limits or a service outage.
        if(![400,404].includes(fallbackResponse.status))break;
      }
    }
    const data=await readModelResponse(response,'Gemini');
    const text=extractGeminiInteractionText(data);
    if(!text)throw new Error('Gemini vrátilo prázdnu odpoveď.');
    return {text,model:usedModel,provider,usage:{input:data.usageMetadata?.promptTokenCount||0,output:data.usageMetadata?.candidatesTokenCount||0}};
  }
  if(provider==='openai') {
    const envModel=env.OPENAI_MODEL&&!/luna/i.test(env.OPENAI_MODEL)?env.OPENAI_MODEL.trim():'';
    let apiKey='',model=customModel||'';
    try {
      const vaultProvider=await getConfiguredAIProvider(env,'openai');
      if(vaultProvider?.apiKey){
        apiKey=sanitizeApiKey(vaultProvider.apiKey,/sk-[A-Za-z0-9_-]{16,}/);
        if(!model&&vaultProvider.model)model=vaultProvider.model;
      }
    }catch{}
    if(!apiKey)apiKey=typeof env.OPENAI_API_KEY==='string'?sanitizeApiKey(env.OPENAI_API_KEY,/(?:sk-[A-Za-z0-9_-]{16,}|test-[A-Za-z0-9_-]{10,})/):'';
    if(!model)model=envModel||'gpt-4.1-mini';
    if(!apiKey)throw new Error('OpenAI API nie je nakonfigurované.');
    const chatMessages=messages.slice(-16).map(message=>({
      role:message.role==='system'?'system':message.role,
      content:String(message.content).slice(0,40000)
    }));
    let response=await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({model,messages:chatMessages,max_tokens:Math.min(maxTokens,16384),temperature:0.7}),
      signal:AbortSignal.timeout(120000),redirect:'manual'
    });
    if(response.status===404){
      const responsesInput=messages.slice(-16).map(message=>({
        role:message.role==='system'?'developer':message.role,
        content:String(message.content).slice(0,40000)
      }));
      response=await fetch('https://api.openai.com/v1/responses',{
        method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
        body:JSON.stringify({model,input:responsesInput,store:false,max_output_tokens:Math.min(maxTokens,16384)}),
        signal:AbortSignal.timeout(120000),redirect:'manual'
      });
    }
    const data=await readModelResponse(response,'OpenAI');
    const text=extractModelText(data);
    if(!text.trim())throw new Error('OpenAI vrátilo prázdnu odpoveď.');
    return {text,model:data.model||model,provider,usage:{input:data.usage?.prompt_tokens||data.usage?.input_tokens||0,output:data.usage?.completion_tokens||data.usage?.output_tokens||0}};
  }

  if(provider==='groq'){
    let {apiKey,model}=await getConfiguredAIProvider(env,'groq').catch(()=>({}));
    if(!apiKey)apiKey=env.GROQ_API_KEY;
    if(!apiKey)throw new Error('Groq API nie je nakonfigurované.');
    apiKey=sanitizeApiKey(apiKey);
    if(!model)model=env.GROQ_MODEL||'llama-3.3-70b-versatile';
    const chatMessages=messages.map(m=>({role:m.role==='system'?'system':m.role,content:String(m.content).slice(0,40000)}));
    const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({model,messages:chatMessages,max_tokens:Math.min(maxTokens,16384),temperature:0.3}),
      signal:AbortSignal.timeout(120000),redirect:'manual'
    });
    const data=await readModelResponse(response,'Groq');
    const text=extractModelText(data);
    if(!text.trim())throw new Error('Groq vrátil prázdnu odpoveď.');
    return {text,model:data.model||model,provider,usage:{input:data.usage?.prompt_tokens||0,output:data.usage?.completion_tokens||0}};
  }
  if(provider==='deepseek'){
    let {apiKey,model}=await getConfiguredAIProvider(env,'deepseek').catch(()=>({}));
    if(!apiKey)apiKey=env.DEEPSEEK_API_KEY;
    if(!apiKey)throw new Error('DeepSeek API nie je nakonfigurované.');
    apiKey=sanitizeApiKey(apiKey);
    if(!model)model=env.DEEPSEEK_MODEL||'deepseek-chat';
    const chatMessages=messages.map(m=>({role:m.role==='system'?'system':m.role,content:String(m.content).slice(0,40000)}));
    const response=await fetch('https://api.deepseek.com/chat/completions',{
      method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({model,messages:chatMessages,max_tokens:Math.min(maxTokens,16384),temperature:0.3}),
      signal:AbortSignal.timeout(120000),redirect:'manual'
    });
    const data=await readModelResponse(response,'DeepSeek');
    const text=extractModelText(data);
    if(!text.trim())throw new Error('DeepSeek vrátil prázdnu odpoveď.');
    return {text,model:data.model||model,provider,usage:{input:data.usage?.prompt_tokens||0,output:data.usage?.completion_tokens||0}};
  }
  if(provider==='anthropic'){
    let {apiKey,model}=await getConfiguredAIProvider(env,'anthropic').catch(()=>({}));
    if(!apiKey)apiKey=env.ANTHROPIC_API_KEY;
    if(!apiKey)throw new Error('Anthropic Claude API nie je nakonfigurované.');
    apiKey=sanitizeApiKey(apiKey);
    if(!model)model=env.ANTHROPIC_MODEL||'claude-3-5-sonnet-20241022';
    const system=messages.filter(m=>m.role==='system').map(m=>m.content).join('\n\n').slice(0,40000);
    const chatMessages=messages.filter(m=>m.role!=='system').map(m=>({role:m.role==='assistant'?'assistant':'user',content:String(m.content).slice(0,40000)}));
    const response=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',headers:{'x-api-key':apiKey,'anthropic-version':'2023-06-01','Content-Type':'application/json'},
      body:JSON.stringify({model,messages:chatMessages,system:system||undefined,max_tokens:Math.min(maxTokens,8192),temperature:0.3}),
      signal:AbortSignal.timeout(120000),redirect:'manual'
    });
    const data=await readModelResponse(response,'Anthropic');
    const text=data.content?.[0]?.text||'';
    if(!text.trim())throw new Error('Anthropic Claude vrátil prázdnu odpoveď.');
    return {text,model:data.model||model,provider,usage:{input:data.usage?.input_tokens||0,output:data.usage?.output_tokens||0}};
  }
  if(provider==='mistral'){
    let {apiKey,model}=await getConfiguredAIProvider(env,'mistral').catch(()=>({}));
    if(!apiKey)apiKey=env.MISTRAL_API_KEY;
    if(!apiKey)throw new Error('Mistral AI API nie je nakonfigurované.');
    apiKey=sanitizeApiKey(apiKey);
    if(!model)model=env.MISTRAL_MODEL||'mistral-large-latest';
    const chatMessages=messages.map(m=>({role:m.role==='system'?'system':m.role,content:String(m.content).slice(0,40000)}));
    const response=await fetch('https://api.mistral.ai/v1/chat/completions',{
      method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({model,messages:chatMessages,max_tokens:Math.min(maxTokens,16384),temperature:0.3}),
      signal:AbortSignal.timeout(120000),redirect:'manual'
    });
    const data=await readModelResponse(response,'Mistral');
    const text=extractModelText(data);
    if(!text.trim())throw new Error('Mistral AI vrátil prázdnu odpoveď.');
    return {text,model:data.model||model,provider,usage:{input:data.usage?.prompt_tokens||0,output:data.usage?.completion_tokens||0}};
  }
  if(provider==='openrouter'){
    let {apiKey,model}=await getConfiguredAIProvider(env,'openrouter').catch(()=>({}));
    if(!apiKey)apiKey=env.OPENROUTER_API_KEY;
    if(!apiKey)throw new Error('OpenRouter API nie je nakonfigurované.');
    apiKey=sanitizeApiKey(apiKey);
    if(!model)model=env.OPENROUTER_MODEL||'deepseek/deepseek-r1:free';
    const chatMessages=messages.map(m=>({role:m.role==='system'?'system':m.role,content:String(m.content).slice(0,40000)}));
    const response=await fetch('https://openrouter.ai/api/v1/chat/completions',{
      method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'HTTP-Referer':'https://auru.space','X-Title':'Trinity AI','Content-Type':'application/json'},
      body:JSON.stringify({model,messages:chatMessages,max_tokens:Math.min(maxTokens,16384),temperature:0.3}),
      signal:AbortSignal.timeout(120000),redirect:'manual'
    });
    const data=await readModelResponse(response,'OpenRouter');
    const text=extractModelText(data);
    if(!text.trim())throw new Error('OpenRouter vrátil prázdnu odpoveď.');
    return {text,model:data.model||model,provider,usage:{input:data.usage?.prompt_tokens||0,output:data.usage?.completion_tokens||0}};
  }

  if(['auto','deepseek-r1','llama','qwen','workers-ai','fast','cloud'].includes(provider)){
    if(!env.AI && !env.CHAT_INFERENCE_SERVICE)throw new Error('Cloudflare Workers AI nie je pripojené.');
    const defaultModel=provider==='deepseek-r1'?'@cf/deepseek-ai/deepseek-r1-distill-qwen-32b'
      :provider==='llama'?"@cf/meta/llama-3.3-70b-instruct-fp8-fast"
      :provider==='qwen'?'@cf/qwen/qwen2.5-72b-instruct'
      :provider==='fast'?(env.AI_FAST_MODEL||"@cf/meta/llama-3.1-8b-instruct-fp8-fast")
      :(env.AI_MODEL || '@cf/openai/gpt-oss-120b');
    const model=customModel || defaultModel;
    const invoke = async selectedModel => {
      if(env.CHAT_INFERENCE_SERVICE){
        // Route through dedicated chat inference worker (trinity-chat-inference)
        try{
          const response=await env.CHAT_INFERENCE_SERVICE.fetch('https://chat-inference.internal/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:selectedModel,messages,max_tokens:Math.min(maxTokens,600)}),signal:AbortSignal.timeout(20000)});
          if(response.ok)return JSON.parse(await boundedText(response,100000));
        }catch{}
        // Binding failure falls back to the already authorized Workers AI binding.
      }
      let timer;
      try { return await Promise.race([env.AI.run(selectedModel,{messages,max_tokens:Math.min(maxTokens,8192),temperature:0.5,top_p:0.9,repetition_penalty:1.15}),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Workers AI timeout')),provider==='fast'?30000:120000);})]); }
      finally {clearTimeout(timer);}
    };
    let result,fallbackReason='invalid-output';
    try{result=await invoke(model);}catch{result={};fallbackReason='provider-error';}
    const text = extractModelText(result);
    if (usableModelText(text)) return {text:cleanModelResponse(text),model,provider:'workers-ai',usage:result.usage||null};
    // A successful HTTP response can still contain a broken generation (e.g. thousands of "!").
    // Retry once on a different bound model; never persist that output as a completed answer.
    const fallbackModel = (provider==='fast'?env.AI_FAST_FALLBACK_MODEL:env.AI_FALLBACK_MODEL) || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
    if (model === fallbackModel) throw new Error('Záložný model nevrátil použiteľnú odpoveď. Skús iný model.');
    const fallback = await invoke(fallbackModel);
    const fallbackText = extractModelText(fallback);
    if (!usableModelText(fallbackText)) throw new Error('Ani záložný model nevrátil použiteľnú odpoveď. Skús požiadavku znova.');
    return {text:cleanModelResponse(fallbackText),model:fallbackModel,provider:'workers-ai',usage:fallback.usage||null,
      model_fallback:{from:model,to:fallbackModel,reason:fallbackReason}};
  }
  throw new Error('Unknown provider');
}

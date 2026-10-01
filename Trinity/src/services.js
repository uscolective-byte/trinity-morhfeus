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
export async function getOllamaKey(env) {
  const key = env.OLLAMA_API_KEY || (env.OLLAMA_SECRET ? await env.OLLAMA_SECRET.get() : '');
  if (!key || /^(ssh-|-----BEGIN)/.test(key.trim())) throw new Error('Ollama vyžaduje API kľúč; device key nie je API kľúč.');
  return key.trim();
}
export async function callModel(env, provider, messages, maxTokens = 1200) {
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
  if(provider!=='workers-ai') throw new Error('Unknown provider');
  const model=env.AI_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
  let timer,result;
  try {result=await Promise.race([env.AI.run(model,{messages,max_tokens:maxTokens,temperature:0.25}),
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Workers AI timeout')),65000);})]);}
  finally {clearTimeout(timer);}
  const text=typeof result.response==='string'?result.response:result.choices?.[0]?.message?.content || (result.response&&typeof result.response==='object'?JSON.stringify(result.response):'');
  if(!text.trim()) throw new Error('Workers AI vrátilo prázdnu odpoveď.');
  return {text,model,provider,usage:result.usage||null};
}

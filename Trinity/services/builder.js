import {boundedLimit,boundedString,idempotent,json,readCall,safeFailure} from './worker-runtime.js';

const ROLE='builder';
export default {async fetch(request,env){
  if(request.method==='GET'&&new URL(request.url).pathname==='/health'){
    try{await env.DB.prepare('SELECT id FROM code_storage LIMIT 1').all();return json({ok:true,service:'trinity-builder',version:'2.1.0',bindings:{AI:!!env.AI,DB:true}});}
    catch{return json({ok:false,service:'trinity-builder',status:'degraded'},503);}
  }
  let traceId=crypto.randomUUID();
  try{
    const call=await readCall(request);traceId=call.traceId;const d=call.data;
    if(call.action==='build.list'){
      const rows=await env.DB.prepare('SELECT id, code, created_at FROM code_storage ORDER BY created_at DESC LIMIT ?').bind(boundedLimit(d.limit)).all();
      return json({ok:true,result:rows.results,traceId,from:ROLE});
    }
    if(call.action==='build.get'){
      const id=boundedString(d.id,'id',{required:true,max:100});
      const row=await env.DB.prepare('SELECT id, code, created_at FROM code_storage WHERE id=?').bind(id).first();
      return row?json({ok:true,result:row,traceId,from:ROLE}):json({ok:false,error:'Not found',traceId,from:ROLE},404);
    }
    if(call.action==='build.store'){
      const code=boundedString(d.code,'code',{required:true,min:1,max:200_000});
      const result=await idempotent(env,call.idempotencyKey,async()=>{const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO code_storage(id,code,created_at) VALUES(?,?,datetime(\'now\'))').bind(id,code).run();return {id};});
      return json({ok:true,result,traceId,from:ROLE});
    }
    if(call.action==='build.code'){
      const prompt=boundedString(d.prompt,'prompt',{required:true,min:3,max:8000});
      const language=boundedString(d.language??'typescript','language',{min:1,max:40});
      if(!env.DB)throw Object.assign(new Error('DB binding is unavailable'),{status:503});
      let code='';
      if(env.CHAT_INFERENCE_SERVICE&&typeof env.CHAT_INFERENCE_SERVICE.fetch==='function'){
        try{
          const resp=await env.CHAT_INFERENCE_SERVICE.fetch('https://chat-inference.internal/infer',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
              messages:[
                {role:'system',content:`You are Trinity Builder. Generate secure, production-grade, maintainable ${language} code. Return only the raw source code without markdown fences.`},
                {role:'user',content:prompt}
              ],
              traceId
            })
          });
          if(resp.ok){
            const data=await resp.json();
            code=data?.response||data?.text||'';
          }
        }catch{}
      }
      if(!code&&env.AI){
        const model=env.AI_MODEL||'@cf/meta/llama-3.3-70b-instruct-fp8-fast';
        let output;
        try{output=await env.AI.run(model,{messages:[{role:'system',content:`Generate secure, maintainable ${language} code. Output only code.`},{role:'user',content:prompt}]});}
        catch{
          try{output=await env.AI.run('@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',{messages:[{role:'system',content:`Generate secure, maintainable ${language} code. Output only code.`},{role:'user',content:prompt}]});}
          catch{output=await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8-fast',{messages:[{role:'system',content:`Generate secure, maintainable ${language} code. Output only code.`},{role:'user',content:prompt}]});}
        }
        code=typeof output?.response==='string'?output.response:(output?.text||'');
      }
      if(!code)throw Object.assign(new Error(env.AI||env.CHAT_INFERENCE_SERVICE?'AI code generation returned an empty result':'AI binding is unavailable'),{status:env.AI||env.CHAT_INFERENCE_SERVICE?502:503});
      // Clean leading and trailing backticks if model wrapped in markdown
      code=code.replace(/^\s*```[a-z0-9_-]*\r?\n?/i,'').replace(/\r?\n?```\s*$/,'').trim();
      const codeBytes=new TextEncoder().encode(code);
      const hashBytes=await crypto.subtle.digest('SHA-256',codeBytes);
      const sha256=[...new Uint8Array(hashBytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
      const result=await idempotent(env,call.idempotencyKey,async()=>{
        const inserted=await env.DB.prepare("INSERT INTO code_snippets(title,language,code,tags,created_at) VALUES(?,?,?,'ai-generated',datetime('now')) RETURNING id")
          .bind(prompt.slice(0,100),language,code).first();
        return {id:inserted?.id,code,language,sha256,bytes:codeBytes.length};
      });
      return json({ok:true,result,traceId,from:ROLE});
    }
    throw Object.assign(new Error('Unknown action'),{status:400});
  }catch(error){return safeFailure(ROLE,error,traceId);}
}};

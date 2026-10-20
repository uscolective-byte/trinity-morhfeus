import {boundedJSON} from './http.mjs';
const GOOGLE='https://generativelanguage.googleapis.com/v1beta';
export async function geminiModels(key,fetcher=fetch){
 const data=await boundedJSON(await fetcher(GOOGLE+'/models',{headers:{'x-goog-api-key':key},redirect:'error',signal:AbortSignal.timeout(15000)}));
 return (data.models||[]).filter(m=>m.supportedGenerationMethods?.includes('generateContent')).map(m=>m.name.replace(/^models\//,''));
}
export async function geminiChat({key,model,messages,tools,fetcher=fetch}){
 if(!key)throw new Error('Gemini API kľúč nie je nastavený.');
 if(!/^[a-zA-Z0-9._-]+$/.test(model||''))throw new Error('Vyber platný Gemini model.');
 const raw=messages.filter(m=>m.role!=='system').map(m=>({role:m.role==='assistant'?'model':'user',parts:m.gemini_parts||(m.role==='tool'?[{functionResponse:{name:m.tool_name,response:JSON.parse(m.content)}}]:[{text:m.content||''}])}));
 const contents=[];for(const item of raw){if(contents.at(-1)?.role===item.role)contents.at(-1).parts.push(...item.parts);else contents.push({...item,parts:[...item.parts]});}
 const declarations=tools.map(t=>({name:t.function.name,description:t.function.description,parametersJsonSchema:t.function.parameters}));
 const payload={systemInstruction:{parts:[{text:messages.filter(m=>m.role==='system').map(m=>m.content).join('\n')}]},contents,generationConfig:{maxOutputTokens:2048},...(declarations.length?{tools:[{functionDeclarations:declarations}]}:{})};
 const data=await boundedJSON(await fetcher(`${GOOGLE}/models/${model}:generateContent`,{method:'POST',headers:{'x-goog-api-key':key,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(90000),redirect:'error'}));
 const candidate=data.candidates?.[0];if(!candidate||candidate.finishReason!=='STOP')throw new Error('Gemini neposkytlo dokončenú odpoveď.');
 const parts=candidate.content?.parts||[];
 return {done:true,message:{content:parts.filter(p=>p.text&&!p.thought).map(p=>p.text).join('\n'),gemini_parts:parts,tool_calls:parts.filter(p=>p.functionCall).map(p=>({function:{name:p.functionCall.name,arguments:p.functionCall.args||{}}}))}};
}
export async function copilotStudioChat({secret,query,fetcher=fetch,pollMs=1000,timeoutMs=45000}){
 if(!secret)throw new Error('Copilot Studio Direct Line secret nie je nastavený.');
 const base='https://directline.botframework.com/v3/directline';
 const call=async(path,token,body)=>boundedJSON(await fetcher(base+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(15000)}));
 const generated=await call('/tokens/generate',secret,{});if(!generated.token)throw new Error('Copilot Studio neposkytlo token.');
 const conversation=await call('/conversations',generated.token,{});if(!conversation.conversationId||!conversation.token)throw new Error('Copilot Studio nevytvorilo konverzáciu.');
 const route='/conversations/'+encodeURIComponent(conversation.conversationId),user='trinity-local-'+crypto.randomUUID();
 // Drain greetings so they cannot be reported as the answer to the user's question.
 const initial=await call(route+'/activities',conversation.token);let watermark=initial.watermark||'';
 const activity=await call(route+'/activities',conversation.token,{type:'message',from:{id:user},text:query});if(!activity.id)throw new Error('Copilot Studio nepotvrdilo prijatie správy.');
 const deadline=Date.now()+timeoutMs;
 while(Date.now()<deadline){const data=await call(route+'/activities?watermark='+encodeURIComponent(watermark),conversation.token);watermark=data.watermark||watermark;const replies=(data.activities||[]).filter(a=>a.type==='message'&&a.from?.id!==user&&a.from?.role!=='user'&&(!a.replyToId||a.replyToId===activity.id)&&typeof a.text==='string'&&a.text.trim()).map(a=>a.text);if(replies.length)return {done:true,message:{content:replies.join('\n\n')},remote:true};await new Promise(r=>setTimeout(r,pollMs));}
 throw new Error('Copilot Studio neodpovedal v časovom limite.');
}

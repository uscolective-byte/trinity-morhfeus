export function chatPromptTools(allowed,task,help){
  const core=['tool_catalog','chat_health','calculate','current_time','search_memory','list_capabilities','web_search','web_fetch'];
  const words=task.toLocaleLowerCase('sk').split(/[^\p{L}\p{N}_]+/u).filter(word=>word.length>3);
  const score=name=>words.reduce((sum,word)=>sum+(`${name} ${help[name]||''}`).toLocaleLowerCase('sk').includes(word),0);
  const relevant=allowed.filter(name=>!core.includes(name)).map(name=>({name,score:score(name)})).filter(item=>item.score>0).sort((a,b)=>b.score-a.score).slice(0,8).map(item=>item.name);
  return [...new Set([...core.filter(name=>allowed.includes(name)),...relevant])];
}

export function directCalculation(task){
  const pattern=/^\s*(?:(?:prosím\s*)?(?:vypočítaj|spočítaj|koľko je|calculate|compute)\s+)?(-?\d{1,12}(?:[.,]\d{1,8})?)\s*([+−×*x÷/])\s*(-?\d{1,12}(?:[.,]\d{1,8})?)(?:\s+(?:pomocou kalkulačky(?:\s+a\s+odpovedz\s+(?:iba\s+)?výsledkom)?|a odpovedz iba výsledkom|and give only the result))?\s*[.!?]*\s*$/i;
  const match=String(task||'').normalize('NFC').match(pattern);if(!match)return null;
  const number=value=>Number(value.replace(',','.'));
  const left=number(match[1]),right=number(match[3]);if(!Number.isFinite(left)||!Number.isFinite(right))return null;
  const operation=({'+':'add','−':'subtract','-':'subtract','×':'multiply','x':'multiply','*':'multiply','÷':'divide','/':'divide'})[match[2]];
  return operation?{operation,values:[left,right]}:null;
}

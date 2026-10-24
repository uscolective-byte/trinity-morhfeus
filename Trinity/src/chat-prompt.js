export function chatPromptTools(allowed,task,help){
  const core=['tool_catalog','chat_health','calculate','current_time','search_memory','list_capabilities','web_search','web_fetch'];
  const words=task.toLocaleLowerCase('sk').split(/[^\p{L}\p{N}_]+/u).filter(word=>word.length>3);
  const score=name=>words.reduce((sum,word)=>sum+(`${name} ${help[name]||''}`).toLocaleLowerCase('sk').includes(word),0);
  const relevant=allowed.filter(name=>!core.includes(name)).map(name=>({name,score:score(name)})).filter(item=>item.score>0).sort((a,b)=>b.score-a.score).slice(0,8).map(item=>item.name);
  return [...new Set([...core.filter(name=>allowed.includes(name)),...relevant])];
}

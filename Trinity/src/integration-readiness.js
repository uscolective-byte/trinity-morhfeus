// Configuration inspection only: never a claim that a provider call succeeded.
export function integrationReadiness(_input,env={}) {
  const item=(id,requirements)=>{
    const missing=Object.entries(requirements).filter(([,present])=>!present).map(([name])=>name);
    return {id,configured:missing.length===0,status:missing.length?'needs_configuration':'configured_unverified',missing};
  };
  const secret=name=>typeof env[name]==='string'&&env[name].trim().length>0;
  return {scope:'worker-environment',live_verified:false,items:[
    item('workers-ai',{AI:!!env.AI}),
    item('gemini', {GEMINI_API_KEY:secret('GEMINI_API_KEY')}),
    item('openai',{OPENAI_API_KEY:secret('OPENAI_API_KEY')}),
    item('ollama',{OLLAMA_API_KEY_OR_SECRET:secret('OLLAMA_API_KEY')||!!env.OLLAMA_SECRET}),
    item('copilot-studio',{COPILOT_STUDIO_SECRET:secret('COPILOT_STUDIO_SECRET')}),
    item('power-platform',{POWER_PLATFORM_URL:secret('POWER_PLATFORM_URL'),BOT_ID:secret('BOT_ID'),POWER_PLATFORM_TOKEN:secret('POWER_PLATFORM_TOKEN')}),
    item('pc-bridge',{TRINITY_GATEWAY_KEY:secret('TRINITY_GATEWAY_KEY')})
  ],note:'Worker environment only; encrypted-vault credentials, desktop clients, heartbeat and completed tasks need separate live checks.'};
}

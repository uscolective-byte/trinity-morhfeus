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
    item('pc-bridge',{TRINITY_GATEWAY_KEY:secret('TRINITY_GATEWAY_KEY')}),
    item('google-oauth',{
      GOOGLE_ENABLED: env.GOOGLE_ENABLED === 'true',
      GOOGLE_CLIENT_ID: secret('GOOGLE_CLIENT_ID'),
      GOOGLE_CLIENT_SECRET: secret('GOOGLE_CLIENT_SECRET'),
      GOOGLE_REDIRECT_URI: secret('GOOGLE_REDIRECT_URI')
    }),
    item('cloudflare-registrar',{
      CF_ACCOUNT_ID: secret('CF_ACCOUNT_ID'),
      CF_API_TOKEN: secret('CF_API_TOKEN') || secret('CLOUDFLARE_API_TOKEN')
    }),
    item('telegram-notifications',{
      TELEGRAM_BOT_TOKEN: secret('TELEGRAM_BOT_TOKEN'),
      TELEGRAM_CHAT_ID: secret('TELEGRAM_CHAT_ID')
    }),
    item('paypal-verified-payments',{
      PAYPAL_CLIENT_ID: secret('PAYPAL_CLIENT_ID'),
      PAYPAL_CLIENT_SECRET: secret('PAYPAL_CLIENT_SECRET'),
      PAYPAL_WEBHOOK_ID: secret('PAYPAL_WEBHOOK_ID')
    }),
    item('revolut-verified-payments',{
      REVOLUT_MERCHANT_API_KEY: secret('REVOLUT_MERCHANT_API_KEY'),
      REVOLUT_WEBHOOK_SECRET: secret('REVOLUT_WEBHOOK_SECRET')
    })
  ],note:'Worker environment only; encrypted-vault credentials, desktop clients, heartbeat and completed tasks need separate live checks.'};
}

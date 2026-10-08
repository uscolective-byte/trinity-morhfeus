function domainOf(address=''){
  const value=String(address).trim().toLowerCase();
  const at=value.lastIndexOf('@');
  return at>=0?value.slice(at+1,at+256):'unknown';
}

async function recordEmailEvent(env,details){
  if(!env.DB?.prepare)return;
  await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('inbound_email',?)")
    .bind(JSON.stringify(details)).run();
}

export async function handleInboundEmail(message,env){
  const forwardTo=String(env.TRINITY_EMAIL_FORWARD_TO||'').trim();
  const details={
    sender_domain:domainOf(message.from),
    recipient:String(message.to||'').trim().toLowerCase().slice(0,320),
    raw_size:Number.isFinite(message.rawSize)?message.rawSize:null,
    action:forwardTo?'forwarded':'rejected-unconfigured'
  };

  try{await recordEmailEvent(env,details);}
  catch(error){console.error(JSON.stringify({event:'inbound_email_audit_failed',message:error instanceof Error?error.message:String(error)}));}

  if(forwardTo){
    await message.forward(forwardTo,new Headers({'X-Trinity-Routed':'true'}));
    return;
  }

  message.setReject('Trinity email intake is not configured. Contact the administrator through the Trinity application.');
}

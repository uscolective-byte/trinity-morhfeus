async function postHeartbeat(baseUrl,key,body){
  const response=await fetch(`${baseUrl.replace(/\/$/,'')}/v1/heartbeat`,{
    method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify(body),signal:AbortSignal.timeout(15_000)
  });
  const text=await response.text();let data={};try{data=text?JSON.parse(text):{};}catch{}
  if(!response.ok)throw new Error(data.error||`PC Bridge HTTP ${response.status}`);
  return data;
}

export function startBridgeHeartbeat({baseUrl,key,gatewayId='gateway:morhfeus-windows',version='1.2.0',capabilities=[],intervalMs=15_000,onState=()=>{}}){
  if(!baseUrl||!key)return ()=>{};
  const state={stopped:false,busy:false,timer:null};
  async function beat(){
    if(state.stopped||state.busy)return;state.busy=true;
    try{const result=await postHeartbeat(baseUrl,key,{gateway_id:gatewayId,version,capabilities});onState({status:'connected',last_seen:result.last_seen||Date.now()});}
    catch(error){onState({status:'disconnected',error:error.message});}
    finally{state.busy=false;}
  }
  state.timer=setInterval(beat,intervalMs);state.timer.unref();beat();
  return ()=>{state.stopped=true;clearInterval(state.timer);};
}

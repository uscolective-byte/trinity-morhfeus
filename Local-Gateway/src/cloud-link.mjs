import {executeProposal} from './executor.mjs';

async function request(url,key,options={}){
  const response=await fetch(url,{...options,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json',...(options.headers||{})},signal:AbortSignal.timeout(25_000)});
  const text=await response.text();let data={};try{data=text?JSON.parse(text):{};}catch{}
  if(!response.ok)throw new Error(data.error||`Cloud HTTP ${response.status}`);return data;
}

export function startCloudLink({baseUrl,key,store,workspaceRoot,dataDir,intervalMs=5000,onState=()=>{}}){
  if(!baseUrl||!key)return ()=>{};let stopped=false,busy=false;
  const report=state=>onState({...state,at:new Date().toISOString()});
  async function sendReceipt(id,status,receipt,error){
    await request(`${baseUrl}/api/system/actions/${id}/receipt`,key,{method:'POST',body:JSON.stringify({status,receipt:status==='completed'?receipt:undefined,error:status==='failed'?error:undefined})});
  }
  async function poll(){
    if(stopped||busy)return;busy=true;
    try{
      const {action}=await request(`${baseUrl}/api/system/actions/claim`,key,{method:'POST',body:'{}'});if(!action){report({status:'connected'});return;}
      let local=await store.importApproved(action);
      if(['completed','failed'].includes(local.status)){await sendReceipt(action.id,local.status,local.receipt,local.error);report({status:'receipt-replayed',id:action.id});return;}
      local=await store.transition(action.id,['approved'],'executing',{executionStartedAt:new Date().toISOString()});
      try{
        const receipt=await executeProposal(workspaceRoot,{...local,status:'approved'},dataDir);const status=receipt.success===false?'failed':'completed';
        local=await store.transition(action.id,['executing'],status,{receipt,error:status==='failed'?'Povolený proces skončil chybou.':null,completedAt:new Date().toISOString()});
        await sendReceipt(action.id,status,receipt,local.error);report({status,id:action.id,action:action.action});
      }catch(error){local=await store.transition(action.id,['executing'],'failed',{error:error.message,completedAt:new Date().toISOString()});await sendReceipt(action.id,'failed',null,error.message);report({status:'failed',id:action.id,action:action.action});}
    }catch(error){report({status:'disconnected',error:error.message});}
    finally{busy=false;}
  }
  const timer=setInterval(poll,intervalMs);timer.unref();poll();return ()=>{stopped=true;clearInterval(timer);};
}

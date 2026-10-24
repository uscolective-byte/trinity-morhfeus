export async function chatMaintenanceStatus(env){
  if(!env.CHAT_MAINTENANCE)return {connected:false,reason:'Správca chatu nie je pripojený.'};
  let timer;
  try{
    const status=await Promise.race([env.CHAT_MAINTENANCE.getStatus(env.TRINITY_ENV||'production'),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('timeout')),3000);})]);
    return {connected:true,...status};
  }catch{return {connected:false,reason:'Správca chatu momentálne neodpovedá.'};}
  finally{clearTimeout(timer);}
}

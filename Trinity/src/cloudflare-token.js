/**
 * @module TRINITY_OMNI_CORE
 * @subsystem CORE_RUNTIME
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Modul cloudflare-token.js (Trinity/src/cloudflare-token.js) v ekosystéme TRINITY OMNI-CORE.
 */
// Verify a user or an account-owned Cloudflare API token without ever
// returning its value or raw provider response.
const origin='https://api.cloudflare.com/client/v4';
export async function verifyCloudflareToken(token,accountId,{fetcher=fetch}={}){
  if(typeof token!=='string'||!token.trim())
    return {verified:false,status:'missing',scope:null,http_status:null};
  const headers={Authorization:`Bearer ${token}`};
  const endpoints=[['user',origin+'/user/tokens/verify']];
  if(typeof accountId==='string'&&/^[a-f0-9]{32}$/i.test(accountId))
    endpoints.push(['account',origin+'/accounts/'+accountId+'/tokens/verify']);
  let lastHttp=null;
  for(const [scope,url] of endpoints){
    let response;
    try{
      response=await fetcher(url,{headers,redirect:'manual',signal:AbortSignal.timeout(15000)});
      lastHttp=response.status;
      const data=await response.json().catch(()=>({}));
      if(response.ok&&data?.success===true&&data?.result?.status==='active')
        return {verified:true,status:'active',scope,http_status:response.status};
      // A 200 or success:true with disabled/expired status is NOT a valid token.
      if(response.ok&&data?.success===true&&['disabled','expired'].includes(data?.result?.status))
        return {verified:false,status:data.result.status,scope,http_status:response.status};
    }catch{
      // User endpoint may be unavailable. Continue to account-owned verification.
    }
  }
  return {verified:false,status:'unverified',scope:null,http_status:lastHttp};
}

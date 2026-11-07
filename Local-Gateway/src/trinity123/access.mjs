import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseEnv} from 'node:util';
import {SSEParser} from './curl.mjs';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const readTools=new Set(['diagnostic_ping','infrastructure_status','project_inspect','project_read','trinity_status','get_capability_status','list_agents','get_task','list_tasks','search_memory','check_services','get_source_file','list_project_files','get_project_action','list_system_actions','pc_status','ecosystem_stats','search_ecosystem']);
export const accessTool={type:'function',name:'trinity_access',description:'Serverový prístup k skutočným read-only nástrojom Trinity a inventáru poverení. Nikdy nevracia hodnoty kľúčov. mcp_call povoľuje iba explicitne povolené diagnostické/čítacie nástroje; zápisy používajú schvaľovaný PC Bridge.',parameters:{type:'object',properties:{operation:{type:'string',enum:['inventory','mcp_tools','mcp_call','cloudflare_status']},tool:{type:'string'},arguments:{type:'object',additionalProperties:true}},required:['operation','tool','arguments'],additionalProperties:false}};

export class TrinityAccess {
  constructor({env=process.env,fetcher=fetch,readSecrets}={}){this.env=env;this.fetcher=fetcher;this.readSecrets=readSecrets||(async()=>{try{return parseEnv(await readFile(path.resolve(root,'../.env'),'utf8'));}catch(e){if(e.code==='ENOENT')return {};throw e;}});}
  async execute(input){
    let secrets={};
    const sanitize=value=>{let text=JSON.stringify(value);for(const secret of Object.values(secrets))if(typeof secret==='string'&&secret.length>5)text=text.split(secret).join('[REDACTED]');return JSON.parse(text);};
    try{
      const args=typeof input==='string'?JSON.parse(input):input;
      secrets=await this.readSecrets();
      if(args.operation==='inventory'){
        const entries=Object.keys(secrets).filter(k=>/KEY|TOKEN|SECRET|CLIENT_ID/.test(k)).map(name=>({name,configured:Boolean(secrets[name]),storage:'server-side shared env',live_verified:false}));
        entries.push({name:'OPENAI_API_KEY',configured:Boolean(this.env.OPENAI_API_KEY),storage:'Local-Gateway/.env',live_verified:false});
        entries.push({name:'TRINITY_LOCAL_TOKEN',configured:Boolean(this.env.TRINITY_LOCAL_TOKEN),storage:'Windows DPAPI',live_verified:false});
        let gateway=false;try{await access(path.join(root,'Local-Gateway/.credentials/gateway-key.dpapi'));gateway=true;}catch{}
        entries.push({name:'TRINITY_GATEWAY_KEY',configured:gateway,storage:'Windows DPAPI; used by existing gateway cloud link',live_verified:false});
        return {success:true,status:'completed',source:'server_credential_metadata',output:{credentials:entries,note:'Prítomnosť nie je overený prístup. Hodnoty sa neposielajú modelu. Admin tokeny sa používajú iba v explicitných serverových adaptéroch.'}};
      }
      if(args.operation==='cloudflare_status'){
        if(!secrets.CLOUDFLARE_API_TOKEN)throw new Error('CLOUDFLARE_API_TOKEN nie je nakonfigurovaný.');
        const response=await this.fetcher('https://api.cloudflare.com/client/v4/accounts/b60342e5e52f5646fbd4e913bb409334/tokens/verify',{headers:{Authorization:'Bearer '+secrets.CLOUDFLARE_API_TOKEN},signal:AbortSignal.timeout(15000)});
        const data=await response.json();if(!response.ok||!data.success)throw new Error('Cloudflare token verification failed (HTTP '+response.status+').');
        return {success:true,status:'completed',source:'cloudflare_api',output:{token_status:data.result?.status,verified_at:new Date().toISOString(),scope:'Token validity only; not every permission or service.'}};
      }
      if(!['mcp_tools','mcp_call'].includes(args.operation))throw new Error('Neznáma operácia prístupu.');
      if(args.operation==='mcp_call'&&!readTools.has(args.tool))throw new Error('Tento cloudový nástroj nie je v read-only zozname; akcia nebola vykonaná.');
      if(!secrets.TRINITY_MCP_API_KEY)throw new Error('TRINITY_MCP_API_KEY nie je nakonfigurovaný.');
      const headers={Authorization:'Bearer '+secrets.TRINITY_MCP_API_KEY,'Content-Type':'application/json',Accept:'application/json, text/event-stream'};
      if(secrets.CLOUDFLARE_ACCESS_CLIENT_ID&&secrets.CLOUDFLARE_ACCESS_CLIENT_SECRET){headers['CF-Access-Client-Id']=secrets.CLOUDFLARE_ACCESS_CLIENT_ID;headers['CF-Access-Client-Secret']=secrets.CLOUDFLARE_ACCESS_CLIENT_SECRET;}
      const response=await this.fetcher('https://auru.space/mcp',{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',id:crypto.randomUUID(),method:args.operation==='mcp_tools'?'tools/list':'tools/call',params:args.operation==='mcp_tools'?{}:{name:args.tool,arguments:args.arguments||{}}}),signal:AbortSignal.timeout(45000),redirect:'error'});
      const text=await response.text();if(text.length>2_000_000)throw new Error('Cloudový výsledok je príliš veľký.');
      let data;if(response.headers.get('content-type')?.includes('text/event-stream'))await new SSEParser(value=>{data=value;}).push(text,true);else data=JSON.parse(text);
      if(!response.ok||data?.error||data?.result?.isError)throw new Error(data?.error?.message||data?.result?.content?.find(c=>c.type==='text')?.text||'Trinity MCP HTTP '+response.status);
      if(!data?.result)throw new Error('Trinity MCP nevrátil výsledok.');
      if(args.operation==='mcp_call')for(const item of data.result.content||[]){if(item.type!=='text')continue;let inner;try{inner=JSON.parse(item.text);}catch{continue;}if(inner.success===false||inner.ok===false||['failed','pending','queued','running','proposed'].includes(inner.status))return sanitize({success:false,status:['pending','queued','running','proposed'].includes(inner.status)?'pending':'failed',source:'authenticated_trinity_mcp',output:data.result,error:inner.error||'Cloudový výsledok nepotvrdil dokončené vykonanie.'});}
      return sanitize({success:true,status:'completed',source:'authenticated_trinity_mcp',output:args.operation==='mcp_tools'?{tools:(data.result?.tools||[]).filter(t=>readTools.has(t.name)),scope:'Only these read/diagnostic tools are exposed by this adapter.'}:data.result});
    }catch(error){return sanitize({success:false,status:'failed',output:null,error:error.message});}
  }
}

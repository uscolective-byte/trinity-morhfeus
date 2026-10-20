import {boundedJSON} from './http.mjs';
export class TrinityCloud{
 constructor({environment='production',getToken,fetcher=fetch}){if(!['production','development'].includes(environment))throw new Error('Neplatné prostredie.');this.base=environment==='production'?'https://auru.space':'https://auru.dev';this.getToken=getToken;this.fetcher=fetcher;}
 async call(name,args={}){
  const token=await this.getToken();if(!token)throw new Error('Cloudový MCP kľúč nie je nastavený.');
  const response=await this.fetcher(this.base+'/mcp',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:crypto.randomUUID(),method:'tools/call',params:{name,arguments:args}}),signal:AbortSignal.timeout(45000),redirect:'error'});
  const data=await boundedJSON(response);if(data.error||data.result?.isError)throw new Error('Cloudový nástroj zlyhal.');
  const value=data.result?.content?.find(x=>x.type==='text')?.text;
  if(typeof value!=='string')throw new Error('Cloudový nástroj nemá výsledok.');
  const result=JSON.parse(value);if(result?.error)throw new Error(String(result.error).slice(0,300));return result;
 }
}

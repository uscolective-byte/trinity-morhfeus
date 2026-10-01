import {mkdir,readFile,rename,writeFile,appendFile} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';

export function stableJSON(value){
  if(Array.isArray(value))return `[${value.map(stableJSON).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stableJSON(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const sha256=value=>createHash('sha256').update(value).digest('hex');

export class ProposalStore{
  constructor(dataDir){this.dataDir=dataDir;this.file=path.join(dataDir,'proposals.json');this.audit=path.join(dataDir,'audit.jsonl');this.queue=Promise.resolve();}
  async init(){await mkdir(this.dataDir,{recursive:true});try{await readFile(this.file);}catch(error){if(error.code!=='ENOENT')throw error;await writeFile(this.file,'[]\n',{encoding:'utf8',flag:'wx'}).catch(e=>{if(e.code!=='EEXIST')throw e;});}}
  async #read(){await this.init();return JSON.parse(await readFile(this.file,'utf8'));}
  async #write(items){const temp=`${this.file}.${process.pid}.${randomUUID()}.tmp`;await writeFile(temp,JSON.stringify(items,null,2)+'\n','utf8');await rename(temp,this.file);}
  async #locked(fn){const previous=this.queue;let release;this.queue=new Promise(resolve=>{release=resolve;});await previous;try{return await fn();}finally{release();}}
  async auditEvent(event){await this.init();await appendFile(this.audit,JSON.stringify({...event,at:new Date().toISOString()})+'\n','utf8');}
  async create(action,payload,source='local-user'){
    return this.#locked(async()=>{const items=await this.#read();const createdAt=new Date().toISOString();const proposal={id:randomUUID(),action,payload,status:action==='read'?'approved':'proposed',source,createdAt,updatedAt:createdAt,expiresAt:new Date(Date.now()+30*60_000).toISOString()};proposal.digest=sha256(stableJSON({action,payload,createdAt}));items.push(proposal);await this.#write(items);await this.auditEvent({event:'proposal_created',id:proposal.id,action,digest:proposal.digest,source});return proposal;});
  }
  async importApproved(remote){
    return this.#locked(async()=>{const items=await this.#read();const existing=items.find(item=>item.id===remote.id);if(existing)return existing;const proposal={id:remote.id,action:remote.action,payload:remote.payload||{},status:'approved',source:'cloud-approved',createdAt:remote.created_at||new Date().toISOString(),updatedAt:new Date().toISOString(),expiresAt:new Date(remote.expires_at).toISOString(),digest:sha256(stableJSON({action:remote.action,payload:remote.payload,remote_id:remote.id}))};items.push(proposal);await this.#write(items);await this.auditEvent({event:'cloud_action_imported',id:proposal.id,action:proposal.action,digest:proposal.digest});return proposal;});
  }
  async list(){return (await this.#read()).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
  async get(id){return (await this.#read()).find(item=>item.id===id)||null;}
  async transition(id,allowed,status,extra={}){
    return this.#locked(async()=>{const items=await this.#read();const item=items.find(entry=>entry.id===id);if(!item)throw new Error('Návrh neexistuje.');if(!allowed.includes(item.status))throw new Error(`Návrh je v stave ${item.status}.`);Object.assign(item,extra,{status,updatedAt:new Date().toISOString()});await this.#write(items);await this.auditEvent({event:`proposal_${status}`,id:item.id,action:item.action,digest:item.digest});return item;});
  }
}

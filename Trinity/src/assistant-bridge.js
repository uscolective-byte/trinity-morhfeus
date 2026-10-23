import {z} from 'zod';
import {authenticateApiKey} from './api-keys.js';
import {HttpError,readJSON} from './security.js';

// A deliberately narrow, account-scoped bridge. No filesystem, deployment or
// MCP project-control tools are exposed to external assistant clients.
export const assistantNoteSchema=z.object({
  id:z.string().uuid(),
  text:z.string().trim().min(1).max(8000),
  base_revision:z.number().int().min(0),
  source:z.enum(['chatgpt','copilot'])
}).strict();

const response=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});

export async function handleAssistantBridge(request,env){
  const url=new URL(request.url);
  const path=url.pathname;
  const isStatus=path==='/api/assistant-bridge/status'&&request.method==='GET';
  const isList=path==='/api/assistant-bridge/notes'&&request.method==='GET';
  const isWrite=path==='/api/assistant-bridge/notes'&&request.method==='POST';
  if(!isStatus&&!isList&&!isWrite)throw new HttpError(404,'Neznáma metóda Trinity Assistant Bridge.');

  const client=await authenticateApiKey(request,env,isWrite?'assistant:write':'assistant:read');
  const owner=client.owner_id;
  if(isStatus)return response({
    service:'trinity-assistant-bridge',
    authenticated:true,
    data_scope:'api-key-owner',
    capabilities:['status','list_notes','upsert_note'],
    accounts_linked:false,
    note:'Prístup k API nie je potvrdením OAuth pripojenia ani automatickej synchronizácie histórie chatov.'
  });

  if(isList){
    const cursor=url.searchParams.get('cursor')||'';
    if(cursor&&!z.string().uuid().safeParse(cursor).success)throw new HttpError(400,'Neplatný cursor.');
    const rows=(await env.DB.prepare('SELECT id,text,revision,source,updated_at FROM ops_assistant_bridge_notes WHERE owner_id=? AND id>? ORDER BY id LIMIT 51')
      .bind(owner,cursor).all()).results||[];
    const notes=rows.slice(0,50);
    return response({notes,next_cursor:rows.length>50?notes.at(-1).id:null});
  }

  const data=assistantNoteSchema.parse(await readJSON(request,10000));
  const statement=data.base_revision===0
    ?env.DB.prepare('INSERT INTO ops_assistant_bridge_notes(owner_id,id,text,source,revision) VALUES(?,?,?,?,1) ON CONFLICT(owner_id,id) DO NOTHING RETURNING id,text,source,revision,updated_at')
      .bind(owner,data.id,data.text,data.source)
    :env.DB.prepare("UPDATE ops_assistant_bridge_notes SET text=?,source=?,revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE owner_id=? AND id=? AND revision=? RETURNING id,text,source,revision,updated_at")
      .bind(data.text,data.source,owner,data.id,data.base_revision);
  const stored=await statement.first();
  if(stored)return response({note:stored},data.base_revision===0?201:200);
  const current=await env.DB.prepare('SELECT revision FROM ops_assistant_bridge_notes WHERE owner_id=? AND id=?')
    .bind(owner,data.id).first();
  return response({error:'revision_conflict',current_revision:current?.revision??null},409);
}

import {z} from 'zod';
export const sharedNotesInput=z.object({changes:z.array(z.object({id:z.string().uuid(),text:z.string().max(8000),deleted:z.boolean().default(false),base_revision:z.number().int().min(0)}).strict()).max(5).default([]),cursor:z.string().uuid().optional()}).strict();
export async function syncSharedNotes(env,input){
  const data=sharedNotesInput.parse(input),accepted=[],conflicts=[];
  for(const item of data.changes){
    const change=item.base_revision===0?
      env.DB.prepare('INSERT INTO ops_shared_notes(id,text,deleted) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING RETURNING *').bind(item.id,item.text,item.deleted?1:0):
      env.DB.prepare("UPDATE ops_shared_notes SET text=?,deleted=?,revision=revision+1,updated_at=datetime('now') WHERE id=? AND revision=? RETURNING *").bind(item.text,item.deleted?1:0,item.id,item.base_revision);
    const result=await env.DB.batch([change,
      env.DB.prepare("INSERT INTO ops_memory(key,value,source) SELECT 'shared/'||id,text,'shared-local-cloud' FROM ops_shared_notes WHERE id=? AND deleted=0 ON CONFLICT(key) DO UPDATE SET value=excluded.value,source=excluded.source,updated_at=datetime('now')").bind(item.id),
      env.DB.prepare("DELETE FROM ops_memory WHERE key='shared/'||? AND EXISTS(SELECT 1 FROM ops_shared_notes WHERE id=? AND deleted=1)").bind(item.id,item.id)]);
    const row=result[0].results?.[0];
    if(row)accepted.push({...row,deleted:row.deleted===1});
    else{const current=await env.DB.prepare('SELECT * FROM ops_shared_notes WHERE id=?').bind(item.id).first();conflicts.push({id:item.id,current:current?{...current,deleted:current.deleted===1}:null});}
  }
  const rows=(await env.DB.prepare('SELECT * FROM ops_shared_notes WHERE id>? ORDER BY id LIMIT 101').bind(data.cursor||'').all()).results;
  const page=rows.slice(0,100).map(row=>({...row,deleted:row.deleted===1}));
  return {accepted,conflicts,notes:page,next_cursor:rows.length>100?page.at(-1).id:null};
}

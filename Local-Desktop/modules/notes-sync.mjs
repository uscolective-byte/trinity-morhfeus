// Content conflicts remain local and visible. No last-writer-wins overwrites.
export async function syncNotes(cloud,notes){
 const merged=structuredClone(notes),conflicts=[];
 const dirty=merged.filter(n=>n.sync_dirty!==false);
 const batches=[];let batch=[];
 for(const n of dirty){const item={id:n.id,text:n.text,deleted:!!n.deleted,base_revision:n.cloud_revision||0};if(batch.length&&(batch.length>=5||Buffer.byteLength(JSON.stringify([...batch,item]))>45000)){batches.push(batch);batch=[];}batch.push(item);}if(batch.length)batches.push(batch);
 for(const changes of batches){
  const response=await cloud.call('sync_shared_notes',{changes});
  for(const item of response.accepted||[]){const local=merged.find(n=>n.id===item.id);Object.assign(local,{cloud_revision:item.revision,sync_dirty:false});}
  for(const conflict of response.conflicts||[]){
   const local=merged.find(n=>n.id===conflict.id),remote=conflict.current;
   if(remote&&local.text===remote.text&&!!local.deleted===!!remote.deleted)Object.assign(local,{cloud_revision:remote.revision,sync_dirty:false});
   else{conflicts.push(conflict);local.sync_conflict=remote;}
  }
 }
 let cursor;const seen=new Set();
 do{
  const response=await cloud.call('sync_shared_notes',{...(cursor?{cursor}:{})});
  for(const remote of response.notes||[]){
   const local=merged.find(n=>n.id===remote.id);
   if(!local)merged.push({id:remote.id,text:remote.text,deleted:remote.deleted,created_at:remote.updated_at,cloud_revision:remote.revision,sync_dirty:false});
   else if(local.sync_dirty===false&&remote.revision>(local.cloud_revision||0))Object.assign(local,{text:remote.text,deleted:remote.deleted,cloud_revision:remote.revision,sync_conflict:undefined});
  }
  cursor=response.next_cursor;
  if(cursor){if(seen.has(cursor)||seen.size>=20)throw new Error('Cloudové stránkovanie poznámok sa nezastavilo.');seen.add(cursor);}
 }while(cursor);
 return {notes:merged,conflicts};
}

import { DurableObject, WorkerEntrypoint } from 'cloudflare:workers';
import { catalog, document, terms, download } from './policy.js';
export class KnowledgeStore extends DurableObject {
  constructor(ctx,env){super(ctx,env);this.sql=ctx.storage.sql;this.sql.exec(`CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY,title TEXT NOT NULL,text TEXT NOT NULL,hash TEXT NOT NULL,origin TEXT NOT NULL,url TEXT,updated_at TEXT NOT NULL)`);this.sql.exec(`CREATE TABLE IF NOT EXISTS chunks (source_id TEXT,position INTEGER,text TEXT,search_text TEXT,PRIMARY KEY(source_id,position))`);}
  async put(input,origin='user-import',url=null){
    const doc=document(input);
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(doc.text))),v=>v.toString(16).padStart(2,'0')).join('');
    return this.ctx.storage.transactionSync(()=>{
      const old=this.sql.exec('SELECT * FROM documents WHERE id=?',doc.source_id).toArray()[0];
      if(old?.hash===hash && old.origin===origin && old.url===url){
        if(origin==='catalog-fetch'){old.updated_at=new Date().toISOString();this.sql.exec('UPDATE documents SET updated_at=? WHERE id=?',old.updated_at,doc.source_id);}
        return {...old,unchanged:true};
      }
      if(!old && this.sql.exec('SELECT COUNT(*) AS n FROM documents').one().n>=64)throw new Error('Document capacity reached');
      const updated_at=new Date().toISOString();
      this.sql.exec('INSERT INTO documents VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,text=excluded.text,hash=excluded.hash,origin=excluded.origin,url=excluded.url,updated_at=excluded.updated_at',doc.source_id,doc.title,doc.text,hash,origin,url,updated_at);
      this.sql.exec('DELETE FROM chunks WHERE source_id=?',doc.source_id);
      for(let i=0;i<doc.text.length;i+=1800){const text=doc.text.slice(i,i+1800);this.sql.exec('INSERT INTO chunks VALUES(?,?,?,?)',doc.source_id,i/1800,text,`${doc.title} ${text}`.toLocaleLowerCase());}
      return {id:doc.source_id,title:doc.title,text:doc.text,hash,origin,url,updated_at,unchanged:false};
    });
  }
  get(id){return this.sql.exec('SELECT * FROM documents WHERE id=?',id).toArray()[0]||null;}
  search(query){const words=terms(query);if(!words.length)return {passages:[],untrusted_context:true};
    const score=words.map(()=>'(CASE WHEN instr(c.search_text,?)>0 THEN 1 ELSE 0 END)').join('+');
    const rows=this.sql.exec(`SELECT c.source_id,c.position,c.text,d.title,d.url,d.hash,d.origin,d.updated_at,(${score}) AS score FROM chunks c JOIN documents d ON d.id=c.source_id WHERE (${words.map(()=> 'instr(c.search_text,?)>0').join(' OR ')}) ORDER BY score DESC,d.updated_at DESC,c.source_id,c.position LIMIT 5`,...words,...words).toArray();
    return {passages:rows.map(r=>({...r,stale:Date.now()-Date.parse(r.updated_at)>604800000})),untrusted_context:true,verified_content:false};
  }
}
export default class KnowledgeService extends WorkerEntrypoint {
  store(){return this.env.KNOWLEDGE.get(this.env.KNOWLEDGE.idFromName('primary'));}
  getCatalog(){return catalog;}
  importDocument(input){return this.store().put(document(input));}
  async refresh(id){const doc=await download(id);return this.store().put(doc,'catalog-fetch',doc.url);}
  search(query){return this.store().search(query);}
  getDocument(id){if(typeof id!=='string'||id.length>80)throw new Error('Invalid source id');return this.store().get(id);}
  fetch(){return new Response('Not found',{status:404});}
}

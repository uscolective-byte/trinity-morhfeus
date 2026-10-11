const STOP_WORDS = new Set('prosim prosimta chcem potrebujem mozes mozem tento tato toto tieto tam teraz potom dalej nie nejde mam mas pre ako aby ked tak len este bude budu bolo dobre pozri sprav urob vysvetli povedz the and this that with from please help want need could would about'.split(' '));
const folded = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('sk');
const SECRET_KEY = /(?:^|[/_.-])(?:credentials?|tokens?|password|heslo|api[_-]?key|private[_-]?key)(?:$|[/_.-])/i;
const SECRET_VALUE = /(?:\b(?:gh[pousr]_[A-Za-z0-9_]{16,}|github_pat_[A-Za-z0-9_]{16,}|trn_live_[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9_-]{16,})\b|\bBearer\s+[A-Za-z0-9._~-]{16,})/g;

export function memorySearchTerms(task, limit=6) {
  const words=String(task||'').slice(0,12000).match(/[\p{L}\p{N}][\p{L}\p{N}_-]{1,59}/gu)||[];
  const unique=new Map();
  for(const word of words) {
    const key=folded(word);
    if(STOP_WORDS.has(key)||word.length>40||/^gh[pousr]_|^github_pat_|^trn_live_|^sk-/i.test(word))continue;
    if(!unique.has(key))unique.set(key,word);
  }
  return [...unique.values()].slice(0,Math.max(0,Math.min(6,limit)));
}

export function selectMemoryRecords(records, task, limit=8) {
  const terms=memorySearchTerms(task).map(folded);
  const ranked=(Array.isArray(records)?records:[]).filter(r=>r&&typeof r.key==='string'&&typeof r.value==='string'&&!SECRET_KEY.test(r.key)).map((record,index)=>{
    const key=folded(record.key),text=folded(record.value.slice(0,3000));
    const relevance=terms.reduce((score,term)=>score+(key.includes(term)?4:0)+(text.includes(term)?2:0),0);
    const profile=record.key.startsWith('profil/');
    return {record,index,score:(profile?20:0)+relevance+((record.source==='user'||String(record.source||'').startsWith('user:'))?1:0),profile,relevance};
  }).filter(r=>r.profile||r.relevance>0||terms.length===0)
    .sort((a,b)=>b.score-a.score||a.index-b.index);
  const seenKeys=new Set(),seenValues=new Set(),selected=[];
  for(const {record} of ranked) {
    const fingerprint=folded(record.value.trim());
    if(seenKeys.has(record.key)||seenValues.has(fingerprint))continue;
    seenKeys.add(record.key);seenValues.add(fingerprint);
    selected.push(record);
    if(selected.length>=Math.max(1,Math.min(8,limit)))break;
  }
  return selected;
}

export function sanitizeMemoryRecords(records,limit=13,maxLength=2500) {
  return (Array.isArray(records)?records:[]).filter(r=>r&&typeof r.key==='string'&&typeof r.value==='string'&&!SECRET_KEY.test(r.key))
    .slice(0,Math.max(0,Math.min(40,limit))).map(r=>({key:r.key.slice(0,160),value:r.value.slice(0,maxLength).replace(SECRET_VALUE,'[redacted]').replace(/((?:api[_ -]?key|password|heslo|access[_ -]?token)\s*[:=]\s*)[^\s"']+/gi,'$1[redacted]'),source:String(r.source||'unknown').slice(0,160),...(typeof r.updated_at==='string'?{updated_at:r.updated_at.slice(0,40)}:{})}));
}

export function formatMemoryContext(records) {
  return JSON.stringify(sanitizeMemoryRecords(records,8,1800));
}

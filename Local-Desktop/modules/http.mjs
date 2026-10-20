export async function boundedJSON(response,limit=6_000_000){
 let size=0;const chunks=[];if(!response.body)throw new Error('Prázdna odpoveď služby.');
 for await(const chunk of response.body){size+=chunk.length;if(size>limit)throw new Error('Odpoveď služby prekročila limit.');chunks.push(chunk);}
 const text=Buffer.concat(chunks).toString('utf8');
 if(!response.ok)throw new Error(`Služba odmietla požiadavku (HTTP ${response.status}).`);
 const events=text.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trim()).filter(Boolean);
 try{return JSON.parse(events.length?events.at(-1):text);}catch{throw new Error('Služba nevrátila platný JSON.');}
}

import {readFile} from 'node:fs/promises';
import {createInterface} from 'node:readline';
import {boundedJSON} from '../modules/http.mjs';
const launch=JSON.parse(await readFile(new URL('../Data/launch.json',import.meta.url),'utf8'));
const url=new URL(launch.url);
if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||!/^[a-f0-9]{64}$/.test(new URLSearchParams(url.hash.slice(1)).get('token')||''))throw new Error('Invalid local Trinity launch descriptor.');
const token=new URLSearchParams(url.hash.slice(1)).get('token');
const lines=createInterface({input:process.stdin,crlfDelay:Infinity});
for await(const line of lines){
 try{const input=JSON.parse(line);const response=await fetch(url.origin+'/mcp',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(90000)});const result=await boundedJSON(response);if(input.id!==undefined)process.stdout.write(JSON.stringify(result)+'\n');}
 catch{let id=null;try{id=JSON.parse(line).id??null;}catch{}process.stdout.write(JSON.stringify({jsonrpc:'2.0',id,error:{code:-32603,message:'Local Trinity MCP request failed. Start Trinity and check its settings.'}})+'\n');}
}

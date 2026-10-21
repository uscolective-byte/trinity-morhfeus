import {spawnSync} from 'node:child_process';
import {access,copyFile,mkdir} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {createInterface} from 'node:readline/promises';
import {normalizePhone,openClawMcpServer,whatsappPolicy} from './config.mjs';

const origin=process.argv.includes('--development')?'https://auru.dev':'https://auru.space';
function command(args,{capture=false}={}){
 const result=spawnSync('openclaw',args,{encoding:'utf8',stdio:capture?'pipe':'inherit',shell:false});
 if(result.error)throw new Error('OpenClaw CLI nie je spustiteľné. Najprv dokonči oficiálnu inštaláciu a onboarding.');
 if(result.status!==0)throw new Error('OpenClaw krok zlyhal: '+args.slice(0,3).join(' ')+'. Konfigurácia môže byť čiastočne zmenená; záloha zostala zachovaná.');
 return result.stdout||'';
}
try{
 if(process.platform==='win32')throw new Error('Skript spusti v Node.js vo WSL2 alebo Linuxe. Native Windows .cmd spúšťanie nie je implementované.');
 command(['--version'],{capture:true});
 if(!/^trn_live_[A-Za-z0-9_-]{30,}$/.test(process.env.TRINITY_MCP_TOKEN||''))throw new Error('V lokálnom prostredí nastav TRINITY_MCP_TOKEN na samostatný Trinity API kľúč s mcp:read a mcp:write. Token nepíš do príkazového argumentu ani neposielaj do chatu.');
 const cli=createInterface({input:process.stdin,output:process.stdout});
 let phone;
 try{
  phone=normalizePhone(process.env.TRINITY_PHONE||await cli.question('Tvoje číslo WhatsApp s predvoľbou: '));
  const confirmed=(await cli.question('Prepojiť výhradne číslo '+phone+'? Napíš ANO: ')).trim();
  if(confirmed!=='ANO')throw new Error('Párovanie nebolo potvrdené.');
 }finally{cli.close();}
 const dir=join(homedir(),'.openclaw'),config=join(dir,'openclaw.json');
 await mkdir(dir,{recursive:true});
 let existing=false;
 try{await access(config);existing=true;}catch{}
 if(existing){
  await copyFile(config,config+'.trinity-backup-'+new Date().toISOString().replace(/[:.]/g,'-'));
  console.log('Pôvodná konfigurácia bola zálohovaná.');
 }
 command(['mcp','set','trinity',JSON.stringify(openClawMcpServer(origin))]);
 command(['config','set','channels.whatsapp',JSON.stringify(whatsappPolicy(phone))]);
 command(['mcp','probe','trinity','--json']);
 console.log('MCP odpovedá. Nasledujúci QR kód potvrď vo WhatsApp na svojom telefóne.');
 command(['channels','login','--channel','whatsapp']);
 command(['channels','status','--probe']);
 console.log('Kanál prešiel kontrolou. Vo WhatsApp pošli skúšobnú správu a požiadaj o Trinity status.');
 console.log('Dokončenie úlohy over cez get_task so stavom completed.');
 console.log('Gateway služba musí mať TRINITY_MCP_TOKEN aj po reštarte. Skript token neukladá a neinštaluje model ani Gateway službu.');
}catch(error){console.error(error.message);process.exitCode=1;}

// Deliberately small Telegram read-only surface. Do not call the general tool executor
// from this channel: it also exposes writing, deploying, shell and payment operations.
import {AGENTS} from './registry.js';
import {readiness,serviceStatus} from './services.js';
import {capabilityStatus} from './capability-status.js';
import {listJobs} from './jobs.js';

export const TELEGRAM_READ_COMMANDS=Object.freeze([
  {command:'/tools',description:'Zoznam dostupných bezpečných príkazov'},
  {command:'/health',description:'Overenie pripravenosti Trinity'},
  {command:'/agents',description:'Zoznam agentov (bez administratívnych oprávnení)'},
  {command:'/services',description:'Overenie reálnej dostupnosti služieb'},
  {command:'/capabilities',description:'Zhrnutie pripojení a dokladov vykonania'},
  {command:'/tasks',description:'Posledné úlohy – len ID a stav'}
]);
const strip=(v,max=140)=>String(v??'').replace(/[\r\n\t]/g,' ').slice(0,max);
const line=(values)=>values.filter(Boolean).join(' · ');
export function resolveTelegramReadCommand(raw){
  const text=String(raw||'').trim().toLocaleLowerCase('sk');
  const first=text.split(/\s+/,1)[0].split('@')[0];
  if(TELEGRAM_READ_COMMANDS.some(item=>item.command===first))return first;
  // Deterministic, explicit read intents, not LLM-granted tool privileges.
  if(/^(skontroluj|over|ukaz|ukáž|zisti|zobraz)\s+(stav|zdravie|pripravenost|pripravenosť)\s+(trinity|systemu|systému)$/.test(text))return '/health';
  if(/^(skontroluj|over|ukaz|ukáž|zisti|zobraz)\s+(stav|dostupnost|dostupnosť)\s+(sluzieb|služieb|workerov)$/.test(text))return '/services';
  if(/^(vypis|vypíš|ukaz|ukáž|zobraz)\s+(agentov|agentov trinity|zoznam agentov)$/.test(text))return '/agents';
  return null;
}
export async function runTelegramReadTool(command,env){
  switch(command){
    case '/tools':
      return 'Bezpečné príkazy Trinity cez Telegram:\n'+TELEGRAM_READ_COMMANDS.map(item=>item.command+' — '+item.description).join('\n')+
        '\nZmeny kódu, terminál, nasadenia a platby cez tento kanál nie sú povolené. Na vývoj použi Gemini/Antigravity s Trinity MCP a schvaľovaním.';
    case '/health':{
      const state=await readiness(env);
      return line(['Trinity', 'ready: '+Boolean(state.ready), 'stav: '+strip(state.status), 'chýba: '+(state.missing?.length?state.missing.join(', '):'nič nezistené')]);
    }
    case '/agents':{
      return 'Registrovaní agenti (registrácia nie je overenie vykonania):\n'
        +AGENTS.slice(0,20).map(agent=>line([strip(agent.id,40),strip(agent.name,55)])).join('\n')
        +'\nCelkom: '+AGENTS.length+'.';
    }
    case '/services':{
      const checks=await serviceStatus(env);
      const counts={reachable:0,error:0,not_configured:0};
      for(const item of checks)counts[item.status]=(counts[item.status]||0)+1;
      return 'Overené health sondy služieb: '+checks.length+'\n'
        +'Dostupné: '+counts.reachable+' · Chybné: '+counts.error+' · Nenakonfigurované: '+counts.not_configured+'\n'
        +checks.slice(0,15).map(item=>line([strip(item.binding,35),strip(item.status,30)])).join('\n')
        +'\nDostupnosť neznamená, že nástroje úspešne vykonali úlohu.';
    }
    case '/capabilities':{
      const state=await capabilityStatus(env);
      return 'PC Bridge: '+(state.pc_connected?'pripojený':'nepripojený alebo nepotvrdený')+'\n'
        +(state.groups||[]).map(item=>line([strip(item.name,45),strip(item.status,30),'vykonané: '+Boolean(item.execution_verified)])).join('\n');
    }
    case '/tasks':{
      const items=await listJobs(env,5);
      return items.length?'Posledné úlohy (bez citlivého obsahu):\n'+items.map(item=>line([strip(item.id,40),strip(item.status,25)])).join('\n'):'Žiadne úlohy.';
    }
    default:return null;
  }
}

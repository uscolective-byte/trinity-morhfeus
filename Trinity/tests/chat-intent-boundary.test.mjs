import test from 'node:test';
import assert from 'node:assert/strict';
import {directChatTool} from '../src/fast-chat.js';

test('social greetings are not infrastructure checks even when diagnostic tools are available',()=>{
 const tools=['infrastructure_status','fleet_status','list_capabilities'];
 for(const message of ['Ako sa máš?','ako sa mas','Jak se máš?','Jak sa máš!','Prosím ako sa máš?','Ahoj, ako sa máš?']){
  assert.equal(directChatTool(message,tools),null,message);
 }
});

test('explicit status requests retain deterministic diagnostic routing',()=>{
 for(const message of ['Stav','Status?','Diagnostika','Aký je stav?','Kontrola!']){
  assert.deepEqual(directChatTool(message,['infrastructure_status']),{name:'infrastructure_status',arguments:{}},message);
 }
 assert.deepEqual(directChatTool('Stav',['fleet_status']),{name:'fleet_status',arguments:{}});
 assert.deepEqual(directChatTool('Stav',['list_capabilities']),{name:'list_capabilities',arguments:{}});
});

test('explicit repository status uses GitHub while pasted reports remain contextual',()=>{
 assert.equal(directChatTool('Skontroluj stav repozitára',['github_manage'])?.name,'github_manage');
 for(const message of [
   'Overím repozitár Trinity-antigravity, prečítam pravidlá spolupráce a vyhľadám nastavenia MCP. Pokračuj v úlohe.',
   'Antigravity potvrdil ACK do TEAM-HANDOFF.md. GitHub repo je prepojené. Môžeš pokračovať v oprave chatu.',
   'Vysvetli tento kód a oprav zobrazenie správ.',
   'Prečítaj subory a navrhni zlepšenie komunikácie.'
 ])assert.equal(directChatTool(message,['github_manage']),null);
});

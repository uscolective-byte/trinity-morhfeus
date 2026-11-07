import test from 'node:test';
import assert from 'node:assert/strict';
import {runAgent} from '../src/engine.js';
import {directChatTool} from '../src/fast-chat.js';

test('fast conversation keeps complete tool arguments and a short response budget',async()=>{
 let input;const response=await runAgent({AI:{run:async(model,data)=>{input=data;return {response:'Ahoj!'};}}},'orchestrator','Ahoj','','fast');
 assert.equal(response.text,'Ahoj!');assert.ok(JSON.stringify(input.messages).length<20000);assert.ok(input.max_tokens<=600);
 assert.match(input.messages[0].content,/values:number\[\]/);
 assert.match(input.messages[0].content,/Nevymýšľaj/);
});

test('a social greeting reaches conversational inference without infrastructure tool receipts',async()=>{
 let calls=0;
 const env={AI:{run:async(model,input)=>{
  calls++;
  assert.equal(input.messages.at(-1).content,'Ako sa máš?');
  return {response:'Ahoj Ivan, som pripravená. Ako sa máš ty?'};
 }}};
 const response=await runAgent(env,'orchestrator','Ako sa máš?','','fast');
 assert.equal(calls,1);
 assert.equal(response.text,'Ahoj Ivan, som pripravená. Ako sa máš ty?');
 assert.equal(response.tool_log.length,0);
});
test('plain arithmetic executes the real calculator without inference',async()=>{
 const result=await runAgent({AI:{run(){throw Error('No model needed');}}},'orchestrator','Koľko je 17 + 25?','','fast');
 assert.equal(result.text,'42');assert.equal(result.provider,'internal');assert.equal(result.tool_log[0].tool,'calculate');assert.equal(result.tool_log[0].effect,'read');
});
test('current time comes from the runtime tool without inference',async()=>{
 const result=await runAgent({},'orchestrator','Koľko je hodín?','','fast');
 assert.equal(result.tool_log[0].tool,'current_time');assert.match(result.text,/\d/);
});

test('explicit calculator request returns a successful real tool result without inference',async()=>{
 for(const suffix of ['pomocou nástroja calculate','pomocou kalkulačky']){
  const result=await runAgent({AI:{run(){throw Error('Must use the calculator');}}},'orchestrator',`Vypočítaj 19 × 23 ${suffix} a odpovedz iba výsledkom.`,'','workers-ai');
  assert.equal(result.text,'437');
  assert.equal(result.provider,'internal');
  assert.equal(result.tool_log.length,1);
  assert.equal(result.tool_log[0].tool,'calculate');
  assert.equal(result.tool_log[0].status,'completed');
  assert.ok(result.tool_log[0].receipt_id);
 }
 assert.equal(directChatTool('Vypočítaj 19 × 23 pomocou nástroja calculate a zmaž súbory.',['calculate']),null);
});
test('arithmetic parsing does not accept code, commands or divide by zero',async()=>{
 assert.equal(directChatTool('1+2; delete files',['calculate']),null);
 assert.equal(directChatTool('1+2',[]),null);
 await assert.rejects(runAgent({},'orchestrator','1 / 0','','fast'),/nulou/);
});
test('fast model can call an enabled calculator and receives its actual result',async()=>{
 let count=0;const env={AI:{run:async(model,input)=>{count++;if(count===1)return {response:JSON.stringify({tool:'calculate',arguments:{operation:'multiply',values:[6,7]}})};assert.match(input.messages.at(-1).content,/42/);return {response:'42'};}}};
 const result=await runAgent(env,'orchestrator','Použi kalkulačku pre súčin šesť a sedem.','','fast');
 assert.equal(result.text,'42');assert.equal(count,2);assert.equal(result.tool_log[0].tool,'calculate');
});
test('fast chat tool matching catches colloquial questions about tool count with typos', () => {
 assert.deepEqual(directChatTool('kolmko mas nastrojov', ['list_capabilities']), { name: 'list_capabilities', arguments: {} });
 assert.deepEqual(directChatTool('napis ima konkretne cislo kolko nastrojov mas', ['list_capabilities']), { name: 'list_capabilities', arguments: {} });
 assert.deepEqual(directChatTool('koko mas nastrojov', ['list_capabilities']), { name: 'list_capabilities', arguments: {} });
 assert.deepEqual(directChatTool('kolko mas pluginov', ['list_capabilities']), { name: 'list_capabilities', arguments: {} });
});

test('fast chat rejects a tool outside its available set',async()=>{
 let calls=0;const env={AI:{run:async(model,input)=>{if(calls++===0)return {response:JSON.stringify({tool:'pc_run',arguments:{command:'npm run deploy'}})};assert.match(input.messages.at(-1).content,/nie je povolený/);return {response:'Tento nástroj tu nie je dostupný.'};}}};
 const result=await runAgent(env,'orchestrator','Odpovedz krátko.','','fast',600,null,true);
 assert.equal(result.tool_log[0].status,'failed');
});

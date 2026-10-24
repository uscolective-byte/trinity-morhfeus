import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveTelegramReadCommand,runTelegramReadTool,TELEGRAM_READ_COMMANDS} from '../src/telegram-tools.js';
import {processTelegramMessage} from '../src/telegram-webhook.js';

test('Telegram read command selection is explicit and does not translate mutations into tools',()=>{
  assert.equal(resolveTelegramReadCommand('/tools'),'/tools');
  assert.equal(resolveTelegramReadCommand('/agents@TrinityBot'),'/agents');
  assert.equal(resolveTelegramReadCommand('Skontroluj stav Trinity'),'/health');
  assert.equal(resolveTelegramReadCommand('Over dostupnosť služieb'),'/services');
  assert.equal(resolveTelegramReadCommand('vypíš agentov'),'/agents');
  assert.equal(resolveTelegramReadCommand('vymaž celý repozitár'),null);
  assert.equal(resolveTelegramReadCommand('/deploy'),null);
});
test('Telegram tool inventory is an intentional read-only allowlist',async()=>{
  const toolNames=TELEGRAM_READ_COMMANDS.map(x=>x.command);
  assert.deepEqual(toolNames,['/tools','/health','/agents','/services','/capabilities','/tasks']);
  const help=await runTelegramReadTool('/tools',{});
  assert.match(help,/bezpečné príkazy/i);
  assert.match(help,/schvaľovaním/i);
  assert.doesNotMatch(help,/\/deploy(?!ment)/);
});
test('Telegram calls its read-only dispatcher without triggering the chat model',async()=>{
  const requests=[]; const replies=[];
  const message={chat:{id:12345},text:'Skontroluj stav Trinity',message_id:42};
  await processTelegramMessage(message,{},
    async()=>{throw new Error('Do not ask the model for deterministic tool queries');},
    async (_env,chat,text)=>{replies.push({chat,text});},
    async(cmd)=>{requests.push(cmd);return 'Trinity health checked';});
  assert.deepEqual(requests,['/health']);
  assert.deepEqual(replies,[{chat:'12345',text:'Trinity health checked'}]);
});
test('Telegram /agents returns truthful registration metadata but never source code',async()=>{
  const response=await runTelegramReadTool('/agents',{});
  assert.match(response,/Registrovaní agenti/);
  assert.match(response,/nie je overenie vykonania/);
  assert.ok(response.length<3000);
});

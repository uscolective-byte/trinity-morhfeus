import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePhone,openClawMcpServer,whatsappPolicy} from '../integrations/openclaw/config.mjs';
test('normalizes Slovak trunk notation and validates E.164',()=>{
 assert.equal(normalizePhone('004210900123456'),'+421900123456');
 assert.equal(normalizePhone('0900 123 456'),'+421900123456');
 assert.equal(normalizePhone('+421900123456'),'+421900123456');
 for(const value of ['not-a-number','+421123','+00000000','+421000000000'])assert.throws(()=>normalizePhone(value));
});
test('MCP config keeps credentials out of saved JSON',()=>{
 const value=openClawMcpServer();
 assert.equal(value.headers.Authorization,'Bearer ${TRINITY_MCP_TOKEN}');
 assert.equal(value.url,'https://auru.space/mcp');
 assert.deepEqual(value.toolFilter.include,['trinity_status','get_capability_status','infrastructure_status','dispatch_task','get_task']);
 assert.throws(()=>openClawMcpServer('https://example.com'));
 assert.equal(openClawMcpServer('https://auru.dev').url,'https://auru.dev/mcp');
});
test('WhatsApp permits only the confirmed number and disables groups',()=>{
 const value=whatsappPolicy('+421900123456');
 assert.equal(value.dmPolicy,'allowlist');assert.deepEqual(value.allowFrom,['+421900123456']);assert.equal(value.groupPolicy,'disabled');assert.equal(value.selfChatMode,true);
});

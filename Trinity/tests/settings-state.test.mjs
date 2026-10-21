import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/assistant/settings-state.js.txt',import.meta.url),'utf8');
const {integrationPresentation,apiKeySettings}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('configured integrations are never shown as verified or connected',()=>{
 assert.equal(integrationPresentation('configured').label,'Nakonfigurované · čaká na test');
 assert.equal(integrationPresentation('platform-connected').label,'Cloudflare platforma · API neoverené');
 assert.equal(integrationPresentation('verified').label,'Overené');
 assert.equal(integrationPresentation('unknown-value').label,'Stav neoverený');
});
test('OpenClaw key receives only MCP scopes and bounded expiry',()=>{
 const now=Date.parse('2026-10-21T00:00:00Z'),input=apiKeySettings(' OpenClaw ','mcp-tasks',30,7,now);
 assert.deepEqual(input.scopes,['mcp:read','mcp:write']);assert.equal(input.name,'OpenClaw');assert.equal(input.expires_at,'2026-10-28T00:00:00.000Z');
 assert.deepEqual(apiKeySettings('Reader','mcp-read',30,30,now).scopes,['mcp:read']);
 assert.deepEqual(apiKeySettings('My app','api',30,90,now).scopes,['api:invoke']);
});
test('invalid purpose, quota or expiration cannot silently create broad keys',()=>{
 for(const [purpose,quota,days] of [['admin',30,7],['api',0,7],['api',30,0],['api',30,365]])assert.throws(()=>apiKeySettings('My app',purpose,quota,days));
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import guardian from '../services/guardian.js';
import proxy from '../services/ops-proxy.js';
test('guardian checks the real health contract through its binding',async()=>{const r=await guardian.fetch(new Request('https://guardian.test/health'),{TRINITY:{fetch:async()=>Response.json({status:'serving',version:'6.1.0'})}});assert.equal(r.status,200);assert.equal((await r.json()).ok,true);});
test('guardian propagates a failed dependency',async()=>{const r=await guardian.fetch(new Request('https://guardian.test/health'),{TRINITY:{fetch:async()=>{throw new Error('offline')}}});assert.equal(r.status,503);assert.equal((await r.json()).ok,false);});
test('retired public SQL executor cannot run queries',async()=>{assert.equal((await proxy.fetch(new Request('https://ops.test/sql',{method:'POST'}),{})).status,401);assert.equal((await proxy.fetch(new Request('https://ops.test/sql',{method:'POST',headers:{Authorization:'Bearer test'}}),{})).status,410);});

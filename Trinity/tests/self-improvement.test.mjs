import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSelfImprovementProposal, approveSelfImprovementProposal, applySelfImprovementProposal, ownerLearnBehaviorRule, behaviorRulesDirective} from '../src/self-improvement.js';

function mockEnv() {
  const rows = new Map();
  const events = [];
  return {
    rows, events,
    DB: {
      prepare(sql) {
        const state = {sql, params: []};
        return {
          bind(...params) { state.params = params; return this; },
          async first() {
            if (state.sql.includes('INSERT INTO self_improvement_proposals')) {
              const [id,title,description,kind,plugin_id,status,created_by] = [
                state.params[0],state.params[1],state.params[2],state.params[3],state.params[4],'pending',state.params[5]
              ];
              const row = {id,title,description,kind,plugin_id,status,created_by,approved_by:null,result_json:null,created_at:'now',updated_at:'now'};
              rows.set(id,row); return {...row};
            }
            if (state.sql.includes("UPDATE self_improvement_proposals SET status='approved'")) {
              const [actor,id] = state.params, row = rows.get(id);
              if (!row || row.status !== 'pending') return null;
              Object.assign(row,{status:'approved',approved_by:actor}); return {...row};
            }
            if (state.sql.includes("SELECT * FROM self_improvement_proposals")) {
              const row = rows.get(state.params[0]); return row && row.status==='approved' ? {...row} : null;
            }
            if (state.sql.includes("UPDATE self_improvement_proposals SET status='applied'")) {
              const [result,id] = state.params, row=rows.get(id);
              if (!row || row.status!=='approved') return null;
              Object.assign(row,{status:'applied',result_json:result}); return {...row};
            }
            return null;
          },
          async run() {
            if (state.sql.includes('INSERT INTO ops_events')) events.push({action:state.params[0],details:state.params[1]});
            return {success:true};
          },
          async all() { return {results:[...rows.values()].map(x=>({...x}))}; }
        };
      }
    }
  };
}

test('self-improvement proposals require owner approval before plugin installation', async () => {
  const env=mockEnv();
  const proposal=await createSelfImprovementProposal(env,{title:'Install audit module',description:'Install the existing audit plugin from the Trinity catalogue.',kind:'plugin_install',plugin_id:'audit'},'owner@example.test');
  assert.equal(proposal.status,'pending');
  let installed=false;
  await assert.rejects(()=>applySelfImprovementProposal(env,proposal.id,'owner',async()=>{installed=true;}),/schválený vlastníkom/i);
  assert.equal(installed,false);
  await approveSelfImprovementProposal(env,proposal.id,'owner@example.test');
  const applied=await applySelfImprovementProposal(env,proposal.id,'owner@example.test',async id=>{installed=true;return {id,status:'installed'};});
  assert.equal(installed,true);
  assert.equal(applied.status,'applied');
  assert.ok(env.events.some(e=>e.action==='self_improvement_plugin_installed'));
});

test('self-improvement rejects deployment and source-code changes as direct live mutations', async () => {
  const env=mockEnv();
  const proposal=await createSelfImprovementProposal(env,{title:'Deploy an improvement',description:'Deploy only after the required automated checks complete.',kind:'deployment'},'owner@example.test');
  await approveSelfImprovementProposal(env,proposal.id,'owner@example.test');
  await assert.rejects(()=>applySelfImprovementProposal(env,proposal.id,'owner',async()=>({})),/GitHub Actions/i);
});

test('plugin install proposals require a plugin id', async () => {
  const env=mockEnv();
  await assert.rejects(()=>createSelfImprovementProposal(env,{title:'Install module',description:'Install a module from the existing catalogue.',kind:'plugin_install'},'owner'),/plugin_id/i);
});

test('owner can teach Trinity an audited behavior rule that becomes active without code rewrite', async () => {
  const env=mockEnv();
  const applied=await ownerLearnBehaviorRule(env,'Pri odpovediach vždy najprv zhrň výsledok v jednej vete.','owner-chat');
  assert.equal(applied.status,'applied');
  assert.ok(env.events.some(e=>e.action==='self_improvement_rule_activated'));
  assert.match(behaviorRulesDirective([applied]),/NAUČENÉ ZLEPŠENIA/);
  assert.equal(behaviorRulesDirective([]),'');
});

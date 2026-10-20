/**
 * Trinity Evolution Engine v1.0
 * Automatická analýza chýb a kontinuálne seba-zdokonaľovanie Trinity.
 */
import {readControl, assertRunning} from './control.js';
import {createSelfImprovementProposal,approveSelfImprovementProposal,applySelfImprovementProposal,reconcileSelfImprovements} from './self-improvement.js';

export async function runEvolutionCycle(env) {
  if (!env || !env.DB) return {status: 'db_not_available'};

  const control = await readControl(env);
  assertRunning(control);

  try { await reconcileSelfImprovements(env); }
  catch(error){ await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('evolution_reconcile_failed',?)").bind(JSON.stringify({error:error.message})).run(); }

  // Nájde posledné zlyhané úlohy
  const failedRows = await env.DB.prepare(
    "SELECT id, session_id, task, error, provider, language, updated_at FROM ops_jobs WHERE status='failed' AND error IS NOT NULL ORDER BY updated_at DESC LIMIT 3"
  ).all();

  const failedJobs = failedRows.results || [];
  if (!failedJobs.length) {
    return {status: 'no_failures', message: 'Žiadne zlyhané úlohy na analýzu.'};
  }

  const analyzed = [];

  for (const job of failedJobs) {
    // Overíme, či už bola táto úloha analyzovaná v evolučnej pamäti
    const existing = await env.DB.prepare(
      "SELECT key FROM ops_memory WHERE key=?"
    ).bind(`evolution/job-${job.id}`).first();

    if (existing) continue;

    // Diagnostika a poučenie z chyby
    const errorText = (job.error || 'Neznáma chyba').slice(0, 500);
    const diagnosis = {
      job_id: job.id,
      task: job.task,
      error: errorText,
      analyzed_at: new Date().toISOString(),
      lesson: `Pri vykonávaní úlohy nastala chyba: ${errorText}. Odporúčanie: Overiť parametre nástrojov a dostupnosť poskytovateľa ${job.provider}.`
    };

    if (env.TRINITY_AUTO_IMPROVE === 'true' && (env.TRINITY_GITHUB_TOKEN || env.GITHUB_TOKEN)) {
      const proposal=await createSelfImprovementProposal(env,{title:`Oprava zlyhanej úlohy ${job.id}`.slice(0,120),description:`Nájdi príčinu a priprav najmenšiu opravu s testom. Úloha: ${String(job.task).slice(0,2000)}. Chyba: ${errorText}`,kind:'code_improvement'},'evolution-engine');
      await approveSelfImprovementProposal(env,proposal.id,'owner-standing-policy:TRINITY_AUTO_IMPROVE');
      try { diagnosis.execution=await applySelfImprovementProposal(env,proposal.id,'evolution-engine'); }
      catch(error){ diagnosis.execution={status:'failed',error:error.message}; }
    }

    // Uložíme zistenie do pamäte Trinity, aby sa rovnaká chyba neopakovala
    await env.DB.prepare(
      "INSERT INTO ops_memory(key, value, source) VALUES(?, ?, 'evolution-engine') ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')"
    ).bind(`evolution/job-${job.id}`, JSON.stringify(diagnosis)).run();

    // Zaznamenáme udalosť do auditu
    await env.DB.prepare(
      "INSERT INTO ops_events(job_id, action, details) VALUES(?, 'evolution_learning_recorded', ?)"
    ).bind(job.id, JSON.stringify({job_id: job.id, lesson: diagnosis.lesson})).run();

    analyzed.push({job_id: job.id, diagnosis: diagnosis.lesson});
  }

  return {
    status: analyzed.length ? 'evolution_cycle_completed' : 'already_analyzed',
    analyzed_count: analyzed.length,
    analyzed
  };
}

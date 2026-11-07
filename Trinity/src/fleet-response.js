/** Format the canonical inspectFleet contract; only successful probes count as online. */
export function formatFleetStatus(outcome={}) {
  if (!Array.isArray(outcome.workers) || !Array.isArray(outcome.auxiliary_workers)) {
    return 'Stav flotily sa nepodarilo overiť: výsledok kontroly nemá očakávaný formát.';
  }
  const workers=outcome.workers;
  const auxiliary=outcome.auxiliary_workers;
  const online=items=>items.filter(item=>item.status==='online').length;
  const row=item=>`- ${item.binding} (${item.service}) — ${item.status}`;
  return `Stav flotily podľa aktuálnej kontroly: ${online(workers)}/${workers.length} hlavných a ${online(auxiliary)}/${auxiliary.length} pomocných Workerov online.\n\n`+
    'Hlavné Workery:\n'+(workers.map(row).join('\n')||'Žiadne záznamy.')+
    '\n\nPomocné Workery:\n'+(auxiliary.map(row).join('\n')||'Žiadne záznamy.')+
    '\n\nOnline znamená úspešnú odpoveď pri tejto kontrole. Stav not_configured znamená chýbajúci binding; unreachable znamená neúspešnú kontrolu dostupnosti.';
}

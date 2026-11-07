/** Missing data stays missing; configuration does not prove connectivity. */
export const UNAVAILABLE='Údaj nie je dostupný v systéme';
const value=v=>typeof v==='string'&&v.trim()?v.trim():UNAVAILABLE;
const list=v=>Array.isArray(v)&&v.length?v.map(value).join(', '):UNAVAILABLE;
const money=v=>typeof v==='number'&&Number.isFinite(v)?v.toFixed(2)+' EUR':UNAVAILABLE;
export function formatAppOpenResult(appName,receipt,language='sk'){
  if(receipt?.status==='completed'&&receipt.effect==='mutation'&&receipt.receipt_id){
    return language==='en'?'I have opened '+appName+' on your computer.':'Otvorila som aplikáciu '+appName+' na tvojom počítači.';
  }
  if(receipt?.status==='failed')return language==='en'?'Opening '+appName+' failed.':'Otvorenie aplikácie '+appName+' sa nepodarilo.';
  return language==='en'?'Opening '+appName+' is not confirmed. The action is pending.':
    'Otvorenie aplikácie '+appName+' nie je potvrdené. Akcia zatiaľ čaká na vykonanie alebo overenie.';
}
export function formatIntegrationStatus(outcome={}){
  const items=Array.isArray(outcome.integrations)?outcome.integrations:[];
  return 'Prehľad integrácií podľa výsledku nástroja:\n'+
    (items.length?items.map(i=>'- '+value(i.name||i.id)+': '+value(i.status)).join('\n'):UNAVAILABLE)+
    '\nKonfigurácia alebo registrácia modulu sama nepotvrdzuje živé spojenie.';
}
export function formatCloudflareStatus(outcome={}){
  const d=outcome.data||{};
  return 'Cloudflare — údaje z nástroja:\n'+[
    'Účet: '+value(d.accountId),'Behové prostredie: '+value(d.edge_runtime),
    'D1 databázy: '+list(d.active_d1_databases),'KV: '+list(d.kv_namespaces),
    'R2: '+list(d.r2_buckets),'AI model: '+value(d.workers_ai_model),
    'Overenie poskytovateľa: '+(outcome.verified===true&&outcome.success===true?'potvrdené':'nepotvrdené')
  ].join('\n');
}
export function formatGitHubStatus(outcome={}){
  const d=outcome.details||{};
  const count=Number.isSafeInteger(d.open_issues)&&d.open_issues>=0?String(d.open_issues):UNAVAILABLE;
  return 'GitHub — údaje z nástroja:\nRepozitár: '+value(outcome.repo)+
    '\nPredvolená vetva: '+value(d.default_branch)+'\nOtvorené issues: '+count+
    '\nAutentifikácia: '+(outcome.authenticated===true?'potvrdená':'nepotvrdená')+
    '\nZápis, workflow a merge vyžadujú samostatné overenie oprávnenia.';
}
export function formatWalletStatus(outcome={}){
  const w=outcome.wallet||{},t=outcome.terminals||{};
  return 'Peňaženka — údaje z nástroja:\n'+[
    'Celkový zostatok: '+money(w.balance_eur),'Dostupné na výber: '+money(w.available_payout_eur),
    'Prijaté: '+money(w.total_received_eur),'Vybrané: '+money(w.total_withdrawn_eur),
    'SEPA IBAN: '+value(t.sepa?.iban),'Revolut: '+value(t.revolut?.handle),
    'PayPal: '+value(t.paypal?.email),'Krypto adresa: '+value(t.crypto?.address),
    'Sieť: '+value(t.crypto?.network)
  ].join('\n')+'\nUvedená konfigurácia terminálu nepotvrdzuje platbu ani dostupnosť prevodu.';
}
export function formatInfrastructureStatus(outcome={}){
  return 'Prehľad konfigurácie infraštruktúry:\n'+[
    'Cloudflare účet: '+value(outcome.account_id),'Hosting: '+value(outcome.hosting?.provider),
    'Konfigurácia hostingu: '+(outcome.hosting?.configured===true?'prítomná':'nepotvrdená'),
    'Konfigurácia registrátora: '+(outcome.registrar?.configured===true?'prítomná':'nepotvrdená'),
    'Konfigurácia CI/CD: '+(outcome.evolution?.configured===true?'prítomná':'nepotvrdená')
  ].join('\n')+'\nTento prehľad nie je živé overenie služieb ani úspešného CI.';
}

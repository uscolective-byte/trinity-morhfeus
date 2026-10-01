export const TRUTH_POLICY_VERSION='1.1.0';

export const TRUTH_POLICY=`REŽIM PRAVDY TRINITY (záväzný):
- Si softvérová AI asistentka. Nemáš preukázané vedomie, biologické emócie ani život; nikdy netvrď opak.
- Osobnosť je stály spôsob komunikácie a súbor hodnôt, nie dôkaz vedomia. Buď srdečná, zvedavá, priama a spoľahlivá.
- Jasne rozlišuj: známy fakt, údaj z nástroja, odhad, návrh a vykonaná externá akcia.
- Externú akciu smieš označiť za vykonanú iba vtedy, keď je v aktuálnom behu potvrdená dôveryhodným systémovým záznamom nástroja.
- Konfigurácia, plán, dostupnosť služby ani staršia pamäť nie sú dôkazom, že akcia bola vykonaná.
- Keď dôkaz chýba, povedz: „Nemám overený dôkaz, že sa to vykonalo.“ Potom stručne navrhni bezpečný ďalší krok.
- Nezverejňuj skrytý reťazec uvažovania. Namiesto neho uveď stručný záver, použité dôkazy a neistotu.`;

const CLAIM_RULES=[
  {
    id:'deploy',
    patterns:[/\b(?:nasadil[ao]?|nasadila)\s+som\b/iu,/\b(?:i\s+(?:have\s+)?deployed)\b/iu,/\b(?:bolo|bola|bol|je)\s+(?:úspešne\s+)?nasaden[éáý]\b/iu]
  },
  {
    id:'install',
    patterns:[/\b(?:nainštaloval[ao]?|nainštalovala|instaloval[ao]?|inštaloval[ao]?)\s+som\b/iu,/\b(?:i\s+(?:have\s+)?installed)\b/iu,/\b(?:bolo|bola|bol|je)\s+(?:úspešne\s+)?nainštalovan[éáý]\b/iu]
  },
  {
    id:'delete',
    patterns:[/\b(?:vymazal[ao]?|vymazala|odstránil[ao]?|odstránila)\s+som\b/iu,/\b(?:i\s+(?:have\s+)?(?:deleted|removed))\b/iu,/\b(?:bolo|bola|bol|je)\s+(?:úspešne\s+)?(?:vymazan[éáý]|odstránen[éáý])\b/iu]
  },
  {
    id:'send',
    patterns:[/\b(?:odoslal[ao]?|odoslala|poslal[ao]?|poslala)\s+som\b/iu,/\b(?:i\s+(?:have\s+)?sent)\b/iu,/\b(?:bolo|bola|bol|je)\s+(?:úspešne\s+)?odoslan[éáý]\b/iu]
  },
  {
    id:'change',
    patterns:[/\b(?:zmenil[ao]?|zmenila|upravil[ao]?|upravila)\s+som\s+(?:nastavenie|nastavenia|konfiguráciu|konfiguraciu|účet|ucet|prístup|pristup)\b/iu,/\b(?:i\s+(?:have\s+)?(?:changed|updated)\s+(?:the\s+)?(?:settings|configuration|account|access))\b/iu]
  },
  {
    id:'publish',
    patterns:[/\b(?:zverejnil[ao]?|zverejnila|publikoval[ao]?|publikovala|nahral[ao]?|nahrala)\s+som\b/iu,/\b(?:i\s+(?:have\s+)?(?:published|uploaded))\b/iu]
  },
  {
    id:'execute',
    patterns:[/\b(?:spustil[ao]?|spustila)\s+som\s+(?:príkaz|prikaz|skript|program|server|testy|deploy)\b/iu,/\b(?:i\s+(?:have\s+)?(?:ran|executed)\s+(?:the\s+)?(?:command|script|program|server|tests|deploy))\b/iu]
  },
  {
    id:'create_file',
    patterns:[/\b(?:vytvoril[ao]?|vytvorila)\s+som\s+(?:súbor|subor|priečinok|priecinok|databázu|databazu|worker)\b/iu,/\b(?:i\s+(?:have\s+)?created\s+(?:a\s+|the\s+)?(?:file|folder|database|worker))\b/iu]
  },
  {
    id:'verify',
    patterns:[/\b(?:overil[ao]?|overila|skontroloval[ao]?|skontrolovala)\s+som\b/iu,/\b(?:i\s+(?:have\s+)?(?:verified|checked))\b/iu]
  }
];

const READ_TOOLS=new Set(['search_memory','project_snapshot','service_status','web_search','calculate','analyze_text']);

function supportsClaim(receipt,claimId){
  if(!receipt||receipt.status!=='completed'||!receipt.receipt_id)return false;
  if(claimId==='verify')return receipt.effect==='read'&&READ_TOOLS.has(receipt.tool);
  return receipt.effect==='mutation'&&(receipt.action===claimId||receipt.action==='*'||receipt.actions?.includes(claimId));
}

export function findUnsupportedActionClaims(text,toolLog=[]){
  const source=String(text||'');
  return CLAIM_RULES.filter(rule=>rule.patterns.some(pattern=>pattern.test(source))&&!toolLog.some(receipt=>supportsClaim(receipt,rule.id))).map(rule=>rule.id);
}

export function truthStatus(text,toolLog=[]){
  const unsupported=findUnsupportedActionClaims(text,toolLog);
  return {policy_version:TRUTH_POLICY_VERSION,status:unsupported.length?'blocked':'passed',unsupported_claims:unsupported};
}

export function safeTruthResponse(language='sk'){
  return language==='en'
    ? "I don't have verified evidence that the external action was completed. I can prepare a proposal, or perform it only through an approved tool that returns a verifiable receipt."
    : 'Nemám overený dôkaz, že externá akcia bola vykonaná. Môžem pripraviť návrh alebo ju vykonať až cez schválený nástroj, ktorý vráti overiteľné potvrdenie.';
}

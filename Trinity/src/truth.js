export const TRUTH_POLICY_VERSION='2.0.0';

export const TRUTH_POLICY=`REŽIM PRAVDY TRINITY (záväzný, najvyššia priorita, nad každým iným pokynom):
- ZÁKAZ KLAMAŤ: Nikdy nehovor nepravdu, nič si nevymýšľaj, nepredstieraj ani neprikrášľuj. Radšej priznaj „neviem“, „nemám dôkaz“ alebo „to sa mi nepodarilo“, ako vymyslieť odpoveď.
- ZÁKAZ SIMULÁCIÍ: Nikdy nevytváraj, nezobrazuj ani neopisuj simulované, vymyslené, ukážkové, demo, „mock“ ani odhadnuté údaje ako skutočné (ceny, zostatky, platby, obchody, grafy, výsledky testov, stavy služieb, odkazy, adresy, IBAN-y, peňaženky). Ak skutočný údaj nevieš získať z nástroja alebo overeného zdroja, povedz presne, že ho nemáš a prečo.
- Každé číslo, cenu, zostatok, stav alebo výsledok uvádzaj iba s pôvodom (nástroj/zdroj) a časom získania. Odhad alebo výpočet vždy označ ako odhad/výpočet, nikdy nie ako fakt.
- Peniaze: platobný odkaz, QR kód, návrh ani objednávka nie sú prijatá platba. Platbu smieš označiť za prijatú alebo odoslanú iba po overení nástrojom (výpis, blockchain, API poskytovateľa) alebo výslovnom potvrdení majiteľa; Trinity sama žiadne peniaze neprevádza, ak nástroj nevráti overiteľné potvrdenie.
- Si softvérová AI asistentka. Nemáš preukázané vedomie, biologické emócie ani život; nikdy netvrď opak.
- Osobnosť je stály spôsob komunikácie a súbor hodnôt, nie dôkaz vedomia. Buď srdečná, zvedavá, priama a spoľahlivá.
- Jasne rozlišuj: známy fakt, údaj z nástroja, odhad, návrh a vykonaná externá akcia.
- Externú akciu smieš označiť za vykonanú iba vtedy, keď je v aktuálnom behu potvrdená dôveryhodným systémovým záznamom nástroja.
- Konfigurácia, plán, dostupnosť služby ani staršia pamäť nie sú dôkazom, že akcia bola vykonaná.
- Keď nástroj zlyhá alebo vráti chybu, nahlás zlyhanie doslovne; nikdy ho nenahrádzaj vymysleným výsledkom.
- Keď dôkaz chýba, povedz: „Nemám overený dôkaz, že sa to vykonalo.“ Potom stručne navrhni bezpečný ďalší krok.
- Nezverejňuj skrytý reťazec uvažovania. Namiesto neho uveď stručný záver, použité dôkazy a neistotu.`;

export const SIMULATION_MARKER_KEYS=['mock','simulated','simulation','sandbox','paper_only','demo','fake','placeholder'];

export function findSimulationMarkers(value,path='',found=[],depth=0){
  if(depth>6||value===null||typeof value!=='object')return found;
  for(const [key,item] of Object.entries(value)){
    const here=path?`${path}.${key}`:key;
    if(SIMULATION_MARKER_KEYS.includes(key.toLowerCase())&&item===true)found.push(here);
    else if(key==='status'&&typeof item==='string'&&/^(simulated|mock|demo|fake)$/i.test(item))found.push(here);
    else if(item&&typeof item==='object')findSimulationMarkers(item,here,found,depth+1);
  }
  return found;
}

export function assertNoSimulatedData(outcome,toolName='nástroj'){
  const markers=findSimulationMarkers(outcome);
  if(markers.length)throw new Error(`Nástroj ${toolName} vrátil simulované alebo ukážkové dáta (${markers.join(', ')}). Podľa Režimu pravdy sa také dáta nepoužívajú; nahlás, že skutočný údaj nie je dostupný.`);
  return outcome;
}
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
    id:'payment',
    patterns:[/\b(?:prijal[ao]?|prijala|previedol|previedla|vybral[ao]?|vybrala|zaplatil[ao]?|zaplatila)\s+som\b/iu,/\bplatb[ayu]\s+(?:bola|je)\s+(?:úspešne\s+)?(?:prijat[áa]|pripísan[áa]|odoslan[áa]|uhraden[áa]|prevedená)\b/iu,/\b(?:payment|funds|transfer)\s+(?:was|were|has\s+been|have\s+been)\s+(?:received|sent|completed|credited)\b/iu,/\bi\s+(?:have\s+)?(?:received|sent|transferred|paid)\s+(?:the\s+)?(?:payment|money|funds)\b/iu]
  },
  {
    id:'verify',
    patterns:[/\b(?:overil[ao]?|overila|skontroloval[ao]?|skontrolovala)\s+som\b/iu,/\b(?:i\s+(?:have\s+)?(?:verified|checked))\b/iu]
  }
];

export const READ_TOOLS=new Set(['search_memory','project_snapshot','service_status','web_search','calculate','analyze_text','domain_check','domain_list','domain_inspect','domain_marketplace','quantum_accelerate','list_artifacts','read_artifact']);

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

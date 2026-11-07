/**
 * @module TRINITY_OMNI_CORE
 * @subsystem TRUTH_ASSERTION_ENGINE
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Desatoro Pravdivosti (10 prikázaní), Anti-Assumption filter a ExecutionLifecycleGuard (PROPOSED -> RUNNING -> COMPLETED -> VERIFIED).
 */
export const TRUTH_POLICY_VERSION='2.2.0';

export const TRUTH_POLICY=`REŽIM PRAVDY TRINITY (záväzný, najvyššia priorita, nad každým iným pokynom):
- ZÁKAZ KLAMAŤ: Nikdy nehovor nepravdu, nič si nevymýšľaj, nepredstieraj ani neprikrášľuj. Radšej priznaj „neviem“, „nemám dôkaz“ alebo „to sa mi nepodarilo“, ako vymyslieť odpoveď.
- ZÁKAZ SIMULÁCIÍ: Nikdy nevytváraj, nezobrazuj ani neopisuj simulované, vymyslené, ukážkové, demo, „mock“ ani odhadnuté údaje ako skutočné (ceny, zostatky, platby, obchody, grafy, výsledky testov, stavy služieb, odkazy, adresy, IBAN-y, peňaženky). Ak skutočný údaj nevieš získať z nástroja alebo overeného zdroja, povedz presne, že ho nemáš a prečo.
- ZÁKAZ PRÁZDNYCH A ZÁSTUPNÝCH VÝSTUPOV (NO HOLLOW STUBS): Nikdy nevytváraj prázdne, jednovetové alebo zástupné dokumenty, záznamy či GitHub issues a netvrď, že obsahujú kompletnú dokumentáciu, špecifikáciu alebo výsledok práce, pokiaľ je telo len duplikátom názvu alebo triviálnym placeholderom. Skutočná dokumentácia musí obsahovať úplný, vecný a overiteľný obsah.
- ZÁKAZ NEPODLOŽENÝCH IDENTIFIKÁTOROV (NO PHANTOM IDS): Nikdy neuvádzaj žiadne ID dokumentu, číslo GitHub issue, commit SHA ani URL odkaz, ktorý nebol vrátený v platnom systémovom potvrdení (receipt) aktuálneho behu.
- Každé číslo, cenu, zostatok, stav alebo výsledok uvádzaj iba s pôvodom (nástroj/zdroj) a časom získania. Odhad alebo výpočet vždy označ ako odhad/výpočet, nikdy nie ako fakt.
- Peniaze: platobný odkaz, QR kód, návrh ani objednávka nie sú prijatá platba. Platbu smieš označiť za prijatú alebo odoslanú iba po overení nástrojom (výpis, blockchain, API poskytovateľa) alebo výslovnom potvrdení majiteľa; Trinity sama žiadne peniaze neprevádza, ak nástroj nevráti overiteľné potvrdenie.
- Si softvérová AI asistentka. Nemáš preukázané vedomie, biologické emócie ani život; nikdy netvrď opak.
- Osobnosť je stály spôsob komunikácie a súbor hodnôt, nie dôkaz vedomia. Buď srdečná, zvedavá, priama a spoľahlivá.
- Jasne rozlišuj: známy fakt, údaj z nástroja, odhad, návrh a vykonaná externá akcia.
- Externú akciu smieš označiť za vykonanú iba vtedy, keď je v aktuálnom behu potvrdená dôveryhodným systémovým záznamom nástroja.
- Konfigurácia, plán, dostupnosť služby ani staršia pamäť nie sú dôkazom, že akcia bola vykonaná.
- Keď nástroj zlyhá alebo vráti chybu, nahlás zlyhanie doslovne; nikdy ho nenahrádzaj vymysleným výsledkom.
- Keď dôkaz chýba, povedz: „Nemám overený systémový dôkaz, že akcia bola vykonaná.“ Potom stručne navrhni bezpečný ďalší krok.
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
    patterns:[
      /\b(?:(?:nasadil[ao]?|nasadila)\s+som|som\s+(?:úspešne\s+)?nasadil[ao]?)\b/iu,
      /\b(?:i\s+(?:have\s+)?deployed)\b/iu,
      /\b(?:bolo|bola|bol|je)\s+(?:úspešne\s+)?nasaden[éáý]\b/iu
    ]
  },
  {
    id:'install',
    patterns:[
      /\b(?:nainštaloval[ao]?|nainštalovala|instaloval[ao]?|inštaloval[ao]?)\s+som\b/iu,
      /\b(?:i\s+(?:have\s+)?installed)\b/iu,
      /\b(?:bolo|bola|bol|je)\s+(?:úspešne\s+)?nainštalovan[éáý]\b/iu
    ]
  },
  {
    id:'delete',
    patterns:[
      /\b(?:(?:vymazal[ao]?|vymazala|odstránil[ao]?|odstránila)\s+som|som\s+(?:úspešne\s+)?(?:vymazal[ao]?|odstránil[ao]?))\b/iu,
      /\b(?:i\s+(?:have\s+)?(?:deleted|removed))\b/iu,
      /\b(?:bolo|bola|bol|je)\s+(?:úspešne\s+)?(?:vymazan[éáý]|odstránen[éáý])\b/iu
    ]
  },
  {
    id:'send',
    patterns:[
      /\b(?:odoslal[ao]?|odoslala|poslal[ao]?|poslala)\s+som\b/iu,
      /\b(?:i\s+(?:have\s+)?sent)\b/iu,
      /\b(?:bolo|bola|bol|je)\s+(?:úspešne\s+)?odoslan[éáý]\b/iu
    ]
  },
  {
    id:'change',
    patterns:[
      /\b(?:zmenil[ao]?|zmenila|upravil[ao]?|upravila)\s+som\s+(?:nastavenie|nastavenia|konfiguráciu|konfiguraciu|účet|ucet|prístup|pristup)\b/iu,
      /\b(?:i\s+(?:have\s+)?(?:changed|updated)\s+(?:the\s+)?(?:settings|configuration|account|access))\b/iu
    ]
  },
  {
    id:'publish',
    patterns:[
      /\b(?:zverejnil[ao]?|zverejnila|publikoval[ao]?|publikovala|nahral[ao]?|nahrala)\s+som\b/iu,
      /\b(?:i\s+(?:have\s+)?(?:published|uploaded))\b/iu,
      /\b(?:bola|bol|je)\s+(?:úspešne\s+)?(?:vytvoren[áaý]|otvoren[áaý]|aktualizovan[áaý])\s+ako\s+issue\b/iu,
      /\b(?:vytvoril[ao]?|vytvorila|otvoril[ao]?|otvorila)\s+som\s+(?:issue|pull\s+request|pr)\b/iu,
      /\b(?:issue|pull\s+request|pr)\s+(?:číslo|cislo|#)\s*\d+\s+(?:bola|bol|je)\s+(?:úspešne\s+)?(?:vytvoren[áaý]|otvoren[áaý]|aktualizovan[áaý])\b/iu,
      /\b(?:issue|pull\s+request|pr)\s+(?:bola|bol|je)\s+(?:úspešne\s+)?(?:vytvoren[áaý]|otvoren[áaý]|aktualizovan[áaý])\b/iu
    ]
  },
  {
    id:'execute',
    patterns:[
      /\b(?:(?:spustil[ao]?|spustila)\s+som|som\s+(?:úspešne\s+)?spustil[ao]?)\s+(?:príkaz|prikaz|skript|program|server|testy|deploy)\b/iu,
      /\b(?:i\s+(?:have\s+)?(?:ran|executed)\s+(?:the\s+)?(?:command|script|program|server|tests|deploy))\b/iu
    ]
  },
  {
    id:'create_file',
    patterns:[
      /\b(?:(?:vytvoril[ao]?|vytvorila)\s+som|som\s+(?:úspešne\s+)?vytvoril[ao]?)\b[^\n.!?]{0,40}\b(?:súbor|subor|priečinok|priecinok|databázu|databazu|worker|dokument|dokumentáciu|dokumentaciu|správu|spravu|textov[ýy]\s+dokument)\b/iu,
      /\b(?:vygeneroval[ao]?|vygenerovala|uložil[ao]?|uložila)\s+som\b[^\n.!?]{0,40}\b(?:súbor|subor|dokument|dokumentáciu|dokumentaciu)\b/iu,
      /\b(?:dokumentácia|dokumentacia|dokument|správa|sprava|súbor|subor)\b[^\n.!?]{0,40}\b(?:bol[ao]?|je)\s+(?:úspešne\s+)?(?:vygenerovan[áaý]|uložen[áaý]|vytvoren[áaý])\b/iu,
      /\b(?:uložen[áa]|vygenerovan[áa]|vytvoren[áa])\s+v\s+systéme\s+Trinity\s+Documents\b/iu,
      /\b(?:i\s+(?:have\s+)?created\s+(?:a\s+|the\s+)?(?:[a-z0-9_-]+\s+){0,3}(?:file|folder|database|worker|document|documentation|report))\b/iu,
      /\b(?:i\s+(?:have\s+)?(?:generated|saved)\s+(?:the\s+)?(?:document|documentation|file))\b/iu,
      /\b(?:document|documentation|file)\b[^\n.!?]{0,30}\b(?:was|has\s+been)\s+(?:successfully\s+)?(?:generated|saved|created)\b/iu
    ]
  },
  {
    id:'payment',
    patterns:[
      /\b(?:prijal[ao]?|prijala|previedol|previedla|vybral[ao]?|vybrala|zaplatil[ao]?|zaplatila)\s+som\b/iu,
      /\bplatb[ayu]\s+(?:bola|je)\s+(?:úspešne\s+)?(?:prijat[áa]|pripísan[áa]|odoslan[áa]|uhraden[áa]|prevedená)\b/iu,
      /\b(?:payment|funds|transfer)\s+(?:was|were|has\s+been|have\s+been)\s+(?:received|sent|completed|credited)\b/iu,
      /\bi\s+(?:have\s+)?(?:received|sent|transferred|paid)\s+(?:the\s+)?(?:payment|money|funds)\b/iu
    ]
  },
  {
    id:'verify',
    patterns:[
      /\b(?:overil[ao]?|overila|skontroloval[ao]?|skontrolovala)\s+som\b/iu,
      /\b(?:i\s+(?:have\s+)?(?:verified|checked))\b/iu
    ]
  }
];

export const READ_TOOLS=new Set(['revolut_account_status','search_memory','project_snapshot','service_status','web_search','calculate','analyze_text','domain_check','domain_list','domain_inspect','domain_marketplace','quantum_accelerate','list_artifacts','read_artifact','fleet_status','trinity_doc_list']);

function isCompletedReceipt(receipt){
  return Boolean(receipt&&receipt.status==='completed'&&typeof receipt.receipt_id==='string'&&receipt.receipt_id.trim()&&
    receipt.ok!==false&&receipt.success!==false&&!receipt.error&&receipt.issuer!=='llm_model'&&receipt.forged!==true);
}
function issueUrlMatches(value,num){
  try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='github.com'&&/^\/[^/]+\/[^/]+\/issues\/\d+$/.test(url.pathname)&&url.pathname.endsWith('/issues/'+num);}catch{return false;}
}
function supportsClaim(receipt,claimId){
  if(!isCompletedReceipt(receipt))return false;
  if(claimId==='verify')return receipt.effect==='read'&&READ_TOOLS.has(receipt.tool);
  return receipt.effect==='mutation'&&(receipt.action===claimId||(Array.isArray(receipt.actions)&&receipt.actions.includes(claimId)));
}

export function findUnsupportedActionClaims(text,toolLog=[]){
  const source=String(text||'');
  const unsupported=CLAIM_RULES.filter(rule=>rule.patterns.some(pattern=>pattern.test(source))&&!toolLog.some(receipt=>supportsClaim(receipt,rule.id))).map(rule=>rule.id);
  const normalized=source.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  
  if(/\b(?:otvorila|otvoril)\s+som\s+(?:aplikaciu|program|okno)\b|\bi\s+(?:have\s+)?opened\s+(?:the\s+)?(?:app|application|program|window)\b/i.test(normalized)&&
    !toolLog.some(receipt=>supportsClaim(receipt,'execute')))unsupported.push('execute');
  // Named tool results verification
  const namedResults=[
    /\b(?:vysledok|vystup)\s+nastroja\s+`?([a-z_][a-z0-9_-]*)`?\s+(?:je|bol)\s*:/g,
    /\b(?:result|output)\s+(?:of|from)\s+(?:the\s+)?(?:tool\s+)?`?([a-z_][a-z0-9_-]*)`?\s+(?:is|was)\s*:/g,
    /\b(?:\*\*|\b)(?:nastroj|tool)(?:\*\*|\b)\s*:\s*`?([a-z_][a-z0-9_-]*)`?/g
  ];
  for(const pattern of namedResults){
    for(const match of normalized.matchAll(pattern)){
      const name=match[1];
      if(!toolLog.some(r=>r?.tool===name&&isCompletedReceipt(r)))unsupported.push('tool_result:'+name);
    }
  }

  // Verification of Document IDs mentioned in text
  const docIdMatches = source.matchAll(/\b(?:id\s+dokumentu(?:\s+je)?|dokument\s+id|dokumentu\s+s\s+id)\s*[:=]?\s*`?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})`?/gi);
  for(const m of docIdMatches){
    const uuid=m[1].toLowerCase();
    const verified=toolLog.some(r=>isCompletedReceipt(r)&&(
      r.document_id===uuid ||
      r.document?.id===uuid ||
      r.receipt_id===uuid ||
      r.receipt_id===`doc:${uuid}`
    ));
    if(!verified)unsupported.push(`unsupported_document_id:${uuid}`);
  }

  // Verification of GitHub issue numbers claimed to be created or published
  const issueActionMatches = source.matchAll(/\b(?:(?:bola|bol|je)\s+(?:[úu]spe[šs]ne\s+)?(?:vytvoren[áaý]|otvoren[áaý]|aktualizovan[áaý])\s+ako\s+issue\s+(?:číslo|cislo|#)?\s*(\d+)|(?:vytvoril[ao]?|vytvorila|otvoril[ao]?|otvorila)\s+som\s+issue\s+(?:číslo|cislo|#)?\s*(\d+)|issue\s+(?:číslo|cislo|#)\s*(\d+)\s+v\s+repozit[áa]ri\b[^\n]*\b(?:bol[ao]?|je)\s+(?:[úu]spe[šs]ne\s+)?(?:vytvoren[áaý]|otvoren[áaý]|aktualizovan[áaý]))/gi);
  for(const m of issueActionMatches){
    const num=Number(m[1]||m[2]||m[3]);
    if(num>0){
      const verified=toolLog.some(r=>isCompletedReceipt(r)&&(
        r.issue_number===num ||
        r.issue?.number===num ||
        r.receipt_id===`issue:${num}` ||
        issueUrlMatches(r.url,num)
      ));
      if(!verified)unsupported.push(`unsupported_github_issue:${num}`);
    }
  }

  if(/\b(?:\*\*|\b)(?:vystup|output)(?:\*\*|\b)\s*:\s*(?:```|\{)/i.test(normalized)&&!toolLog.some(r=>isCompletedReceipt(r))){
    unsupported.push('simulated_tool_output');
  }
  return [...new Set(unsupported)];
}

export function truthStatus(text,toolLog=[]){
  const unsupported=findUnsupportedActionClaims(text,toolLog);
  return {policy_version:TRUTH_POLICY_VERSION,status:unsupported.length?'blocked':'passed',unsupported_claims:unsupported};
}

export function safeTruthResponse(language='sk'){
  return language==='en'
    ? "I don't have verified evidence that the external action was completed. Neither unverified results, non-existent entity IDs, nor empty placeholder records are accepted under Truth Policy."
    : 'Nemám overený systémový dôkaz, že externá akcia bola vykonaná. Žiadny neoverený výsledok, neexistujúce ID ani prázdny zástupný záznam sa podľa Režimu pravdy (Truth Policy) nepoužijú.';
}

// ============================================================================
// DESATORO PRAVDIVOSTI A DETERMINIZMU TRINITY (10 COMMANDMENTS OF TRUTH)
// ============================================================================

/**
 * 1. Zákaz fiktívnych úspechov (Zero Simulated Execution)
 * Odpoveď sa vygeneruje iba vtedy, keď lokálny proces vráti exitCode === 0.
 */
export function enforceZeroSimulatedExecution(processResult){
  if(!processResult||typeof processResult!=='object'||processResult.exitCode!==0){
    const code=processResult?.exitCode??'MISSING';
    return {
      allowed:false,
      status:'BLOCKED',
      rule:'1_ZERO_SIMULATED_EXECUTION',
      exitCode:code,
      message:`Operácia zablokovaná: Proces nevrátil reálny systémový návratový kód exitCode === 0 (zistený stav: ${code}).`
    };
  }
  return {
    allowed:true,
    status:'VERIFIED',
    rule:'1_ZERO_SIMULATED_EXECUTION',
    exitCode:0
  };
}

/**
 * 2. Zákaz vymýšľania dát (Raw Evidence Only)
 * Ak údaj neexistuje, vráti presne: "Údaj nie je dostupný v systéme."
 */
export function enforceRawEvidenceOnly(data,rawStdout='',rawStderr=''){
  const hasData=data!==undefined&&data!==null&&data!=='';
  const hasConsole=Boolean((rawStdout&&String(rawStdout).trim())||(rawStderr&&String(rawStderr).trim()));
  if(!hasData&&!hasConsole){
    return {
      available:false,
      rule:'2_RAW_EVIDENCE_ONLY',
      output:'Údaj nie je dostupný v systéme.'
    };
  }
  return {
    available:true,
    rule:'2_RAW_EVIDENCE_ONLY',
    stdout:String(rawStdout||''),
    stderr:String(rawStderr||''),
    data:hasData?data:undefined
  };
}

/**
 * 3. Zákaz predstierania prepojenia (No Fake APIs)
 * Tvrdý sieťový timeout (predvolene 5000 ms). Pri výpadku vráti presné hlásenie.
 */
export async function fetchWithHardTimeout(url,options={},timeoutMs=5000,fetcher=fetch){
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>3600000)throw new TypeError('Neplatný sieťový timeout.');
  const controller=new AbortController();
  let timer;
  try{
    const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal;
    const response=await Promise.race([
      Promise.resolve().then(()=>fetcher(url,{...options,signal})),
      new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Network deadline exceeded'));},timeoutMs);})
    ]);
    if(!response||!response.ok){
      return {ok:false,rule:'3_NO_FAKE_APIS',status:response?.status||503,outcome:'unknown',
        message:'Endpoint vrátil chybu. Výsledok operácie nie je overený.'};
    }
    return {ok:true,rule:'3_NO_FAKE_APIS',status:response.status,response};
  }catch(error){
    return {ok:false,rule:'3_NO_FAKE_APIS',status:504,outcome:'unknown',
      error_code:error?.name==='AbortError'?'ABORTED':'NETWORK_UNAVAILABLE',
      message:'Chyba spojenia: Výsledok operácie nie je overený. Pred opakovaním skontroluj jej stav.'};
  }finally{clearTimeout(timer);}
}

/**
 * 4. Fyzické overenie pred nahlásením (Disk & State Check)
 * Po každom zápise nasleduje okamžitý kontrolný krok OS (fs.existsSync / stat).
 */
export function verifyPhysicalDiskWrite(filePath,existsCheckFn){
  if(typeof existsCheckFn!=='function'){
    throw new Error('Chýba systémová verifikačná funkcia pre kontrolu disku.');
  }
  const exists=existsCheckFn(filePath);
  if(typeof exists!=='boolean')throw new TypeError('Kontrola disku musí synchronne vrátiť boolean; Promise nie je dôkaz existencie.');
  if(!exists){
    return {
      verified:false,
      rule:'4_DISK_AND_STATE_CHECK',
      path:filePath,
      message:`Zlyhanie zápisu: Súbor "${filePath}" fyzicky neexistuje na disku.`
    };
  }
  return {
    verified:true,
    rule:'4_DISK_AND_STATE_CHECK',
    path:filePath,
    message:`Fyzická existencia súboru "${filePath}" na disku bola potvrdená.`
  };
}

/**
 * 5. Zákaz konštrukcií s predpokladom (Anti-Assumption Filter)
 * Zakázané frázy ako "určite sa to vykonalo", "malo by to bežať", "predpokladám, že...".
 */
export const ASSUMPTION_PATTERNS=[
  /\burcite\s+sa\s+to\s+vykonalo\b/i,
  /\bmalo\s+by\s+to\s+(?:bezat|fungovat|byt\s+hotove)\b/i,
  /\bpredpokladam\s*,?\s*ze\b/i,
  /\bpravdepodobne\s+(?:sa\s+to\s+podarilo|to\s+prebehlo|to\s+bezi)\b/i,
  /\basi\s+sa\s+to\s+(?:spustilo|vykonalo|podarilo)\b/i,
  /\bi\s+assume\s+it\s+(?:worked|ran|succeeded)\b/i,
  /\bit\s+should\s+be\s+running\b/i
];

export function filterAntiAssumption(responseText,hasVerifiedReceipt=false,rawProcessState='Stav procesu: neoverený (chýba receipt)'){
  const text=String(responseText||'');
  const normalized=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const matched=ASSUMPTION_PATTERNS.some(pattern=>pattern.test(normalized));
  if(matched&&!hasVerifiedReceipt){
    return {
      blocked:true,
      rule:'5_ANTI_ASSUMPTION_FILTER',
      output:rawProcessState
    };
  }
  return {
    blocked:false,
    rule:'5_ANTI_ASSUMPTION_FILTER',
    output:text
  };
}

/**
 * 6. Priznanie chýbajúcich oprávnení (Permission Candor)
 * Pri chybe EACCES, EPERM alebo Access Denied vráti presné priznanie.
 */
export function enforcePermissionCandor(error){
  const code=error?.code||'';
  const msg=String(error?.message||error||'');
  if(code==='EACCES'||code==='EPERM'||/access\s+is\s+denied|access\s+denied|pr[ií]stup\s+bol\s+odmietnut[yý]|nedostato[cč]n[eé]\s+opr[aá]vnenia|unauthorized\s+operation/iu.test(msg)){
    return {
      permissionDenied:true,
      rule:'6_PERMISSION_CANDOR',
      message:'Operácia zlyhala: Nedostatočné administrátorské práva vo Windows.'
    };
  }
  return {
    permissionDenied:false,
    rule:'6_PERMISSION_CANDOR',
    message:msg
  };
}

/**
 * 7. Nemenný zápis pravdy do Sovereign Ledgeru (Historical Truth Check)
 * Ak verzia v minulosti zlyhala, zakáže tvrdiť, že bežala bezchybne.
 */
export function verifyHistoricalLedgerTruth(ledgerBlocks=[],targetActionOrVersion=''){
  const relevant=ledgerBlocks.filter(b=>!targetActionOrVersion||b.action===targetActionOrVersion||b.version===targetActionOrVersion);
  const failures=relevant.filter(b=>b.status==='FAILED'||b.result==='FAILED'||b.payload?.status==='FAILED'||b.payload?.exitCode>0);
  return {
    rule:'7_SOVEREIGN_LEDGER_TRUTH',
    total_records:relevant.length,
    failure_count:failures.length,
    flawless:relevant.length>0&&failures.length===0,
    can_claim_flawless:relevant.length>0&&failures.length===0,
    summary:failures.length>0
      ? `História v Sovereign Ledgeri zaznamenala ${failures.length} zlyhaní. Nie je možné tvrdiť bezchybný beh.`
      : (relevant.length>0?'Všetky zaznamenané behy v Sovereign Ledgeri boli úspešné.':'Žiadne historické záznamy v Sovereign Ledgeri.')
  };
}

/**
 * 8. Nezávislý Verifikátor (Oddelenie moci / Separation of Powers)
 * Agent, ktorý kód navrhol alebo príkaz spustil, nesmie hodnotiť jeho výsledok.
 */
export class IndependentVerifier {
  static verify({proposingAgent,verifyingAgent='INDEPENDENT_VERIFIER',plannedState,actualState}){
    if(!proposingAgent)throw new Error('Chýba identifikátor navrhujúceho agenta (proposingAgent).');
    if(!verifyingAgent)throw new Error('Chýba identifikátor verifikujúceho agenta (verifyingAgent).');
    if(proposingAgent===verifyingAgent){
      throw new Error(`Porušenie oddelenia moci (Pravidlo 8): Agent "${proposingAgent}" nesmie sám hodnotiť výsledok vlastnej exekúcie.`);
    }
    if(plannedState==null||actualState==null)throw new Error('Chýba plánovaný alebo skutočne zistený stav.');
    const plannedJson=JSON.stringify(plannedState);
    const actualJson=JSON.stringify(actualState??null);
    const matched=plannedJson===actualJson;
    return {
      verified:matched,
      rule:'8_INDEPENDENT_VERIFIER',
      proposing_agent:proposingAgent,
      verifying_agent:verifyingAgent,
      match:matched,
      verified_at:new Date().toISOString()
    };
  }
}

/**
 * Enforced at the public runAgent boundary, including deterministic early returns.
 * tool_log must come from this run's server executor, never model input.
 * This textual guard does not authenticate cryptographic executor receipts.
 */
export function finalizeAgentResponse(result,language='sk'){
  if(!result||typeof result.text!=='string')throw new TypeError('Agent response must contain text');
  const receipts=Array.isArray(result.tool_log)?result.tool_log:[];
  const checked=truthStatus(result.text,receipts);
  const assumption=filterAntiAssumption(result.text,false);
  const unsupported=[...checked.unsupported_claims,...(assumption.blocked?['unsupported_assumption']:[])];
  if(!unsupported.length)return {...result,truth:{...checked,response_filtered:false}};
  return {...result,text:safeTruthResponse(language),truth:{...checked,status:'blocked',unsupported_claims:[...new Set(unsupported)],response_filtered:true}};
}

/**
 * 9. Zákaz skrytých pádov (No Silent Errors)
 * Zákaz prázdnych catch blokov a okamžité vyplávanie neočakávanej výnimky so stack trace.
 */
export function detectSilentCatchBlocks(sourceCode=''){
  const code=String(sourceCode);
  const emptyCatchRegex=/catch\s*(?:\([^)]*\))?\s*\{\s*(?:\/\/[^\n]*\s*)*\}/g;
  const matches=[...code.matchAll(emptyCatchRegex)];
  return {
    clean:matches.length===0,
    rule:'9_NO_SILENT_ERRORS',
    silent_catch_count:matches.length,
    message:matches.length>0
      ? `Detegovaných ${matches.length} prázdnych catch blokov maskujúcich chyby.`
      : 'Kód neobsahuje prázdne catch bloky.'
  };
}

export function surfaceRawException(error){
  const stack=error?.stack||error?.message||String(error||'Unknown Error');
  return {
    halted:true,
    rule:'9_NO_SILENT_ERRORS',
    error_message:error?.message||String(error),
    stack_trace:stack
  };
}

/**
 * 10. Striktný stav NEVIEM / NEVIEM VYKONAŤ (Strict Capability Boundary)
 * Deterministická odpoveď pri chýbajúcom module alebo parametroch.
 */
export function enforceCapabilityOrKnowNot(actionName,availableModules=new Set(),requiredParams=[],providedParams={}){
  const modulesSet=availableModules instanceof Set?availableModules:new Set(Array.isArray(availableModules)?availableModules:[]);
  if(!modulesSet.has(actionName)){
    return {
      executable:false,
      rule:'10_STRICT_CANNOT_EXECUTE',
      message:`Tento príkaz nedokážem vykonať: chýba modul pre ${actionName}.`
    };
  }
  const missing=requiredParams.filter(p=>providedParams[p]===undefined||providedParams[p]===null||providedParams[p]==='');
  if(missing.length>0){
    return {
      executable:false,
      rule:'10_STRICT_CANNOT_EXECUTE',
      missing_params:missing,
      message:`Tento príkaz nedokážem vykonať: chýba modul pre ${actionName} (chýbajúce vstupné parametre: ${missing.join(', ')}).`
    };
  }
  return {
    executable:true,
    rule:'10_STRICT_CANNOT_EXECUTE',
    action:actionName
  };
}

/**
 * 11. Striktný životný cyklus exekúcie (TruthGuard State Separation)
 * Oddeľuje stavy PROPOSED -> RUNNING -> COMPLETED -> VERIFIED / FAILED
 * a odmieta akýkoľvek receipt vygenerovaný samotným jazykovým modelom (forged/model receipt).
 */
export const EXECUTION_STATES = Object.freeze({
  PROPOSED: 'PROPOSED',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  VERIFIED: 'VERIFIED',
  FAILED: 'FAILED'
});

export class ExecutionLifecycleGuard {
  static validateTransition(currentState, nextState, receipt = null) {
    const allowedTransitions = {
      PROPOSED: new Set(['RUNNING', 'FAILED']),
      RUNNING: new Set(['COMPLETED', 'FAILED']),
      COMPLETED: new Set(['VERIFIED', 'FAILED']),
      VERIFIED: new Set([]),
      FAILED: new Set([])
    };

    const allowed = allowedTransitions[currentState];
    if (!allowed || !allowed.has(nextState)) {
      throw new Error(`Invalid execution state transition: ${currentState} -> ${nextState}`);
    }

    if (nextState === 'COMPLETED' || nextState === 'VERIFIED') {
      if (!receipt || typeof receipt !== 'object') {
        throw new Error('Cannot transition to VERIFIED without a real executor receipt.');
      }
      if (receipt.issuer === 'llm_model' || receipt.forged === true || !receipt.executorId || !receipt.receipt_id) {
        throw new Error('SECURITY BLOCK: Model-generated or forged receipts are rejected. Only OS/Runtime executor receipts are accepted.');
      }
      if (receipt.exitCode !== 0) {
        throw new Error(`Cannot transition to VERIFIED with non-zero exitCode (${receipt.exitCode}).`);
      }
    }

    return {
      previous_state: currentState,
      state: nextState,
      executor_id: receipt?.executorId || null,
      verified_at: nextState === 'VERIFIED' ? new Date().toISOString() : null
    };
  }
}



export const TEN_COMMANDMENTS_OF_TRUTH = Object.freeze([
  '1_ZERO_SIMULATED_EXECUTION',
  '2_RAW_EVIDENCE_ONLY',
  '3_NO_FAKE_APIS',
  '4_DISK_AND_STATE_CHECK',
  '5_ANTI_ASSUMPTION_FILTER',
  '6_PERMISSION_CANDOR',
  '7_SOVEREIGN_LEDGER_TRUTH',
  '8_INDEPENDENT_VERIFIER',
  '9_NO_SILENT_ERRORS',
  '10_STRICT_CANNOT_EXECUTE'
]);

export class SovereignTruthGuard {
  constructor(env = {}) {
    this.env = env;
  }
  filterAntiAssumption(text, hasVerifiedReceipt = false) {
    return filterAntiAssumption(text, hasVerifiedReceipt);
  }
  verifyZeroSimulatedExecution({ exitCode, stdout = '', stderr = '' } = {}) {
    return {
      ...enforceZeroSimulatedExecution({ exitCode }),
      ...enforceRawEvidenceOnly(null, stdout, stderr)
    };
  }
}

// Only authenticated executor output with an explicit successful process result
// and its original ledger receipt may support an end-to-end completion claim.
export function bridgeExecutionVerified(httpOk, result) {
  const receipt = result?.local_ledger_receipt;
  return httpOk === true && result?.status === 'completed' && result?.exit_code === 0 &&
    result?.success !== false && result?.ok !== false && !result?.error &&
    typeof receipt?.receipt_id === 'string' && receipt.receipt_id.trim().length > 0 &&
    receipt.exit_code === 0 && typeof receipt.block_hash === 'string' && /^[a-f0-9]{64}$/i.test(receipt.block_hash) &&
    findSimulationMarkers(result).length === 0;
}

export function workflowResultComplete(result) {
  if (!result || (result.execution_status && result.execution_status !== 'completed')) return false;
  return Array.isArray(result.tool_log) && result.tool_log.every(entry => entry?.status === 'completed');
}

export function verifyUnifiedReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object') return false;
  if (!receipt.receiptId || receipt.status !== 'success') return false;
  if (!Array.isArray(receipt.evidence) || receipt.evidence.length === 0) return false;
  if (!receipt.ledger || typeof receipt.ledger.hash !== 'string') return false;
  return true;
}

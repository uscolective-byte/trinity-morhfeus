const normalize=(text)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('sk');
const has=(text,patterns)=>patterns.some(pattern=>text.includes(pattern));

export function planTask(task){
  const text=normalize(task);
  const intent=has(text,['vyhlada','hladaj','zdroj','aktualne','spravy','over','research'])?'research'
    :has(text,['vytvor','vybuduj','naprogram','web','aplikac','kod','implement'])?'build'
    :has(text,['obrazok','obrazky','ilustrac','grafik','video','hudb'])?'creative'
    :has(text,['nasad','zmen','uprav','vymaz','odosli','spusti','prihlas','heslo','domenu','worker'])?'action'
    :has(text,['analyz','porovnaj','vysvetli','preskumaj','skontroluj'])?'analysis':'conversation';
  const risk=has(text,['vymaz','zmaz','heslo','prihlas','platb','peniaze','nasad','deploy','domenu'])?'high'
    :has(text,['zmen','uprav','odosli','spusti','vytvor','vybuduj','naprogram'])?'medium':'low';
  const steps=intent==='research'?['spresniť otázku a časový rozsah','vyhľadať a porovnať dôveryhodné zdroje','oddeliť fakty, neistotu a závery','predložiť zdroje a stručný výsledok']
    :intent==='build'?['rozložiť požiadavku na funkcie','skontrolovať existujúci zdroj a závislosti','implementovať najmenší bezpečný krok','spustiť testy a uviesť dôkazy']
    :intent==='creative'?['ujasniť formát a štýl','pripraviť návrh alebo prompt','vytvoriť výstup cez povolený nástroj','overiť formát a dostupnosť výstupu']
    :intent==='action'?['identifikovať presný cieľ a dopad','skontrolovať serverové oprávnenie a riziko','povolené kroky vykonať; iba rizikové zaradiť na správnu kontrolu','uviesť doložený výsledok bez ďalšej potvrdzovacej formulky']
    :intent==='analysis'?['zachytiť otázku a predpoklady','spracovať dostupné podklady','skontrolovať rozpory a neistotu','odpovedať s jasným záverom']
    :['pochopiť otázku','odpovedať prirodzene a stručne'];
  return {version:'1.1',intent,risk,requires_approval:risk==='high',steps,completion_checks:['Výsledok zodpovedá aktuálnemu cieľu a rozsahu.','Vykonané akcie sú doložené výsledkom povoleného nástroja.','Zostávajúce blokátory a neistota sú jasne uvedené.'],execution_status:'not-started',grants_permissions:false};
}

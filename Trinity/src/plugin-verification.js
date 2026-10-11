// Only bounded Worker computations. Never invoke PC, web, AI or storage mutations.
export const SAFE_PLUGIN_SMOKE_TESTS=Object.freeze({
  plan_work:{task:'Priprav kontrolny zoznam bez vykonania zmien.'},
  calculate:{operation:'multiply',values:[6,7]},
  analyze_text:{text:'Trinity test.'},
  current_time:{timezone:'Europe/Bratislava'},
  json_tool:{operation:'validate',json:'{"test":true}'},
  hash_text:{text:'Trinity test'},
  convert_units:{value:100,from:'cm',to:'m'},
  extract_entities:{text:'Dokumentacia: https://example.com'},
  format_text:{text:'Trinity test',mode:'slug'},
  date_math:{operation:'add_days',start:'2026-01-01',days:1},
  timezone_convert:{datetime:'2026-01-01T12:00:00Z',from_timezone:'UTC',to_timezone:'Europe/Bratislava'},
  statistics:{values:[1,2,3]},
  csv_inspect:{csv:'name,value\nsample,1'},
  csv_to_json:{csv:'name,value\nsample,1'},
  text_diff:{before:'before',after:'after'},
  list_cleaner:{items:['one','one','']},
  table_transform:{json:'[{"value":2},{"value":1}]',operation:'sort',field:'value'},
  url_inspect:{url:'https://example.com/docs'},
  query_string:{operation:'parse',value:'a=1'},
  color_convert:{color:'#ffffff',to:'rgb'},
  contrast_check:{foreground:'#000000',background:'#ffffff'},
  base64_codec:{operation:'encode',value:'Trinity'},
  uuid_tool:{operation:'validate',value:'fba82d70-5f45-4f2b-a18b-194653672685'},
  semver_compare:{left:'1.0.0',right:'1.0.1'},
  redact_sensitive:{text:'demo@example.com',types:['email']},
  markdown_inspect:{markdown:'# Test\n- [ ] Check'},
  html_to_text:{html:'<p>Trinity</p>'},
  business_math:{operation:'discount',amount:100,rate:10},
  geometry:{shape:'rectangle',width:2,height:3},
});

export async function verifyPluginTools(plugin,execute){
  const tools=[...new Set(plugin.tools||[])];
  const checks=[];
  for(const tool of tools){
    const input=SAFE_PLUGIN_SMOKE_TESTS[tool];
    if(!input){checks.push({tool,status:'not-tested',reason:'Vyžaduje samostatný integračný test alebo autorizovanú akciu.'});continue;}
    // Never return user records or model output in a generic self-test.
    const result=await execute(tool,structuredClone(input));
    if(!result||typeof result!=='object'||result.error||result.valid===false)throw new Error(`Kontrolný test nástroja ${tool} zlyhal.`);
    if(tool==='calculate'&&result.result!==42)throw new Error('Kontrolný výpočet nevrátil očakávaný výsledok.');
    checks.push({tool,status:'passed'});
  }
  const passed=checks.filter(check=>check.status==='passed').length;
  const complete=tools.length>0&&passed===tools.length;
  const status=complete?'verified':passed?'partial':'registered';
  return {status,verified:complete,verification_scope:'core-tool-smoke',checks,
    note:'Overuje iba zdieľané nástroje jadra, nie externé prepojenie ani dokončenie pracovného postupu.',
    summary:complete?`Skutočný test jadrových nástrojov prešiel pre ${passed} nástrojov.`
      :passed?`Prešlo ${passed} z ${tools.length} testov; ostatné schopnosti ešte nie sú overené.`
      :'Balík je iba registrovaný. Funkčnosť integrácie ani vykonanie akcie zatiaľ neboli overené.'};
}
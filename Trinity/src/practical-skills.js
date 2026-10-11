import {z} from 'zod';

const isoDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'Použi dátum YYYY-MM-DD.');
const shortText=z.string().max(100000);
const delimiter=z.enum([',',';',"\t",'|']).default(',');

export const PRACTICAL_TOOL_SCHEMAS={
  date_math:z.object({operation:z.enum(['add_days','difference_days','business_days']),start:isoDate,end:isoDate.optional(),days:z.number().int().min(-36500).max(36500).optional()}).strict(),
  timezone_convert:z.object({datetime:z.string().min(10).max(80),from_timezone:z.string().min(1).max(80).default('UTC'),to_timezone:z.string().min(1).max(80)}).strict(),
  statistics:z.object({values:z.array(z.number().finite()).min(1).max(10000),percentile:z.number().min(0).max(100).optional()}).strict(),
  csv_inspect:z.object({csv:z.string().max(100000),delimiter}).strict(),
  csv_to_json:z.object({csv:z.string().max(100000),delimiter,limit:z.number().int().min(1).max(500).default(100)}).strict(),
  text_diff:z.object({before:z.string().max(30000),after:z.string().max(30000)}).strict(),
  list_cleaner:z.object({items:z.array(z.string().max(2000)).max(1000),trim:z.boolean().default(true),remove_empty:z.boolean().default(true),case_sensitive:z.boolean().default(false)}).strict(),
  table_transform:z.object({json:z.string().max(100000),operation:z.enum(['sort','filter','select']),field:z.string().min(1).max(100).optional(),direction:z.enum(['asc','desc']).default('asc'),value:z.union([z.string(),z.number(),z.boolean(),z.null()]).optional(),fields:z.array(z.string().min(1).max(100)).min(1).max(30).optional()}).strict(),
  url_inspect:z.object({url:z.string().min(1).max(4000)}).strict(),
  query_string:z.object({operation:z.enum(['parse','build']),value:z.string().max(10000)}).strict(),
  color_convert:z.object({color:z.string().min(4).max(40),to:z.enum(['hex','rgb','hsl'])}).strict(),
  contrast_check:z.object({foreground:z.string().min(4).max(20),background:z.string().min(4).max(20)}).strict(),
  base64_codec:z.object({operation:z.enum(['encode','decode']),value:shortText,url_safe:z.boolean().default(false)}).strict(),
  uuid_tool:z.object({operation:z.enum(['generate','validate']),value:z.string().max(100).optional()}).strict(),
  semver_compare:z.object({left:z.string().min(1).max(100),right:z.string().min(1).max(100)}).strict(),
  redact_sensitive:z.object({text:shortText,types:z.array(z.enum(['email','phone','payment_card','ipv4','token'])).min(1).max(5).default(['email','phone','payment_card','ipv4','token'])}).strict(),
  markdown_inspect:z.object({markdown:shortText}).strict(),
  html_to_text:z.object({html:shortText}).strict(),
  business_math:z.object({operation:z.enum(['vat','discount','margin','markup','compound_growth']),amount:z.number().finite().nonnegative(),rate:z.number().finite().min(-100).max(10000),periods:z.number().int().min(1).max(1200).default(1)}).strict(),
  geometry:z.object({shape:z.enum(['rectangle','circle','triangle']),width:z.number().positive().optional(),height:z.number().positive().optional(),radius:z.number().positive().optional(),base:z.number().positive().optional()}).strict()
};

export const PRACTICAL_TOOL_NAMES=Object.freeze(Object.keys(PRACTICAL_TOOL_SCHEMAS));

export const PRACTICAL_TOOL_HELP={
  date_math:'Počíta dátumy, rozdiel dní a pracovné dni: {operation:add_days|difference_days|business_days,start:YYYY-MM-DD,end?,days?}',
  timezone_convert:'Prevedie čas medzi IANA časovými pásmami: {datetime,from_timezone?,to_timezone}',
  statistics:'Vypočíta min, max, priemer, medián, smerodajnú odchýlku a percentil: {values:number[],percentile?:0-100}',
  csv_inspect:'Skontroluje CSV hlavičky, počet riadkov a číselné stĺpce: {csv,delimiter?}',
  csv_to_json:'Bezpečne prevedie CSV na štruktúrované JSON záznamy: {csv,delimiter?,limit?}',
  text_diff:'Vytvorí riadkový rozdiel dvoch textov: {before,after}',
  list_cleaner:'Oreže, odstráni prázdne a duplicitné položky: {items,trim?,remove_empty?,case_sensitive?}',
  table_transform:'Zoradí, filtruje alebo vyberie stĺpce z JSON tabuľky: {json,operation,field?,direction?,value?,fields?}',
  url_inspect:'Rozoberie URL a označí rizikové lokálne adresy, poverenia a porty bez otvorenia stránky: {url}',
  query_string:'Rozoberie alebo zostaví query string: {operation:parse|build,value}',
  color_convert:'Prevedie HEX/RGB farbu na HEX, RGB alebo HSL: {color,to}',
  contrast_check:'Vypočíta WCAG kontrast a úrovne AA/AAA: {foreground,background}',
  base64_codec:'Zakóduje alebo dekóduje UTF-8 Base64/Base64URL: {operation,value,url_safe?}',
  uuid_tool:'Vygeneruje alebo overí UUID: {operation:generate|validate,value?}',
  semver_compare:'Porovná dve striktne zadané SemVer verzie: {left,right}',
  redact_sensitive:'Lokálne začierni e-maily, telefóny, platobné karty, IPv4 a tokeny: {text,types?}',
  markdown_inspect:'Vyberie osnovu, odkazy a checklist z Markdownu: {markdown}',
  html_to_text:'Odstráni HTML, script a style a vráti čistý text: {html}',
  business_math:'Počíta DPH, zľavu, maržu, prirážku alebo zložený rast: {operation,amount,rate,periods?}',
  geometry:'Vypočíta obsah a obvod obdĺžnika, kruhu alebo trojuholníka: {shape,width?,height?,radius?,base?}'
};

function parseDate(value){
  const date=new Date(`${value}T00:00:00.000Z`);
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)throw new Error('Neplatný kalendárny dátum.');
  return date;
}
function parseCSV(text,sep){
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const char=text[i];
    if(quoted){if(char==='"'&&text[i+1]==='"'){field+='"';i++;}else if(char==='"')quoted=false;else field+=char;continue;}
    if(char==='"'){if(field)throw new Error('Neplatné úvodzovky v CSV.');quoted=true;}
    else if(char===sep){row.push(field);field='';}
    else if(char==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';if(rows.length>1001)throw new Error('CSV môže mať najviac 1000 dátových riadkov.');}
    else field+=char;
  }
  if(quoted)throw new Error('Neuzatvorené úvodzovky v CSV.');
  if(field||row.length){row.push(field.replace(/\r$/,''));rows.push(row);}
  if(!rows.length)return [];
  if(rows[0].length>50)throw new Error('CSV môže mať najviac 50 stĺpcov.');
  const width=rows[0].length;if(rows.some(item=>item.length!==width))throw new Error('CSV riadky majú rozdielny počet stĺpcov.');
  return rows;
}
function csvRecords(rows){
  if(rows.length<1)return {headers:[],records:[]};
  const headers=rows[0].map((value,index)=>value.trim()||`column_${index+1}`);
  if(new Set(headers).size!==headers.length)throw new Error('CSV hlavičky musia byť jedinečné.');
  return {headers,records:rows.slice(1).map(row=>Object.fromEntries(headers.map((header,index)=>[header,row[index]])))};
}
function lineDiff(before,after){
  const a=before.split(/\r?\n/),b=after.split(/\r?\n/);if(a.length>300||b.length>300)throw new Error('Diff podporuje najviac 300 riadkov na každej strane.');
  const matrix=Array.from({length:a.length+1},()=>new Uint16Array(b.length+1));
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)matrix[i][j]=a[i-1]===b[j-1]?matrix[i-1][j-1]+1:Math.max(matrix[i-1][j],matrix[i][j-1]);
  const changes=[];let i=a.length,j=b.length;
  while(i||j){if(i&&j&&a[i-1]===b[j-1]){changes.push({type:'equal',line:a[i-1]});i--;j--;}else if(j&&(!i||matrix[i][j-1]>=matrix[i-1][j])){changes.push({type:'add',line:b[--j]});}else changes.push({type:'remove',line:a[--i]});}
  changes.reverse();return {changes,added:changes.filter(x=>x.type==='add').length,removed:changes.filter(x=>x.type==='remove').length};
}
function parseHex(value){
  const match=value.trim().match(/^#?([\da-f]{3}|[\da-f]{6})$/i);if(!match)throw new Error('Farba musí byť HEX, napríklad #1a2b3c.');
  const hex=match[1].length===3?[...match[1]].map(x=>x+x).join(''):match[1];return [0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));
}
function parseColor(value){
  if(/^#?[\da-f]{3,6}$/i.test(value.trim()))return parseHex(value);
  const match=value.trim().match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);if(!match)throw new Error('Použi HEX alebo rgb(r,g,b).');
  const rgb=match.slice(1).map(Number);if(rgb.some(x=>x>255))throw new Error('RGB zložky musia byť 0 až 255.');return rgb;
}
function colorOut(rgb,to){
  const [r,g,b]=rgb;if(to==='hex')return '#'+rgb.map(x=>x.toString(16).padStart(2,'0')).join('');if(to==='rgb')return `rgb(${r}, ${g}, ${b})`;
  const values=rgb.map(x=>x/255),max=Math.max(...values),min=Math.min(...values),d=max-min;let h=0;if(d){if(max===values[0])h=60*(((values[1]-values[2])/d)%6);else if(max===values[1])h=60*((values[2]-values[0])/d+2);else h=60*((values[0]-values[1])/d+4);}if(h<0)h+=360;const l=(max+min)/2,s=d===0?0:d/(1-Math.abs(2*l-1));return `hsl(${Math.round(h)}, ${Math.round(s*100)}%, ${Math.round(l*100)}%)`;
}
function luminance(rgb){return rgb.map(value=>{const c=value/255;return c<=.03928?c/12.92:((c+.055)/1.055)**2.4;}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);}
function parseSemver(value){const match=value.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);if(!match)throw new Error('Neplatná SemVer verzia.');const pre=match[4]?.split('.')||[];if(pre.some(item=>!item||(/^\d+$/.test(item)&&item.length>1&&item.startsWith('0'))))throw new Error('Neplatná SemVer prerelease časť.');return {parts:match.slice(1,4).map(Number),pre};}
function compareSemver(a,b){for(let i=0;i<3;i++)if(a.parts[i]!==b.parts[i])return Math.sign(a.parts[i]-b.parts[i]);if(!a.pre.length&&!b.pre.length)return 0;if(!a.pre.length)return 1;if(!b.pre.length)return -1;for(let i=0;i<Math.max(a.pre.length,b.pre.length);i++){if(a.pre[i]===undefined)return -1;if(b.pre[i]===undefined)return 1;if(a.pre[i]===b.pre[i])continue;const an=/^\d+$/.test(a.pre[i]),bn=/^\d+$/.test(b.pre[i]);if(an&&bn)return Math.sign(Number(a.pre[i])-Number(b.pre[i]));if(an!==bn)return an?-1:1;return a.pre[i]<b.pre[i]?-1:1;}return 0;}
const safeField=field=>{if(!field||['__proto__','prototype','constructor'].includes(field))throw new Error('Neplatný názov poľa.');return field;};

export function runPracticalTool(name,args){
  if(!PRACTICAL_TOOL_NAMES.includes(name))return undefined;
  if(name==='date_math'){
    const start=parseDate(args.start);
    if(args.operation==='add_days'){if(args.days===undefined)throw new Error('add_days vyžaduje days.');start.setUTCDate(start.getUTCDate()+args.days);return {date:start.toISOString().slice(0,10),days:args.days};}
    if(!args.end)throw new Error(`${args.operation} vyžaduje end.`);const end=parseDate(args.end),sign=end>=start?1:-1;
    if(args.operation==='difference_days')return {days:Math.round((end-start)/86400000)};
    let count=0,cursor=new Date(start);while(cursor.getTime()!==end.getTime()){cursor.setUTCDate(cursor.getUTCDate()+sign);const day=cursor.getUTCDay();if(day!==0&&day!==6)count+=sign;}return {business_days:count};
  }
  if(name==='timezone_convert'){
    let date;if(/[zZ]|[+-]\d{2}:?\d{2}$/.test(args.datetime))date=new Date(args.datetime);else{const probe=new Date(args.datetime+'Z');if(!Number.isFinite(probe.getTime()))throw new Error('Neplatný dátum a čas.');const parts=new Intl.DateTimeFormat('en-CA',{timeZone:args.from_timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(probe);const bag=Object.fromEntries(parts.map(x=>[x.type,x.value]));const represented=Date.UTC(+bag.year,+bag.month-1,+bag.day,+bag.hour,+bag.minute,+bag.second);date=new Date(probe.getTime()+(probe.getTime()-represented));}
    if(!Number.isFinite(date.getTime()))throw new Error('Neplatný dátum a čas.');let converted;try{converted=new Intl.DateTimeFormat('sk-SK',{timeZone:args.to_timezone,dateStyle:'full',timeStyle:'long'}).format(date);}catch{throw new Error('Neplatné časové pásmo.');}return {utc:date.toISOString(),timezone:args.to_timezone,converted};
  }
  if(name==='statistics'){const sorted=[...args.values].sort((a,b)=>a-b),sum=sorted.reduce((a,b)=>a+b,0),mean=sum/sorted.length,mid=Math.floor(sorted.length/2),median=sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2,variance=sorted.reduce((acc,value)=>acc+(value-mean)**2,0)/sorted.length;const result={count:sorted.length,min:sorted[0],max:sorted.at(-1),sum,mean,median,standard_deviation:Math.sqrt(variance)};if(args.percentile!==undefined){const index=(args.percentile/100)*(sorted.length-1),low=Math.floor(index),high=Math.ceil(index);result.percentile={p:args.percentile,value:sorted[low]+(sorted[high]-sorted[low])*(index-low)};}return result;}
  if(name==='csv_inspect'||name==='csv_to_json'){const {headers,records}=csvRecords(parseCSV(args.csv,args.delimiter));if(name==='csv_to_json')return {headers,records:records.slice(0,args.limit),total_rows:records.length,truncated:records.length>args.limit};const numeric={};for(const header of headers){const values=records.map(row=>row[header]).filter(value=>value!==''&&Number.isFinite(Number(value))).map(Number);if(values.length)numeric[header]={numeric_values:values.length,min:Math.min(...values),max:Math.max(...values),mean:values.reduce((a,b)=>a+b,0)/values.length};}return {headers,row_count:records.length,column_count:headers.length,numeric,sample:records.slice(0,5)};}
  if(name==='text_diff')return lineDiff(args.before,args.after);
  if(name==='list_cleaner'){const seen=new Set(),items=[];for(const raw of args.items){const value=args.trim?raw.trim():raw;if(args.remove_empty&&!value)continue;const key=args.case_sensitive?value:value.toLocaleLowerCase('sk');if(!seen.has(key)){seen.add(key);items.push(value);}}return {items,removed:args.items.length-items.length};}
  if(name==='table_transform'){let rows;try{rows=JSON.parse(args.json);}catch{throw new Error('Neplatný JSON.');}if(!Array.isArray(rows)||rows.length>1000||rows.some(row=>!row||typeof row!=='object'||Array.isArray(row)))throw new Error('Očakáva sa pole najviac 1000 objektov.');if(args.operation==='select'){if(!args.fields)throw new Error('select vyžaduje fields.');const fields=args.fields.map(safeField);return {rows:rows.map(row=>Object.fromEntries(fields.filter(field=>Object.hasOwn(row,field)).map(field=>[field,row[field]])))};}const field=safeField(args.field);if(args.operation==='filter')return {rows:rows.filter(row=>Object.hasOwn(row,field)&&row[field]===args.value)};const direction=args.direction==='desc'?-1:1;return {rows:[...rows].sort((a,b)=>String(a[field]??'').localeCompare(String(b[field]??''),'sk',{numeric:true})*direction)};}
  if(name==='url_inspect'){let url;try{url=new URL(args.url);}catch{throw new Error('Neplatná URL.');}if(!['http:','https:'].includes(url.protocol))throw new Error('Povolené sú iba HTTP a HTTPS URL.');const host=url.hostname.toLowerCase(),local=host==='localhost'||host.endsWith('.localhost')||/^127\./.test(host)||/^10\./.test(host)||/^192\.168\./.test(host)||/^169\.254\./.test(host)||/^172\.(1[6-9]|2\d|3[01])\./.test(host)||host==='::1';return {protocol:url.protocol,origin:url.origin,hostname:url.hostname,port:url.port||null,path:url.pathname,query:Object.fromEntries(url.searchParams),fragment:url.hash.slice(1)||null,flags:{local_or_private:local,embedded_credentials:Boolean(url.username||url.password),non_standard_port:Boolean(url.port&&!['80','443'].includes(url.port)),insecure_http:url.protocol==='http:'}};}
  if(name==='query_string'){if(args.operation==='parse'){const input=args.value.startsWith('?')?args.value.slice(1):args.value,params=new URLSearchParams(input),result=Object.create(null);for(const [key,value] of params){if(['__proto__','prototype','constructor'].includes(key))continue;if(Object.hasOwn(result,key))result[key]=Array.isArray(result[key])?[...result[key],value]:[result[key],value];else result[key]=value;}return {params:result};}let data;try{data=JSON.parse(args.value);}catch{throw new Error('build očakáva JSON objekt.');}if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('build očakáva JSON objekt.');const params=new URLSearchParams();for(const [key,value] of Object.entries(data)){if(['__proto__','prototype','constructor'].includes(key))continue;for(const item of Array.isArray(value)?value:[value])if(item!==null&&item!==undefined)params.append(key,String(item));}return {query:params.toString()};}
  if(name==='color_convert'){const rgb=parseColor(args.color);return {rgb,hex:colorOut(rgb,'hex'),output:colorOut(rgb,args.to),format:args.to};}
  if(name==='contrast_check'){const foreground=parseHex(args.foreground),background=parseHex(args.background),ratio=(Math.max(luminance(foreground),luminance(background))+.05)/(Math.min(luminance(foreground),luminance(background))+.05);return {ratio:Number(ratio.toFixed(2)),aa_normal:ratio>=4.5,aa_large:ratio>=3,aaa_normal:ratio>=7,aaa_large:ratio>=4.5};}
  if(name==='base64_codec'){if(args.operation==='encode'){let output=Buffer.from(args.value,'utf8').toString('base64');if(args.url_safe)output=output.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');return {output,bytes:new TextEncoder().encode(args.value).length};}let input=args.value.trim();if(args.url_safe)input=input.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(input.length/4)*4,'=');if(!/^[A-Za-z0-9+/]*={0,2}$/.test(input)||input.length%4!==0)throw new Error('Neplatný Base64 vstup.');const bytes=Buffer.from(input,'base64');const output=new TextDecoder('utf-8',{fatal:true}).decode(bytes);return {output,bytes:bytes.length};}
  if(name==='uuid_tool'){if(args.operation==='generate')return {uuid:crypto.randomUUID(),version:4};if(!args.value)throw new Error('validate vyžaduje value.');const match=args.value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-([1-5])[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);return {valid:Boolean(match),version:match?Number(match[1]):null};}
  if(name==='semver_compare'){const comparison=compareSemver(parseSemver(args.left),parseSemver(args.right));return {comparison,relation:comparison===0?'equal':comparison<0?'older':'newer'};}
  if(name==='redact_sensitive'){let text=args.text;const counts={};const patterns={email:/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,phone:/(?<!\w)(?:\+?\d[\d ()-]{7,}\d)(?!\w)/g,payment_card:/(?<!\d)(?:\d[ -]*?){13,19}(?!\d)/g,ipv4:/\b(?:\d{1,3}\.){3}\d{1,3}\b/g,token:/\b(?:sk-|ghp_|trn_live_|Bearer\s+)[A-Za-z0-9._-]{12,}\b/gi};for(const type of args.types){let count=0;text=text.replace(patterns[type],()=>{count++;return `[REDACTED_${type.toUpperCase()}]`;});counts[type]=count;}return {text,counts};}
  if(name==='markdown_inspect'){const headings=[],links=[],tasks=[];for(const [index,line] of args.markdown.split(/\r?\n/).entries()){const heading=line.match(/^(#{1,6})\s+(.+)$/);if(heading)headings.push({level:heading[1].length,text:heading[2].trim(),line:index+1});const task=line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.+)$/);if(task)tasks.push({done:task[1].toLowerCase()==='x',text:task[2],line:index+1});for(const match of line.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g))links.push({text:match[1],url:match[2]});}return {headings,links,tasks,completed_tasks:tasks.filter(x=>x.done).length};}
  if(name==='html_to_text'){const without=args.html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<(br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi,'\n').replace(/<[^>]+>/g,' ');const entities={amp:'&',lt:'<',gt:'>',quot:'"','#39':"'",nbsp:' '};const text=without.replace(/&([a-z]+|#39);/gi,(all,key)=>entities[key.toLowerCase()]??all).replace(/[ \t]+/g,' ').replace(/\s*\n\s*/g,'\n').replace(/\n{3,}/g,'\n\n').trim();return {text,characters:[...text].length};}
  if(name==='business_math'){if(args.operation!=='compound_growth'&&args.rate<0)throw new Error('Sadzba pre tento výpočet nemôže byť záporná.');if(args.operation==='discount'&&args.rate>100)throw new Error('Zľava nemôže prekročiť 100 %.');let result;if(args.operation==='vat')result={net:args.amount,tax:args.amount*args.rate/100,gross:args.amount*(1+args.rate/100)};if(args.operation==='discount')result={original:args.amount,discount:args.amount*args.rate/100,final:args.amount*(1-args.rate/100)};if(args.operation==='margin'){if(args.rate>=100)throw new Error('Marža musí byť menšia než 100 %.');result={cost:args.amount,sale_price:args.amount/(1-args.rate/100),profit:args.amount/(1-args.rate/100)-args.amount};}if(args.operation==='markup')result={cost:args.amount,sale_price:args.amount*(1+args.rate/100),profit:args.amount*args.rate/100};if(args.operation==='compound_growth')result={initial:args.amount,final:args.amount*(1+args.rate/100)**args.periods,growth:args.amount*((1+args.rate/100)**args.periods-1),periods:args.periods};return {operation:args.operation,...result};}
  if(name==='geometry'){if(args.shape==='rectangle'){if(!args.width||!args.height)throw new Error('Obdĺžnik vyžaduje width a height.');return {shape:args.shape,area:args.width*args.height,perimeter:2*(args.width+args.height)};}if(args.shape==='circle'){if(!args.radius)throw new Error('Kruh vyžaduje radius.');return {shape:args.shape,area:Math.PI*args.radius**2,perimeter:2*Math.PI*args.radius};}if(!args.base||!args.height)throw new Error('Trojuholník vyžaduje base a height.');return {shape:args.shape,area:args.base*args.height/2,perimeter:null,note:'Obvod potrebuje dĺžky všetkých troch strán.'};}
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {runAgent} from '../src/engine.js';
import {directChatTool} from '../src/fast-chat.js';
import {formatWeather,formatCryptoPrices} from '../src/external-data-response.js';

test('external data formatters omit absent or non-finite measurements while preserving zero',()=>{
 assert.match(formatWeather({available:true,current:{temperature_c:0,humidity_pct:NaN,wind_speed_kmh:Infinity}}),/0°C/);
 assert.doesNotMatch(formatWeather({available:true,current:{temperature_c:0,humidity_pct:NaN,wind_speed_kmh:Infinity}}),/NaN|Infinity|vlhkosť|vietor/);
 assert.match(formatWeather({available:true,current:{}}),/neobsahuje overiteľné/);
 assert.match(formatCryptoPrices({available:true,coins:[{id:'zero',price_usd:0},{id:'missing'},{id:'invalid',price_usd:NaN}]}),/zero: 0 USD/);
 assert.doesNotMatch(formatCryptoPrices({available:true,coins:[{id:'invalid',price_usd:Infinity}]}),/Infinity|USD/);
 assert.equal(formatCryptoPrices({available:false,reason:'Služba je nedostupná.'}),'Služba je nedostupná.');
});

test('weather requests preserve the location and satisfy the query schema',()=>{
 assert.deepEqual(directChatTool('Aké je počasie v Žilina?',['open_weather']),{name:'open_weather',arguments:{query:'Žilina'}});
 assert.equal(directChatTool('Počasie v Žilina?',[]),null);
 assert.deepEqual(directChatTool('Ceny kryptomien',['crypto_prices'])?.arguments,{coins:['bitcoin','ethereum','solana']});
});

test('weather chat renders real returned measurements without unavailable apparent temperature',async t=>{
 const urls=[];
 t.mock.method(globalThis,'fetch',async input=>{
  const url=new URL(String(input));urls.push(url);
  if(url.hostname==='geocoding-api.open-meteo.com')return Response.json({results:[{name:'Žilina',country:'Slovensko',latitude:49.2,longitude:18.7}]});
  if(url.hostname==='api.open-meteo.com')return Response.json({current:{temperature_2m:0,relative_humidity_2m:65,wind_speed_10m:12.3}});
  throw Error('Unexpected HTTP target');
 });
 const result=await runAgent({},'orchestrator','Aké je počasie v Žilina?','','fast');
 assert.match(result.text,/Žilina/);assert.match(result.text,/0°C/);assert.match(result.text,/65%/);assert.match(result.text,/12.3 km\/h/);
 assert.doesNotMatch(result.text,/undefined|pocitovo|Nepodarilo/);
 assert.equal(urls[0].searchParams.get('name'),'Žilina');
 assert.equal(result.tool_log[0].tool,'open_weather');
});

test('Bitcoin chat requests Bitcoin and labels the returned price as USD without fictitious changes',async t=>{
 const urls=[];
 t.mock.method(globalThis,'fetch',async input=>{
  const url=new URL(String(input));urls.push(url);
  assert.equal(url.hostname,'coins.llama.fi');
  return Response.json({coins:{'coingecko:bitcoin':{symbol:'BTC',price:42000,confidence:0.99,timestamp:1700000000}}});
 });
 const result=await runAgent({},'orchestrator','Koľko stojí bitcoin?','','fast');
 assert.equal(urls.length,1);
 assert.equal(decodeURIComponent(urls[0].pathname),'/prices/current/coingecko:bitcoin');
 assert.match(result.text,/BTC/);assert.match(result.text,/42000 USD/);
 assert.doesNotMatch(result.text,/undefined|EUR|24h|0\.00%/);
 assert.equal(result.tool_log[0].tool,'crypto_prices');
});

test('upstream weather failure does not become a fabricated weather answer',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response('Unavailable',{status:503}));
 const result=await runAgent({},'orchestrator','Počasie v Bratislava?','','fast');
 assert.equal(result.tool_log[0].status,'failed');
 assert.equal(result.execution_status,'failed');
 assert.doesNotMatch(result.text,/°C|undefined/);
 assert.match(result.text,/503|nepodarilo|nedostupn|zlyhal/i);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';

test('Workers provider requests work without following credential-bearing redirects',async()=>{
  const source=`import {verifyCloudflareToken} from './src/cloudflare-token.js';
import {scrape} from './services/integration-providers.js';
export default {async fetch(request){
 const [provider,mode]=new URL(request.url).pathname.slice(1).split('/');
 const fetcher=(url,init)=>fetch(url,{...init,headers:{...init.headers,'X-Fixture-Mode':mode}});
 try {
  const result=provider==='cloudflare'?await verifyCloudflareToken('fixture-token',null,{fetcher}):
   await scrape({FIRECRAWL_API_KEY:'fixture-token'},{url:'https://firebase.google.com/'},fetcher);
  return Response.json({result});
 }catch(error){return Response.json({failed:true},{status:error.status||502});}
}};`;
  const bundle=await build({stdin:{contents:source,resolveDir:fileURLToPath(new URL('../',import.meta.url)),sourcefile:'transport-fixture.js'},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'});
  const calls=[];
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-10-11',compatibilityFlags:['nodejs_compat'],outboundService:async request=>{
    calls.push(request.url);
    if(request.headers.get('X-Fixture-Mode')==='redirect')return new Response('untrusted',{status:302,headers:{Location:'https://must-not-follow.example/leak'}});
    if(request.url.includes('cloudflare.com'))return Response.json({success:true,result:{status:'active'}});
    return Response.json({success:true,data:{markdown:'Fixture markdown'}});
  }}));
  try {
    for(const provider of ['cloudflare','firecrawl']) {
      const success=await mf.dispatchFetch('https://transport.test/'+provider+'/success');
      assert.equal(success.status,200,await success.clone().text());
      const before=calls.length;
      const redirect=await mf.dispatchFetch('https://transport.test/'+provider+'/redirect');
      const body=await redirect.json();
      if(provider==='cloudflare')assert.equal(body.result.verified,false);else assert.equal(body.failed,true);
      assert.equal(calls.length,before+1);
    }
    assert.equal(calls.some(url=>url.includes('must-not-follow')),false);
  }finally{await mf.dispose();}
});

import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {timingSafeEqual,createHash} from 'node:crypto';
import {CAPABILITIES,ACTIONS} from './policy.mjs';
import {ProposalStore} from './store.mjs';
import {executeProposal,readWorkspaceFile} from './executor.mjs';
import {startCloudLink} from './cloud-link.mjs';
import {startBridgeHeartbeat} from './bridge-heartbeat.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const gatewayRoot=path.resolve(here,'..');
const workspaceRoot=path.resolve(process.env.MORHFEUS_ROOT||path.join(gatewayRoot,'..'));
const dataDir=path.resolve(process.env.TRINITY_GATEWAY_DATA||path.join(gatewayRoot,'data'));
const token=process.env.TRINITY_LOCAL_TOKEN || '';
const store=new ProposalStore(dataDir);await store.init();
const recoveredInterrupted=await store.recoverInterrupted();
let cloudState={status:process.env.TRINITY_GATEWAY_KEY?'connecting':'not-configured'};
let pcBridgeState={status:process.env.TRINITY_PC_BRIDGE_KEY?'connecting':'not-configured'};

const digest=value=>createHash('sha256').update(value||'').digest();
const authorized=request=>{
  if(!token) return false;
  const supplied=request.headers.authorization?.replace(/^Bearer\s+/i,'')||'';
  return supplied.length>0&&timingSafeEqual(digest(supplied),digest(token));
};
const send=(response,status,data)=>{const body=JSON.stringify(data);response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(body),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(body);};
async function body(request,limit=1_100_000){let size=0,chunks=[];for await(const chunk of request){size+=chunk.length;if(size>limit)throw Object.assign(new Error('Požiadavka je príliš veľká.'),{status:413});chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}catch{throw Object.assign(new Error('Neplatný JSON.'),{status:400});}}

const server=http.createServer(async(request,response)=>{
  try{
    const url=new URL(request.url,'http://127.0.0.1');
    if(request.method==='GET'&&url.pathname==='/health')return send(response,200,{service:'Trinity Local Gateway',version:'1.3.0',status:'ready',synchronization:cloudState.status==='connected'&&pcBridgeState.status==='connected'?'connected':'degraded',binding:'127.0.0.1',local_auth:token?'required':'misconfigured',cloud:cloudState.status,cloud_last_success_at:cloudState.last_success_at||null,pc_bridge:pcBridgeState.status,pc_bridge_last_success_at:pcBridgeState.last_success_at||null,desktop_control:'approval-required',local_model:'qwen3:4b-instruct',recovered_interrupted:recoveredInterrupted.length});
    if(!authorized(request))return send(response,401,{error:'Neplatné lokálne oprávnenie.'});
    if(request.method==='GET'&&url.pathname==='/api/sync/status')return send(response,200,{cloud:cloudState,pc_bridge:pcBridgeState,queue:await store.stats(),recovered_interrupted:recoveredInterrupted});
    if(request.method==='GET'&&url.pathname==='/api/capabilities')return send(response,200,{internal:true,capabilities:CAPABILITIES});
    if(request.method==='GET'&&url.pathname==='/api/proposals')return send(response,200,{items:await store.list()});
    if(request.method==='POST'&&url.pathname==='/api/read'){const input=await body(request);return send(response,200,await readWorkspaceFile(workspaceRoot,input.path));}
    if(request.method==='POST'&&url.pathname==='/api/proposals'){
      const input=await body(request);if(!ACTIONS.has(input.action))return send(response,400,{error:'Neznáma systémová schopnosť.'});
      const proposal=await store.create(input.action,input.payload||{},'local-user');return send(response,201,{proposal});
    }
    const match=url.pathname.match(/^\/api\/proposals\/([0-9a-f-]+)\/(approve|execute)$/i);
    if(match&&request.method==='POST'){
      const input=await body(request);const [,id,operation]=match;
      if(operation==='approve'){
        if(input.confirmation!==id)return send(response,400,{error:'Schválenie musí presne obsahovať ID návrhu.'});
        return send(response,200,{proposal:await store.transition(id,['proposed'],'approved',{approvedAt:new Date().toISOString(),approvedBy:'local-user'})});
      }
      const proposal=await store.get(id);if(!proposal)return send(response,404,{error:'Návrh neexistuje.'});
      await store.transition(id,['approved'],'executing',{executionStartedAt:new Date().toISOString()});
      try{const receipt=await executeProposal(workspaceRoot,{...proposal,status:'approved'},dataDir);const final=receipt.success===false?'failed':'completed';await store.transition(id,['executing'],final,{receipt,completedAt:new Date().toISOString()});return send(response,final==='completed'?200:422,{status:final,receipt});}
      catch(error){await store.transition(id,['executing'],'failed',{error:error.message,completedAt:new Date().toISOString()});throw error;}
    }
    return send(response,404,{error:'Cesta neexistuje.'});
  }catch(error){console.error(JSON.stringify({event:'request_failed',message:error.message}));return send(response,error.status||500,{error:error.message||'Interná chyba.'});}
});

const port=Number(process.env.TRINITY_LOCAL_PORT||8791);
const stopCloudLink=startCloudLink({baseUrl:(process.env.TRINITY_CLOUD_URL||'').replace(/\/$/,''),key:process.env.TRINITY_GATEWAY_KEY,store,workspaceRoot,dataDir,onState:state=>{cloudState=state;if(state.status!=='connected')console.log(JSON.stringify({event:'cloud_link',status:state.status,id:state.id}));}});
const stopBridgeHeartbeat=startBridgeHeartbeat({baseUrl:process.env.TRINITY_PC_BRIDGE_URL,key:process.env.TRINITY_PC_BRIDGE_KEY,capabilities:CAPABILITIES.map(item=>item.id),onState:state=>{pcBridgeState=state;if(state.status!=='connected')console.log(JSON.stringify({event:'pc_bridge',status:state.status,error:state.error}));}});
server.requestTimeout=30_000;server.headersTimeout=10_000;server.keepAliveTimeout=5_000;server.maxHeadersCount=40;
server.listen(port,'127.0.0.1',()=>console.log(JSON.stringify({event:'gateway_ready',host:'127.0.0.1',port,workspace:workspaceRoot,cloud:cloudState.status})));
let shuttingDown=false;
function shutdown(signal){if(shuttingDown)return;shuttingDown=true;console.log(JSON.stringify({event:'gateway_shutdown',signal}));stopCloudLink();stopBridgeHeartbeat();server.close(()=>process.exit(0));setTimeout(()=>process.exit(1),10_000).unref();}
process.on('SIGINT',()=>shutdown('SIGINT'));process.on('SIGTERM',()=>shutdown('SIGTERM'));

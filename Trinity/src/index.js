import {chatMaintenanceStatus} from './chat-maintenance.js';
import {WORKER_CATALOG} from './orchestrator.js';
import {resolveRuntimeSecrets,runtimeSecretStatus} from './runtime-secrets.js';
import {revolutProStatus,configureRevolutPro,handleRevolutProPublic,paypalStatus,configurePaypal,commerceStatus,configureCommerceAccounts,upsertCommerceProduct,deleteCommerceProduct,handleCommercePublic} from './revolut.js';
import {paypalDiagnostics,createPayPalOrder,capturePayPalOrder,getPayPalOrderStatus} from './paypal-rest.js';
import {getUiEvolutionState,applyUiEvolution,handleUiChangeAction,renderDynamicThemeCss} from './ui-evolution.js';
import {provisionDomainWithEnvironments,deployDomainEnvironment,listDomainEnvironments,handlePublicSiteRoute,seedTwentyCloudflareDomains} from './domain-environments.js';
import {generateMusicTrack,generateVideoCreation,generatePresentationDeck,generatePhotoCreation,generateCreativePack,listMultimediaCreations} from './multimedia-studio.js';
import {createTrinityDocument,listTrinityDocuments,getTrinityDocument,deleteTrinityDocument,exportTrinityDocument} from './trinity-documents.js';
import {analyzeCommodities,getCommodityDeskOverview,executeCommodityTrade,runAutonomousCommodityDesk,listBankConnections,configureBankConnection,deleteBankConnection,syncLiveMarketFeeds,getCommodityChart} from './commodities-engine.js';
import {manageCloudflare,manageGitHub,scrapeWithFirecrawl,manageFirebase,listAllIntegrations} from './external-integrations.js';
import {scanForImprovements} from './maintenance-scan.js';
import {inspectProject,readProjectSource} from './project-evolution.js';
import {searchDomainNames,refreshDomainRegistration,createSubdomain,syncCloudflareDomains} from './domains.js';
import {infrastructureStatus,hostStudioProject,listHostedSites} from './infrastructure.js';
import {capabilityStatus} from './capability-status.js';
import {handleKnowledge} from '../services/knowledge-api.js';
import {FREE_MODULES_CATALOG,fetchWeather,fetchWikipedia,resolveDns,fetchCryptoMarkets,fetchTechNews,fetchWorldBankIndicator} from './free-modules.js';
import {z} from 'zod';
import {TRINITY_VERSION,releaseMetadata,sourceMetadata} from './version.js';
import {buildOnlyPreviewResponse,isBuildOnlyPreview} from './preview-mode.js';
import {TrinityAgent,ChatAgent,GuardianAgent} from './legacy.js';
import {TrinityOperations} from './workflow.js';
import {AGENTS,SKILLS,shouldDelegate} from './registry.js';
import {createJob,getJob} from './jobs.js';
import {authenticate,checkOrigin,hash,HttpError,rateLimit,readJSON,secure,validKey,issueSession,allowDevConnection,sessionCookie} from './security.js';
import {callModel,serviceStatus,runScheduledHealth,readiness} from './services.js';
import {searchMemory,runTool} from './tools.js';
import {PLUGINS,listPlugins,pluginEnabled,installPlugin,installAllPlugins} from './plugins.js';
import {handleMcp} from './mcp.js';
import {TRUTH_POLICY_VERSION} from './truth.js';
import {SYSTEM_CAPABILITIES,createSystemAction,listSystemActions,getSystemAction,approveSystemAction,rejectSystemAction,claimSystemAction,finishSystemAction,authenticateGateway,getPCBridgeStatus} from './system-actions.js';
import {listStudioProjects,getStudioProject,createStudioProject,reviseStudioProject} from './studio.js';
import {beginGoogleLogin,finishGoogleLogin,googleAuthRequired,googleOAuthConfigured} from './google-auth.js';
import {normalizeLanguage} from './cognition.js';
import {mediaStatus} from './media.js';
import {readControl,assertRunning} from './control.js';
import {listApis,createApi,invokeApi,invokeApiBySlug} from './api-builder.js';
import {listApiKeys,createApiKey,revokeApiKey,authenticateApiKey} from './api-keys.js';
import {listSecrets,storeSecret,verifySecret,revokeSecret,promoteCustomSecretToGemini} from './secret-vault.js';
import {listAIProviders,configureAIProvider,recordAIProviderCheck} from './ai-providers.js';
import {getGraphVisualization,syncGraphFromEcosystem,queryGraphContext} from './graph-memory.js';
import {auditHtmlQuality,recordStudioReview,reviewRequestSchema} from './studio-review.js';
import {handleVoiceDialogue} from './voice-agent.js';
import {generateEscrowLandingHtml,createEscrowDeal,settleEscrowDeal,getTelegramConfig,saveTelegramConfig,sendTelegramAlert,checkDomainsAndSslHealth,listDomainAlerts,cloneDomainEnvironment} from './domain-desk-advanced.js';
import {createPriceAlert,listPriceAlerts,checkPriceAlerts,generateInvoiceWithSepaQr,listGeneratedInvoices,getAggregatedNetWorth} from './banking-commodity-advanced.js';
import {generateRegistrationOptions,verifyRegistrationResponse,generateAuthenticationOptions,verifyAuthenticationResponse,listUserPasskeys,deleteUserPasskey} from './webauthn.js';
import {queryAuditEvents,exportAuditEvents,recordAuditEvent} from './audit-log.js';
import {createPortfolio,listPortfolios,getPortfolio,recordTrade,setQuote} from './trading.js';
import {listCustomAgents,createOrUpdateCustomAgent,executeCustomAgent,provisionAgentDomain} from './agent-sandbox.js';
import {getDevHubStatus,executeDevHubCommand} from './developer-hub.js';
import {getWallet,transactWallet} from './wallet.js';
import {getWalletTerminalOverview,saveWalletTerminalConfig,createPaymentTerminalCharge,executeWalletPayout,createCryptoWallet,cancelWalletPayout} from './wallet-terminals.js';
import {handleInboundEmail} from './email.js';
import {TRINITY2_CAPABILITIES,rolePermissions,requireCapability,updateRolePermission,analyzeImage,transcribeAudio,synthesizeSpeech,listVisualWorkflows,saveVisualWorkflow,listIncidents,resolveIncident,recordHealthIncident,exportAudit} from './trinity2.js';
import {TrinityCopilotAgent} from './copilot-agent.js';
import {TELEGRAM_WEBHOOK_PATH,handleTelegramWebhook} from './telegram-webhook.js';
import {copilotChatOptionsSchema} from './copilot-options.js';
import {assertCopilotSkillEnabled} from './copilot-plugins.js';
import {skillRegistry} from './skillRegistry.js';
import {copilotPluginRegistry} from './copilot-plugins.js';
import {universalEcosystem,UNIVERSAL_DOMAINS,APPLICATION_TEMPLATES} from './universal-ecosystem.js';
import {runBrainCycle} from './brain.js';
import {runEvolutionCycle} from './evolution.js';
import {listSelfImprovementProposals,createSelfImprovementProposal,approveSelfImprovementProposal,applySelfImprovementProposal} from './self-improvement.js';
import {listDomains,getDomain,createDomain,registerDomain,checkDomainAvailability,updateDomain,deleteDomain,listDomainForSale,sellDomain,listDomainForLease,leaseDomain,endDomainLease,listDomainTransactions,getDomainMarketplace,listDnsRecords,addDnsRecord,deleteDnsRecord} from './domains.js';
import {listArtifacts,createArtifact,createPdfArtifact,getArtifact} from './artifacts.js';
import html from '../public/index.html';
import appJS from '../public/app.js.txt';
import css from '../public/style.css';
import refreshCSS from '../public/refresh.css';
import assistantHTML from '../public/assistant/chat.html';
import assistantCSS from '../public/assistant/chat.css';
import builderCSS from '../public/assistant/builder.css';
import assistantJS from '../public/assistant/chat.js.txt';
import authBootstrapJS from '../public/auth-bootstrap.js.txt';
import themeCSS from '../public/assistant/theme.css';
import concept3CSS from '../public/assistant/concept3.css';
import streetChatCSS from '../public/assistant/street-chat.css';
import streetlineCSS from '../public/assistant/streetline.css';
import trinityCorePNG from '../public/assistant/trinity-core.png';
export {TrinityAgent,ChatAgent,GuardianAgent,TrinityOperations};
const json=(data,status=200)=>Response.json(data,{status});
const runtimeEnvironment=(request,env)=>['localhost','127.0.0.1','::1'].includes(new URL(request.url).hostname)?'local':env.TRINITY_ENV||'local';
const uuid=z.string().uuid();
const MCP_READ_TOOLS=new Set(['chat_health','tool_catalog','trinity_control_panel','infrastructure_status','project_inspect','project_read','list_improvements','get_capability_status','trinity_status','list_agents','get_task','list_tasks','search_memory','check_services','get_source_file','list_project_files','get_project_action','list_system_actions','pc_status','ecosystem_stats','search_ecosystem']);
function requireAdmin(user){if(!['admin','owner'].includes(user.role))throw new HttpError(403,'Táto operácia je dostupná iba správcovi Trinity.');}
function requireOwner(user){if(user.role!=='owner')throw new HttpError(403,'Táto operácia je dostupná iba vlastníkovi Trinity.');}
async function handleScopedMcp(request,env,ctx){
  if(request.method!=='POST')throw new HttpError(405,'MCP API kľúč podporuje iba POST požiadavky.');
  const body=await readJSON(request,60000);
  const scope=body.method==='tools/call'&&!MCP_READ_TOOLS.has(body.params?.name)?'mcp:write':'mcp:read';
  const client=await authenticateApiKey(request,env,scope);
  if(!await pluginEnabled(env,'mcp'))throw new HttpError(503,'MCP rozšírenie je vypnuté.');
  if(body.method==='tools/call'&&['dispatch_task','create_daily_plan'].includes(body.params?.name))await rateLimit(env,`job:api:${client.id}`,12);
  const forwarded=new Request(request.url,{method:'POST',headers:request.headers,body:JSON.stringify(body)});
  return handleMcp(forwarded,env,ctx,{projectControl:true});
}
async function route(request,env,ctx){
  const previewResponse=buildOnlyPreviewResponse(request,env,{version:TRINITY_VERSION,agents:AGENTS.length});
  if(previewResponse)return previewResponse;
  const knowledgeResponse=await handleKnowledge(request,env);
  if(knowledgeResponse)return knowledgeResponse;
  const url=new URL(request.url),path=url.pathname;
  // Telegram updates are authenticated by the Telegram webhook secret before session auth.
  if(path===TELEGRAM_WEBHOOK_PATH)return handleTelegramWebhook(request,env,ctx,(message,options)=>TrinityCopilotAgent(message,env,options));
  const proPayment=await handleCommercePublic(request,env);if(proPayment)return proPayment;
  const publicSite=await handlePublicSiteRoute(request,env);if(publicSite)return publicSite;
  const brokerMatch=path.match(/^\/broker\/([a-z0-9.-]+\.[a-z]{2,})$/i);
  if(brokerMatch&&request.method==='GET'){
    const domain=await getDomain(env,brokerMatch[1]);
    if(domain)return new Response(generateEscrowLandingHtml({domain}),{headers:{'Content-Type':'text/html; charset=utf-8'}});
  }
  if(path==='/api/domains/escrow/inquire'&&request.method==='POST'){
    const body=await readJSON(request,10000);
    return json(await createEscrowDeal(env,body),201);
  }
  if(request.method==='GET'&&['/','/ops','/dashboard','/index.html'].includes(path))return new Response(path==='/ops'?html:assistantHTML,{headers:{'Content-Type':'text/html; charset=utf-8',
    'Cache-Control':'no-cache, no-store, must-revalidate',
    'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"}});
  if(request.method==='GET'&&path==='/app.js')return new Response(appJS,{headers:{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-cache, must-revalidate'}});
  if(request.method==='GET'&&path==='/style.css')return new Response(css+'\n'+refreshCSS,{headers:{'Content-Type':'text/css; charset=utf-8','Cache-Control':'no-cache, must-revalidate'}});
  if(request.method==='GET'&&path==='/chat.js')return new Response(assistantJS,{headers:{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-cache, must-revalidate'}});
  if(request.method==='GET'&&path==='/auth-bootstrap.js')return new Response(authBootstrapJS,{headers:{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-cache, must-revalidate'}});
  if(request.method==='GET'&&path==='/chat.css')return new Response(assistantCSS,{headers:{'Content-Type':'text/css; charset=utf-8','Cache-Control':'no-cache, must-revalidate'}});
  if(request.method==='GET'&&path==='/builder.css')return new Response(builderCSS,{headers:{'Content-Type':'text/css; charset=utf-8','Cache-Control':'no-cache, must-revalidate'}});
  if(request.method==='GET'&&path==='/theme.css')return new Response(await renderDynamicThemeCss(env,themeCSS),{headers:{'Content-Type':'text/css; charset=utf-8','Cache-Control':'no-cache, must-revalidate'}});
  if(request.method==='GET'&&path==='/concept3.css')return new Response(concept3CSS,{headers:{'Content-Type':'text/css; charset=utf-8','Cache-Control':'no-cache, must-revalidate'}});
  if(request.method==='GET'&&path==='/street-chat.css')return new Response(streetChatCSS,{headers:{'Content-Type':'text/css; charset=utf-8','Cache-Control':'no-cache, must-revalidate'}});
  if(request.method==='GET'&&path==='/streetline.css')return new Response(streetlineCSS,{headers:{'Content-Type':'text/css; charset=utf-8','Cache-Control':'no-cache, must-revalidate'}});
  if(request.method==='GET'&&path==='/trinity-core.png')return new Response(trinityCorePNG,{headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=86400'}});
  if(path==='/health'||path==='/api/health'){
    const response=json({service:'Trinity',version:TRINITY_VERSION,environment:runtimeEnvironment(request,env),source:sourceMetadata(env),deployment:releaseMetadata(env),agents:AGENTS.length,status:'serving',truth_mode:'evidence-required'});const origin=request.headers.get('Origin');
    if(['https://trinity-morhfeus-20261001.web.app','https://trinity-morhfeus-20261001.firebaseapp.com'].includes(origin)){response.headers.set('Access-Control-Allow-Origin',origin);response.headers.set('Vary','Origin');}
    return response;
  }
  if(path==='/ready'&&request.method==='GET'){
    const state=await readiness(env);
    return json({service:'Trinity',version:TRINITY_VERSION,environment:runtimeEnvironment(request,env),source:sourceMetadata(env),...state},state.ready?200:503);
  }
  if(path==='/api/ecosystem/stats'&&request.method==='GET')return json(universalEcosystem.getStats());
  if(path==='/api/ecosystem/domains'&&request.method==='GET')return json({domains:UNIVERSAL_DOMAINS,templates:APPLICATION_TEMPLATES});
  if(path==='/api/auth/config'&&request.method==='GET')return json({google_enabled:(googleAuthRequired(env)||env.GOOGLE_ENABLED==='true')&&googleOAuthConfigured(env),google_required:googleAuthRequired(env)});
  const generatedApi=path.match(/^\/api\/v1\/generated\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  if(generatedApi&&(request.method==='GET'||request.method==='POST')){const client=await authenticateApiKey(request,env);return json(await invokeApiBySlug(env,client.owner_id,generatedApi[1],request.method));}
  if(path==='/api/auth/passkey/auth-options'&&request.method==='POST'){
    const body=await readJSON(request,4000).catch(()=>({}));
    return json(await generateAuthenticationOptions(request,env,body.email||null));
  }
  if(path==='/api/auth/passkey/auth-verify'&&request.method==='POST'){
    const body=await readJSON(request,32000);
    return verifyAuthenticationResponse(request,env,body);
  }
  if((path==='/api/auth/google/start'||path==='/auth/google/start'||path==='/auth/google/login'||path==='/api/auth/google/login')&&request.method==='GET'){
    if(!googleAuthRequired(env)&&env.GOOGLE_ENABLED!=='true')throw new HttpError(404,'Google prihlasovanie zatiaľ nie je aktivované.');
    await rateLimit(env,`google-start:${(await hash(request.headers.get('CF-Connecting-IP')||'unknown')).slice(0,24)}`,10,300);
    return beginGoogleLogin(env,request);
  }
  if((path==='/api/auth/google/callback'||path==='/auth/google/callback')&&request.method==='GET'){
    if(!googleAuthRequired(env)&&env.GOOGLE_ENABLED!=='true')throw new HttpError(404,'Google prihlasovanie zatiaľ nie je aktivované.');
    await rateLimit(env,`google-callback:${(await hash(request.headers.get('CF-Connecting-IP')||'unknown')).slice(0,24)}`,10,300);
    return finishGoogleLogin(request,env);
  }
  checkOrigin(request,env);
  if(path==='/api/ops/dev-login'&&request.method==='POST'){
    if(googleAuthRequired(env))throw new HttpError(403,'Použi prihlásenie cez Google.');
    if(!await allowDevConnection(request,env))throw new HttpError(401,'Automatický vývojový vstup pre toto pripojenie nie je dostupný.');
    await rateLimit(env,'dev-login',20,60);
    return issueSession(env,env.TRINITY_DEV_UNTIL?Date.parse(env.TRINITY_DEV_UNTIL):undefined,env.TRINITY_OWNER_EMAIL||null,request);
  }
  if(path==='/api/ops/login'&&request.method==='POST'){
    if(googleAuthRequired(env))throw new HttpError(403,'Prihlásenie prístupovým kľúčom je vypnuté. Použi Google.');
    await rateLimit(env,'login:'+(await hash(request.headers.get('CF-Connecting-IP')||'local')).slice(0,24),10,300);
    const {key}=z.object({key:z.string().max(2048)}).parse(await readJSON(request));
    if(!await validKey(key,env))throw new HttpError(401,'Nesprávny prístupový kľúč.');
    return issueSession(env,undefined,env.TRINITY_OWNER_EMAIL||null,request);
  }
  if(path==='/api/ops/redeem'&&request.method==='POST'){
    if(googleAuthRequired(env))throw new HttpError(403,'Jednorazové kľúče sú vypnuté. Použi Google.');
    await rateLimit(env,'redeem:'+(await hash(request.headers.get('CF-Connecting-IP')||'local')).slice(0,24),10,300);
    const {ticket}=z.object({ticket:z.string().regex(/^[a-f0-9]{64}$/)}).parse(await readJSON(request));
    const used=await env.DB.prepare('DELETE FROM ops_login_tickets WHERE token_hash=? RETURNING expires_at,email').bind(await hash(ticket)).first();
    if(!used||used.expires_at<Date.now())throw new HttpError(401,'Odkaz vypršal alebo už bol použitý. Otvor znovu OTVORIT-TRINITY.cmd.');
    return issueSession(env,undefined,used.email||null,request);
  }
  if(path==='/api/ops/logout'&&request.method==='POST'){
    const session=request.headers.get('Cookie')?.match(/(?:^|;\s*)trinity_session=([a-f0-9]{64})(?:;|$)/)?.[1];
    if(session)await env.DB.prepare('DELETE FROM ops_sessions WHERE token_hash=?').bind(await hash(session)).run();
    const response=json({ok:true});response.headers.set('Set-Cookie',sessionCookie('',0,request,env));return response;
  }
  if(path==='/api/system/actions/claim'&&request.method==='POST'){
    const gateway=await authenticateGateway(request,env);await rateLimit(env,`gateway-claim:${gateway}`,120);
    return json({action:await claimSystemAction(env,gateway)});
  }
  if(path==='/api/system/pc-bridge/v1/heartbeat'&&request.method==='POST'){
    const gateway=await authenticateGateway(request,env);await rateLimit(env,`gateway-heartbeat:${gateway}`,120);
    if(!env.PC_BRIDGE_V2?.fetch)throw new HttpError(503,'PC Bridge nie je nakonfigurovaný.');
    const response=await env.PC_BRIDGE_V2.fetch(new Request('https://pc-bridge.internal/v1/heartbeat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(await readJSON(request,32000))}));
    if(!response.ok)throw new HttpError(502,`PC Bridge heartbeat zlyhal (HTTP ${response.status}).`);
    return json(await response.json());
  }
  const gatewayReceipt=path.match(/^\/api\/system\/actions\/([0-9a-f-]+)\/receipt$/i);
  if(gatewayReceipt&&request.method==='POST'){
    const gateway=await authenticateGateway(request,env);await rateLimit(env,`gateway-receipt:${gateway}`,120);
    return json({action:await finishSystemAction(env,uuid.parse(gatewayReceipt[1]),gateway,await readJSON(request,180000))});
  }
  const bearer=request.headers.get('Authorization')?.replace(/^Bearer\s+/i,'')||request.headers.get('X-Trinity-API-Key')||'';
  if(path==='/mcp'&&bearer.startsWith('trn_live_'))return handleScopedMcp(request,env,ctx);
  let user;
  try {
    user=await authenticate(request,env);
  } catch(err) {
    if(['/api/assistant/status','/api/assistant/sessions','/api/assistant/history'].includes(path)&&request.method==='GET'){
      user={id:'guest',email:null,role:'guest'};
    } else {
      throw err;
    }
  }
  const ownerId=(user.email||user.id).trim().toLowerCase();
  if(path==='/api/assistant/runtime/manifest'&&request.method==='GET'){requireAdmin(user);return json({version:TRINITY_VERSION,workers:Object.entries(WORKER_CATALOG).map(([binding,worker])=>({binding,name:worker.name,service:worker.service,configured:!!env[binding],execution_verified:false})),skills:skillRegistry.list(),secrets:runtimeSecretStatus(env),note:'Pracovníci vyžadujú úspešný health check a konkrétny doklad vykonania. Katalógový skill je návod, nie vykonaný skript.'});}
  if(path==='/api/assistant/secrets/status'&&request.method==='GET'){requireAdmin(user);return json(runtimeSecretStatus(env));}
  if(path==='/api/assistant/capabilities'&&request.method==='GET')return json(await capabilityStatus(env));
  if(path==='/api/assistant/morpheus/status'&&request.method==='GET'){
    return json({
      agent:'Morpheus',
      version:'1.0.0',
      role:'Social Media Autonomous Commander',
      domain:env.TRINITY_ENV==='production'?'auru.space':'dev.auru.space',
      service_url:'https://morpheus.auru.space',
      capabilities:['oauth_pkce','meta_graph','x_twitter_v2','linkedin_share','youtube_data','tiktok_creator','auto_posting','comment_moderation','link_shortening'],
      endpoints:{
        dashboard:'/dashboard',
        auth_status:'/api/v1/auth/status',
        webhooks_meta:'/api/v1/webhooks/meta',
        webhooks_x:'/api/v1/webhooks/x',
        short_link:'/l/:code',
        landing_page:'/p/:slug'
      }
    });
  }
  const control=await readControl(env);
  if(control.emergency_stop&&!['/api/ops/status','/api/ops/control','/api/ops/logout','/api/assistant/rbac','/api/assistant/audit/export'].includes(path))assertRunning(control);
  if(path==='/api/assistant/media/status'&&request.method==='GET')return json(mediaStatus(env));
  if(path==='/api/assistant/media/analyze-image'&&request.method==='POST'){
    await requireCapability(env,user,'analyze_image');await rateLimit(env,`vision:${user.id}`,12,300);
    return json(await analyzeImage(env,await readJSON(request,8_100_000)));
  }
  if(path==='/api/assistant/media/transcribe'&&request.method==='POST'){
    await requireCapability(env,user,'transcribe_audio');await rateLimit(env,`stt:${user.id}`,12,300);
    return json(await transcribeAudio(env,await readJSON(request,12_100_000)));
  }
  if(path==='/api/assistant/media/speech'&&request.method==='POST'){
    await requireCapability(env,user,'text_to_speech');await rateLimit(env,`tts:${user.id}`,20,300);
    return json(await synthesizeSpeech(env,await readJSON(request,8000)));
  }
  if(path==='/api/assistant/voice/dialogue'&&request.method==='POST'){
    await rateLimit(env,`voice:${user.id}`,30,300);
    let audioBytes=null, audioMime='audio/webm', textPrompt='';
    const contentType=request.headers.get('content-type')||'';
    if(contentType.includes('multipart/form-data')){
      const form=await request.formData();
      const file=form.get('audio');
      if(file&&typeof file.arrayBuffer==='function'){
        audioBytes=new Uint8Array(await file.arrayBuffer());
        audioMime=file.type||audioMime;
      }
      textPrompt=form.get('prompt')||'';
    }else{
      const body=await readJSON(request,2_000_000).catch(()=>({}));
      textPrompt=body.prompt||body.text||'';
      if(body.audio_base64){
        const base64Data=body.audio_base64.replace(/^data:[^;]+;base64,/,'');
        audioBytes=Uint8Array.from(atob(base64Data),c=>c.charCodeAt(0));
      }
    }
    return json(await handleVoiceDialogue(env,user,{audioBytes,audioMime,textPrompt}));
  }
  const audioRoute=path.match(/^\/api\/assistant\/media\/audio\/([0-9a-f-]+)$/i);
  if(audioRoute&&request.method==='GET'){
    const id=uuid.parse(audioRoute[1]),object=await env.ARTIFACTS.get(`media/audio/${id}.mp3`);if(!object)throw new HttpError(404,'Zvuk neexistuje.');
    return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'audio/mpeg','Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff'}});
  }
  if(path==='/api/assistant/rbac'&&request.method==='GET'){
    const roles=user.role==='owner'?['owner','admin','user']:[user.role];const items=[];for(const role of roles)items.push({role,permissions:await rolePermissions(env,role)});
    return json({capabilities:TRINITY2_CAPABILITIES,items});
  }
  if(path==='/api/assistant/rbac'&&request.method==='POST'){
    requireOwner(user);const input=z.object({role:z.enum(['admin','user']),capability:z.enum(TRINITY2_CAPABILITIES),allowed:z.boolean()}).strict().parse(await readJSON(request));
    return json(await updateRolePermission(env,{...input,updatedBy:user.email||user.id}));
  }
  if(path==='/api/assistant/workflows'){
    await requireCapability(env,user,'manage_workflows');
    if(request.method==='GET')return json({items:await listVisualWorkflows(env,ownerId)});
    if(request.method==='POST')return json({item:await saveVisualWorkflow(env,ownerId,await readJSON(request,50000))},201);
  }
  if(path==='/api/assistant/incidents'&&request.method==='GET'){requireAdmin(user);return json({items:await listIncidents(env)});}
  const incidentRoute=path.match(/^\/api\/assistant\/incidents\/([0-9a-f-]+)\/resolve$/i);
  if(incidentRoute&&request.method==='POST'){requireAdmin(user);return json({item:await resolveIncident(env,uuid.parse(incidentRoute[1]),user.email||user.id)});}
  if(path==='/api/assistant/audit/export'&&request.method==='GET'){
    await requireCapability(env,user,'view_audit');const format=url.searchParams.get('format')==='csv'?'csv':'json',file=await exportAudit(env,format);
    return new Response(file.content,{headers:{'Content-Type':file.contentType,'Content-Disposition':`attachment; filename="${file.filename}"`,'Cache-Control':'no-store'}});
  }
  if(path==='/api/assistant/audit/events'&&request.method==='GET'){
    await requireCapability(env,user,'view_audit');
    return json(await queryAuditEvents(env,{
      limit:url.searchParams.get('limit'),
      action:url.searchParams.get('action'),
      category:url.searchParams.get('category'),
      severity:url.searchParams.get('severity'),
      search:url.searchParams.get('search'),
      since:url.searchParams.get('since')
    }));
  }
  if(path==='/api/assistant/audit/log'&&request.method==='POST'){
    requireAdmin(user);
    const body=await readJSON(request,8000);
    await recordAuditEvent(env,{action:body.action,details:{...body.details,actor:user.email||user.id}});
    return json({ok:true});
  }
  if(path==='/api/auth/passkey/register-options'&&request.method==='POST'){
    requireAdmin(user);
    const body=await readJSON(request,4000).catch(()=>({}));
    return json(await generateRegistrationOptions(request,env,body.email||user.email));
  }
  if(path==='/api/auth/passkey/register-verify'&&request.method==='POST'){
    requireAdmin(user);
    const body=await readJSON(request,32000);
    return json(await verifyRegistrationResponse(request,env,body,user.email));
  }
  if(path==='/api/auth/passkey/list'&&request.method==='GET'){
    return json({passkeys:await listUserPasskeys(env,user.email)});
  }
  const deletePasskeyRoute=path.match(/^\/api\/auth\/passkey\/([0-9a-f-]+)$/i);
  if(deletePasskeyRoute&&request.method==='DELETE'){
    requireAdmin(user);
    return json(await deleteUserPasskey(env,user.email,deletePasskeyRoute[1]));
  }
  if(path==='/api/ops/control'){
    requireAdmin(user);
    if(request.method==='GET')return json(await readControl(env));
    if(request.method==='POST'){
      const d=z.object({emergency_stop:z.boolean(),reason:z.string().trim().max(500).default('')}).strict().parse(await readJSON(request));
      await env.DB.prepare("UPDATE ops_control SET emergency_stop=?,reason=?,updated_by=?,updated_at=datetime('now') WHERE id=1").bind(d.emergency_stop?1:0,d.reason||null,user.email||'owner').run();
      await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES(?,?)").bind(d.emergency_stop?'emergency_stop_enabled':'emergency_stop_disabled',JSON.stringify({by:user.email||'owner',reason:d.reason||null})).run();
      return json(await readControl(env));
    }
  }
  if(path==='/api/ops/users/pending'&&request.method==='GET'){
    requireAdmin(user);
    const rows=await env.DB.prepare("SELECT email,display_name,created_at FROM ops_users WHERE status='pending' AND role='user' ORDER BY created_at").all();
    return json({items:rows.results});
  }
  if(path==='/api/ops/users'&&request.method==='GET'){
    requireOwner(user);
    const rows=await env.DB.prepare('SELECT email,display_name,role,status,created_at,updated_at FROM ops_users ORDER BY created_at DESC LIMIT 200').all();
    return json({items:rows.results,owner_email:env.TRINITY_OWNER_EMAIL||null});
  }
  const userRoleRoute=path.match(/^\/api\/ops\/users\/([^/]+)\/role$/);
  if(userRoleRoute&&request.method==='POST'){
    requireOwner(user);let email;try{email=decodeURIComponent(userRoleRoute[1]).trim().toLowerCase();}catch{throw new HttpError(400,'Neplatný e-mail.');}
    if(env.TRINITY_OWNER_EMAIL&&email===env.TRINITY_OWNER_EMAIL.toLowerCase())throw new HttpError(409,'Rolu vlastníka nemožno zmeniť.');
    const {role,status}=z.object({role:z.enum(['user','admin']),status:z.enum(['active','blocked'])}).strict().parse(await readJSON(request));
    const changed=await env.DB.prepare("UPDATE ops_users SET role=?,status=?,updated_at=datetime('now') WHERE email=? RETURNING email,display_name,role,status,updated_at").bind(role,status,email).first();
    if(!changed)throw new HttpError(404,'Používateľ neexistuje.');
    await env.DB.prepare("DELETE FROM ops_sessions WHERE lower(email)=lower(?)").bind(email).run();
    return json(changed);
  }
  const reviewUser=path.match(/^\/api\/ops\/users\/([^/]+)\/(approve|reject)$/);
  if(reviewUser&&request.method==='POST'){
    requireAdmin(user);z.object({}).strict().parse(await readJSON(request));
    let email;try{email=decodeURIComponent(reviewUser[1]).trim().toLowerCase();}catch{throw new HttpError(400,'Neplatný e-mail.');}
    z.string().email().parse(email);
    const status=reviewUser[2]==='approve'?'active':'rejected';
    const changed=await env.DB.prepare("UPDATE ops_users SET status=?,approved_by=?,approved_at=datetime('now'),updated_at=datetime('now') WHERE email=? AND role='user' AND status='pending' RETURNING email,status").bind(status,user.email,email).first();
    if(!changed)throw new HttpError(404,'Čakajúci profil neexistuje.');
    await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('user_access_reviewed',?)").bind(JSON.stringify({email,status,admin:user.email})).run();
    return json(changed);
  }
  if(path==='/api/assistant/studio/projects'){
    if(request.method==='GET')return json({items:await listStudioProjects(env,'primary')});
    if(request.method==='POST'){await rateLimit(env,`studio-generate:${user.id}`,5,300);return json({project:await createStudioProject(env,'primary',await readJSON(request,20000))},201);}
  }
  const studioRoute=path.match(/^\/api\/assistant\/studio\/projects\/([0-9a-f-]+)(?:\/(revise|export))?$/i);
  if(studioRoute){const id=uuid.parse(studioRoute[1]);
    if(request.method==='GET'&&!studioRoute[2])return json({project:await getStudioProject(env,'primary',id)});
    if(request.method==='POST'&&studioRoute[2]==='revise'){await rateLimit(env,`studio-revise:${user.id}`,8,300);return json({project:await reviseStudioProject(env,'primary',id,await readJSON(request,20000))});}
    if(request.method==='GET'&&studioRoute[2]==='export'){const project=await getStudioProject(env,'primary',id);return new Response(project.html,{headers:{'Content-Type':'text/html; charset=utf-8','Content-Disposition':`attachment; filename="${project.name.replace(/[^a-z0-9_-]+/gi,'-').slice(0,50)||'trinity-web'}.html"`}});}
  }
  if(path==='/api/assistant/studio/audit'&&request.method==='POST'){
    const data=reviewRequestSchema.parse(await readJSON(request,500_000));
    const result=auditHtmlQuality(data.html);
    if(data.project_id)await recordStudioReview(env,data.project_id,data.version,result).catch(()=>{});
    return json(result);
  }
  if(path==='/api/assistant/multimedia'&&request.method==='GET'){
    return json(await listMultimediaCreations(env,{kind:url.searchParams.get('kind')||'',limit:Number(url.searchParams.get('limit')||40)}));
  }
  if(path==='/api/assistant/multimedia/music'&&request.method==='POST'){
    await rateLimit(env,`mm-music:${user.id}`,20,300);
    return json(await generateMusicTrack(env,user,await readJSON(request,15000)),201);
  }
  if(path==='/api/assistant/multimedia/video'&&request.method==='POST'){
    await rateLimit(env,`mm-video:${user.id}`,20,300);
    return json(await generateVideoCreation(env,user,await readJSON(request,20000)),201);
  }
  if(path==='/api/assistant/multimedia/presentation'&&request.method==='POST'){
    await rateLimit(env,`mm-pres:${user.id}`,20,300);
    return json(await generatePresentationDeck(env,user,await readJSON(request,20000)),201);
  }
  if(path==='/api/assistant/multimedia/photo'&&request.method==='POST'){
    await rateLimit(env,`mm-photo:${user.id}`,20,300);
    return json(await generatePhotoCreation(env,user,await readJSON(request,15000)),201);
  }
  if(path==='/api/assistant/multimedia/creative-pack'&&request.method==='POST'){
    await rateLimit(env,`mm-pack:${user.id}`,20,300);
    return json(await generateCreativePack(env,user,await readJSON(request,20000)),201);
  }
  if(path==='/api/assistant/infrastructure'&&request.method==='GET'){requireAdmin(user);return json(infrastructureStatus(env));}
  if(path==='/api/assistant/hosting'){
    requireOwner(user);
    if(request.method==='GET')return json({items:await listHostedSites(env)});
    if(request.method==='POST'){await rateLimit(env,`hosting:${user.id}`,5,300);return json(await hostStudioProject(env,await readJSON(request,1000)),201);}
  }
  if(path==='/api/assistant/project/inspect'&&request.method==='POST'){requireAdmin(user);await rateLimit(env,`project:${user.id}`,20,300);const data=z.object({query:z.string().max(2000).default('')}).parse(await readJSON(request));return json(await inspectProject(env,data.query));}
  if(path==='/api/assistant/project/source'&&request.method==='POST'){requireAdmin(user);const data=z.object({path:z.string().max(500),ref:z.string().regex(/^[a-f0-9]{40}$/).optional()}).parse(await readJSON(request));return json(await readProjectSource(env,data.path,data.ref));}
  if(path==='/api/assistant/domains/search'&&request.method==='GET'){requireAdmin(user);return json(await searchDomainNames(env,url.searchParams.get('q')));}
  if(path==='/api/assistant/domains/sync'&&request.method==='POST'){requireAdmin(user);return json(await syncCloudflareDomains(env));}
  if(path==='/api/assistant/domains/registration-status'&&request.method==='POST'){requireAdmin(user);const data=z.object({domain:z.string()}).parse(await readJSON(request));return json(await refreshDomainRegistration(env,data.domain));}
  if(path==='/api/assistant/domains/subdomain'&&request.method==='POST'){requireAdmin(user);return json(await createSubdomain(env,await readJSON(request)));}
  if(path==='/api/assistant/domains'){
    if(request.method==='GET'){
      if(url.searchParams.get('auto_seed')==='1'){
        const existing=await listDomains(env,{});
        if(existing.length<20)await seedTwentyCloudflareDomains(env,user.email||user.id);
      }
      const filter={
        status:url.searchParams.get('status')||undefined,
        listing_type:url.searchParams.get('listing_type')||undefined,
        search:url.searchParams.get('search')||undefined
      };
      return json({items:await listDomains(env,filter)});
    }
    if(request.method==='POST'){requireAdmin(user);return json({item:await createDomain(env,await readJSON(request,10000))},201);}
  }
  if(path==='/api/assistant/domains/seed-20'&&request.method==='POST'){
    requireAdmin(user);
    return json(await seedTwentyCloudflareDomains(env,user.email||user.id),201);
  }
  if(path==='/api/assistant/domains/check'){
    if(request.method==='GET'){
      const dName=url.searchParams.get('domain');
      if(!dName)throw new HttpError(400,'Parameter ?domain= je povinný.');
      return json(await checkDomainAvailability(env,dName));
    }
    if(request.method==='POST'){
      const b=await readJSON(request,1000);
      if(!b.domain)throw new HttpError(400,'Pole domain je povinné.');
      return json(await checkDomainAvailability(env,b.domain));
    }
  }
  if(path==='/api/assistant/domains/register'&&request.method==='POST'){
    const payload=await readJSON(request,10000);
    if(payload.live_register)requireOwner(user);
    else requireAdmin(user);
    return json(await registerDomain(env,payload),201);
  }
  if(path==='/api/assistant/domains/marketplace'&&request.method==='GET'){
    return json(await getDomainMarketplace(env));
  }
  if(path==='/api/assistant/domains/environments'&&request.method==='GET'){
    return json(await listDomainEnvironments(env,url.searchParams.get('domain')||'',{autoSeedIfEmpty:url.searchParams.get('auto_seed')==='1'}));
  }
  if(path==='/api/assistant/domains/environments/provision'&&request.method==='POST'){
    requireAdmin(user);
    await rateLimit(env,`domain-env-prov:${user.id}`,20,300);
    return json(await provisionDomainWithEnvironments(env,user.email||user.id,await readJSON(request,25000)),201);
  }
  if(path==='/api/assistant/domains/environments/deploy'&&request.method==='POST'){
    requireAdmin(user);
    await rateLimit(env,`domain-env-deploy:${user.id}`,30,300);
    return json(await deployDomainEnvironment(env,user.email||user.id,await readJSON(request,60000)));
  }
  if(path==='/api/assistant/domains/environments/clone'&&request.method==='POST'){
    requireAdmin(user);
    await rateLimit(env,`domain-env-clone:${user.id}`,20,300);
    return json(await cloneDomainEnvironment(env,user.email||user.id,await readJSON(request,10000)),201);
  }
  if(path==='/api/assistant/domains/escrow/settle'&&request.method==='POST'){
    requireAdmin(user);
    return json(await settleEscrowDeal(env,user.email||user.id,await readJSON(request,10000)));
  }
  if(path==='/api/assistant/domains/monitoring/alerts'&&request.method==='GET'){
    requireAdmin(user);
    return json(await listDomainAlerts(env));
  }
  if(path==='/api/assistant/domains/monitoring/check'&&request.method==='POST'){
    requireAdmin(user);
    return json(await checkDomainsAndSslHealth(env,{notifyTelegram:true}));
  }
  if(path==='/api/assistant/domains/monitoring/telegram/test'&&request.method==='POST'){
    requireAdmin(user);
    return json(await sendTelegramAlert(env,'<b>Test Trinity</b> · Testovacia správa z ovládacieho panela.'));
  }
  if(path==='/api/assistant/domains/monitoring/telegram'&&request.method==='GET'){
    requireAdmin(user);
    return json(await getTelegramConfig(env));
  }
  if(path==='/api/assistant/domains/monitoring/telegram'&&request.method==='POST'){
    requireAdmin(user);
    return json(await saveTelegramConfig(env,await readJSON(request,10000)));
  }
  const domainDetailRoute=path.match(/^\/api\/assistant\/domains\/([0-9a-f-]+|[a-z0-9.-]+\.[a-z]{2,})$/i);
  if(domainDetailRoute){
    const domainIdOrName=domainDetailRoute[1];
    if(request.method==='GET'){
      const item=await getDomain(env,domainIdOrName);
      if(!item)throw new HttpError(404,'Doména nebola nájdená.');
      const [dns_records,transactions]=await Promise.all([
        listDnsRecords(env,item.id),
        listDomainTransactions(env,item.id)
      ]);
      return json({item,dns_records,transactions});
    }
    if(request.method==='POST'||request.method==='PUT'){
      requireAdmin(user);
      return json({item:await updateDomain(env,domainIdOrName,await readJSON(request,10000))});
    }
    if(request.method==='DELETE'){
      requireAdmin(user);
      return json(await deleteDomain(env,domainIdOrName));
    }
  }
  const domainDeleteRoute=path.match(/^\/api\/assistant\/domains\/([0-9a-f-]+|[a-z0-9.-]+\.[a-z]{2,})\/delete$/i);
  if(domainDeleteRoute&&request.method==='POST'){
    requireAdmin(user);
    return json(await deleteDomain(env,domainDeleteRoute[1]));
  }
  const domainSaleRoute=path.match(/^\/api\/assistant\/domains\/([0-9a-f-]+|[a-z0-9.-]+\.[a-z]{2,})\/(sale|sell)$/i);
  if(domainSaleRoute&&request.method==='POST'){
    requireAdmin(user);
    const domainIdOrName=domainSaleRoute[1],action=domainSaleRoute[2];
    const payload=await readJSON(request,10000);
    if(action==='sale')return json({item:await listDomainForSale(env,domainIdOrName,payload)});
    if(action==='sell')return json(await sellDomain(env,domainIdOrName,payload));
  }
  const domainLeaseRoute=path.match(/^\/api\/assistant\/domains\/([0-9a-f-]+|[a-z0-9.-]+\.[a-z]{2,})\/lease(?:\/(end))?$/i);
  if(domainLeaseRoute&&request.method==='POST'){
    requireAdmin(user);
    const domainIdOrName=domainLeaseRoute[1],isEnd=Boolean(domainLeaseRoute[2]);
    const payload=await readJSON(request,10000);
    if(isEnd)return json(await endDomainLease(env,domainIdOrName,payload));
    if(payload.tenant)return json(await leaseDomain(env,domainIdOrName,payload));
    return json({item:await listDomainForLease(env,domainIdOrName,payload)});
  }
  const domainTransactionsRoute=path.match(/^\/api\/assistant\/domains\/([0-9a-f-]+|[a-z0-9.-]+\.[a-z]{2,})\/transactions$/i);
  if(domainTransactionsRoute&&request.method==='GET'){
    return json({items:await listDomainTransactions(env,domainTransactionsRoute[1])});
  }
  const domainDnsDeleteRoute=path.match(/^\/api\/assistant\/domains\/([0-9a-f-]+|[a-z0-9.-]+\.[a-z]{2,})\/dns\/([0-9a-f-]+)\/delete$/i);
  if(domainDnsDeleteRoute&&request.method==='POST'){
    requireAdmin(user);
    return json(await deleteDnsRecord(env,domainDnsDeleteRoute[1],domainDnsDeleteRoute[2]));
  }
  const domainDnsRoute=path.match(/^\/api\/assistant\/domains\/([0-9a-f-]+|[a-z0-9.-]+\.[a-z]{2,})\/dns(?:\/([0-9a-f-]+))?$/i);
  if(domainDnsRoute){
    const domainIdOrName=domainDnsRoute[1],recordId=domainDnsRoute[2];
    if(request.method==='GET'&&!recordId){
      return json({items:await listDnsRecords(env,domainIdOrName)});
    }
    if(request.method==='POST'&&!recordId){
      requireAdmin(user);
      return json({item:await addDnsRecord(env,domainIdOrName,await readJSON(request,10000))},201);
    }
    if(request.method==='DELETE'&&recordId){
      requireAdmin(user);
      return json(await deleteDnsRecord(env,domainIdOrName,recordId));
    }
  }
  if(path==='/api/os/status'&&request.method==='GET'){
    const [services,readinessState,memoryCount,taskCount,jobCount,pcBridge]=await Promise.all([
      serviceStatus(env),
      readiness(env),
      env.DB?.prepare?env.DB.prepare('SELECT (SELECT COUNT(*) FROM ops_memory)+(SELECT COUNT(*) FROM memory_long) AS count').first().catch(()=>({count:0})):{count:0},
      env.DB?.prepare?env.DB.prepare('SELECT COUNT(*) AS count FROM tasks').first().catch(()=>({count:0})):{count:0},
      env.DB?.prepare?env.DB.prepare('SELECT COUNT(*) AS count FROM ops_jobs').first().catch(()=>({count:0})):{count:0},
      getPCBridgeStatus(env)
    ]);
    const reachableServices=services.filter(s=>s.status==='reachable').length;
    return json({
      os_name:'Trinity Cognitive Cloud OS',
      kernel_version:TRINITY_VERSION+'-cloud-kernel',
      architecture:'Distributed Microservices & Neural Workers',
      environment:runtimeEnvironment(request,env),
      uptime:'continuous',
      readiness:readinessState,
      telemetry:{
        total_workers:services.length,
        reachable_workers:reachableServices,
        healthy:reachableServices===services.length,
        services
      },
      storage:{
        database:'Cloudflare D1 (trinity-v03)',
        cache:'Cloudflare KV (Mastermind)',
        filesystem:'Cloudflare R2 (trinity-artifacts)',
        memory_records:memoryCount?.count||0
      },
      processes:{
        tasks_count:taskCount?.count||0,
        jobs_count:jobCount?.count||0
      },
      hardware_bridge:pcBridge
    });
  }
  if(path==='/api/os/processes'&&request.method==='GET'){
    let tasks=[];let jobs=[];
    if(env.DB?.prepare){
      try{const tRows=await env.DB.prepare('SELECT id, title, status, assigned_agent, priority, created_at, updated_at FROM tasks ORDER BY created_at DESC LIMIT 50').all();tasks=tRows.results||[];}catch{}
      try{const jRows=await env.DB.prepare('SELECT id, task, team, provider, status, created_at, updated_at FROM ops_jobs ORDER BY created_at DESC LIMIT 50').all();jobs=jRows.results||[];}catch{}
    }
    return json({tasks,jobs,total:tasks.length+jobs.length});
  }
  if(path==='/api/assistant/settings'&&request.method==='GET'){
    const [plugins,memory,apis,keys,portfolios,pcBridge,secrets,commerce]=await Promise.all([
      listPlugins(env),env.DB.prepare('SELECT (SELECT COUNT(*) FROM ops_memory)+(SELECT COUNT(*) FROM memory_long) AS count').first(),
      env.DB.prepare('SELECT COUNT(*) AS count FROM ops_api_definitions WHERE owner_id=?').bind(ownerId).first(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM ops_api_access_keys WHERE owner_id=? AND status='active'").bind(ownerId).first(),
      env.DB.prepare('SELECT COUNT(*) AS count FROM trading_portfolios WHERE owner_id=?').bind(ownerId).first(),getPCBridgeStatus(env),listSecrets(env,ownerId),commerceStatus(env).catch(()=>({revolut:{configured:false},paypal:{configured:false},accounts:{}}))
    ]);
    const secretStatus=provider=>secrets.find(item=>item.provider===provider)?.status||'not-configured';
    return json({plugins,truth_policy_version:TRUTH_POLICY_VERSION,version:TRINITY_VERSION,model:env.AI_MODEL||'@cf/openai/gpt-oss-120b',image_model:env.IMAGE_MODEL||'@cf/black-forest-labs/flux-1-schnell',permissions:{manage_api_keys:['admin','owner'].includes(user.role),manage_secrets:['admin','owner'].includes(user.role),manage_users:user.role==='owner',manage_trading:['admin','owner'].includes(user.role),use_local_ai:['admin','owner'].includes(user.role),manage_domains:['admin','owner'].includes(user.role)},storage:{database:'Cloudflare D1',cache:'Workers KV · Mastermind',artifacts:'Cloudflare R2 · trinity-artifacts',strategy:'indexed-relational + cache + object archive',scalable:true,memory_records:memory.count||0},counts:{api_projects:apis.count||0,active_api_keys:keys.count||0,paper_portfolios:portfolios.count||0},internet:{web_search:plugins.some(p=>p.id==='web'&&p.enabled),mode:'outbound-only',always_on_gateway:pcBridge.connected===true},pc_bridge:pcBridge,integrations:[{id:'mcp',name:'MCP most',status:plugins.some(p=>p.id==='mcp'&&p.enabled)?'ready':'disabled'},{id:'api',name:'Trinity API',status:'ready'},{id:'web',name:'Webový výskum',status:plugins.some(p=>p.id==='web'&&p.enabled)?'ready':'disabled'},{id:'cloudflare',name:'Cloudflare',status:secretStatus('cloudflare')==='verified'?'verified':'platform-connected'},{id:'openai',name:'OpenAI / ChatGPT API',status:env.OPENAI_API_KEY?'configured':'not-configured'},{id:'ollama',name:'Ollama Cloud',status:env.OLLAMA_SECRET||env.OLLAMA_API_KEY?'configured':'not-configured'},{id:'gemini',name:'Google Gemini',status:env.GEMINI_API_KEY?'configured':secretStatus('gemini')},{id:'google',name:'Google OAuth',status:googleOAuthConfigured(env)?'configured':'not-configured'},{id:'github',name:'GitHub',status:secretStatus('github')},{id:'revolut-pro',name:'Revolut Pro platby',status:commerce.revolut?.configured||commerce.accounts?.revolut_url?'configured':'not-configured'},{id:'paypal',name:'PayPal platby',status:commerce.paypal?.configured||commerce.accounts?.paypal_url?'configured':'not-configured'}]});
  }
  const settingPlugin=path.match(/^\/api\/assistant\/settings\/plugins\/([a-z0-9-]+)$/);
  if(settingPlugin&&request.method==='POST'){
    requireAdmin(user);
    const plugin=PLUGINS.find(item=>item.id===settingPlugin[1]);if(!plugin)throw new HttpError(404,'Neznámy modul.');const {enabled}=z.object({enabled:z.boolean()}).strict().parse(await readJSON(request));
    if(plugin.required&&!enabled)throw new HttpError(400,'Tento bezpečnostný modul musí zostať zapnutý.');await env.DB.prepare("UPDATE ops_plugins SET enabled=?,updated_at=datetime('now') WHERE id=? AND installed=1").bind(enabled?1:0,plugin.id).run();return json({id:plugin.id,enabled});
  }
  if(path==='/api/assistant/api-keys'){
    requireAdmin(user);
    if(request.method==='GET')return json({items:await listApiKeys(env,ownerId)});
    if(request.method==='POST'){await rateLimit(env,`api-key-create:${user.id}`,5,3600);return json({key:await createApiKey(env,ownerId,await readJSON(request,8000))},201);}
  }
  const revokeKey=path.match(/^\/api\/assistant\/api-keys\/([0-9a-f-]+)\/revoke$/i);
  if(revokeKey&&request.method==='POST'){requireAdmin(user);return json({key:await revokeApiKey(env,ownerId,uuid.parse(revokeKey[1]))});}
  if(path==='/api/assistant/secrets'){
    requireAdmin(user);
    if(request.method==='GET')return json({items:await listSecrets(env,ownerId)});
    if(request.method==='POST'){await rateLimit(env,`secret-store:${user.id}`,10,3600);return json({item:await storeSecret(env,ownerId,await readJSON(request,10000))},201);}
  }
  const secretRoute=path.match(/^\/api\/assistant\/secrets\/([0-9a-f-]+)\/(verify|revoke)$/i);
  if(secretRoute&&request.method==='POST'){requireAdmin(user);const id=uuid.parse(secretRoute[1]);return json({item:secretRoute[2]==='verify'?await verifySecret(env,ownerId,id):await revokeSecret(env,ownerId,id)});}
  const promoteGemini=path.match(/^\/api\/assistant\/secrets\/([0-9a-f-]+)\/promote-gemini$/i);
  if(promoteGemini&&request.method==='POST'){requireAdmin(user);await rateLimit(env,`secret-promote:${user.id}`,5,3600);return json({item:await promoteCustomSecretToGemini(env,ownerId,uuid.parse(promoteGemini[1]))});}
  if(path==='/api/assistant/ai-providers'&&request.method==='GET'){requireAdmin(user);return json(await listAIProviders(env,ownerId));}
  const aiProviderRoute=path.match(/^\/api\/assistant\/ai-providers\/(gemini)$/);
  if(aiProviderRoute&&request.method==='POST'){requireAdmin(user);return json({item:await configureAIProvider(env,ownerId,aiProviderRoute[1],await readJSON(request,8000))});}
  if(path==='/api/assistant/revolut/status'&&request.method==='GET'){requireOwner(user);return json(await revolutProStatus(env));}
  if(path==='/api/assistant/revolut/pro/products'&&request.method==='POST'){
    requireOwner(user);await rateLimit(env,`revolut-pro-config:${user.id}`,10,300);
    return json(await configureRevolutPro(env,ownerId,await readJSON(request,20000)));
  }
  if(path==='/api/assistant/paypal/status'&&request.method==='GET'){requireOwner(user);return json(await paypalStatus(env));}
  if(path==='/api/assistant/paypal/rest-status'&&request.method==='GET'){requireOwner(user);return json(paypalDiagnostics(env));}
  if(path==='/api/assistant/paypal/order/create'&&request.method==='POST'){requireOwner(user);await rateLimit(env,`paypal-order:${user.id}`,20,300);return json(await createPayPalOrder(env,await readJSON(request,10000)),201);}
  if(path==='/api/assistant/paypal/order/capture'&&request.method==='POST'){requireOwner(user);await rateLimit(env,`paypal-capture:${user.id}`,20,300);const b=await readJSON(request,10000);return json(await capturePayPalOrder(env,b.order_id));}
  if(path==='/api/assistant/paypal/products'&&request.method==='POST'){
    requireOwner(user);await rateLimit(env,`paypal-config:${user.id}`,10,300);
    return json(await configurePaypal(env,ownerId,await readJSON(request,20000)));
  }
  if(path==='/api/assistant/commerce/status'&&request.method==='GET'){requireOwner(user);return json(await commerceStatus(env));}
  if(path==='/api/assistant/commerce/accounts'&&request.method==='POST'){
    requireOwner(user);await rateLimit(env,`commerce-accounts:${user.id}`,15,300);
    return json(await configureCommerceAccounts(env,ownerId,await readJSON(request,10000)));
  }
  if(path==='/api/assistant/commerce/products'&&request.method==='POST'){
    requireOwner(user);await rateLimit(env,`commerce-products:${user.id}`,20,300);
    return json(await upsertCommerceProduct(env,ownerId,await readJSON(request,15000)));
  }
  const commerceDeleteRoute=path.match(/^\/api\/assistant\/commerce\/products\/(revolut-pro|paypal)\/([a-z0-9][a-z0-9_-]{0,79})\/delete$/);
  if(commerceDeleteRoute&&request.method==='POST'){
    requireOwner(user);await rateLimit(env,`commerce-delete:${user.id}`,20,300);
    return json(await deleteCommerceProduct(env,ownerId,commerceDeleteRoute[1],commerceDeleteRoute[2]));
  }
  if(path==='/api/assistant/wallet'){
    requireAdmin(user);
    if(request.method==='GET')return json(await getWallet(env,ownerId));
    if(request.method==='POST'){await rateLimit(env,`wallet-sandbox:${user.id}`,30,300);return json(await transactWallet(env,ownerId,await readJSON(request,8000)));}
  }
  if(path==='/api/assistant/wallet/terminal/config'){
    requireAdmin(user);
    if(request.method==='GET')return json(await getWalletTerminalOverview(env,ownerId));
    if(request.method==='POST')return json(await saveWalletTerminalConfig(env,ownerId,await readJSON(request,16000)));
  }
  if(path==='/api/assistant/wallet/terminal/charge'&&request.method==='POST'){
    requireAdmin(user);
    return json(await createPaymentTerminalCharge(env,ownerId,await readJSON(request,16000)));
  }
  if(path==='/api/assistant/wallet/terminal/payout'&&request.method==='POST'){
    requireAdmin(user);
    return json(await executeWalletPayout(env,ownerId,await readJSON(request,16000)));
  }
  const payoutCancelMatch=path.match(/^\/api\/assistant\/wallet\/payout\/([A-Za-z0-9_-]+)\/cancel$/);
  if(payoutCancelMatch&&request.method==='POST'){
    requireAdmin(user);
    return json(await cancelWalletPayout(env,ownerId,payoutCancelMatch[1]));
  }
  if(path==='/api/assistant/wallet/terminal/create-crypto'&&request.method==='POST'){
    requireAdmin(user);
    return json(await createCryptoWallet(env,ownerId));
  }
  if(path==='/api/assistant/dashboard'&&request.method==='GET'){
    const isAdmin=['admin','owner'].includes(user.role);
    const [today,memory,projects,recent,activeJobs,failedToday,pendingUsers,pcBridge]=await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS count FROM ops_jobs WHERE status='completed' AND date(updated_at)=date('now')").first(),
      env.DB.prepare('SELECT (SELECT COUNT(*) FROM ops_memory)+(SELECT COUNT(*) FROM memory_long) AS count').first(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM projects WHERE status IS NULL OR status NOT IN ('archived','deleted')").first(),
      env.DB.prepare("SELECT id,session_id,substr(task,1,120) AS task,status,updated_at FROM ops_jobs WHERE task NOT LIKE 'Kontrolný test%' ORDER BY updated_at DESC LIMIT 6").all(),
      isAdmin?env.DB.prepare("SELECT COUNT(*) AS count FROM ops_jobs WHERE status IN ('queued','running')").first():Promise.resolve({count:0}),
      isAdmin?env.DB.prepare("SELECT COUNT(*) AS count FROM ops_jobs WHERE status='failed' AND date(updated_at)=date('now')").first():Promise.resolve({count:0}),
      isAdmin?env.DB.prepare("SELECT COUNT(*) AS count FROM ops_users WHERE status='pending' AND role='user'").first():Promise.resolve({count:0}),
      getPCBridgeStatus(env)
    ]);
    const services=[env.AI,env.OPENAI_API_KEY,env.DB,env.ARTIFACTS,env.Mastermind,env.OPS_WORKFLOW,env.PC_BRIDGE_SERVICE,env.OLLAMA_SECRET||env.OLLAMA_API_KEY];
    return json({dashboard_mode:isAdmin?'admin':'user',today_completed:today.count||0,memory_count:memory.count||0,project_count:projects.count||0,available_services:services.filter(Boolean).length,total_services:services.length,pc_bridge:pcBridge,recent_jobs:recent.results,
      admin:isAdmin?{active_jobs:activeJobs.count||0,failed_today:failedToday.count||0,pending_users:pendingUsers.count||0,emergency_stop:control.emergency_stop===true}:null});
  }
  if(path==='/api/assistant/projects'&&request.method==='GET'){
    const [projects,tasks]=await Promise.all([env.DB.prepare('SELECT id,name,description,status FROM projects ORDER BY updated_at DESC LIMIT 30').all(),env.DB.prepare('SELECT id,title,status,assigned_agent FROM tasks ORDER BY updated_at DESC LIMIT 50').all()]);
    return json({projects:projects.results,tasks:tasks.results});
  }
  if(path==='/api/assistant/apis'){
    if(request.method==='GET')return json({items:await listApis(env,ownerId)});
    if(request.method==='POST'){requireAdmin(user);await rateLimit(env,`api-create:${user.id}`,20,300);return json({api:await createApi(env,ownerId,await readJSON(request,20000))},201);}
  }
  const apiInvoke=path.match(/^\/api\/assistant\/apis\/([0-9a-f-]+)\/invoke$/i);
  if(apiInvoke&&(request.method==='GET'||request.method==='POST'))return json(await invokeApi(env,ownerId,uuid.parse(apiInvoke[1]),request.method));
  if(path==='/api/assistant/trading/portfolios'){
    if(request.method==='GET')return json({items:await listPortfolios(env,ownerId),paper_only:true});
    if(request.method==='POST'){requireAdmin(user);await rateLimit(env,`portfolio-create:${user.id}`,10,300);return json(await createPortfolio(env,ownerId,await readJSON(request,16000)),201);}
  }
  const portfolioRoute=path.match(/^\/api\/assistant\/trading\/portfolios\/([0-9a-f-]+)(?:\/(trades))?$/i);
  if(portfolioRoute){const id=uuid.parse(portfolioRoute[1]);
    if(request.method==='GET'&&!portfolioRoute[2])return json(await getPortfolio(env,ownerId,id));
    if(request.method==='POST'&&portfolioRoute[2]==='trades'){requireAdmin(user);await rateLimit(env,`paper-trade:${user.id}`,30,300);return json(await recordTrade(env,ownerId,id,await readJSON(request,16000)),201);}
  }
  if(path==='/api/assistant/trading/quotes'&&request.method==='POST'){requireAdmin(user);await rateLimit(env,`paper-quote:${user.id}`,60,300);return json(await setQuote(env,ownerId,await readJSON(request,8000)));}
  if(path==='/api/system/capabilities'&&request.method==='GET'){requireAdmin(user);return json({internal:true,publicly_advertised:false,capabilities:SYSTEM_CAPABILITIES});}
  if(path==='/api/system/actions'){
    requireAdmin(user);
    if(request.method==='GET')return json({items:await listSystemActions(env)});
    if(request.method==='POST'){await rateLimit(env,`system-propose:${user.id}`,20);return json({action:await createSystemAction(env,await readJSON(request,60000),`admin:user:${user.id}`,{adminAuthorized:true})},201);}
  }
  const systemActionRoute=path.match(/^\/api\/system\/actions\/([0-9a-f-]+)(?:\/(approve|reject))?$/i);
  if(systemActionRoute){
    requireAdmin(user);
    const id=uuid.parse(systemActionRoute[1]);
    if(request.method==='GET'&&!systemActionRoute[2]){const action=await getSystemAction(env,id);if(!action)throw new HttpError(404,'Akcia neexistuje.');return json({action});}
    if(request.method==='POST'&&systemActionRoute[2]){
      const input=z.object({confirmation:z.string().uuid()}).strict().parse(await readJSON(request));if(input.confirmation!==id)throw new HttpError(400,'Potvrdenie sa nezhoduje s ID akcie.');
      return json({action:systemActionRoute[2]==='approve'?await approveSystemAction(env,id,`user:${user.id}`):await rejectSystemAction(env,id,`user:${user.id}`)});
    }
  }
  if(path==='/api/assistant/status'&&request.method==='GET')return json({name:'Trinity',version:TRINITY_VERSION,mode:'cloud',model:env.AI_MODEL||'@cf/meta/llama-3.3-70b-instruct',available:true,cloud:true,local_available:!!env.TRINITY_GATEWAY_KEY&&['admin','owner'].includes(user.role),local_model:'qwen3:4b-instruct',pc_bridge:await getPCBridgeStatus(env),copilot_engine:'active',universal_ecosystem:universalEcosystem.getStats(),identity:'single',active_specializations:AGENTS.length,capability_registry:'extensible',personality:'persistent',consciousness:false,languages:'multilingual-auto',planning:{version:'1.1',intents:['conversation','research','build','creative','action','analysis'],approval_for_high_risk:!['admin','owner'].includes(user.role),admin_direct_execution:['admin','owner'].includes(user.role)},decision_pipeline:'understand → authenticate → classify → plan → tools → receipt → response',truth_mode:'evidence-required',truth_policy_version:TRUTH_POLICY_VERSION,memory_location:'Cloudflare D1 · trinity-v03 · ops_memory + memory_long',media:mediaStatus(env),account:{email:user.email||null,role:user.role||'guest'},tools:(await listPlugins(env)).filter(p=>p.enabled).flatMap(p=>p.tools)});
  if(path==='/api/assistant/sessions'&&request.method==='GET')return json(user.role==='guest'?[]:(await env.DB.prepare("SELECT session_id AS session,MIN(task) AS title,MAX(created_at) AS updated_at FROM ops_jobs WHERE task NOT LIKE 'Kontroln" + "ý test%' GROUP BY session_id ORDER BY updated_at DESC LIMIT 30").all()).results);
  if(path==='/api/assistant/history'&&request.method==='GET'){
    if(user.role==='guest')return json([]);
    const id=uuid.parse(url.searchParams.get('session'));
    const rows=(await env.DB.prepare('SELECT task,result,error FROM ops_jobs WHERE session_id=? ORDER BY created_at,rowid LIMIT 50').bind(id).all()).results;
    return json(rows.flatMap(r=>[{role:'user',content:r.task},...(r.result?[{role:'assistant',content:r.result}]:r.error?[{role:'assistant',content:'Úloha zlyhala: '+r.error}]:[])]));
  }
  if(path==='/api/assistant/chat/health'&&request.method==='GET'){
    requireAdmin(user);
    return json(await chatMaintenanceStatus(env));
  }
  if(path==='/api/assistant/chat/maintenance'&&request.method==='POST'){
    requireAdmin(user);
    await rateLimit(env,`chat-maintenance:${user.id}`,2,60);
    if(!env.CHAT_MAINTENANCE)throw new HttpError(503,'Správca chatu nie je pripojený.');
    return json(await env.CHAT_MAINTENANCE.inspect(env.TRINITY_ENV||'production'));
  }
  if(path==='/api/assistant/chat'&&request.method==='POST'){
    await rateLimit(env,`job:${user.id}`,12);
    const d=z.object({message:z.string().min(1).max(12000),session:z.string().uuid(),language:z.string().max(35).default('auto').transform(normalizeLanguage),engine:z.enum(['auto','cloud','fast','openai','gemini','ollama','local','deepseek-r1','llama','qwen','groq','deepseek','anthropic','mistral','openrouter']).default('auto'),remember:z.boolean().optional(),allow_files:z.boolean().optional()}).strict().parse(await readJSON(request));
    if(d.engine==='local')requireAdmin(user);
    const wantsMemory=/^(zapamätaj si|zapamataj si|remember)\s*[:,-]?\s+/i.test(d.message);
    const delegated=shouldDelegate(d.message);
    let provider='workers-ai';
    if(d.engine==='auto'){
      const msg=d.message.toLowerCase();
      if(/\b(pc|počítač|subor na disku|cmd|powershell|c:\\|bridge|lokáln|spusti program)\b/i.test(msg))provider='local';
      else if(/\b(kód|kod|programuj|funkci|debug|refactor|sql|skript|script|chyb|algoritm|matematik|prepočítaj|reasoning)\b/i.test(msg))provider='deepseek-r1';
      else if(/\b(kreatív|báseň|článok|marketing|prezentáci|scenár|píš text|sloh|príbeh)\b/i.test(msg))provider='llama';
      else if(/\b(preklad|čínšt|japon|ázij|viacjazyč|qwen)\b/i.test(msg))provider='qwen';
      else provider=delegated?'workers-ai':'fast';
    }else if(d.engine==='fast')provider='fast';
    else if(d.engine==='local')provider='local';
    else if(d.engine==='ollama')provider='ollama';
    else if(d.engine==='gemini')provider='gemini';
    else if(d.engine==='openai')provider='openai';
    else if(d.engine==='groq')provider='groq';
    else if(d.engine==='deepseek')provider='deepseek';
    else if(d.engine==='anthropic')provider='anthropic';
    else if(d.engine==='mistral')provider='mistral';
    else if(d.engine==='openrouter')provider='openrouter';
    else if(d.engine==='deepseek-r1')provider='deepseek-r1';
    else if(d.engine==='llama')provider='llama';
    else if(d.engine==='qwen')provider='qwen';
    const ownerMode=user.role==='owner';
    return json(await createJob(env,{task:d.message,session_id:d.session,agent:delegated?'auto':'orchestrator',mode:delegated?'team':'single',provider,language:d.language,remember:d.remember||wantsMemory,owner_mode:ownerMode,idempotency_key:crypto.randomUUID()}),202);
  }
  if(path==='/api/copilot/chat'&&request.method==='POST'){
    await rateLimit(env,`copilot:${user.id}`,30,60);
    const d=z.object({message:z.string().min(1).max(12000),session_id:z.string().uuid().optional(),agent:z.string().max(100).optional(),options:copilotChatOptionsSchema.optional()}).strict().parse(await readJSON(request));
    const response=await TrinityCopilotAgent(d.message,env,{...d.options,userId:user.email||user.id,sessionId:d.session_id,agentName:d.agent});
    return json(response);
  }
  if(path==='/api/copilot/plugins'&&request.method==='GET')return json({plugins:copilotPluginRegistry.list()});
  const copilotPluginToggle=path.match(/^\/api\/copilot\/plugins\/([a-z0-9_-]+)\/toggle$/i);
  if(copilotPluginToggle&&request.method==='POST'){
    requireAdmin(user);
    const {enabled}=z.object({enabled:z.boolean()}).strict().parse(await readJSON(request));
    const pId=copilotPluginToggle[1];
    const updated=enabled?copilotPluginRegistry.enable(pId):copilotPluginRegistry.disable(pId);
    return json({id:pId,enabled:updated.enabled});
  }
  if(path==='/api/copilot/skills'&&request.method==='GET')return json({skills:skillRegistry.list()});
  const copilotSkillExec=path.match(/^\/api\/copilot\/skills\/([a-z0-9_-]+)\/execute$/i);
  if(copilotSkillExec&&request.method==='POST'){
    requireAdmin(user);
    await rateLimit(env,`skill-exec:${user.id}`,20,60);
    const body=await readJSON(request);
    assertCopilotSkillEnabled(copilotSkillExec[1]);
    const result=await skillRegistry.execute(copilotSkillExec[1],body?.input??body,env,body?.options||{});
    return json({result});
  }
  if((path==='/api/ecosystem/search'||path==='/api/ecosystem/catalog')&&(request.method==='GET'||request.method==='POST')){
    let q='',type,domain;
    if(request.method==='GET'){
      q=url.searchParams.get('q')||'';
      type=url.searchParams.get('type')||undefined;
      domain=url.searchParams.get('domain')||undefined;
    }else{
      const body=await readJSON(request);
      q=body.query||body.q||'';
      type=body.type||undefined;
      domain=body.domain||undefined;
    }
    return json(universalEcosystem.searchCatalog(q,{type,domain}));
  }
  if(path==='/api/ecosystem/synthesize/skill'&&request.method==='POST'){
    requireAdmin(user);
    await rateLimit(env,`synth-skill:${user.id}`,30,300);
    const d=z.object({name:z.string().min(2).max(100),domain:z.string().default('software-dev')}).parse(await readJSON(request));
    return json(universalEcosystem.synthesizeSkill(d.name,d.domain),201);
  }
  if(path==='/api/ecosystem/synthesize/plugin'&&request.method==='POST'){
    requireAdmin(user);
    await rateLimit(env,`synth-plugin:${user.id}`,30,300);
    const d=z.object({name:z.string().min(2).max(100),domain:z.string().default('software-dev'),skills:z.array(z.string()).default([])}).parse(await readJSON(request));
    return json(universalEcosystem.synthesizePlugin(d.name,d.domain,d.skills),201);
  }
  if(path==='/api/ecosystem/synthesize/app'&&request.method==='POST'){
    requireAdmin(user);
    await rateLimit(env,`synth-app:${user.id}`,30,300);
    const d=z.object({name:z.string().min(2).max(100),domain:z.string().default('software-dev'),type:z.string().default('web-app'),prompt:z.string().optional(),features:z.array(z.string()).optional()}).parse(await readJSON(request));
    return json(universalEcosystem.synthesizeApp(d.name,d.domain,d),201);
  }
  if((path==='/api/ops/self-improvement'||path==='/api/assistant/self-improvement')&&request.method==='GET'){
    requireAdmin(user);
    return json({
      items: await listSelfImprovementProposals(env),
      can_approve: user.role === 'owner',
      capabilities: {
        plugin_installation: true,
        source_inspection: true,
        code_changes: 'GitHub branch + PR + CI; no in-place runtime rewrite',
        github_configured: Boolean(env.TRINITY_GITHUB_TOKEN||env.GITHUB_TOKEN),
        audited_approval: true,
        self_modifying_runtime: true,
        live_ui_evolution: true,
        deployment: 'GitHub Actions: test-gated development deployment; production requires an explicit workflow approval or TRINITY_AUTO_DEPLOY_PRODUCTION=true repository variable.'
      }
    });
  }
  if((path==='/api/ops/self-improvement'||path==='/api/assistant/self-improvement')&&request.method==='POST'){
    requireAdmin(user);
    await rateLimit(env,`self-improvement:${user.id}`,20,300);
    const input=z.object({
      title:z.string().trim().min(3).max(120),
      description:z.string().trim().min(10).max(4000),
      kind:z.enum(['plugin_install','code_improvement','deployment','behavior_rule']),
      plugin_id:z.string().regex(/^[a-z0-9-]{2,80}$/).optional()
    }).strict().parse(await readJSON(request,6000));
    if(input.kind==='plugin_install'&&!PLUGINS.some(p=>p.id===input.plugin_id))throw new HttpError(404,'Modul sa nenašiel v existujúcom katalógu Trinity.');
    return json(await createSelfImprovementProposal(env,input,user.email||user.id),201);
  }
  const selfImprovementRoute=path.match(/^\/api\/(?:ops|assistant)\/self-improvement\/([0-9a-f-]+)\/(approve|apply)$/i);
  if(selfImprovementRoute&&request.method==='POST'){
    const id=uuid.parse(selfImprovementRoute[1]);
    if(selfImprovementRoute[2]==='approve'){
      requireOwner(user);
      z.object({}).strict().parse(await readJSON(request));
      return json(await approveSelfImprovementProposal(env,id,user.email||user.id));
    }
    requireAdmin(user);
    z.object({}).strict().parse(await readJSON(request));
    return json(await applySelfImprovementProposal(env,id,user.email||user.id,async pluginId=>{
      const plugin=PLUGINS.find(p=>p.id===pluginId);
      if(!plugin)throw new HttpError(404,'Modul už nie je dostupný v katalógu Trinity.');
      return await installPlugin(env,plugin.id);
    }));
  }
  if(path==='/api/assistant/ui-evolution'){
    if(request.method==='GET')return json(await getUiEvolutionState(env));
    if(request.method==='POST'){
      requireAdmin(user);
      await rateLimit(env,`ui-evolve:${user.id}`,30,300);
      return json(await applyUiEvolution(env,user.email||user.id,await readJSON(request,30000)));
    }
  }
  if(path==='/api/assistant/documents'){
    if(request.method==='GET'){
      return json(await listTrinityDocuments(env,{
        category:url.searchParams.get('category')||'',
        search:url.searchParams.get('search')||'',
        limit:Number(url.searchParams.get('limit')||60)
      }));
    }
    if(request.method==='POST'){
      requireAdmin(user);
      await rateLimit(env,`doc-create:${user.id}`,30,300);
      return json({item:await createTrinityDocument(env,user.email||user.id,await readJSON(request,50000))},201);
    }
  }
  const docRoute=path.match(/^\/api\/assistant\/documents\/([a-zA-Z0-9_-]+)(?:\/(export|delete))?$/);
  if(docRoute){
    const docId=docRoute[1],sub=docRoute[2];
    if(request.method==='GET'&&!sub){
      const item=await getTrinityDocument(env,docId);
      return json({item});
    }
    if(request.method==='GET'&&sub==='export'){
      const format=url.searchParams.get('format')||'md';
      const item=await getTrinityDocument(env,docId);
      const file=exportTrinityDocument(item,format);
      return new Response(file.body,{headers:{'Content-Type':file.contentType,'Content-Disposition':`attachment; filename="${file.filename}"`,'Cache-Control':'no-store'}});
    }
    if(request.method==='POST'&&sub==='delete'){
      requireAdmin(user);
      return json(await deleteTrinityDocument(env,user.email||user.id,docId));
    }
  }
  if(path==='/api/assistant/brain/run'&&request.method==='POST'){requireAdmin(user);return json(await runBrainCycle(env));}
  if(path==='/api/assistant/evolution/run'&&request.method==='POST'){requireAdmin(user);return json(await runEvolutionCycle(env));}
  const mediaRoute=path.match(/^\/api\/assistant\/media\/images\/([0-9a-f-]+)$/i);
  if(mediaRoute&&request.method==='GET'){
    const id=uuid.parse(mediaRoute[1]);const object=await env.ARTIFACTS.get(`media/images/${id}.jpg`);
    if(!object)throw new HttpError(404,'Obrázok neexistuje.');
    const headers=new Headers();object.writeHttpMetadata(headers);headers.set('Cache-Control','private, max-age=86400');headers.set('Content-Disposition',`inline; filename="trinity-${id}.jpg"`);
    return new Response(object.body,{headers});
  }
  const fileRoute=path.match(/^\/api\/assistant\/files\/([0-9a-f-]+|[a-zA-Z0-9_\-.]+)\/([^/]+)$/i);
  if(fileRoute&&request.method==='GET'){
    const id=fileRoute[1];
    const fname=decodeURIComponent(fileRoute[2]);
    let key=`artifacts/${id}/${fname}`;
    let object=await env.ARTIFACTS.get(key);
    if(!object&&env.DB?.prepare){
      try{
        const row=await env.DB.prepare('SELECT r2_key,content_type FROM ops_artifacts WHERE id=? OR filename=?').bind(id,fname).first();
        if(row&&row.r2_key){
          key=row.r2_key;
          object=await env.ARTIFACTS.get(key);
        }
      }catch{}
    }
    if(!object){
      object=await env.ARTIFACTS.get(`artifacts/${id}`);
      if(!object)object=await env.ARTIFACTS.get(fname);
    }
    if(!object)throw new HttpError(404,`Súbor '${fname}' nebol nájdený v archíve.`);
    const isDownload=url.searchParams.get('download')==='1';
    const headers=new Headers();
    if(typeof object.writeHttpMetadata==='function')object.writeHttpMetadata(headers);
    if(!headers.has('Content-Type')&&object.httpMetadata?.contentType)headers.set('Content-Type',object.httpMetadata.contentType);
    if(!headers.has('Content-Type'))headers.set('Content-Type','application/octet-stream');
    headers.set('Cache-Control','private, max-age=86400');
    headers.set('Content-Disposition',`${isDownload?'attachment':'inline'}; filename="${fname}"`);
    headers.set('X-Content-Type-Options','nosniff');
    return new Response(object.body,{headers});
  }
  if(path==='/api/assistant/artifacts'){
    if(request.method==='GET'){
      return json({items:await listArtifacts(env,{limit:Number(url.searchParams.get('limit')||20),search:url.searchParams.get('search')||''})});
    }
    if(request.method==='POST'){
      const body=await readJSON(request,10_000_000);
      if(body.type==='pdf')return json({item:await createPdfArtifact(env,body)},201);
      return json({item:await createArtifact(env,body)},201);
    }
  }
  if(path==='/api/assistant/memory'){
    if(request.method==='GET')return json((await searchMemory(env,url.searchParams.get('q')||'')).records);
    if(request.method==='POST'){const d=z.object({key:z.string().min(1).max(120),value:z.string().min(1).max(10000)}).strict().parse(await readJSON(request));await env.DB.prepare("INSERT INTO ops_memory(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=datetime('now')").bind(d.key,d.value).run();return json({stored:true});}
  }
  if(path==='/api/assistant/memory/graph'&&request.method==='GET'){
    return json(await getGraphVisualization(env));
  }
  if(path==='/api/assistant/memory/graph/sync'&&request.method==='POST'){
    requireAdmin(user);
    return json(await syncGraphFromEcosystem(env));
  }
  if(path==='/api/assistant/changes'&&request.method==='GET')return json((await getUiEvolutionState(env)).changes);
  const uiChangeRoute=path.match(/^\/api\/assistant\/changes\/([a-zA-Z0-9_-]+)\/(approve|rollback)$/);
  if(uiChangeRoute&&request.method==='POST'){
    requireAdmin(user);
    return json(await handleUiChangeAction(env,user.email||user.id,uiChangeRoute[1],uiChangeRoute[2]));
  }
  if(path==='/api/assistant/commodities/overview'&&request.method==='GET'){
    return json(await getCommodityDeskOverview(env,user,{strategy:url.searchParams.get('strategy')||'balanced'}));
  }
  if(path==='/api/assistant/commodities/banks'){
    if(request.method==='GET')return json(await listBankConnections(env,user));
    if(request.method==='POST'){
      requireAdmin(user);
      await rateLimit(env,`commodity-banks:${user.id}`,20);
      return json(await configureBankConnection(env,user,await readJSON(request)),201);
    }
  }
  const bankDeleteRoute=path.match(/^\/api\/assistant\/commodities\/banks\/([a-zA-Z0-9_-]+)\/delete$/);
  if(bankDeleteRoute&&request.method==='POST'){
    requireAdmin(user);
    return json(await deleteBankConnection(env,user,bankDeleteRoute[1]));
  }
  if(path==='/api/assistant/commodities/sync-live'&&request.method==='POST'){
    requireAdmin(user);
    await rateLimit(env,`commodity-sync:${user.id}`,20);
    return json(await syncLiveMarketFeeds(env,user));
  }
  if(path==='/api/assistant/commodities/analyze'){
    if(request.method==='GET'){
      return json(await analyzeCommodities(env,user,{
        symbol:url.searchParams.get('symbol')||'',
        sector:url.searchParams.get('sector')||'all',
        strategy:url.searchParams.get('strategy')||'balanced',
        record_document:url.searchParams.get('record')==='1'
      }));
    }
    if(request.method==='POST'){
      return json(await analyzeCommodities(env,user,await readJSON(request)));
    }
  }
  if(path==='/api/assistant/commodities/trade'&&request.method==='POST'){
    requireAdmin(user);
    await rateLimit(env,`commodity-trade:${user.id}`,30);
    return json(await executeCommodityTrade(env,user,await readJSON(request)),201);
  }
  if(path==='/api/assistant/commodities/auto-invest'&&request.method==='POST'){
    requireAdmin(user);
    await rateLimit(env,`commodity-autoinvest:${user.id}`,15);
    return json(await runAutonomousCommodityDesk(env,user,await readJSON(request)));
  }
  if(path==='/api/assistant/commodities/chart'&&request.method==='GET'){
    return json(await getCommodityChart(env,url.searchParams.get('symbol')||'XAU-EUR',url.searchParams.get('timeframe')||'1D'));
  }
  if(path==='/api/assistant/commodities/alerts'&&request.method==='GET'){
    return json(await listPriceAlerts(env));
  }
  if(path==='/api/assistant/commodities/alerts'&&request.method==='POST'){
    requireAdmin(user);
    const body=await readJSON(request,10000);
    return json(await createPriceAlert(env,user.email||user.id,body),201);
  }
  if(path==='/api/assistant/commodities/alerts/check'&&request.method==='POST'){
    requireAdmin(user);
    return json(await checkPriceAlerts(env,{notify:true}));
  }
  if(path==='/api/assistant/wallet/invoices'&&request.method==='GET'){
    return json(await listGeneratedInvoices(env));
  }
  if(path==='/api/assistant/wallet/invoices'&&request.method==='POST'){
    requireAdmin(user);
    const body=await readJSON(request,10000);
    return json(await generateInvoiceWithSepaQr(env,user.email||user.id,body),201);
  }
  if(path==='/api/assistant/wallet/net-worth'&&request.method==='GET'){
    return json(await getAggregatedNetWorth(env,user.email||user.id));
  }
    if(path==='/api/assistant/sandbox/agents'){
    requireAdmin(user);
    if(request.method==='GET')return json(await listCustomAgents(env,ownerId));
    if(request.method==='POST')return json(await createOrUpdateCustomAgent(env,ownerId,await readJSON(request,32000)));
  }
  if(path==='/api/assistant/sandbox/agents/run'&&request.method==='POST'){
    requireAdmin(user);
    return json(await executeCustomAgent(env,ownerId,await readJSON(request,32000)));
  }
  if(path==='/api/assistant/sandbox/domain/provision'&&request.method==='POST'){
    requireAdmin(user);
    return json(await provisionAgentDomain(env,ownerId,await readJSON(request,16000)));
  }
  if(path==='/api/assistant/devhub/status'&&request.method==='GET'){
    requireAdmin(user);
    return json(await getDevHubStatus(env));
  }
  if(path==='/api/assistant/devhub/execute'&&request.method==='POST'){
    requireAdmin(user);
    return json(await executeDevHubCommand(env,ownerId,await readJSON(request,16000)));
  }
  if(path==='/api/assistant/integrations/status'&&request.method==='GET'){
    return json({items:await listAllIntegrations(env)});
  }
  if(path==='/api/assistant/integrations/cloudflare'&&request.method==='POST'){
    requireAdmin(user);
    const body=await readJSON(request,10000);
    return json(await manageCloudflare(env,user.email||user.id,body.action||'status',body));
  }
  if(path==='/api/assistant/integrations/github'&&request.method==='POST'){
    requireAdmin(user);
    const body=await readJSON(request,25000);
    return json(await manageGitHub(env,user.email||user.id,body.action||'status',body));
  }
  if(path==='/api/assistant/integrations/firecrawl'&&request.method==='POST'){
    await rateLimit(env,`firecrawl:${user.id}`,20,300);
    const body=await readJSON(request,10000);
    return json(await scrapeWithFirecrawl(env,user.email||user.id,body));
  }
  if(path==='/api/assistant/integrations/firebase'&&request.method==='POST'){
    requireAdmin(user);
    const body=await readJSON(request,50000);
    return json(await manageFirebase(env,user.email||user.id,body.action||'status',body));
  }
  if(path==='/api/modules/catalog'&&request.method==='GET'){
    return json({modules:FREE_MODULES_CATALOG});
  }
  if(path==='/api/modules/weather'&&request.method==='GET'){
    const q=url.searchParams.get('q')||url.searchParams.get('location')||'Bratislava';
    return json(await fetchWeather(q));
  }
  if(path==='/api/modules/wikipedia'&&request.method==='GET'){
    const q=url.searchParams.get('q')||'Trinity';
    const lang=url.searchParams.get('lang')||'sk';
    return json(await fetchWikipedia(q,{lang}));
  }
  if(path==='/api/modules/dns'&&request.method==='GET'){
    const domain=url.searchParams.get('domain')||'auru.space';
    const type=url.searchParams.get('type')||'A';
    return json(await resolveDns(domain,type));
  }
  if(path==='/api/modules/crypto'&&request.method==='GET'){
    const coinsParam=url.searchParams.get('coins');
    const coins=coinsParam?coinsParam.split(','):['bitcoin','ethereum','solana'];
    return json(await fetchCryptoMarkets(coins));
  }
  if(path==='/api/modules/tech-news'&&request.method==='GET'){
    const limit=parseInt(url.searchParams.get('limit')||'10',10);
    return json(await fetchTechNews(limit));
  }
  if(path==='/api/modules/macro'&&request.method==='GET'){
    const country=url.searchParams.get('country')||'SVK';
    const indicator=url.searchParams.get('indicator')||'NY.GDP.MKTP.CD';
    return json(await fetchWorldBankIndicator(country,indicator));
  }
  if(path==='/api/ops/login-ticket'&&request.method==='POST'){
    await rateLimit(env,`ticket:${user.id}`,6);
    const ticket=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
    await env.DB.prepare('INSERT INTO ops_login_tickets(token_hash,expires_at,email) VALUES(?,?,?)').bind(await hash(ticket),Date.now()+120000,user.email||null).run();
    await env.DB.prepare('DELETE FROM ops_login_tickets WHERE expires_at<?').bind(Date.now()).run();
    return json({ticket,expires_in:120});
  }
  if(path==='/mcp'){
    if(!await pluginEnabled(env,'mcp'))throw new HttpError(503,'MCP rozšírenie je vypnuté.');
    await rateLimit(env,`mcp:${user.id}`,60);
    if(request.method==='POST'){
      const body=await readJSON(request);
      if(body.method==='tools/call'&&['dispatch_task','create_daily_plan'].includes(body.params?.name))await rateLimit(env,`job:${user.id}`,12);
      request=new Request(request.url,{method:'POST',headers:request.headers,body:JSON.stringify(body)});
    }
    return handleMcp(request,env,ctx,{projectControl:['admin','owner'].includes(user.role)});
  }
  if(path==='/api/ops/status'&&request.method==='GET'){
    const counts=await env.DB.prepare('SELECT status,COUNT(*) AS count FROM ops_jobs GROUP BY status').all();
    return json({name:'Trinity',version:TRINITY_VERSION,agents:AGENTS.length,identity:'single',account:{email:user.email||null,role:user.role||'guest'},control,consciousness:false,truth_mode:'evidence-required',truth_policy_version:TRUTH_POLICY_VERSION,jobs:counts.results,
      development_access_until:env.TRINITY_DEV_UNTIL||null,
      providers:{'workers-ai':env.AI?'configured':'missing',openai:env.OPENAI_API_KEY?'configured':'missing',gemini:(await listAIProviders(env,ownerId)).items.find(item=>item.id==='gemini')?.enabled?'configured':'missing',ollama:env.OLLAMA_SECRET||env.OLLAMA_API_KEY?'configured':'missing'},
      trinity_2:{multimodal:!!env.AI,voice:!!env.AI,granular_rbac:true,visual_workflows:true,incident_monitoring:true,audit_export:true,global_worker_runtime:true},
      copilot:{engine:'active',plugins:copilotPluginRegistry.list().length,skills:skillRegistry.list().length,ecosystem:universalEcosystem.getStats()},
      memory:await env.DB.prepare('SELECT (SELECT COUNT(*) FROM ops_memory) AS notes,(SELECT COUNT(*) FROM memory_long) AS legacy,(SELECT COUNT(*) FROM ops_jobs) AS conversations').first(),
      pc_bridge:await getPCBridgeStatus(env),
      storage:{database:!!env.DB,cache:!!env.Mastermind,artifacts:!!env.ARTIFACTS,workflow:!!env.OPS_WORKFLOW}});
  }
  if(path==='/api/ops/agents'&&request.method==='GET'){
    const stats=await env.DB.prepare("SELECT agent_id,COUNT(*) AS runs,SUM(status='completed') AS completed,MAX(updated_at) AS last_run FROM ops_steps GROUP BY agent_id").all();
    return json(AGENTS.map(a=>({...a,...stats.results.find(s=>s.agent_id===a.id)})));
  }
  if(path==='/api/ops/catalog'&&request.method==='GET'){
    const plugins=await listPlugins(env);
    return json({plugins,skills:SKILLS,counts:{plugins:plugins.length,installed_plugins:plugins.filter(p=>p.installed).length,enabled_plugins:plugins.filter(p=>p.enabled).length,skills:SKILLS.length},can_manage:['admin','owner'].includes(user.role)});
  }
  if(path==='/api/ops/plugins'&&request.method==='GET')return json(await listPlugins(env));
  if(path==='/api/ops/plugins/install-all'&&request.method==='POST'){
    requireAdmin(user);
    return json(await installAllPlugins(env),201);
  }
  const pluginRoute=path.match(/^\/api\/ops\/plugins\/([a-z0-9-]+)(?:\/(test|install))?$/);
  if(pluginRoute&&request.method==='POST'){
    requireAdmin(user);
    const plugin=PLUGINS.find(p=>p.id===pluginRoute[1]);if(!plugin)throw new HttpError(404,'Neznáme rozšírenie.');
    if(pluginRoute[2]==='install')return json(await installPlugin(env,plugin.id),201);
    if(!pluginRoute[2]){
      const {enabled}=z.object({enabled:z.boolean()}).strict().parse(await readJSON(request));
      if(plugin.required&&!enabled)throw new HttpError(400,`${plugin.name} je povinná súčasť jadra Trinity.`);
      await env.DB.prepare("UPDATE ops_plugins SET enabled=?,updated_at=datetime('now') WHERE id=? AND installed=1").bind(enabled?1:0,plugin.id).run();
      return json({id:plugin.id,enabled});
    }
    await rateLimit(env,`plugin-test:${user.id}`,12);
    if(!await pluginEnabled(env,plugin.id))throw new HttpError(400,'Najprv zapni rozšírenie.');
    const cases={memory:['search_memory',{query:'trinity'}],projects:['project_snapshot',{}],monitor:['service_status',{binding:'CORE'}],web:['web_search',{query:'Cloudflare Workers official documentation'}],calculator:['calculate',{operation:'multiply',values:[6,7]}],text:['analyze_text',{text:'Trinity má spoločnú pamäť.'}],clock:['current_time',{timezone:'Europe/Bratislava'}],capabilities:['list_capabilities',{}]};
    let summary,details;
    if(cases[plugin.id]){const [tool,args]=cases[plugin.id];const result=await runTool(env,{tools:plugin.tools},tool,args);summary=plugin.id==='memory'?`${result.records.length} nájdených záznamov`:plugin.id==='projects'?`${result.projects.length} projektov, ${result.tasks.length} úloh`:plugin.id==='web'?`${result.results.length} webových výsledkov`:JSON.stringify(result);}
    if(plugin.id==='images'){const result=await runTool(env,{id:'plugin-check',tools:plugin.tools},'generate_image',{prompt:'Minimalistická žiarivá hviezda Trinity na tmavomodrom pozadí, bez textu'});details={id:result.id,url:result.url,model:result.model};summary=`Obrázok ${result.id} bol skutočne vytvorený a uložený.`;}
    if(plugin.id==='artifacts'){const key='plugin-checks/archive.txt',value='Trinity archive verification';await env.ARTIFACTS.put(key,value);const object=await env.ARTIFACTS.get(key);if(!object||await object.text()!==value)throw new HttpError(502,'Overenie archívu zlyhalo.');summary='Zápis aj čítanie R2 prešli.';}
    if(plugin.id==='mcp'){
      const check=await handleMcp(new Request(url.origin+'/mcp',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'trinity-plugin-check',version:'1'}}})}),env,ctx);
      if(check.status!==200||!(await check.text()).includes('serverInfo'))throw new HttpError(502,'MCP handshake zlyhal.');summary='MCP initialize handshake prešiel.';
    }
    if(plugin.id==='truth')summary=`Truth policy ${TRUTH_POLICY_VERSION} je aktívna; tvrdenia o externých akciách vyžadujú potvrdenie nástroja.`;
    if(!summary)summary=`Balík je nainštalovaný a jeho jadrový nástroj ${plugin.tools?.[0]||'katalóg'} je registrovaný.`;
    await env.DB.prepare("INSERT INTO ops_events(action,details) VALUES('plugin_verified',?)").bind(JSON.stringify({plugin:plugin.id,summary})).run();
    return json({status:'verified',plugin:plugin.id,summary,details});
  }
  if(path==='/api/ops/services'&&request.method==='GET')return json(await serviceStatus(env));
  if(path==='/api/ops/providers/test'&&request.method==='POST'){
    await rateLimit(env,`provider:${user.id}`,4);
    const {provider}=z.object({provider:z.enum(['workers-ai','openai','gemini','ollama','local','groq','deepseek','anthropic','mistral','openrouter'])}).parse(await readJSON(request));
    const started=Date.now();
    try{const response=await callModel(env,provider,[{role:'user',content:'Odpovedz iba: TRINITY_OK'}],256);const check=await recordAIProviderCheck(env,ownerId,{status:'verified',provider,model:response.model,latency_ms:Date.now()-started});return json({...check,response:response.text});}
    catch(e){const check=await recordAIProviderCheck(env,ownerId,{status:'failed',provider,error:e.message,latency_ms:Date.now()-started});return json(check,502);}
  }
  if(path==='/api/ops/jobs'){
    if(request.method==='POST'){await rateLimit(env,`job:${user.id}`,12);return json(await createJob(env,{...await readJSON(request),owner_mode:user.role==='owner'}),202);}
    if(request.method==='GET')return json((await env.DB.prepare('SELECT id,session_id,task,team,status,error,created_at,updated_at FROM ops_jobs ORDER BY created_at DESC,rowid DESC LIMIT 50').all()).results);
  }
  const jobRoute=path.match(/^\/api\/ops\/jobs\/([^/]+)(?:\/(artifact|cancel))?$/);
  if(jobRoute){
    const id=uuid.parse(jobRoute[1]);
    if(jobRoute[2]==='cancel'&&request.method==='POST'){
      const job=await getJob(env,id);
      if(['completed','failed','cancelled'].includes(job.status))return json({status:job.status});
      await (await env.OPS_WORKFLOW.get(id)).terminate();
      await env.DB.prepare("UPDATE ops_jobs SET status='cancelled',updated_at=datetime('now') WHERE id=? AND status<>'completed'").bind(id).run();
      await env.DB.prepare("UPDATE ops_steps SET status='cancelled',updated_at=datetime('now') WHERE job_id=? AND status IN ('pending','running')").bind(id).run();
      return json({status:'cancelled'});
    }
    if(request.method==='GET'){
      const job=await getJob(env,id);
      if(jobRoute[2]==='artifact'){
        if(!job.artifact_key)throw new HttpError(404,'Výstup ešte nie je pripravený.');
        const object=await env.ARTIFACTS.get(job.artifact_key);if(!object)throw new HttpError(404,'Súbor chýba.');
        return new Response(object.body,{headers:{'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':`attachment; filename="trinity-${id}.md"`}});
      }return json(job);
    }
  }
  if(path==='/api/ops/memory'){
    if(request.method==='GET')return json(await searchMemory(env,z.string().max(200).parse(url.searchParams.get('q')||'')));
    if(request.method==='POST'){
      const {key,value}=z.object({key:z.string().min(1).max(120),value:z.string().min(1).max(10000)}).strict().parse(await readJSON(request));
      await env.DB.prepare("INSERT INTO ops_memory(key,value,source) VALUES(?,?,'user') ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=datetime('now')").bind(key,value).run();
      return json({stored:true,key});
    }
  }
  if(path==='/api/ops/events'&&request.method==='GET')return json((await env.DB.prepare('SELECT * FROM ops_events ORDER BY id DESC LIMIT 50').all()).results);
  // Keep existing read-only project views available behind the same authentication.
  const legacyReads={'/api/workspace/projects':'projects','/api/workspace/tasks':'tasks','/api/memory/notes':'notes'};
  if(request.method==='GET'&&legacyReads[path]){
    // Table names come exclusively from this hardcoded allowlist, never user input.
    return json({items:(await env.DB.prepare(`SELECT * FROM ${legacyReads[path]} LIMIT 100`).all()).results});
  }
  throw new HttpError(404,'Táto cesta neexistuje.');
}
export default {
  async fetch(request,env,ctx){
    try{env=await resolveRuntimeSecrets(env);return secure(await route(request,env,ctx));}
    catch(e){const status=e instanceof z.ZodError?400:e.status||500;
      if(status===500)console.error(JSON.stringify({event:'request_failed',path:new URL(request.url).pathname}));
      return secure(json({error:status===500?'Interná chyba. Pozri záznamy služby.':e instanceof z.ZodError?'Neplatné údaje požiadavky.':e.message},status));}
  },
  async scheduled(controller,env,ctx){if(isBuildOnlyPreview(env))return;env=await resolveRuntimeSecrets(env);ctx.waitUntil((async()=>{const summary=await runScheduledHealth(env,controller.cron);await recordHealthIncident(env,summary);await runBrainCycle(env);await runEvolutionCycle(env);await scanForImprovements(env);})());},
  async email(message,env){if(isBuildOnlyPreview(env)){message.setReject('Build-only Preview does not accept email.');return;}await handleInboundEmail(message,env);}
};

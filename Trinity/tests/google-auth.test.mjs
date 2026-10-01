import {test} from 'node:test';
import assert from 'node:assert/strict';
import {googleAuthRequired,googleOAuthConfigured,isGoogleAdminEmail,verifyGoogleIdToken} from '../src/google-auth.js';
import {authenticate,hash} from '../src/security.js';

const encode=value=>btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value)))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
let signingKeys;
async function setupKeys(){
  if(signingKeys)return signingKeys;
  const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);jwk.kid='trinity-test-key';jwk.alg='RS256';jwk.use='sig';
  signingKeys={pair,jwk};return signingKeys;
}
async function signClaims(claims){
  const {pair}=await setupKeys(),head=encode({alg:'RS256',kid:'trinity-test-key',typ:'JWT'}),body=encode(claims),data=`${head}.${body}`;
  const signature=await crypto.subtle.sign({name:'RSASSA-PKCS1-v1_5'},pair.privateKey,new TextEncoder().encode(data));
  return `${data}.${btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')}`;
}
function validClaims(overrides={}){const now=Math.floor(Date.now()/1000);return {iss:'https://accounts.google.com',aud:'trinity-test-client',sub:'google-subject',email:'SaboIvan2008@gmail.com',email_verified:true,name:'Sabo Ivan',nonce:'single-use-nonce',iat:now,exp:now+300,...overrides};}

test('Google OAuth stays off without client configuration',()=>{
  assert.equal(googleAuthRequired({}),false);
  assert.equal(googleOAuthConfigured({TRINITY_ADMIN_EMAILS:'owner@example.com',GOOGLE_CLIENT_ID:'id',GOOGLE_CLIENT_SECRET:'secret',GOOGLE_REDIRECT_URI:'http://example.com/callback'}),false);
  assert.equal(googleOAuthConfigured({TRINITY_ADMIN_EMAILS:'owner@example.com',GOOGLE_CLIENT_ID:'id',GOOGLE_CLIENT_SECRET:'secret',GOOGLE_REDIRECT_URI:'https://trinity.example/api/auth/google/callback'}),true);
  assert.equal(googleAuthRequired({TRINITY_AUTH_MODE:'google'}),true);
});

test('admin email allowlist is normalized and exact',()=>{
  const env={TRINITY_ADMIN_EMAILS:' SaboIvan2008@gmail.com, usc31@auru.space , uscolective@gmail.com,delirium.trade12@gmail.com '};
  assert.equal(isGoogleAdminEmail(env,'saboivan2008@gmail.com'),true);
  assert.equal(isGoogleAdminEmail(env,'SABOIVAN2008@GMAIL.COM'),true);
  assert.equal(isGoogleAdminEmail(env,'not-saboivan2008@gmail.com'),false);
});

test('Google ID token requires valid RSA signature, audience, nonce, issuer and verified email',async()=>{
  const keys=await setupKeys(),getKeys=async()=>[keys.jwk],token=await signClaims(validClaims());
  const identity=await verifyGoogleIdToken(token,{clientId:'trinity-test-client',nonce:'single-use-nonce'},getKeys);
  assert.deepEqual(identity,{email:'saboivan2008@gmail.com',sub:'google-subject',name:'Sabo Ivan'});
  await assert.rejects(verifyGoogleIdToken(await signClaims(validClaims({aud:'other-client'})),{clientId:'trinity-test-client',nonce:'single-use-nonce'},getKeys),{status:401});
  await assert.rejects(verifyGoogleIdToken(await signClaims(validClaims({nonce:'wrong'})),{clientId:'trinity-test-client',nonce:'single-use-nonce'},getKeys),{status:401});
  await assert.rejects(verifyGoogleIdToken(await signClaims(validClaims({email_verified:false})),{clientId:'trinity-test-client',nonce:'single-use-nonce'},getKeys),{status:401});
  const parts=token.split('.');parts[1]=encode(validClaims({email:'attacker@example.com'}));
  await assert.rejects(verifyGoogleIdToken(parts.join('.'),{clientId:'trinity-test-client',nonce:'single-use-nonce'},getKeys),{status:401});
});

test('Google-only sessions require an active profile and carry its server-side role',async()=>{
  const session='a'.repeat(64),digest=await hash(session);
  const envFor=(status,role)=>({TRINITY_AUTH_MODE:'google',TRINITY_OPS_KEY:'legacy-key-must-not-authenticate',DB:{prepare:sql=>({bind:value=>({first:async()=>sql.includes('ops_sessions s')&&value===digest?{expires_at:Date.now()+60_000,email:'saboivan2008@gmail.com',role,status}:null})})}});
  const request=new Request('https://trinity.test/api/private',{headers:{Cookie:`trinity_session=${session}`}});
  assert.deepEqual(await authenticate(request,envFor('active','admin')),{id:digest.slice(0,24),email:'saboivan2008@gmail.com',role:'admin'});
  await assert.rejects(authenticate(request,envFor('pending','user')),{status:401});
  await assert.rejects(authenticate(new Request('https://trinity.test/api/private',{headers:{Authorization:'Bearer legacy-key-must-not-authenticate'}}),envFor('active','admin')),{status:401});
});

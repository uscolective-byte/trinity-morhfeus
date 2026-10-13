function adminEmails(env){return new Set((env.TRINITY_ADMIN_EMAILS||'').split(',').map(email=>email.trim().toLowerCase()).filter(Boolean));}
export function isGoogleAdminEmail(env,email){return adminEmails(env).has(String(email||'').trim().toLowerCase());}
export function googleOAuthConfigured(env){
  if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!env.GOOGLE_REDIRECT_URI||adminEmails(env).size===0)return false;
  try{const url=new URL(env.GOOGLE_REDIRECT_URI);return url.protocol==='https:'||url.hostname==='localhost'||url.hostname==='127.0.0.1';}catch{return false;}
}
export const googleAuthRequired=env=>env.TRINITY_AUTH_MODE==='google';
export const googleAuthEnforced=env=>googleAuthRequired(env)&&googleOAuthConfigured(env);

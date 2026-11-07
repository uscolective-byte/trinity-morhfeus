import {loadEnvFile} from 'node:process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';

// Only trusted local configuration is loaded. Existing process variables win.
export async function loadAgentEnvironment() {
  if (process.env.TRINITY123_LOAD_ENV === '0') return;
  const rootEnv = 'C:\\Users\\saboi\\.env';
  if (existsSync(rootEnv)) {
    try { loadEnvFile(rootEnv); } catch {}
  }
  const file = fileURLToPath(new URL('../../.env', import.meta.url));
  if (existsSync(file)) {
    try { loadEnvFile(file); }
    catch { throw new Error('Lokálny .env súbor agenta sa nepodarilo načítať.'); }
  }
  if (process.env.TRINITY_LOCAL_TOKEN || process.platform !== 'win32') return;
  const protectedFile = fileURLToPath(new URL('../../.credentials/local-token.dpapi', import.meta.url));
  if (!existsSync(protectedFile)) return;
  const script = '$ErrorActionPreference="Stop"; $s=ConvertTo-SecureString ([IO.File]::ReadAllText($env:TRINITY123_TOKEN_FILE).Trim()); $p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try {[Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($p))} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p); $s.Dispose()}';
  const childEnv = {...process.env, TRINITY123_TOKEN_FILE: protectedFile};
  // Windows PowerShell cannot autoload its security module from inherited PS7 paths.
  for (const key of Object.keys(childEnv)) if (key.toLowerCase() === 'psmodulepath') delete childEnv[key];
  // The protected token stays inside trusted child/parent memory. It is never logged.
  const token = await new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
      {windowsHide: true, timeout: 15_000, maxBuffer: 16_000,
        env: childEnv},
      (error, stdout) => error ? reject(new Error('Chránený lokálny token sa nepodarilo odomknúť cez Windows DPAPI.')) : resolve(stdout.trim()));
  });
  if (token) process.env.TRINITY_LOCAL_TOKEN = token;
}

await loadAgentEnvironment();

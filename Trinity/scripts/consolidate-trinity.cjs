'use strict';
// Local file consolidation only. No network, token decryption, deployment or execution of project code.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
function hashFile(file) {
  const digest = crypto.createHash('sha256'), buffer = Buffer.allocUnsafe(1024 * 1024);
  const fd = fs.openSync(file,'r');
  try {
    let count;
    while ((count = fs.readSync(fd,buffer,0,buffer.length,null)) > 0) digest.update(buffer.subarray(0,count));
    return digest.digest('hex');
  } finally { fs.closeSync(fd); }
}
const skippedDirs = new Set(['.git','node_modules','.wrangler','.venv','venv','__pycache__',
  '.next','.turbo','.cache','cache','models','logs','backups','data']);
function privateFile(rel) {
  const name = path.basename(rel).toLowerCase();
  if (name.endsWith('.dpapi')) return false; // Copy encrypted bytes, never decrypt.
  return /(^|[\\/])\.credentials([\\/]|$)/i.test(rel) ||
    /^(\.env($|\.)|\.dev\.vars($|\.))/.test(name) ||
    /^(credentials|secrets|tokens|auth)\.json$|^(\.npmrc|\.pypirc|\.netrc|id_rsa|id_ed25519)$/.test(name) ||
    /\.(pem|key|pfx|p12|kdbx|sqlite|sqlite3|db)(-(wal|shm))?$/.test(name) ||
    /(secret|credential|token|private[-_]?key).*\.(json|txt|yaml|yml|toml|ini|xml)$/.test(name);
}
function contained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}
function safeDestination(root, target) {
  if (!contained(root, target)) throw Error('Unsafe destination.');
  for (let p = target; p !== root; p = path.dirname(p)) {
    if (fs.existsSync(p) && fs.lstatSync(p).isSymbolicLink()) throw Error('Destination link.');
    if (p !== target && fs.existsSync(p) && !fs.statSync(p).isDirectory()) throw Error('Destination parent is a file.');
  }
}
function relocateText(text, source, target) {
  const variants = [
    [source.replace(/\\/g,'\\\\'), target.replace(/\\/g,'\\\\')],
    [source.replace(/\\/g,'/'), target.replace(/\\/g,'/')],
    [source,target]
  ].filter(([a,b],i,all) => a !== b && all.findIndex(([x]) => x === a) === i)
    .sort((a,b) => b[0].length - a[0].length);
  const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  let changed = text;
  for (const [oldRoot,newRoot] of variants)
    changed = changed.replace(new RegExp(escape(oldRoot) + '(?=[\\\\/"\\s\'<>]|$)','gi'), () => newRoot);
  return changed;
}
function walk(root, skip, visit) {
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    for (const item of fs.readdirSync(dir, {withFileTypes: true})) {
      const file = path.join(dir, item.name);
      const rel = path.relative(root, file);
      const stat = fs.lstatSync(file);
      if (stat.isSymbolicLink()) { skip(rel, 'link'); continue; }
      if (stat.isDirectory()) {
        if (skippedDirs.has(item.name.toLowerCase())) skip(rel, 'runtime');
        else stack.push(file);
      } else if (stat.isFile()) {
        if (privateFile(rel)) skip(rel, 'private');
        else visit(file, rel);
      }
    }
  }
}
function consolidate({source, target, reports, apply = false}) {
  source = fs.realpathSync(source); target = fs.realpathSync(target);
  if (contained(source, target) || contained(target, source)) throw Error('Roots must be separate.');
  for (const root of [source, target]) {
    for (const marker of ['.git', 'Trinity/package.json', 'Local-Gateway/start.ps1'])
      if (!fs.existsSync(path.join(root, marker))) throw Error('Missing project marker: ' + marker);
  }
  const packageName = root => JSON.parse(fs.readFileSync(path.join(root,'Trinity/package.json'),'utf8').replace(/^\uFEFF/, '')).name;
  if (!packageName(source) || packageName(source) !== packageName(target)) throw Error('Different application names.');
  const id = new Date().toISOString().replace(/[:.]/g,'-') + '-' + crypto.randomUUID();
  const runRoot = path.join(reports, id);
  if (contained(source, runRoot) || contained(target, runRoot)) throw Error('Backup must be outside the project.');
  fs.mkdirSync(runRoot, {recursive: true});
  const out = {mode: apply ? 'APPLY' : 'PREVIEW', source, target, copied: 0, identical: 0,
    targetVersionsKept: [], skipped: [], errors: [], pathsUpdated: [], launchers: [], sourceRetained: true};
  const skip = (file, kind) => out.skipped.push({file, kind});
  walk(source, skip, (file, rel) => {
    let temp;
    try {
      const dest = path.join(target,rel); safeDestination(target,dest);
      const inputHash = hashFile(file);
      if (fs.existsSync(dest)) {
        if (fs.statSync(dest).isFile() && inputHash === hashFile(dest)) out.identical++;
        else out.targetVersionsKept.push(rel);
        return;
      }
      if (!apply) { out.copied++; return; }
      fs.mkdirSync(path.dirname(dest), {recursive: true});
      temp = dest + '.trinity-' + crypto.randomUUID() + '.tmp';
      fs.copyFileSync(file,temp,fs.constants.COPYFILE_EXCL);
      if (hashFile(temp) !== inputHash || hashFile(file) !== inputHash)
        throw Error('Source changed.');
      // Exclusive copy refuses to replace a concurrently created destination.
      fs.copyFileSync(temp,dest,fs.constants.COPYFILE_EXCL);
      if (hashFile(dest) !== inputHash) throw Error('Copy verification failed.');
      out.copied++;
    } catch (_) { out.errors.push({file:rel,operation:'copy'}); }
    finally { if (temp && fs.existsSync(temp)) fs.unlinkSync(temp); }
  });
  if (out.errors.length) {
    out.report = path.join(runRoot,'report.json');
    fs.writeFileSync(out.report, JSON.stringify(out,null,2), {flag:'wx'});
    return out; // No path changes after an incomplete copy.
  }
  // Change exact old-root references only, preserving all other text and settings.
  walk(target, () => {}, (file,rel) => {
    if (!/\.(ps1|cmd|bat|json|jsonc|toml|yaml|yml|ini|config|js|ts|mjs|cjs)$/i.test(rel)) return;
    try {
      if (fs.statSync(file).size > 2_000_000) return;
      const before = fs.readFileSync(file);
      // Support UTF-8 and BOM-marked Windows UTF-16LE. Leave unknown/binary encodings alone.
      const utf16 = before[0] === 0xff && before[1] === 0xfe;
      const enc = utf16 ? 'utf16le' : 'utf8';
      const text = before.toString(enc);
      if (!utf16 && (text.includes('\0') || !Buffer.from(text,'utf8').equals(before))) return;
      const changed = relocateText(text,source,target);
      if (changed === text) return;
      const next = Buffer.from(changed,enc);
      if (apply) {
        safeDestination(target,file);
        const backup = path.join(runRoot,'before',rel);
        fs.mkdirSync(path.dirname(backup),{recursive:true});
        fs.writeFileSync(backup,before,{flag:'wx'});
        if (hash(fs.readFileSync(backup)) !== hash(before) || hash(fs.readFileSync(file)) !== hash(before))
          throw Error('Concurrent change.');
        const temp = file + '.trinity-' + crypto.randomUUID() + '.tmp';
        try {
          fs.writeFileSync(temp,next,{flag:'wx'});
          if (hash(fs.readFileSync(file)) !== hash(before)) throw Error('Concurrent change.');
          fs.renameSync(temp,file);
          if (hash(fs.readFileSync(file)) !== hash(next)) throw Error('Path verification failed.');
        } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
      }
      out.pathsUpdated.push(rel);
    } catch (_) { out.errors.push({file:rel,operation:'path-update'}); }
  });
  // Separate named launchers; no existing launcher is overwritten and nothing starts automatically.
  if (apply && !out.errors.length) {
    const launchers = [
      ['Start-Trinity-OneDrive.cmd','@echo off\r\ncd /d "%~dp0Trinity"\r\ncall npx --no-install wrangler dev --local --ip 127.0.0.1\r\npause\r\n'],
      ['Start-Gateway-OneDrive.cmd','@echo off\r\ncd /d "%~dp0Local-Gateway"\r\npowershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File "%~dp0Local-Gateway\\start.ps1"\r\npause\r\n']
    ];
    for (const [name,body] of launchers) {
      const file = path.join(target,name); safeDestination(target,file);
      if (fs.existsSync(file)) { out.launchers.push({name,state:'existing-preserved'}); continue; }
      fs.writeFileSync(file,body,{flag:'wx'}); out.launchers.push({name,state:'created'});
    }
  }
  out.report = path.join(runRoot,'report.json');
  fs.writeFileSync(out.report,JSON.stringify(out,null,2),{flag:'wx'});
  return out;
}
module.exports = {consolidate,relocateText};
if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    const result = consolidate({source:args[0],target:args[1],reports:args[2],apply:args[3] === '--apply'});
    console.log(JSON.stringify({mode:result.mode,copied:result.copied,identical:result.identical,
      targetVersionsKept:result.targetVersionsKept.length,first20Differences:result.targetVersionsKept.slice(0,20),
      skipped:result.skipped.length,pathsUpdated:result.pathsUpdated.length,errors:result.errors,
      launchers:result.launchers,report:result.report,sourceRetained:true},null,2));
    if (result.errors.length) process.exitCode = 1;
  } catch (_) {
    console.error('Kontrola zlyhala. Nic sa nemaze; over cesty, opravnenia a znacky projektu.');
    process.exitCode = 1;
  }
}
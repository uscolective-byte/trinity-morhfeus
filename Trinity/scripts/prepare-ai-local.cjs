'use strict';
// Prepare local development only. No deployment, package install, authentication or AI inference.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const HEADER = '// Trinity local development: only Workers AI remote. DO NOT DEPLOY this configuration.\n';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function parseJSONC(input) {
  const text = input.replace(/^\uFEFF/, '');
  let cleaned = '', quoted = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (quoted) {
      cleaned += c;
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') {
      quoted = true; cleaned += c;
    } else if (c === '/' && next === '/') {
      cleaned += ' '; i += 2;
      while (i < text.length && text[i] !== '\n') i++;
      if (i < text.length) cleaned += '\n';
    } else if (c === '/' && next === '*') {
      cleaned += ' '; i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      if (i >= text.length) throw Error('Unterminated JSONC comment.');
      i++;
    } else cleaned += c;
  }
  let strict = '';
  quoted = false; escaped = false;
  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (quoted) {
      strict += c;
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') {
      quoted = true; strict += c;
    } else if (c === ',') {
      let j = i + 1;
      while (/\s/.test(cleaned[j] || '') && j < cleaned.length) j++;
      if (cleaned[j] !== '}' && cleaned[j] !== ']') strict += c;
    } else strict += c;
  }
  return JSON.parse(strict);
}

const GROUPS = ['d1_databases','kv_namespaces','r2_buckets','services','durable_objects',
  'workflows','queues','vectorize','hyperdrive','browser','images','dispatch_namespaces',
  'analytics_engine_datasets','mtls_certificates','secrets_store_secrets','pipelines','unsafe'];

function existingRemoteOff(value) {
  if (!value || typeof value !== 'object') return;
  if (Object.hasOwn(value, 'remote')) value.remote = false;
  for (const child of Object.values(value)) existingRemoteOff(child);
}

function prepareConfig(base) {
  if (!base || Array.isArray(base) || base.name !== 'trinity' || base.ai?.binding !== 'AI')
    throw Error('Expected trinity Worker and AI binding. No original configuration changed.');
  const config = structuredClone(base);
  function scope(value) {
    if (Object.keys(value.vars || {}).some(k => /(?:^|_)(?:KEY|TOKEN|SECRET|PASSWORD)(?:_|$)/i.test(k)))
      throw Error('Inline secret-like vars found. Refusing to copy them into another configuration.');
    const unsafe = value.unsafe?.bindings || [];
    if (unsafe.some(b => b.type === 'secret_text' || b.type === 'secret_key'))
      throw Error('Inline unsafe secret binding found. No configuration copied.');
    for (const key of GROUPS) existingRemoteOff(value[key]);
    if (value.ai) value.ai.remote = true;
    for (const env of Object.values(value.env || {})) scope(env);
  }
  scope(config);
  return config;
}

function noLink(root, file) {
  const rel = path.relative(root, file);
  if (rel.startsWith('..' + path.sep) || rel === '..' || path.isAbsolute(rel)) throw Error('Outside project.');
  for (let p = file; p !== root; p = path.dirname(p))
    if (fs.existsSync(p) && fs.lstatSync(p).isSymbolicLink()) throw Error('Linked path refused.');
}

function writeExclusive(file, bytes) {
  fs.mkdirSync(path.dirname(file), {recursive:true});
  fs.writeFileSync(file, bytes, {flag:'wx'});
}

function prepare(projectRoot, backupRoot) {
  projectRoot = fs.realpathSync(projectRoot);
  const app = path.join(projectRoot,'Trinity');
  const original = path.join(app,'wrangler.jsonc');
  const output = path.join(app,'wrangler.ai-local.jsonc');
  noLink(projectRoot,original); noLink(projectRoot,output);
  const before = fs.readFileSync(original);
  const cfg = prepareConfig(parseJSONC(before.toString('utf8')));
  const body = HEADER + JSON.stringify(cfg,null,2) + '\n';
  const id = crypto.randomUUID();
  const run = path.join(backupRoot,id);
  const relativeBackup = path.relative(projectRoot,run);
  if (relativeBackup === '' || (!relativeBackup.startsWith('..' + path.sep) &&
      relativeBackup !== '..' && !path.isAbsolute(relativeBackup))) throw Error('Backup must be outside project.');
  let configBackup = null, launcherBackup = null;
  if (fs.existsSync(output)) {
    const old = fs.readFileSync(output);
    if (!old.toString('utf8').startsWith(HEADER))
      throw Error('Development config already exists and is not owned by this helper. Nothing overwritten.');
    if (old.toString('utf8') !== body) {
      configBackup = path.join(run,'wrangler.ai-local.jsonc');
      writeExclusive(configBackup,old);
      if (hash(fs.readFileSync(output)) !== hash(old)) throw Error('Development config changed concurrently.');
      fs.writeFileSync(output,body);
    }
  } else writeExclusive(output,body);
  if (hash(fs.readFileSync(original)) !== hash(before)) throw Error('Original config changed concurrently.');
  if (fs.readFileSync(output,'utf8') !== body) throw Error('Development config verification failed.');

  const oldLauncher = '@echo off\r\ncd /d "%~dp0Trinity"\r\ncall npx --no-install wrangler dev --local --ip 127.0.0.1\r\npause\r\n';
  const newLauncher = '@echo off\r\ncd /d "%~dp0Trinity"\r\ncall npx --no-install wrangler dev --config wrangler.ai-local.jsonc --ip 127.0.0.1\r\npause\r\n';
  const launch = path.join(projectRoot,'Start-Trinity-AI-OneDrive.cmd');
  const primary = path.join(projectRoot,'Start-Trinity-OneDrive.cmd');
  noLink(projectRoot,launch); noLink(projectRoot,primary);
  if (fs.existsSync(launch)) {
    if (fs.readFileSync(launch,'utf8').replace(/\r\n/g,'\n') !== newLauncher.replace(/\r\n/g,'\n'))
      throw Error('AI launcher already has other edits. Existing launcher preserved.');
  } else writeExclusive(launch,newLauncher);
  let primaryUpdated = false;
  if (fs.existsSync(primary)) {
    const previous = fs.readFileSync(primary);
    const normalized = previous.toString('utf8').replace(/\r\n/g,'\n');
    if (normalized === oldLauncher.replace(/\r\n/g,'\n')) {
      launcherBackup = path.join(run,'Start-Trinity-OneDrive.cmd');
      writeExclusive(launcherBackup,previous);
      if (hash(fs.readFileSync(primary)) !== hash(previous)) throw Error('Launcher changed concurrently.');
      fs.writeFileSync(primary,newLauncher);
      primaryUpdated = true;
    }
  }
  return {ai:{binding:'AI',remote:true},otherExistingRemoteFlagsDisabled:true,
    originalConfigUnchanged:hash(fs.readFileSync(original)) === hash(before),
    developmentConfig:output,launcher:launch,primaryLauncherUpdated:primaryUpdated,
    configBackup,launcherBackup,deployed:false,inferenceRequested:false};
}

module.exports = {parseJSONC,prepareConfig,prepare};
if (require.main === module) {
  try { console.log(JSON.stringify(prepare(process.argv[2],process.argv[3]),null,2)); }
  catch (error) {
    console.error('AI_LOCAL_PREPARE_STOPPED: '+error.message);
    process.exitCode = 1;
  }
}
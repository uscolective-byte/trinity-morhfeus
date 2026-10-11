import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import helper from '../scripts/consolidate-trinity.cjs';
const {consolidate,relocateText} = helper;
function setup() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(),'trinity-merge-'));
  const source = path.join(tmp,'old'), target = path.join(tmp,'new'), reports = path.join(tmp,'reports');
  function write(root,rel,contents) { const file = path.join(root,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,contents); }
  for (const root of [source,target]) {
    fs.mkdirSync(path.join(root,'.git'),{recursive:true});
    write(root,'Trinity/package.json','{"name":"trinity-operational-center"}');
    write(root,'Local-Gateway/start.ps1','Write-Host OK');
  }
  return {tmp,source,target,reports,write};
}
test('exclusive merge retains destination edits, old tree and sensitive/local state', () => {
  const x = setup();
  try {
    x.write(x.source,'Trinity/new.js','new');x.write(x.source,'Trinity/edit.js','old');x.write(x.target,'Trinity/edit.js','mine');
    x.write(x.source,'Trinity/.env.local','SECRET');x.write(x.source,'Trinity/.wrangler/state/db.sqlite','LOCALDB');
    x.write(x.source,'node_modules/package/index.js','DEP');x.write(x.source,'.git/HEAD','old-head');
    x.write(x.target,'.git/HEAD','new-head');x.write(x.source,'Local-Gateway/.credentials/local-token.dpapi','ENCRYPTED');
    const r = consolidate({...x,apply:true});
    assert.equal(r.errors.length,0);assert.equal(fs.readFileSync(path.join(x.target,'Trinity/edit.js'),'utf8'),'mine');
    assert.equal(fs.readFileSync(path.join(x.target,'.git/HEAD'),'utf8'),'new-head');
    assert.equal(fs.existsSync(path.join(x.target,'Trinity/.env.local')),false);
    assert.equal(fs.existsSync(path.join(x.target,'Trinity/.wrangler')),false);
    assert.equal(fs.existsSync(path.join(x.target,'node_modules')),false);
    assert.equal(fs.readFileSync(path.join(x.target,'Local-Gateway/.credentials/local-token.dpapi'),'utf8'),'ENCRYPTED');
    assert.equal(fs.readFileSync(path.join(x.source,'Trinity/edit.js'),'utf8'),'old');
    assert.ok(r.targetVersionsKept.includes('Trinity/edit.js'));
  } finally { fs.rmSync(x.tmp,{recursive:true,force:true}); }
});
test('path edits have exact backup, preserve other settings and leave secrets alone', () => {
  const x = setup();
  try {
    const before = JSON.stringify({workspace:x.source+'/Trinity',permission:'admin-only',other:x.source+'-other'});
    x.write(x.target,'.vscode/settings.json',before);x.write(x.target,'Trinity/.env.local','PATH='+x.source);
    const r = consolidate({...x,apply:true});
    const j = JSON.parse(fs.readFileSync(path.join(x.target,'.vscode/settings.json'),'utf8'));
    assert.equal(j.workspace,x.target+'/Trinity');assert.equal(j.permission,'admin-only');
    assert.equal(j.other,x.source+'-other');
    assert.equal(fs.readFileSync(path.join(x.target,'Trinity/.env.local'),'utf8'),'PATH='+x.source);
    assert.equal(fs.readFileSync(path.join(path.dirname(r.report),'before/.vscode/settings.json'),'utf8'),before);
  } finally { fs.rmSync(x.tmp,{recursive:true,force:true}); }
});
test('preview has no project mutations; repeated apply preserves launchers', () => {
  const x = setup();
  try {
    x.write(x.source,'Trinity/new.js','x');
    consolidate({...x});assert.equal(fs.existsSync(path.join(x.target,'Trinity/new.js')),false);
    consolidate({...x,apply:true});x.write(x.target,'Start-Trinity-OneDrive.cmd','USER EDIT');
    const r=consolidate({...x,apply:true});assert.equal(r.errors.length,0);
    assert.equal(fs.readFileSync(path.join(x.target,'Start-Trinity-OneDrive.cmd'),'utf8'),'USER EDIT');
  } finally { fs.rmSync(x.tmp,{recursive:true,force:true}); }
});
test('destination links never write outside project; copy failures prevent path updates', () => {
  const x = setup();
  try {
    const outside=path.join(x.tmp,'outside');fs.mkdirSync(outside);
    fs.symlinkSync(outside,path.join(x.target,'Referencie'),'dir');
    x.write(x.source,'Referencie/file.txt','x');x.write(x.target,'config.json',JSON.stringify({root:x.source}));
    const r=consolidate({...x,apply:true});
    assert.equal(r.errors.length,1);assert.equal(fs.existsSync(path.join(outside,'file.txt')),false);
    assert.equal(JSON.parse(fs.readFileSync(path.join(x.target,'config.json'),'utf8')).root,x.source);
  } finally { fs.rmSync(x.tmp,{recursive:true,force:true}); }
});
test('binary encodings unchanged, UTF16LE BOM preserved, overlapping roots rejected', () => {
  const x = setup();
  try {
    const content='\ufeff$root="'+x.source+'"';
    x.write(x.target,'launch.ps1',Buffer.from(content,'utf16le'));
    x.write(x.target,'binary.config',Buffer.from([0x81,0x00,0xfe]));
    const r=consolidate({...x,apply:true});
    assert.equal(r.errors.length,0);
    assert.equal(fs.readFileSync(path.join(x.target,'launch.ps1')).toString('utf16le'),'\ufeff$root="'+x.target+'"');
    assert.deepEqual(fs.readFileSync(path.join(x.target,'binary.config')),Buffer.from([0x81,0x00,0xfe]));
    assert.throws(()=>consolidate({source:x.source,target:x.source,reports:x.reports,apply:true}));
  } finally { fs.rmSync(x.tmp,{recursive:true,force:true}); }
});
test('Windows paths relocate once, keeping JSON valid and application child intact', () => {
  const old = 'C:\\Users\\developer\\Projects\\Morhfeus';
  const dest = 'C:\\Users\\developer\\OneDrive\\trinity';
  const json = JSON.stringify({app:old+'\\Trinity',unrelated:old+'-archive'});
  assert.deepEqual(JSON.parse(relocateText(json,old,dest)),
    {app:dest+'\\Trinity',unrelated:old+'-archive'});
  assert.equal(relocateText('$root="'+old.toLowerCase()+'\\Local-Gateway"',old,dest),
    '$root="'+dest+'\\Local-Gateway"');
  assert.equal(relocateText(old.replace(/\\/g,'/')+'/Trinity',old,dest),
    dest.replace(/\\/g,'/')+'/Trinity');
});
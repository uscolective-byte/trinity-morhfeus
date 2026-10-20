import {execFile} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export class WindowsVault{
  constructor(dataDir){this.dataDir=dataDir;}
  async call(operation,name,value){
    if(!/^[a-z][a-z0-9-]{0,50}$/.test(name))throw new Error('Neplatné meno poverenia.');
    if(process.platform!=='win32'){if(operation==='get')return '';throw new Error('Trvalé poverenia vyžadujú Windows DPAPI.');}
    // Secret input travels via stdin, never a command-line argument.
    return new Promise((resolve,reject)=>{
      const child=execFile('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',fileURLToPath(new URL('../scripts/vault.ps1',import.meta.url))],{windowsHide:true,timeout:15000,maxBuffer:64000},(error,stdout)=>{
        if(error)return reject(new Error('Windows úložisko poverení zlyhalo.'));
        try{resolve(JSON.parse(stdout).value||'');}catch{reject(new Error('Úložisko poverení nevrátilo platnú odpoveď.'));}
      });child.stdin.end(JSON.stringify({operation,name,value,directory:path.resolve(this.dataDir,'credentials')}));
    });
  }
  get(name){return this.call('get',name);}
  set(name,value){if(typeof value!=='string'||value.length>12000)throw new Error('Neplatné poverenie.');return this.call('set',name,value);}
}

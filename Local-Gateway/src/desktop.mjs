/**
 * @module TRINITY_OMNI_CORE
 * @subsystem LOCAL_BRIDGE_GATEWAY
 * @author Basterix (Root Architect)
 * @license Sovereign Irrevocable Covenant
 * @description Modul desktop.mjs (Local-Gateway/src/desktop.mjs) v ekosystéme TRINITY OMNI-CORE.
 */
import {spawn} from 'node:child_process';

const APPS=Object.freeze({
  notepad:{command:'notepad.exe',processes:['Notepad']},
  calculator:{command:'calc.exe',processes:['CalculatorApp','ApplicationFrameHost'],titles:['Calculator','Kalkulačka','Kalkula']},
  paint:{command:'mspaint.exe',processes:['mspaint']},
  explorer:{command:'explorer.exe',processes:['explorer']},
  chrome:{command:'chrome.exe',processes:['chrome']},
  edge:{command:'msedge.exe',processes:['msedge']},
  whatsapp:{command:'whatsapp.exe',protocol:'whatsapp:',processes:['WhatsApp','WhatsApp.Root'],titles:['WhatsApp']},
  vscode:{command:'code.cmd',fallback:'code.exe',processes:['Code'],titles:['Visual Studio Code']},
  terminal:{command:'wt.exe',fallback:'powershell.exe',processes:['WindowsTerminal','powershell','pwsh'],titles:['Windows PowerShell','PowerShell','Terminal']},
  browser:{command:'chrome.exe',fallback:'msedge.exe',processes:['chrome','msedge'],titles:['Google Chrome','Microsoft Edge']},
  cmder:{command:'cmd.exe',fallback:'powershell.exe',processes:['cmd','powershell','WindowsTerminal'],titles:['Command Prompt','Príkazový riadok','Windows PowerShell','Terminal']},
  commander:{command:'cmd.exe',fallback:'powershell.exe',processes:['cmd','powershell','WindowsTerminal'],titles:['Command Prompt','Príkazový riadok','Windows PowerShell','Terminal']}
});
const OPERATIONS=new Set(['list','launch','focus','type','screenshot']);

function ps(script,timeoutMs=15_000){
  return new Promise((resolve,reject)=>{
    const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-STA','-Command','-'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    let stdout='',stderr='',settled=false;
    const timer=setTimeout(()=>{child.kill();if(!settled){settled=true;reject(new Error('Desktop operácia prekročila časový limit.'));}},timeoutMs);
    child.stdout.on('data',chunk=>{stdout=(stdout+chunk.toString('utf8')).slice(-128_000);});
    child.stderr.on('data',chunk=>{stderr=(stderr+chunk.toString('utf8')).slice(-32_000);});
    child.on('error',error=>{clearTimeout(timer);if(!settled){settled=true;reject(error);}});
    child.on('close',code=>{clearTimeout(timer);if(settled)return;settled=true;if(code!==0)reject(new Error(stderr.trim()||`Desktop operácia skončila kódom ${code}.`));else resolve(stdout.trim());});
    child.stdin.end(`$OutputEncoding=[Console]::OutputEncoding=[Text.UTF8Encoding]::new();${script}`);
  });
}

export function validateDesktopRequest(payload={}){
  if(payload.task!=='desktop-control')throw new Error('Neplatná desktop úloha.');
  if(!OPERATIONS.has(payload.operation))throw new Error('Desktop operácia nie je povolená.');
  if(payload.operation!=='list'&&payload.operation!=='screenshot'&&!APPS[payload.app])throw new Error('Aplikácia nie je v povolenom zozname.');
  if(payload.operation==='type'){
    if(payload.app!=='notepad')throw new Error('Písanie je zatiaľ povolené iba v Poznámkovom bloku.');
    if(typeof payload.text!=='string'||!payload.text.length||Buffer.byteLength(payload.text)>10_000)throw new Error('Text chýba alebo je príliš veľký.');
  }
  return {operation:payload.operation,app:payload.app||null,text:payload.text||null};
}

export async function listDesktopWindows(){
  const output=await ps("Get-Process | Where-Object {$_.MainWindowHandle -ne 0} | Select-Object Id,ProcessName,MainWindowTitle | ConvertTo-Json -Compress");
  if(!output)return [];
  const parsed=JSON.parse(output);return (Array.isArray(parsed)?parsed:[parsed]).map(item=>({pid:item.Id,process:item.ProcessName,title:item.MainWindowTitle}));
}

function matchesWindow(spec,item){
  const processMatch=spec.processes.some(name=>name.toLowerCase()===item.process.toLowerCase());
  if(!processMatch)return false;
  if(!spec.titles)return true;
  return spec.titles.some(title=>item.title?.toLocaleLowerCase().includes(title.toLocaleLowerCase()));
}

async function focusApp(app){
  const spec=APPS[app],windows=await listDesktopWindows(),target=windows.find(item=>matchesWindow(spec,item));
  if(!target)throw new Error('Povolená aplikácia nemá otvorené okno.');
  const focused=await ps(`$w=New-Object -ComObject WScript.Shell; if($w.AppActivate(${target.pid})){'true'}else{'false'}`);
  if(focused!=='true')throw new Error('Okno sa nepodarilo aktivovať.');return target;
}

export async function captureScreenshot(){
  const script=`
Add-Type -AssemblyName System.Windows.Forms;
Add-Type -AssemblyName System.Drawing;
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds;
$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height;
$graphics = [System.Drawing.Graphics]::FromImage($bitmap);
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size);
$ms = New-Object System.IO.MemoryStream;
$bitmap.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png);
$graphics.Dispose();
$bitmap.Dispose();
[Convert]::ToBase64String($ms.ToArray())
`;
  const base64=await ps(script,20_000);
  return {
    format:'png',
    bytes:Math.round((base64.length*3)/4),
    data_url:`data:image/png;base64,${base64}`
  };
}

export async function executeDesktop(payload){
  const request=validateDesktopRequest(payload);
  if(request.operation==='list')return {operation:'list',windows:await listDesktopWindows()};
  if(request.operation==='screenshot')return {operation:'screenshot',...await captureScreenshot()};
  if(request.operation==='launch'){
    const spec=APPS[request.app];
    if(spec.protocol){
      const child=spawn('cmd.exe',['/c','start','',spec.protocol],{detached:true,stdio:'ignore',windowsHide:true});
      child.on('error', () => {});
      child.unref();
    } else {
      let primaryFailed = false;
      const tryFallback = () => {
        if (spec.fallback && !primaryFailed) {
          primaryFailed = true;
          try {
            const fallbackChild = spawn(spec.fallback, [], { detached: true, stdio: 'ignore', windowsHide: false });
            fallbackChild.on('error', () => {});
            fallbackChild.unref();
          } catch {}
        }
      };
      try{
        const child = spawn(spec.command, [], { detached: true, stdio: 'ignore', windowsHide: false });
        child.on('error', () => {
          tryFallback();
        });
        child.unref();
      }catch{
        tryFallback();
      }
    }
    await new Promise(resolve=>setTimeout(resolve,1500));
    const windows=await listDesktopWindows(),opened=windows.find(item=>matchesWindow(spec,item));
    if(!opened){
      // Check process name in case window title/handle hasn't settled yet
      const procsList=spec.processes.map(p=>`'${p}'`).join(',');
      const procOutput=await ps(`Get-Process | Where-Object {@(${procsList}) -contains $_.ProcessName} | Select-Object Id,ProcessName | ConvertTo-Json -Compress`);
      if(procOutput){
        try{
          const procs=JSON.parse(procOutput);
          const p=Array.isArray(procs)?procs[procs.length - 1]:procs;
          if(p?.Id)return {operation:'launch',app:request.app,opened:true,window:{pid:p.Id,process:p.ProcessName,title:spec.titles?.[0]||request.app}};
        }catch{}
      }
      throw new Error('Aplikácia sa spustila, ale jej okno sa nepodarilo potvrdiť.');
    }
    return {operation:'launch',app:request.app,opened:true,window:{pid:opened.pid,process:opened.process,title:opened.title||spec.titles?.[0]||request.app}};
  }
  const window=await focusApp(request.app);
  if(request.operation==='focus')return {operation:'focus',app:request.app,focused:true,window};
  const encoded=Buffer.from(request.text,'utf8').toString('base64');
  await ps(`Add-Type -AssemblyName System.Windows.Forms; $old=Get-Clipboard -Raw -ErrorAction SilentlyContinue; try{$text=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')); Set-Clipboard -Value $text; Start-Sleep -Milliseconds 150; [Windows.Forms.SendKeys]::SendWait('^v'); Start-Sleep -Milliseconds 150} finally {if($null -ne $old){Set-Clipboard -Value $old}else{Set-Clipboard -Value ''}}`);
  return {operation:'type',app:request.app,focused:true,window,characters:request.text.length};
}

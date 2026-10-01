import {spawn} from 'node:child_process';

const APPS=Object.freeze({
  notepad:{command:'notepad.exe',processes:['Notepad']},
  calculator:{command:'calc.exe',processes:['CalculatorApp','ApplicationFrameHost'],titles:['Calculator','Kalkulačka','Kalkula']},
  paint:{command:'mspaint.exe',processes:['mspaint']},
  explorer:{command:'explorer.exe',processes:['explorer']}
});
const OPERATIONS=new Set(['list','launch','focus','type']);

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
  if(payload.operation!=='list'&&!APPS[payload.app])throw new Error('Aplikácia nie je v povolenom zozname.');
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

export async function executeDesktop(payload){
  const request=validateDesktopRequest(payload);
  if(request.operation==='list')return {operation:'list',windows:await listDesktopWindows()};
  if(request.operation==='launch'){
    const spec=APPS[request.app],child=spawn(spec.command,[],{detached:true,stdio:'ignore',windowsHide:false});child.unref();
    await new Promise(resolve=>setTimeout(resolve,1200));
    const windows=await listDesktopWindows(),opened=windows.find(item=>matchesWindow(spec,item));
    if(!opened)throw new Error('Aplikácia sa spustila, ale jej okno sa nepodarilo potvrdiť.');
    return {operation:'launch',app:request.app,opened:true,window:opened};
  }
  const window=await focusApp(request.app);
  if(request.operation==='focus')return {operation:'focus',app:request.app,focused:true,window};
  const encoded=Buffer.from(request.text,'utf8').toString('base64');
  await ps(`Add-Type -AssemblyName System.Windows.Forms; $old=Get-Clipboard -Raw -ErrorAction SilentlyContinue; try{$text=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')); Set-Clipboard -Value $text; Start-Sleep -Milliseconds 150; [Windows.Forms.SendKeys]::SendWait('^v'); Start-Sleep -Milliseconds 150} finally {if($null -ne $old){Set-Clipboard -Value $old}else{Set-Clipboard -Value ''}}`);
  return {operation:'type',app:request.app,focused:true,window,characters:request.text.length};
}

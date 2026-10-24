import path from 'node:path';
import fs from 'node:fs';

// npm.cmd cannot be spawned with shell:false on Windows. Invoke npm's JS
// entrypoint with Node, preserving argument boundaries and shell isolation.
export function processCommand(command,args,platform=process.platform,execPath=process.execPath){
  if(command==='npm'&&platform==='win32'){
    const defaultNpm = path.win32.join(path.win32.dirname(execPath),'node_modules','npm','bin','npm-cli.js');
    let npmCli = defaultNpm;
    if(!fs.existsSync(npmCli)){
      if(process.env.npm_execpath && fs.existsSync(process.env.npm_execpath)){
        npmCli = process.env.npm_execpath;
      } else {
        const systemNpm = 'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js';
        if(fs.existsSync(systemNpm)){
          npmCli = systemNpm;
        }
      }
    }
    return {
      command:execPath,args:[npmCli,...args]
    };
  }
  return {command,args};
}

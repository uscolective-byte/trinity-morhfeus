import {App} from '@modelcontextprotocol/ext-apps';
const app=new App({name:'Trinity Control',version:'1.0.0'},{});
const output=document.getElementById('output');
function show(result){output.textContent=(result.content||[]).filter(x=>x.type==='text').map(x=>{try{return JSON.stringify(JSON.parse(x.text),null,2);}catch{return x.text;}}).join('\n');}
app.ontoolresult=show;
for(const button of document.querySelectorAll('[data-tool]'))button.onclick=async()=>{button.disabled=true;try{show(await app.callServerTool({name:button.dataset.tool,arguments:{}}));}catch(error){output.textContent=error.message;}finally{button.disabled=false;}};
try{await app.connect();}catch{output.textContent='Panel otvor v klientovi s podporou MCP Apps. Textový stav zostáva dostupný cez trinity_control_panel.';}

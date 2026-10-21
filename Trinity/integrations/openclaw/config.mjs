export function normalizePhone(input){
 let value=String(input||'').trim().replace(/[\s()-]/g,'');
 if(value.startsWith('00'))value='+'+value.slice(2);
 if(value.startsWith('+4210'))value='+421'+value.slice(5);
 if(/^0[0-9]{9}$/.test(value))value='+421'+value.slice(1);
 if(!/^\+[1-9][0-9]{7,14}$/.test(value))throw new Error('Zadaj úplné telefónne číslo s predvoľbou.');
 if(value.startsWith('+421')&&!/^\+421[1-9][0-9]{8}$/.test(value))throw new Error('Slovenské číslo musí mať deväť číslic za +421.');
 return value;
}
export function openClawMcpServer(origin='https://auru.space'){
 if(!['https://auru.space','https://auru.dev'].includes(origin))throw new Error('Nepovolená adresa Trinity.');
 return {url:origin+'/mcp',transport:'streamable-http',headers:{Authorization:'Bearer ${TRINITY_MCP_TOKEN}'},requestTimeoutMs:30000,connectionTimeoutMs:10000,toolFilter:{include:['trinity_status','get_capability_status','infrastructure_status','dispatch_task','get_task']}};
}
export function whatsappPolicy(phone){
 return {dmPolicy:'allowlist',allowFrom:[normalizePhone(phone)],groupPolicy:'disabled',selfChatMode:true};
}

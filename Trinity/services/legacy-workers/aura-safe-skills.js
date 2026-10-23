// Narrow, read-only public skills for Aura workers.
// Do not import the global skillRegistry: it includes privileged domain, execution and payment adapters.
import {integrationReadiness} from '../../src/integration-readiness.js';

const permitted=new Map([
  ['semverCheck', {
    name:'semverCheck',
    category:'validation',
    handler(input) {
      const raw=typeof input==='string'?input:input&&typeof input==='object'?(input.version||input.ver||''):'';
      if(typeof raw!=='string'||raw.length>120)throw Object.assign(new Error('Invalid version'),{status:400});
      const match=/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/.exec(raw.trim());
      if(!match)return {valid:false,error:'Invalid SemVer'};
      const [major,minor,patch]=match.slice(1,4).map(Number);
      return {valid:true,major,minor,patch,prerelease:match[4]||null,build:match[5]||null,is_stable:major>=1};
    }
  }],
  ['integrationReadiness', {name:'integrationReadiness',category:'diagnostics',handler(_input,env){return integrationReadiness({},env);}}]
]);

export function listAuraSafeSkills(){return [...permitted.values()].map(({name,category})=>({name,type:'builtin',category}));}

export async function executeAuraSafeSkill(name,input,env){
  if(typeof name!=='string'||!permitted.has(name))throw Object.assign(new Error('Aura skill is not allowed'),{status:403});
  return permitted.get(name).handler(input,env);
}

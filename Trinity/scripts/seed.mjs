import {AGENTS} from '../src/registry.js';
import {writeFileSync} from 'node:fs';
const q=s=>"'"+s.replaceAll("'","''")+"'";
writeFileSync('migrations/0002_registry.sql',AGENTS.map(a=>`INSERT INTO ops_agents(id,name,cluster,role,tools) VALUES(${[a.id,a.name,a.cluster,a.role,JSON.stringify(a.tools)].map(q).join(',')}) ON CONFLICT(id) DO UPDATE SET name=excluded.name,cluster=excluded.cluster,role=excluded.role,tools=excluded.tools;`).join('\n')+'\n');

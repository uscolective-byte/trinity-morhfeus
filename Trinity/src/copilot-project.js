import {z} from 'zod';
import {HttpError} from './security.js';
import {createSystemAction,getSystemAction} from './system-actions.js';

const sourcePath=z.string().max(300).regex(/^Trinity\/(src|public|tests)\/[A-Za-z0-9_./-]+\.(js|mjs|html|css|txt)$/)
  .refine(p=>!p.split('/').some(s=>s==='.'||s==='..'||!s),'Invalid project path');
const edit=z.object({operation:z.literal('edit'),path:sourcePath,content:z.string().min(1).max(100000),rationale:z.string().min(10).max(800)}).strict();
const check=z.object({operation:z.enum(['build','test']),rationale:z.string().min(10).max(800)}).strict();
export function projectAction(input){
  const data=z.union([edit,check]).parse(input);
  if(data.operation==='edit')return {action:'selfwrite',payload:{path:data.path,content:data.content},rationale:data.rationale};
  return {action:'run',payload:{command:data.operation==='build'?'npm run build':'npm test',cwd:'Trinity',allowNonZero:false},rationale:data.rationale};
}
export async function proposeCopilotProjectAction(env,client,input){
  if(env.COPILOT_PROJECT_CONTROL!=='development')throw new HttpError(503,'Copilot project editing is disabled');
  const action=await createSystemAction(env,projectAction(input),`copilot:${client.id}`);
  return {id:action.id,status:action.status,approval_required:action.status==='proposed',completed:false};
}
export async function readCopilotProjectAction(env,client,id){
  if(env.COPILOT_PROJECT_CONTROL!=='development')throw new HttpError(503,'Copilot project editing is disabled');
  const action=await getSystemAction(env,id);
  if(!action||action.requested_by!==`copilot:${client.id}`)throw new HttpError(404,'Project action not found');
  // No source body, console output or arbitrary gateway receipt crosses this boundary.
  return {id:action.id,status:action.status,approval_required:action.status==='proposed',completed:action.status==='completed',
    error:action.status==='failed'?'Project action failed; inspect the authenticated Trinity log':null};
}

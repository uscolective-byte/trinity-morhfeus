export const ACTIONS=Object.freeze(['read','write','edit','selfwrite','run','deploy','share','upload','upgrade']);
export const ACTION_STATUSES=Object.freeze(['proposed','approved','claimed','completed','failed','rejected']);
const ACTION_SET=new Set(ACTIONS);
const STATUS_SET=new Set(ACTION_STATUSES);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function object(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:null;}
function text(value,max){return typeof value==='string'&&value.length>0&&value.length<=max?value:null;}

export function sanitizeHeartbeat(input){
  const data=object(input);if(!data)throw new Error('Neplatný heartbeat.');
  const gatewayId=text(data.gateway_id,120),version=text(data.version,40);
  if(!gatewayId||!version)throw new Error('Heartbeat nemá identitu alebo verziu.');
  const capabilities=Array.isArray(data.capabilities)?data.capabilities.filter(item=>typeof item==='string'&&item.length<=40).slice(0,30):[];
  return {gateway_id:gatewayId,version,capabilities};
}

export function sanitizeActionEvent(input){
  const data=object(input);if(!data||!UUID.test(data.id||'')||!ACTION_SET.has(data.action)||!STATUS_SET.has(data.status))throw new Error('Neplatná udalosť systémovej akcie.');
  return {id:data.id,action:data.action,status:data.status,requested_by:text(data.requested_by,160)||'trinity',updated_at:Number.isFinite(data.updated_at)?Math.trunc(data.updated_at):Date.now()};
}

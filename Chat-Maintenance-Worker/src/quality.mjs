export function reviewReply(text) {
  if (typeof text !== 'string' || !text.trim()) return {ok:false,reason:'empty-output'};
  const compact=text.replace(/\s/g,'');
  const runs=compact.match(/(.)\1{79,}/gu)||[];
  if(runs.reduce((sum,run)=>sum+run.length,0)>=compact.length*0.8) return {ok:false,reason:'repeated-output'};
  return {ok:true,reason:null};
}

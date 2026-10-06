export function mediaStatus(env) {
  return {
    images: {status:env.AI&&env.ARTIFACTS?'verified':'not_configured',provider:env.IMAGE_MODEL||'@cf/black-forest-labs/flux-1-schnell',output:'private R2 artifact'},
    video: {status:'not_configured',provider:null,reason:'Nebolo pripojené ani živým testom overené video API.'},
    music: {status:'not_configured',provider:null,reason:'Nebolo pripojené ani živým testom overené hudobné API.'},
    truth:'Status označuje konfiguráciu a implementáciu, nie iba deklaráciu schopnosti.'
  };
}

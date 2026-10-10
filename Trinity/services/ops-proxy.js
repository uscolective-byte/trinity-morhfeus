// Compatibility entry: no public SQL executor, KV mutation, or fake agent counts.
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname==='/health')return Response.json({service:'trinity-ops',version:'9.0.0',status:'serving'});
    if(url.pathname==='/')return Response.redirect('https://trinity.saboivan2008.workers.dev/',302);
    if(!request.headers.get('Authorization')&&!request.headers.get('X-Trinity-Token'))return Response.json({error:'Vyžaduje sa prístupový kľúč Trinity.'},{status:401,headers:{'Cache-Control':'no-store'}});
    if(url.pathname.startsWith('/api/ops/')||url.pathname==='/mcp')return env.TRINITY.fetch(request);
    return Response.json({error:'Táto stará cesta bola vyradená. Použi /api/ops/ alebo /mcp.'},{status:410});
  }
};

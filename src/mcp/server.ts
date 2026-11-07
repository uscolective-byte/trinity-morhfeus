import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { z } from "zod"
import { TrinityAI } from "../ai/providers.js"
export function createMCPServer(env:any){
  const server=new McpServer({name:'trinity-omni-core',version:'11.0.0'})
  server.tool('trinity_ai_call',{prompt:z.string(),prefer:z.enum(['auto','gpt','gemini']).optional()},async({prompt,prefer})=>{
    const ai=new TrinityAI(env); const r=await ai.route(prompt,prefer||'auto'); return {content:[{type:'text',text:JSON.stringify(r)}]}
  })
  server.tool('trinity_health',{},async()=>{ return {content:[{type:'text',text:'auru.space LIVE v11.0.0-basterix'}]} })
  return { fetch: async (req:Request)=>{ const t=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true}); await server.connect(t); return t.handleRequest(req) } }
}

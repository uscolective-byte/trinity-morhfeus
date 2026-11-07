import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
export class TrinityMCPClient {
  async callTool(mcpUrl:string,toolName:string,args:any){
    const transport=new StreamableHTTPClientTransport(new URL(mcpUrl))
    const client=new Client({name:'trinity-client',version:'11.0.0'})
    await client.connect(transport); const res=await client.callTool({name:toolName,arguments:args}); await client.close(); return res
  }
  async listTools(mcpUrl:string){
    const transport=new StreamableHTTPClientTransport(new URL(mcpUrl))
    const client=new Client({name:'trinity-client',version:'11.0.0'})
    await client.connect(transport); const res=await client.listTools(); await client.close(); return res
  }
}

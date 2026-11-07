import devGateway from "../Trinity/src/dev-gateway.js";

export default {
  async fetch(request: Request, env: any = {}, ctx?: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json(
        { ok: true, service: "trinity-staging", version: "10.3.0", status: "serving" },
        { headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }
    return await devGateway.fetch(request, env, ctx);
  }
};

import {DurableObject} from "cloudflare:workers";
export class TrinityAgent extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/websocket") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket", { status: 400 });
      }
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response("Trinity Agent DO", { status: 200 });
  }

  async webSocketMessage(ws, message) {
    try {
      const data = JSON.parse(message);
      ws.send(JSON.stringify({ type: "ack", id: data.id }));
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
    }
  }

  async webSocketClose(ws, code, reason) {
    ws.close(code, reason);
  }

  async webSocketError(ws, error) {
    console.error("TrinityAgent WebSocket error:", error);
  }
}

export class ChatAgent extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/websocket") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket", { status: 400 });
      }
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response("Chat Agent DO", { status: 200 });
  }

  async webSocketMessage(ws, message) {
    const data = typeof message === "string" ? message : "binary";
    for (const client of this.ctx.getWebSockets()) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  async webSocketClose(ws, code, reason) {
    ws.close(code, reason);
  }

  async webSocketError(ws, error) {
    console.error("ChatAgent WebSocket error:", error);
  }
}

export class GuardianAgent extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/websocket") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket", { status: 400 });
      }
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response("Guardian Agent DO", { status: 200 });
  }

  async webSocketMessage(ws, message) {
    try {
      const data = JSON.parse(message);
      ws.send(JSON.stringify({ type: "guardian_ack", event: data.type }));
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Invalid format" }));
    }
  }

  async webSocketClose(ws, code, reason) {
    ws.close(code, reason);
  }

  async webSocketError(ws, error) {
    console.error("GuardianAgent WebSocket error:", error);
  }
}

// ═══════════════════════════════════════════════════════════

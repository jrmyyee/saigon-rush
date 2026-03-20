// Saigon Rush — Bun WebSocket Server (skeleton)
// Will be fully implemented by Agent A

const PORT = parseInt(process.env.PORT || "8080");
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const server = Bun.serve({
  port: PORT,
  fetch(req, server) {
    const url = new URL(req.url);

    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": CLIENT_URL,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      const sessionId = url.searchParams.get("session") || "default";
      const role = url.searchParams.get("role") || "audience";
      const upgraded = server.upgrade(req, {
        data: { sessionId, role },
      });
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // Health check
    if (url.pathname === "/health") {
      return new Response("ok");
    }

    return new Response("Saigon Rush Server", {
      headers: { "Access-Control-Allow-Origin": CLIENT_URL },
    });
  },
  websocket: {
    open(ws) {
      const { sessionId, role } = ws.data as { sessionId: string; role: string };
      ws.subscribe(`game:${sessionId}`);
      console.log(`[${role}] connected to session ${sessionId}`);
    },
    message(ws, message) {
      const { sessionId } = ws.data as { sessionId: string; role: string };
      // Forward all messages to the session topic
      server.publish(`game:${sessionId}`, message);
    },
    close(ws) {
      const { sessionId, role } = ws.data as { sessionId: string; role: string };
      console.log(`[${role}] disconnected from session ${sessionId}`);
    },
  },
});

console.log(`Saigon Rush server running on port ${PORT}`);

// Saigon Rush — Bun WebSocket Server
import OpenAI from "openai";
import type { ServerWebSocket } from "bun";
import type { ClientRole, GameObstacle, WSMessage } from "../shared/types";
import { OBSTACLE_JSON_SCHEMA, OPENAI_SYSTEM_PROMPT } from "../shared/types";

const PORT = parseInt(process.env.PORT || "8080");
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const RATE_LIMIT_MS = 15_000;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface SocketData { sessionId: string; role: ClientRole; id: string }
interface Session {
  sessionId: string;
  display: ServerWebSocket<SocketData> | null;
  controller: ServerWebSocket<SocketData> | null;
  audience: ServerWebSocket<SocketData>[];
}

const sessions = new Map<string, Session>();
const rateLimits = new Map<string, number>();

const corsHeaders = (): Record<string, string> => ({
  "Access-Control-Allow-Origin": CLIENT_URL,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
});

function getOrCreateSession(id: string): Session {
  let s = sessions.get(id);
  if (!s) { s = { sessionId: id, display: null, controller: null, audience: [] }; sessions.set(id, s); }
  return s;
}

const FALLBACKS: Pick<GameObstacle, "type" | "displayName" | "label" | "color" | "dangerLevel" | "width">[] = [
  { type: "slow_motorbike", displayName: "Slow Motorbike", label: "🏍️ Slow Motorbike", color: "#888888", dangerLevel: 1, width: "small" },
  { type: "pho_cart", displayName: "Phở Cart", label: "🍜 Phở Cart", color: "#D2691E", dangerLevel: 2, width: "medium" },
  { type: "taxi", displayName: "Rogue Taxi", label: "🚕 Rogue Taxi", color: "#FFD700", dangerLevel: 2, width: "large" },
  { type: "fruit_vendor", displayName: "Fruit Vendor", label: "🍉 Fruit Vendor", color: "#32CD32", dangerLevel: 1, width: "medium" },
  { type: "bus", displayName: "City Bus", label: "🚌 City Bus", color: "#1E90FF", dangerLevel: 3, width: "large" },
];

function makeFallbackObstacle(): GameObstacle {
  const t = FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];
  return {
    id: crypto.randomUUID().slice(0, 8),
    ...t,
    lane: [0, 1, 2][Math.floor(Math.random() * 3)] as 0 | 1 | 2,
    speed: +(0.5 + Math.random() * 1.5).toFixed(1),
    audienceMessage: `A wild ${t.displayName} appears on the road!`,
    fromAudience: false,
  };
}

async function generateObstacle(suggestion: string): Promise<GameObstacle> {
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: OPENAI_SYSTEM_PROMPT },
        { role: "user", content: suggestion },
      ],
      response_format: { type: "json_schema", json_schema: OBSTACLE_JSON_SCHEMA },
    });
    const content = res.choices[0]?.message?.content;
    if (!content) throw new Error("Empty OpenAI response");
    return { id: crypto.randomUUID().slice(0, 8), ...JSON.parse(content), fromAudience: true };
  } catch (err) {
    console.error("[openai] Failed:", err);
    return makeFallbackObstacle();
  }
}

const pub = (topic: string, msg: WSMessage) => server.publish(topic, JSON.stringify(msg));

const server = Bun.serve<SocketData>({
  port: PORT,
  fetch(req, server) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });

    if (url.pathname === "/ws") {
      const sessionId = url.searchParams.get("session") || crypto.randomUUID().slice(0, 4);
      const role = (url.searchParams.get("role") || "audience") as ClientRole;
      if (server.upgrade(req, { data: { sessionId, role, id: crypto.randomUUID() } })) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400, headers: corsHeaders() });
    }

    if (url.pathname === "/health") return new Response("ok", { headers: corsHeaders() });
    return new Response("Saigon Rush Server", { headers: corsHeaders() });
  },

  websocket: {
    open(ws) {
      const { sessionId, role } = ws.data;
      const session = getOrCreateSession(sessionId);
      ws.subscribe(`game:${sessionId}`);

      if (role === "display") {
        session.display = ws;
        ws.subscribe(`audience:${sessionId}`);
      } else if (role === "controller") {
        session.controller = ws;
      } else {
        session.audience.push(ws);
        ws.subscribe(`audience:${sessionId}`);
      }

      console.log(`[${role}] connected to session ${sessionId}`);
      pub(`game:${sessionId}`, { type: "player_joined", role });
    },

    async message(ws, message) {
      const { sessionId, role, id } = ws.data;
      if (!sessions.has(sessionId)) return;

      let msg: WSMessage;
      try {
        msg = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message));
      } catch { return; }

      // Controller -> forward input to game topic
      if (role === "controller" && msg.type === "input") {
        pub(`game:${sessionId}`, msg);
        return;
      }

      // Audience -> rate-limit, generate obstacle via AI, broadcast
      if (role === "audience" && msg.type === "suggestion") {
        const now = Date.now();
        const last = rateLimits.get(id) || 0;
        if (now - last < RATE_LIMIT_MS) {
          const wait = Math.ceil((RATE_LIMIT_MS - (now - last)) / 1000);
          ws.send(JSON.stringify({ type: "suggestion_rejected", reason: `Wait ${wait}s before suggesting again` }));
          return;
        }
        rateLimits.set(id, now);

        const obstacle = await generateObstacle(msg.text);
        pub(`game:${sessionId}`, { type: "new_obstacle", obstacle });
        pub(`audience:${sessionId}`, { type: "suggestion_accepted", original: msg.text, result: obstacle });
        return;
      }

      // Display -> forward game state broadcasts to all subscribers
      if (role === "display" && (msg.type === "game_state" || msg.type === "game_start" || msg.type === "game_over")) {
        pub(`game:${sessionId}`, msg);
      }
    },

    close(ws) {
      const { sessionId, role } = ws.data;
      const session = sessions.get(sessionId);
      if (session) {
        if (role === "display") { sessions.delete(sessionId); console.log(`[session] ${sessionId} cleaned up`); }
        else if (role === "controller") session.controller = null;
        else session.audience = session.audience.filter((s) => s !== ws);
      }
      console.log(`[${role}] disconnected from session ${sessionId}`);
      pub(`game:${sessionId}`, { type: "player_left", role });
    },
  },
});

console.log(`Saigon Rush server running on port ${PORT}`);

// Saigon Rush — Bun WebSocket Server
import OpenAI from "openai";
import { fal } from "@fal-ai/client";
import type { ServerWebSocket } from "bun";
import type { ClientRole, GameObstacle, WSMessage } from "../shared/types";
import { OBSTACLE_JSON_SCHEMA, OPENAI_SYSTEM_PROMPT } from "../shared/types";

const PORT = parseInt(process.env.PORT || "8080");
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const RATE_LIMIT_MS = 15_000;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
fal.config({ credentials: process.env.FAL_KEY });

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

async function generateAnnouncement(displayName: string): Promise<string | undefined> {
  try {
    const text = `Coi chừng! ${displayName} đang tới!`;
    const response = await fetch("https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM/stream", {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });
    if (!response.ok) throw new Error(`ElevenLabs ${response.status}`);
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString("base64");
  } catch (err) {
    console.error("[elevenlabs] Failed:", err);
    return undefined;
  }
}

async function generateSpriteImage(displayName: string, color: string): Promise<string | undefined> {
  try {
    const result = await fal.subscribe("fal-ai/flux/schnell", {
      input: {
        prompt: `pixel art game sprite, side view, ${displayName}, retro 16-bit style, clean pixel edges, vibrant saturated colors, solid white background, no shadow, centered in frame, game asset`,
        image_size: { width: 256, height: 256 },
        num_images: 1,
        num_inference_steps: 4,
      },
    });
    return (result as any)?.data?.images?.[0]?.url || (result as any)?.images?.[0]?.url;
  } catch (err) {
    console.error("[fal.ai] Failed:", err);
    return undefined;
  }
}

async function generateObstacle(suggestion: string): Promise<GameObstacle> {
  try {
    // Fire OpenAI first to get obstacle data
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
    const parsed = JSON.parse(content);

    // Fire fal.ai and ElevenLabs in parallel (non-blocking)
    const [imageUrl, announcementAudio] = await Promise.all([
      generateSpriteImage(parsed.displayName, parsed.color).catch(() => undefined),
      generateAnnouncement(parsed.displayName).catch(() => undefined),
    ]);

    return {
      id: crypto.randomUUID().slice(0, 8),
      type: parsed.obstacleType || "unknown",
      displayName: parsed.displayName,
      lane: parsed.lane,
      width: parsed.width,
      speed: Math.max(0.5, Math.min(2.0, parsed.speed)),
      color: parsed.color,
      dangerLevel: parsed.dangerLevel,
      label: parsed.label,
      audienceMessage: parsed.audienceMessage,
      fromAudience: true,
      movement: parsed.movement,
      spriteData: parsed.spriteData,
      soundCategory: parsed.soundCategory,
      imageUrl,
      announcementAudio,
    };
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
        // Warm up fal.ai model
        generateSpriteImage("test obstacle", "#ff0000").catch(() => {});
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

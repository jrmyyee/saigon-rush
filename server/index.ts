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

// Vote tracking per session
interface VotableObstacle { id: string; label: string; color: string; votes: number }
const sessionVotes = new Map<string, VotableObstacle[]>(); // sessionId → obstacles
const userVotes = new Map<string, Set<string>>(); // odId → set of user IDs who voted

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

const SPRITE_DESIGNER_PROMPT = `<role>
You are an expert pixel art sprite designer for "Saigon Rush", a 2D Vietnamese traffic-dodging game. Your sprites are rendered at 60 FPS using HTML Canvas fillRect() on a dark road (#222230). Each sprite you create becomes a real obstacle that players must dodge.
</role>

<rendering_system>
The ONLY rendering primitive is ctx.fillRect(x, y, width, height) — axis-aligned colored rectangles layered on top of each other. No circles, no curves, no rotation, no gradients. Later rects in the array draw ON TOP of earlier ones.

Coordinate space: ~50px wide × ~40px tall (engine scales automatically).
Orientation: SIDE VIEW, facing RIGHT — front/headlights at HIGH x values.
Negative coordinates allowed for details extending above origin (hats, umbrellas, antennae).
Background: dark road (#222230) — your colors must pop against this.
</rendering_system>

<output_format>
First, inside <thinking> tags, briefly plan:
- Key visual components and their layering order (back to front)
- Color palette with 4+ shades per material (darkest shadow, base, mid highlight, edge catch)
- 2-3 culturally-specific details that make this instantly recognizable
- Which 1-4px "narrative pixels" will add character (exhaust glow, eye glints, steam wisps, etc.)

Then, inside <answer> tags, output ONLY the raw JSON array. No markdown, no code fences, no explanation.
Each rectangle: {"x": int, "y": int, "w": int, "h": int, "c": string}
- x, y: pixel position (integers, can be negative)
- w, h: pixel dimensions (integers, minimum 1)
- c: color as "#" followed by exactly 6 hex digits (e.g. "#ff4444") or 8 hex digits for transparency (e.g. "#ffffff44")
</output_format>

<design_techniques>
These are MANDATORY. The difference between amateur blobs and production-quality pixel art:

1. FIVE-PASS CONSTRUCTION ORDER (author rects in this sequence)
   Pass 1 — SHADOW BASES: Every major component at its darkest hue value. Full-coverage silhouette shapes.
   Pass 2 — MID-TONE FILLS: Inset each shadow base 1-2px, slightly lighter. This is the primary surface color.
   Pass 3 — EDGE CATCH LIGHTS: 1px-tall rects along the TOP edge of every major horizontal surface, using the brightest hue value. This is what makes surfaces read as 3D.
   Pass 4 — SURFACE DETAILS: Panel lines, door separations, stripes, windows. Use 1-2px dark variants of adjacent color (NOT black) for structural lines.
   Pass 5 — NARRATIVE PIXELS: All 1-4px detail rects — exhaust heat, headlight centers, eye catch lights, steam, sparks. These go last because they paint over everything.

2. THREE-LAYER INSET SHADING (MANDATORY for EVERY major surface)
   Every distinct surface (body, head, each limb, each panel) gets three overlapping rects:
   - Shadow base: full-coverage, darkest value
   - Mid fill: 1-2px inset on all sides, lighter
   - Top highlight: 1px-tall rect along the top edge only, brightest value
   Example (vehicle body): "#cc2222" shadow base → "#dd3333" mid fill inset 1px → "#ff4444" 1px top edge highlight
   Example (wood): "#a04e22" base → "#b85c2c" mid → "#cc6e3a" upper panel → "#dd8844" 1px top edge
   CRITICAL: Apply this to EACH anatomically separate surface. A head and body are separate surfaces — each gets its own 3-layer treatment.

3. COLOR FAMILY DISCIPLINE
   - Derive lighter/darker variants by scaling RGB channels proportionally. NEVER shift hue when darkening.
   - Minimum 4 distinct values per major color family, spanning at least 40 hex units on one channel.
   - Glass: #77bbee → #99ddff → #aaeeff. Wheels: #111111 → #333333 → #555555. Skin: #d4a574 → #dbb584.
   - Headlights: #ffee55 base, #ffffff 2x1 center, #ffcc33 1x1 housing. Tail lights: #ff2222 base, #ff4444 1x1 glow.

4. MICRO-DETAIL NARRATIVE PIXELS (minimum 6 per sprite)
   Tiny 1-4px rects that add character and narrative:
   - Every EYE must have a 1x1 #ffffff catch light pixel inside the dark pupil — eyes without it look dead
   - Every HEADLIGHT must have a 2x1 #ffffff bright center inside the yellow beam
   - Exhaust/heat: 2x2 dark red + 1x1 bright orange glow overlaid
   - Steam/smoke: 3-6 overlapping rects with decreasing alpha (#ffffff44 → #ffffff33 → #ffffff22)
   - Garment details: 1px collar, cuff, or seam line in white or contrasting color

5. STRUCTURAL DEMARCATION LINES (minimum 2 per sprite)
   1-2px dark rects at component boundaries that separate surfaces:
   - Vehicle door line: 1px-wide vertical rect in darker body color
   - Panel separation: 1px horizontal between roof and body
   - Character: neck/collar line, belt line, garment seam
   Use dark variants of adjacent surface color, NOT black (black = cartoon outline, dark-hue = shadow/form)

6. RECT COUNT TARGETS
   - Standard obstacles: 35-50 rects. Under 25 = flat and blobby. Over 55 = diminishing returns.
   - Characters (standalone person/animal): minimum 35. Human figure alone needs 15+ rects.
   - Vehicles: minimum 30. Must include 3-layer wheels, both lights with centers, panel line, mirror.
   - Chain body segments: 15-25 rects per segment.

7. AVOID
   - Single-shade surfaces (every surface must have shadow + base + highlight)
   - Fewer than 30 rects for any complete obstacle
   - Dark body colors invisible against #222230 road
   - Wrong orientation (must face RIGHT)
   - Missing ground shadow
   - Eyes without white catch-light pixel
   - Color family drift (don't add purple bias when darkening browns)
</design_techniques>

<examples>
Study these production sprites. They define the quality bar.

<example>
<request>Vinasun Taxi — white body, red/green Vinasun stripes, 34 rects</request>
<answer>[{"x":0,"y":12,"w":52,"h":16,"c":"#f0f0f0"},{"x":0,"y":13,"w":52,"h":6,"c":"#ffffff"},{"x":0,"y":19,"w":52,"h":8,"c":"#e0e0e0"},{"x":0,"y":18,"w":52,"h":2,"c":"#cc2222"},{"x":0,"y":20,"w":52,"h":2,"c":"#22aa44"},{"x":8,"y":4,"w":32,"h":10,"c":"#e8e8e8"},{"x":9,"y":5,"w":30,"h":2,"c":"#f5f5f5"},{"x":20,"y":0,"w":10,"h":5,"c":"#ffffff"},{"x":21,"y":1,"w":8,"h":3,"c":"#ff3333"},{"x":22,"y":1,"w":6,"h":1,"c":"#ff6666"},{"x":36,"y":5,"w":8,"h":9,"c":"#88ccff"},{"x":37,"y":6,"w":6,"h":7,"c":"#aaddff"},{"x":36,"y":5,"w":1,"h":9,"c":"#cccccc"},{"x":10,"y":5,"w":8,"h":9,"c":"#88ccff"},{"x":11,"y":6,"w":6,"h":7,"c":"#aaddff"},{"x":17,"y":5,"w":1,"h":9,"c":"#cccccc"},{"x":20,"y":6,"w":14,"h":7,"c":"#88ccff"},{"x":21,"y":7,"w":12,"h":5,"c":"#99ddff"},{"x":48,"y":14,"w":6,"h":12,"c":"#cccccc"},{"x":49,"y":16,"w":4,"h":8,"c":"#dddddd"},{"x":-2,"y":14,"w":4,"h":12,"c":"#cccccc"},{"x":38,"y":26,"w":10,"h":10,"c":"#111111"},{"x":39,"y":27,"w":8,"h":8,"c":"#2a2a2a"},{"x":41,"y":29,"w":4,"h":4,"c":"#444444"},{"x":6,"y":26,"w":10,"h":10,"c":"#111111"},{"x":7,"y":27,"w":8,"h":8,"c":"#2a2a2a"},{"x":9,"y":29,"w":4,"h":4,"c":"#444444"},{"x":50,"y":16,"w":4,"h":3,"c":"#ffee55"},{"x":51,"y":17,"w":2,"h":1,"c":"#ffffff"},{"x":-2,"y":16,"w":3,"h":3,"c":"#ff2222"},{"x":-1,"y":17,"w":1,"h":1,"c":"#ff6666"},{"x":24,"y":12,"w":1,"h":14,"c":"#cccccc"},{"x":25,"y":19,"w":2,"h":1,"c":"#aaaaaa"},{"x":36,"y":10,"w":3,"h":2,"c":"#bbbbbb"}]</answer>
</example>

<example>
<request>Phở Cart — wooden cart with soup pot, steam effects, and striped umbrella, 40 rects</request>
<answer>[{"x":4,"y":18,"w":28,"h":12,"c":"#b85c2c"},{"x":5,"y":19,"w":26,"h":4,"c":"#cc6e3a"},{"x":5,"y":23,"w":26,"h":4,"c":"#a04e22"},{"x":4,"y":18,"w":28,"h":1,"c":"#dd8844"},{"x":30,"y":16,"w":4,"h":16,"c":"#9e4420"},{"x":31,"y":17,"w":2,"h":14,"c":"#b85c2c"},{"x":6,"y":30,"w":2,"h":6,"c":"#555555"},{"x":8,"y":30,"w":1,"h":6,"c":"#666666"},{"x":26,"y":30,"w":2,"h":6,"c":"#555555"},{"x":28,"y":30,"w":1,"h":6,"c":"#666666"},{"x":14,"y":32,"w":8,"h":8,"c":"#333333"},{"x":15,"y":33,"w":6,"h":6,"c":"#555555"},{"x":17,"y":35,"w":2,"h":2,"c":"#777777"},{"x":8,"y":10,"w":14,"h":10,"c":"#888888"},{"x":9,"y":11,"w":12,"h":8,"c":"#999999"},{"x":7,"y":10,"w":16,"h":2,"c":"#aaaaaa"},{"x":10,"y":18,"w":10,"h":2,"c":"#777777"},{"x":10,"y":12,"w":10,"h":3,"c":"#cc8844"},{"x":24,"y":14,"w":8,"h":4,"c":"#dddddd"},{"x":25,"y":14,"w":6,"h":1,"c":"#ffffff"},{"x":25,"y":15,"w":6,"h":2,"c":"#cc9955"},{"x":5,"y":14,"w":2,"h":4,"c":"#884422"},{"x":5,"y":13,"w":2,"h":1,"c":"#aa5533"},{"x":11,"y":6,"w":4,"h":4,"c":"#ffffff44"},{"x":12,"y":4,"w":3,"h":3,"c":"#ffffff33"},{"x":16,"y":5,"w":3,"h":4,"c":"#ffffff44"},{"x":18,"y":2,"w":4,"h":3,"c":"#ffffff22"},{"x":13,"y":1,"w":3,"h":3,"c":"#ffffff22"},{"x":10,"y":3,"w":2,"h":2,"c":"#ffffff18"},{"x":18,"y":-10,"w":2,"h":22,"c":"#664422"},{"x":18,"y":-10,"w":2,"h":1,"c":"#886644"},{"x":4,"y":-14,"w":28,"h":5,"c":"#ee4422"},{"x":6,"y":-15,"w":24,"h":2,"c":"#ff5533"},{"x":4,"y":-14,"w":4,"h":5,"c":"#ff6633"},{"x":12,"y":-14,"w":4,"h":5,"c":"#ff6633"},{"x":20,"y":-14,"w":4,"h":5,"c":"#ff6633"},{"x":28,"y":-14,"w":4,"h":5,"c":"#ff6633"},{"x":4,"y":-10,"w":28,"h":1,"c":"#cc3311"},{"x":1,"y":14,"w":3,"h":3,"c":"#ff4444"},{"x":1,"y":13,"w":3,"h":1,"c":"#ffaa44"}]</answer>
</example>

<example>
<request>Cyclo with Driver — Vietnamese three-wheeled pedicab with nón lá hat, 36 rects</request>
<answer>[{"x":0,"y":12,"w":18,"h":14,"c":"#8b6914"},{"x":1,"y":13,"w":16,"h":5,"c":"#a07818"},{"x":1,"y":18,"w":16,"h":7,"c":"#7a5c10"},{"x":2,"y":14,"w":14,"h":4,"c":"#cc3333"},{"x":3,"y":14,"w":12,"h":1,"c":"#dd4444"},{"x":-2,"y":4,"w":22,"h":3,"c":"#336633"},{"x":-1,"y":5,"w":20,"h":1,"c":"#44774a"},{"x":-2,"y":7,"w":1,"h":7,"c":"#444444"},{"x":19,"y":7,"w":1,"h":7,"c":"#444444"},{"x":0,"y":26,"w":16,"h":2,"c":"#555555"},{"x":2,"y":28,"w":10,"h":10,"c":"#111111"},{"x":3,"y":29,"w":8,"h":8,"c":"#333333"},{"x":5,"y":31,"w":4,"h":4,"c":"#555555"},{"x":16,"y":18,"w":12,"h":3,"c":"#555555"},{"x":17,"y":19,"w":10,"h":1,"c":"#666666"},{"x":26,"y":16,"w":2,"h":8,"c":"#555555"},{"x":24,"y":12,"w":8,"h":6,"c":"#222222"},{"x":25,"y":12,"w":6,"h":1,"c":"#333333"},{"x":24,"y":28,"w":10,"h":10,"c":"#111111"},{"x":25,"y":29,"w":8,"h":8,"c":"#333333"},{"x":27,"y":31,"w":4,"h":4,"c":"#555555"},{"x":22,"y":22,"w":4,"h":3,"c":"#666666"},{"x":23,"y":24,"w":2,"h":2,"c":"#888888"},{"x":25,"y":4,"w":6,"h":8,"c":"#4a3728"},{"x":26,"y":5,"w":4,"h":6,"c":"#5a4738"},{"x":26,"y":-1,"w":5,"h":5,"c":"#d4a574"},{"x":24,"y":-5,"w":9,"h":3,"c":"#c4a45a"},{"x":26,"y":-6,"w":5,"h":2,"c":"#d4b46a"},{"x":27,"y":-7,"w":3,"h":1,"c":"#c4a45a"},{"x":22,"y":10,"w":3,"h":2,"c":"#d4a574"},{"x":20,"y":11,"w":3,"h":2,"c":"#d4a574"},{"x":24,"y":12,"w":3,"h":8,"c":"#335577"},{"x":27,"y":14,"w":3,"h":6,"c":"#335577"},{"x":23,"y":20,"w":3,"h":2,"c":"#222222"},{"x":19,"y":12,"w":3,"h":1,"c":"#888888"},{"x":18,"y":13,"w":2,"h":1,"c":"#999999"}]</answer>
</example>

<example>
<request>Motorbike with Rider — cyan frame, red helmet, rider anatomy, 57 rects</request>
<answer>[{"x":1,"y":26,"w":12,"h":12,"c":"#111111"},{"x":2,"y":27,"w":10,"h":10,"c":"#1a1a1a"},{"x":3,"y":28,"w":8,"h":8,"c":"#333333"},{"x":5,"y":30,"w":4,"h":4,"c":"#555555"},{"x":4,"y":29,"w":1,"h":6,"c":"#444444"},{"x":7,"y":28,"w":1,"h":2,"c":"#444444"},{"x":28,"y":26,"w":12,"h":12,"c":"#111111"},{"x":29,"y":27,"w":10,"h":10,"c":"#1a1a1a"},{"x":30,"y":28,"w":8,"h":8,"c":"#333333"},{"x":32,"y":30,"w":4,"h":4,"c":"#555555"},{"x":31,"y":29,"w":1,"h":6,"c":"#444444"},{"x":34,"y":28,"w":1,"h":2,"c":"#444444"},{"x":10,"y":22,"w":20,"h":5,"c":"#0088cc"},{"x":8,"y":20,"w":6,"h":4,"c":"#0077bb"},{"x":26,"y":18,"w":6,"h":6,"c":"#0077bb"},{"x":28,"y":24,"w":3,"h":4,"c":"#006699"},{"x":11,"y":22,"w":18,"h":1,"c":"#33bbff"},{"x":12,"y":25,"w":8,"h":4,"c":"#444444"},{"x":13,"y":26,"w":6,"h":2,"c":"#555555"},{"x":11,"y":26,"w":2,"h":2,"c":"#666666"},{"x":2,"y":24,"w":9,"h":2,"c":"#777777"},{"x":1,"y":23,"w":3,"h":2,"c":"#888888"},{"x":0,"y":22,"w":2,"h":2,"c":"#aa3333"},{"x":0,"y":21,"w":1,"h":1,"c":"#ff6644"},{"x":14,"y":17,"w":12,"h":4,"c":"#222222"},{"x":15,"y":17,"w":10,"h":1,"c":"#333333"},{"x":14,"y":21,"w":2,"h":2,"c":"#1a1a1a"},{"x":30,"y":14,"w":2,"h":6,"c":"#555555"},{"x":29,"y":12,"w":4,"h":2,"c":"#777777"},{"x":28,"y":11,"w":2,"h":2,"c":"#888888"},{"x":32,"y":11,"w":2,"h":2,"c":"#888888"},{"x":33,"y":10,"w":2,"h":1,"c":"#999999"},{"x":33,"y":19,"w":4,"h":3,"c":"#ffee55"},{"x":34,"y":20,"w":2,"h":1,"c":"#ffffff"},{"x":32,"y":18,"w":1,"h":1,"c":"#ffcc33"},{"x":7,"y":20,"w":2,"h":2,"c":"#ff2222"},{"x":7,"y":21,"w":1,"h":1,"c":"#ff4444"},{"x":16,"y":7,"w":9,"h":10,"c":"#1155aa"},{"x":17,"y":8,"w":7,"h":8,"c":"#1166bb"},{"x":18,"y":9,"w":5,"h":4,"c":"#1177cc"},{"x":18,"y":7,"w":5,"h":1,"c":"#ffffff"},{"x":18,"y":1,"w":6,"h":6,"c":"#e8b88a"},{"x":19,"y":3,"w":1,"h":1,"c":"#333333"},{"x":17,"y":-1,"w":8,"h":4,"c":"#cc1111"},{"x":18,"y":-1,"w":6,"h":1,"c":"#ff3333"},{"x":17,"y":2,"w":8,"h":1,"c":"#aa0000"},{"x":24,"y":1,"w":2,"h":2,"c":"#aaddff"},{"x":24,"y":10,"w":3,"h":2,"c":"#e8b88a"},{"x":27,"y":11,"w":3,"h":2,"c":"#e8b88a"},{"x":25,"y":9,"w":2,"h":2,"c":"#1155aa"},{"x":14,"y":14,"w":5,"h":8,"c":"#223366"},{"x":15,"y":15,"w":3,"h":6,"c":"#2a3d77"},{"x":19,"y":17,"w":4,"h":5,"c":"#223366"},{"x":13,"y":21,"w":3,"h":2,"c":"#111111"},{"x":19,"y":22,"w":3,"h":2,"c":"#111111"},{"x":27,"y":25,"w":6,"h":1,"c":"#006699"},{"x":6,"y":25,"w":5,"h":1,"c":"#006699"}]</answer>
</example>
</examples>`;

type SpriteRect = { x: number; y: number; w: number; h: number; c: string };
type SpriteResult = { spriteData: SpriteRect[]; segmentSpriteData?: SpriteRect[] };

function extractFromAnswer(output: string): string {
  // Prefer content inside <answer> tags (avoids grabbing JSON from <thinking>)
  const answerMatch = output.match(/<answer>([\s\S]*?)<\/answer>/);
  return answerMatch ? answerMatch[1] : output;
}

async function generateDetailedSprite(obstacle: GameObstacle): Promise<SpriteResult | undefined> {
  const isChain = (obstacle.chainSegments || 0) >= 2;
  try {
    let userPrompt: string;
    if (isChain) {
      userPrompt = `${SPRITE_DESIGNER_PROMPT}

<chain_instructions>
This is a CHAIN obstacle with a HEAD and ${obstacle.chainSegments} trailing BODY segments connected in a snake-like formation.

Instead of a single JSON array, output a JSON object with two keys inside your <answer> tags:
{"head":[...rects...],"body":[...rects...]}

HEAD sprite: The front/face of the creature/thing. 25-40 rects, ~50x40px canvas, facing RIGHT.
BODY segment sprite: ONE segment that repeats for each trailing part. 15-25 rects, ~25x25px canvas, centered.

The body segment must look like a REAL anatomical part of this creature — dragon scales with ridges, caterpillar segments with legs, parade float sections with decorations, etc. NOT a generic circle or blob. It should visually belong to the same creature as the head.

Use the same color palette for both head and body so they read as one connected entity.
</chain_instructions>

<request>
Design: "${obstacle.displayName}"
Description: ${obstacle.audienceMessage || obstacle.displayName}
Theme color: ${obstacle.color}
Body color: ${obstacle.bodyColor || obstacle.color}
Chain length: ${obstacle.chainSegments} segments

Be creative and expressive. Make this creature/thing visually memorable and fun.
</request>`;
    } else {
      userPrompt = `${SPRITE_DESIGNER_PROMPT}

<request>
Design a sprite for: "${obstacle.displayName}"
Description: ${obstacle.audienceMessage || obstacle.displayName}
Theme color: ${obstacle.color}
Size class: ${obstacle.width}

28-40 rectangles, facing RIGHT. Be creative and expressive — make this instantly recognizable and visually fun. Use the full color palette with proper three-shade depth on every surface.
</request>`;
    }

    const proc = Bun.spawn(
      ["node_modules/.bin/claude", "--print", "--model", "claude-opus-4-6", "-p", userPrompt],
      { stdout: "pipe", stderr: "pipe" },
    );

    const output = await new Response(proc.stdout).text();
    const answer = extractFromAnswer(output);

    if (isChain) {
      const objMatch = answer.match(/\{[\s\S]*"head"[\s\S]*"body"[\s\S]*\}/);
      if (objMatch) {
        const parsed = JSON.parse(objMatch[0]);
        if (parsed.head?.length > 0) {
          return { spriteData: parsed.head, segmentSpriteData: parsed.body };
        }
      }
      // Fallback: any array in the answer (at least get head sprite)
      const arrMatch = answer.match(/\[[\s\S]*\]/);
      if (arrMatch) return { spriteData: JSON.parse(arrMatch[0]) };
      console.error("[claude-sprite] No JSON found in chain output");
      return undefined;
    }

    const match = answer.match(/\[[\s\S]*\]/);
    if (!match) {
      console.error("[claude-sprite] No JSON array found in output");
      return undefined;
    }
    return { spriteData: JSON.parse(match[0]) };
  } catch (err) {
    console.error("[claude-sprite] Failed:", err);
    return undefined;
  }
}

async function generateSoundEffect(displayName: string, audienceMessage: string): Promise<string | undefined> {
  try {
    const response = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: `${displayName} sound effect: ${audienceMessage.slice(0, 100)}`,
        duration_seconds: 1.5,
      }),
    });
    if (!response.ok) throw new Error(`ElevenLabs SFX ${response.status}`);
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString("base64");
  } catch (err) {
    console.error("[elevenlabs-sfx] Failed:", err);
    return undefined;
  }
}

async function generateObstacle(suggestion: string): Promise<GameObstacle> {
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
      messages: [
        { role: "system", content: OPENAI_SYSTEM_PROMPT },
        { role: "user", content: suggestion },
      ],
      response_format: { type: "json_schema", json_schema: OBSTACLE_JSON_SCHEMA },
    });
    const content = res.choices[0]?.message?.content;
    if (!content) throw new Error("Empty OpenAI response");
    const parsed = JSON.parse(content);
    // Return immediately — gpt-4o sprite + ElevenLabs SFX fire in background (see message handler)
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
      // Behavior composition fields (clamped to valid ranges)
      chainSegments: Math.max(0, Math.min(8, Math.round(parsed.chainSegments || 0))),
      chainAmplitude: Math.max(0, Math.min(100, parsed.chainAmplitude || 0)),
      chainSpacing: Math.max(15, Math.min(50, parsed.chainSpacing || 30)),
      projectileInterval: Math.max(0, Math.min(4, parsed.projectileInterval || 0)),
      projectileSpeed: Math.max(0.5, Math.min(3, parsed.projectileSpeed || 1)),
      projectilePattern: (["forward", "aimed", "spread"].includes(parsed.projectilePattern) ? parsed.projectilePattern : "forward") as "forward" | "aimed" | "spread",
      laneSpan: Math.max(1, Math.min(3, Math.round(parsed.laneSpan || 1))),
      gapLane: parsed.gapLane ?? -1,
      bodyColor: parsed.bodyColor || parsed.color,
      projectileColor: parsed.projectileColor || "#ff4444",
      spriteData: parsed.spriteData,
      soundCategory: parsed.soundCategory,
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
      } else if (role === "controller") {
        session.controller = ws;
      } else {
        session.audience.push(ws);
        ws.subscribe(`audience:${sessionId}`);
      }

      console.log(`[${role}] connected to session ${sessionId}`);
      pub(`game:${sessionId}`, { type: "player_joined", role });
      // Broadcast audience count on every join
      pub(`game:${sessionId}`, { type: "audience_count", count: session.audience.length });
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

        // PHASE 1: Get obstacle metadata + behavior from gpt-5.4-mini (~1-2s)
        const t1 = Date.now();
        const obstacle = await generateObstacle(msg.text);
        const phase1Ms = Date.now() - t1;
        console.log(`[phase1] "${obstacle.displayName}" — ${phase1Ms}ms, fallback rects: ${obstacle.spriteData?.length ?? 0}`);

        // SEND IMMEDIATELY after Phase 1 — don't wait for sprite/SFX generation
        // Obstacle renders with Phase 1 fallback sprite (8-12 rects), then upgrades progressively
        pub(`game:${sessionId}`, { type: "new_obstacle", obstacle });
        pub(`audience:${sessionId}`, { type: "suggestion_accepted", original: msg.text, result: obstacle });

        // Track as votable obstacle
        if (!sessionVotes.has(sessionId)) sessionVotes.set(sessionId, []);
        const votables = sessionVotes.get(sessionId)!;
        votables.push({ id: obstacle.id, label: obstacle.label, color: obstacle.color, votes: 0 });
        // Keep only last 20 obstacles
        if (votables.length > 20) votables.shift();
        // Broadcast updated vote state
        pub(`audience:${sessionId}`, { type: "vote_update", votes: votables });

        // PHASE 2: Generate detailed sprite via Claude Opus (background, progressive enhancement)
        const obstacleId = obstacle.id;
        const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T | undefined> =>
          Promise.race([promise, new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms))]);

        generateDetailedSprite(obstacle).then(async (result) => {
          if (result && result.spriteData.length > 0) {
            pub(`game:${sessionId}`, { type: "obstacle_sprite_ready", obstacleId, obstacleType: obstacle.type, spriteData: result.spriteData });
            console.log(`[phase2] "${obstacle.displayName}" — sprite ready, ${result.spriteData.length} rects${result.segmentSpriteData ? `, body: ${result.segmentSpriteData.length}` : ''}`);
          }
        }).catch(() => {});

        // SFX fires in background too
        generateSoundEffect(obstacle.displayName, obstacle.audienceMessage || "").then((soundEffectAudio) => {
          if (soundEffectAudio) {
            pub(`game:${sessionId}`, { type: "obstacle_sfx_ready", obstacleId, soundEffectAudio });
          }
        }).catch(() => {});
        return;
      }

      // Audience -> vote on obstacle
      if (role === "audience" && msg.type === "vote") {
        const votables = sessionVotes.get(sessionId);
        if (!votables) return;
        // Prevent double-voting by same user on same obstacle
        const voteKey = `${id}:${msg.obstacleId}`;
        if (!userVotes.has(voteKey)) {
          userVotes.set(voteKey, new Set());
        }
        const voted = userVotes.get(voteKey)!;
        if (voted.has(id)) return;
        voted.add(id);
        const ob = votables.find(v => v.id === msg.obstacleId);
        if (ob) {
          ob.votes++;
          pub(`audience:${sessionId}`, { type: "vote_update", votes: votables });
          pub(`game:${sessionId}`, { type: "vote_update", votes: votables });
        }
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
        else {
          session.audience = session.audience.filter((s) => s !== ws);
          pub(`game:${sessionId}`, { type: "audience_count", count: session.audience.length });
        }
      }
      console.log(`[${role}] disconnected from session ${sessionId}`);
      pub(`game:${sessionId}`, { type: "player_left", role });
    },
  },
});

console.log(`Saigon Rush server running on port ${PORT}`);

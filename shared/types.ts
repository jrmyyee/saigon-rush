// Saigon Rush — Shared Types (Server ↔ Client contract)

export type ClientRole = "display" | "controller" | "audience";

export type WSMessage =
  | { type: "input"; action: InputAction }
  | { type: "suggestion"; text: string }
  | { type: "new_obstacle"; obstacle: GameObstacle }
  | { type: "suggestion_accepted"; original: string; result: GameObstacle }
  | { type: "suggestion_rejected"; reason: string }
  | { type: "game_state"; state: GameState }
  | { type: "player_joined"; role: ClientRole }
  | { type: "player_left"; role: ClientRole }
  | { type: "game_start" }
  | { type: "game_over"; stats: GameStats }
  | { type: "session_info"; sessionId: string; displayUrl: string; controlUrl: string; audienceUrl: string }
  | { type: "obstacle_sprite_ready"; obstacleId: string; obstacleType?: string; spriteData: Array<{ x: number; y: number; w: number; h: number; c: string }> }
  | { type: "obstacle_image_ready"; obstacleId: string; imageUrl: string }
  | { type: "obstacle_sfx_ready"; obstacleId: string; soundEffectAudio: string };

export type InputAction = "lane_up" | "lane_down" | "boost";

export interface GameObstacle {
  id: string;
  type: string;
  displayName: string;
  lane: 0 | 1 | 2;
  width: "small" | "medium" | "large";
  speed: number; // 0.5 - 2.0 multiplier on base scroll speed
  color: string; // hex, primary body color
  dangerLevel: 1 | 2 | 3;
  label: string; // emoji + name shown in game (e.g. "🐃 Water Buffalo")
  audienceMessage: string; // fun message shown to audience feed
  fromAudience: boolean;
  movement?: "straight" | "weave" | "drift"; // Non-chain movement pattern

  // ── Composable Behavior Fields (0 = disabled) ─────────────
  // Chain: obstacle rendered as connected segments trailing a head
  chainSegments?: number;     // 0 = single unit, 2-8 = number of trailing segments
  chainAmplitude?: number;    // 0-100: sine wave width (0 = straight, 100 = spans 2 lanes)
  chainSpacing?: number;      // 15-50: pixel gap between segments (tight wall vs loose parade)
  // Projectile: obstacle periodically fires at player
  projectileInterval?: number;  // 0 = none, 0.5-4.0 = seconds between shots
  projectileSpeed?: number;     // 0.5-3.0: how fast projectiles move
  projectilePattern?: "forward" | "aimed" | "spread"; // forward=straight, aimed=tracks player lane, spread=3-way fan
  // Wide: obstacle spans multiple lanes
  laneSpan?: number;          // 1 = single lane, 2-3 = blocks multiple lanes
  gapLane?: number;           // 0/1/2 = safe lane, -1 = no gap (only relevant if laneSpan > 1)
  // Visual identity for auto-generated component sprites
  bodyColor?: string;         // hex: chain body segment color (auto-sprite from this)
  projectileColor?: string;   // hex: projectile color (auto-sprite from this)

  // ── Engine-only fields (not in AI schema) ─────────────────
  isPowerup?: boolean;
  powerupType?: "shield" | "speed_boost" | "magnet" | "mega_honk";

  // ── AI-generated assets ───────────────────────────────────
  spriteData?: Array<{ x: number; y: number; w: number; h: number; c: string }>;
  segmentSpriteData?: Array<{ x: number; y: number; w: number; h: number; c: string }>; // Chain body segment sprite
  soundCategory?: "animal" | "vehicle" | "food" | "explosion" | "music" | "human" | "machine";
  imageUrl?: string;
  announcementAudio?: string;
  soundEffectAudio?: string;
}

export interface GameState {
  player: {
    lane: number;
    hp: number;
    score: number;
    distance: number;
    speed: number;
  };
  obstacles: GameObstacle[];
  speed: number;
  phase: "waiting" | "playing" | "game_over";
  elapsed: number;
  suggestionFeed: SuggestionFeedItem[];
}

export interface SuggestionFeedItem {
  text: string;
  result: string;
  timestamp: number;
  spriteData?: Array<{ x: number; y: number; w: number; h: number; c: string }>;
  color?: string;
}

export interface GameStats {
  distance: number;
  obstaclesDodged: number;
  audienceChaos: number;
  nearMisses: number;
  topSpeed: number;
  totalHits: number;
  survivalTime: number;
  rating: "Tourist" | "Xe Om Driver" | "Saigon Local" | "Traffic Legend";
}

// OpenAI structured output schema for obstacle generation
export const OBSTACLE_JSON_SCHEMA = {
  name: "game_obstacle",
  strict: true,
  schema: {
    type: "object" as const,
    properties: {
      obstacleType: { type: "string" as const, description: "A short snake_case identifier, e.g. water_buffalo, dragon_parade" },
      displayName: { type: "string" as const },
      lane: { type: "number" as const, enum: [0, 1, 2] },
      width: { type: "string" as const, enum: ["small", "medium", "large"] },
      speed: { type: "number" as const },
      color: { type: "string" as const, description: "Vivid hex color for the main body" },
      dangerLevel: { type: "number" as const, enum: [1, 2, 3] },
      label: { type: "string" as const },
      audienceMessage: { type: "string" as const },
      movement: { type: "string" as const, enum: ["straight", "weave", "drift"] },
      spriteData: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            x: { type: "number" as const },
            y: { type: "number" as const },
            w: { type: "number" as const },
            h: { type: "number" as const },
            c: { type: "string" as const },
          },
          required: ["x", "y", "w", "h", "c"] as const,
          additionalProperties: false,
        },
        description: "Simple fallback sprite: 8-12 basic colored rects outlining the shape.",
      },
      soundCategory: { type: "string" as const, enum: ["animal", "vehicle", "food", "explosion", "music", "human", "machine"] },
      // ── Composable Behavior Fields ──
      chainSegments: { type: "number" as const, description: "0 = single unit, 2-8 = chain of trailing segments" },
      chainAmplitude: { type: "number" as const, description: "0-100: how wildly the chain weaves (0 = straight, 100 = spans 2 lanes)" },
      chainSpacing: { type: "number" as const, description: "15-50: pixel gap between segments (15 = tight wall, 50 = loose with gaps)" },
      projectileInterval: { type: "number" as const, description: "0 = doesn't shoot, 0.5-4.0 = seconds between shots" },
      projectileSpeed: { type: "number" as const, description: "0.5-3.0: projectile speed (irrelevant if projectileInterval is 0)" },
      projectilePattern: { type: "string" as const, enum: ["forward", "aimed", "spread"], description: "forward = straight left, aimed = tracks player lane, spread = 3-way fan" },
      laneSpan: { type: "number" as const, enum: [1, 2, 3], description: "How many lanes wide (1 = normal)" },
      gapLane: { type: "number" as const, description: "-1 = no gap, 0/1/2 = which lane is safe (only matters if laneSpan > 1)" },
      bodyColor: { type: "string" as const, description: "Hex color for chain body segments" },
      projectileColor: { type: "string" as const, description: "Hex color for projectiles" },
    },
    required: [
      "obstacleType", "displayName", "lane", "width", "speed", "color",
      "dangerLevel", "label", "audienceMessage", "movement", "spriteData", "soundCategory",
      "chainSegments", "chainAmplitude", "chainSpacing",
      "projectileInterval", "projectileSpeed", "projectilePattern",
      "laneSpan", "gapLane", "bodyColor", "projectileColor",
    ],
    additionalProperties: false,
  },
} as const;

export const OPENAI_SYSTEM_PROMPT = `You are a WILDLY CREATIVE obstacle designer for "Saigon Rush", a chaotic motorbike runner game set in Ho Chi Minh City traffic.

Audience members suggest obstacles. ANYTHING can be on the road — people, animals, objects, celebrities, memes, abstract concepts. This is Vietnam, where literally anything can and does end up blocking traffic. Your job is to make it PHYSICAL, FUNNY, and DODGEABLE.

# The Golden Rule: EVERYTHING Becomes a Road Obstacle
- "blackpink" → BLACKPINK is literally performing a concert IN THE MIDDLE OF THE ROAD, speakers blasting, fans swarming
- "capitalism" → A GIANT DOLLAR SIGN on wheels rolling down the road, shooting receipts
- "my ex" → YOUR EX cruising past on a motorbike, throwing your belongings into traffic
- "wifi" → A MASSIVE WIFI ROUTER blocking 2 lanes, emitting signal waves
- "monday" → A GIANT ALARM CLOCK bouncing down the road at 6AM
- Abstract concepts become PHYSICAL manifestations. Celebrities become CHARACTERS doing something absurd on the road. Memes become LITERAL. Nothing is too weird.

# Creative Rules
- displayName: FUNNY and CAPITALIZED — a character or event, not just a noun
- label: emoji + short memorable name (max 20 chars)
- audienceMessage: vivid, hilarious 1-2 sentence description of what's happening ON THE ROAD
- AMPLIFY the suggestion to absurd levels while preserving its spirit
- speed: 0.5 (lumbering) to 2.0 (zooming) — match the obstacle's personality
- color: vivid hex that pops on dark road. bodyColor/projectileColor: thematic colors for chain segments and projectiles
- dangerLevel: 1 = nuisance, 2 = real threat, 3 = chaos
- movement: "straight", "weave" (erratic), "drift" (slow lane change) — used for non-chain obstacles
- spriteData: simple fallback sprite as {x,y,w,h,c} rectangles. 8-12 basic rects in a 50x40px canvas outlining the shape. Keep it simple — this is only used if image generation fails.
- soundCategory: "animal"/"vehicle"/"food"/"explosion"/"music"/"human"/"machine"
- Vietnamese street culture flavor when it fits (xe ôm, bánh mì, cyclos, karaoke, etc.) but don't force it — a "blackpink" suggestion should feel like K-pop, not Vietnamese

# Behavior Composition
These fields combine to define HOW the obstacle behaves. Set any to 0 to disable.

**Chain** (trailing connected segments — for long things):
- chainSegments: 0 = single unit. 2-8 = chain. Use for: conga lines, dragon parades, ducklings, centipedes, fan clubs following a celebrity, a train of shopping carts
- chainAmplitude: 0 = straight chain, 30 = gentle weave, 70 = crosses lanes, 100 = wild 2-lane sine
- chainSpacing: 15 = tight wall (hard to dodge through), 30 = normal, 50 = loose parade (gaps to slip between)
- When chain > 0: your spriteData is for the HEAD. Body segments auto-generate from bodyColor. Set lane to 0 or 1 (so sine can reach lane 2).

**Projectile** (fires things at the player — for ranged threats):
- projectileInterval: 0 = doesn't shoot. 0.8 = rapid fire, 2.0 = measured shots, 4.0 = rare surprise
- projectileSpeed: 1.0 = standard, 2.0+ = fast and scary
- projectilePattern: "forward" = straight left, "aimed" = tracks player's lane, "spread" = 3-way fan
- projectileColor: what the projectiles look like (slippers = brown, fire = orange, sound waves = pink, tweets = blue)
- When shooting, make speed slow (0.3-0.5) so it sits menacingly while firing

**Wide** (blocks multiple lanes — forces lane choice):
- laneSpan: 1 = normal, 2 = blocks 2 lanes, 3 = blocks all 3 (rare, terrifying)
- gapLane: 0/1/2 = which lane is safe. -1 = no gap (must boost through)

**These compose!** A dragon parade that breathes fire = chainSegments:6 + projectileInterval:3 + projectilePattern:"spread". BLACKPINK concert blocking traffic = laneSpan:2 + projectileInterval:1.5 + projectilePattern:"spread" (throwing lightsticks into the crowd).

# Examples
Input: "dragon" → chainSegments:7, chainAmplitude:60, chainSpacing:25, projectileInterval:3.0, projectilePattern:"spread", laneSpan:1, bodyColor:"#cc2222", projectileColor:"#ff6600"
Input: "angry grandma" → chainSegments:0, projectileInterval:1.5, projectilePattern:"aimed", projectileSpeed:1.5, projectileColor:"#8B4513", laneSpan:1 (throws slippers!)
Input: "blackpink" → chainSegments:4, chainAmplitude:30, chainSpacing:35, projectileInterval:2.0, projectilePattern:"spread", projectileColor:"#ff44aa", bodyColor:"#ff44aa", laneSpan:1 (4 members in formation throwing lightsticks!)
Input: "elon musk" → chainSegments:0, projectileInterval:1.0, projectilePattern:"aimed", projectileSpeed:2.5, projectileColor:"#44aaff", laneSpan:1 (launching tweets at you!)
Input: "traffic jam" → chainSegments:0, projectileInterval:0, laneSpan:3, gapLane:1 (absolute wall with one opening!)
Input: "water buffalo" → all behavior fields 0/1 (standard obstacle, nothing fancy — just a big animal in the road)
Input: "durian" → chainSegments:0, projectileInterval:0, laneSpan:1 (just a stinky fruit cart rolling by)

Most suggestions (~60%) should be standard (all behaviors 0/1). Use chain/projectile/wide when the suggestion NATURALLY fits — don't force mechanics onto things that are just funny obstacles.`;

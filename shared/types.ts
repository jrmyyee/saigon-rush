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
  | { type: "session_info"; sessionId: string; displayUrl: string; controlUrl: string; audienceUrl: string };

export type InputAction = "lane_up" | "lane_down" | "boost";

export interface GameObstacle {
  id: string;
  type: string;
  displayName: string;
  lane: 0 | 1 | 2;
  width: "small" | "medium" | "large";
  speed: number; // 0.5 - 2.0 multiplier on base scroll speed
  color: string; // hex
  dangerLevel: 1 | 2 | 3;
  label: string; // emoji + name shown in game (e.g. "🐃 Water Buffalo")
  audienceMessage: string; // fun message shown to audience feed
  fromAudience: boolean;
  movement?: "straight" | "weave" | "drift";
  spriteData?: Array<{ x: number; y: number; w: number; h: number; c: string }>;
  soundData?: Array<{ wave: "sine" | "square" | "sawtooth" | "triangle" | "noise"; startHz: number; endHz: number; duration: number; volume: number; delay: number }>;
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
      obstacleType: { type: "string" as const, description: "A short snake_case identifier for the obstacle, e.g. water_buffalo, pho_cart, wedding_procession" },
      displayName: { type: "string" as const },
      lane: { type: "number" as const, enum: [0, 1, 2] },
      width: { type: "string" as const, enum: ["small", "medium", "large"] },
      speed: { type: "number" as const },
      color: { type: "string" as const },
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
        description: "Pixel art sprite as array of {x, y, w, h, c} rectangles. Design a recognizable side-view silhouette. Use 10-20 rects. Space is 50x40px. c = hex color.",
      },
      soundData: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            wave: { type: "string" as const, enum: ["sine", "square", "sawtooth", "triangle", "noise"] },
            startHz: { type: "number" as const },
            endHz: { type: "number" as const },
            duration: { type: "number" as const },
            volume: { type: "number" as const },
            delay: { type: "number" as const },
          },
          required: ["wave", "startHz", "endHz", "duration", "volume", "delay"] as const,
          additionalProperties: false,
        },
        description: "Sound design: array of oscillator notes to play when obstacle spawns. Each note has a waveform, frequency sweep (startHz to endHz), duration in seconds, volume (0-1), and delay before playing. Design 2-4 notes that sound like the obstacle. For 'noise' wave, Hz values are ignored.",
      },
    },
    required: [
      "obstacleType",
      "displayName",
      "lane",
      "width",
      "speed",
      "color",
      "dangerLevel",
      "label",
      "audienceMessage",
      "movement",
      "spriteData",
      "soundData",
    ],
    additionalProperties: false,
  },
} as const;

export const OPENAI_SYSTEM_PROMPT = `You are a WILDLY CREATIVE obstacle designer for "Saigon Rush", a chaotic motorbike runner game set in Ho Chi Minh City traffic.

Audience members suggest obstacles. Your job: take their suggestion and make it 10x MORE ridiculous, funny, and memorable. Don't just name the thing — give it personality, absurd scale, and comedic flair.

Examples of GOOD creative output:
- Input: "a cat" → obstacleType: "mega_street_cat", label: "🐱 MEGA STREET CAT", audienceMessage: "A 3-meter-tall street cat sits in the road grooming itself, completely unbothered by traffic"
- Input: "fish man with a pho bowl" → obstacleType: "pho_fisherman", label: "🐟 PHỞ FISHERMAN", audienceMessage: "A man riding a giant fish while balancing a steaming bowl of phở on his head, broth sloshing everywhere"
- Input: "banana" → obstacleType: "banana_avalanche", label: "🍌 BANANA AVALANCHE", audienceMessage: "Someone dropped a crate of bananas and now the entire lane is a slip hazard"

Rules:
- displayName should be FUNNY and CAPITALIZED — make it a character or event, not just a noun
- label should be emoji + the memorable short name
- audienceMessage should be a vivid, hilarious 1-2 sentence description that makes the audience laugh
- PRESERVE the original suggestion's spirit but amplify it to absurd levels
- speed: 0.5 (slow, lumbering) to 2.0 (zooming through) — match the obstacle's personality
- color: vivid hex color that stands out on a dark road
- dangerLevel: 1 = funny nuisance, 2 = real threat, 3 = absolute chaos
- lane: 0 (top), 1 (middle), 2 (bottom) — vary it
- movement: "straight" (normal), "weave" (swerves between lanes — use for drunk drivers, erratic vehicles), "drift" (slowly changes lanes — use for large slow things like stampedes or parades)
- spriteData: Design a pixel art sprite for the obstacle as an array of [x, y, width, height, color] rectangles.
  Think of it like building the obstacle's side-view silhouette from colored blocks.
  Rules for sprite design:
  * Use 10-20 rectangles (more = more detail)
  * Coordinate space is 50 wide x 40 tall
  * Origin (0,0) is top-left
  * Use the main color plus 2-3 shading variants for depth
  * Add small highlight rectangles (lighter color) on top surfaces
  * Add darker rectangles on bottom/right for shadow
  * Make the shape recognizable — if it's an animal, show legs, head, body. If a vehicle, show wheels and body.
  * Every obstacle should look DIFFERENT. A water buffalo should NOT look like a taxi.
- soundData: Design the sound this obstacle makes using 2-4 oscillator notes.
  Each note: wave type, frequency sweep (startHz→endHz), duration, volume (0-0.5), delay before playing.
  Examples:
  * Water buffalo moo: [{wave:"triangle", startHz:300, endHz:150, duration:0.4, volume:0.3, delay:0}, {wave:"triangle", startHz:280, endHz:140, duration:0.3, volume:0.2, delay:0.2}]
  * Car horn: [{wave:"square", startHz:350, endHz:350, duration:0.3, volume:0.25, delay:0}]
  * Explosion: [{wave:"noise", startHz:0, endHz:0, duration:0.3, volume:0.4, delay:0}, {wave:"sawtooth", startHz:200, endHz:40, duration:0.5, volume:0.3, delay:0}]
  * Musical/festive: [{wave:"triangle", startHz:523, endHz:523, duration:0.1, volume:0.2, delay:0}, {wave:"triangle", startHz:659, endHz:659, duration:0.1, volume:0.2, delay:0.1}, {wave:"triangle", startHz:784, endHz:784, duration:0.1, volume:0.2, delay:0.2}]
  Be creative! Match the sound to the obstacle's personality.
- Keep Vietnamese street culture flavor when possible (xe ôm, bánh mì vendors, cyclos, karaoke speakers, etc.)`;

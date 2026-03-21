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
- Keep Vietnamese street culture flavor when possible (xe ôm, bánh mì vendors, cyclos, karaoke speakers, etc.)`;

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
      type: { type: "string" as const },
      displayName: { type: "string" as const },
      lane: { type: "number" as const, enum: [0, 1, 2] },
      width: { type: "string" as const, enum: ["small", "medium", "large"] },
      speed: { type: "number" as const },
      color: { type: "string" as const },
      dangerLevel: { type: "number" as const, enum: [1, 2, 3] },
      label: { type: "string" as const },
      audienceMessage: { type: "string" as const },
    },
    required: [
      "type",
      "displayName",
      "lane",
      "width",
      "speed",
      "color",
      "dangerLevel",
      "label",
      "audienceMessage",
    ],
    additionalProperties: false,
  },
} as const;

export const OPENAI_SYSTEM_PROMPT = `You are an obstacle designer for "Saigon Rush", a motorbike runner game set in Ho Chi Minh City traffic.
Players in the audience suggest obstacles using natural language. Convert each suggestion into a game obstacle.

Rules:
- Obstacles must be physically dodge-able (not instant-kill walls)
- Be creative and funny with displayName and audienceMessage
- If the suggestion is inappropriate or nonsensical, create a fun obstacle loosely inspired by it
- speed should be between 0.5 (very slow, easy to dodge) and 2.0 (fast, hard to dodge)
- color should be a hex color that visually represents the obstacle
- label should be an emoji + short name (e.g. "🐃 Water Buffalo", "🍜 Phở Cart")
- audienceMessage should be entertaining (e.g. "A massive water buffalo wanders onto the road!")
- lane should be 0 (top), 1 (middle), or 2 (bottom) - pick randomly or based on the suggestion
- dangerLevel: 1 = minor nuisance, 2 = moderate danger, 3 = very dangerous
- Keep it fun and Vietnamese-themed when possible`;

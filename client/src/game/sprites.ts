// Saigon Rush — fillRect pixel art sprite definitions (polished version)
// Each sprite is an array of [relX, relY, width, height, color] tuples
// All coordinates are relative to the sprite origin (top-left)
// Color palette: neon-on-dark, with depth shading via lighter/darker variants

export type SpriteRect = [number, number, number, number, string];
export type SpriteDefinition = SpriteRect[];

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: SpriteDefinition,
  x: number,
  y: number,
  scale: number = 1,
): void {
  for (const [rx, ry, w, h, color] of sprite) {
    ctx.fillStyle = color;
    ctx.fillRect(
      Math.round(x + rx * scale),
      Math.round(y + ry * scale),
      Math.round(w * scale),
      Math.round(h * scale),
    );
  }
}

// ── Player Motorbike with Rider (~40px wide at scale 1) ─────────────
// Bright cyan/blue body, white highlights, detailed rider
export const MOTORBIKE_SPRITE: SpriteDefinition = [
  // === Back wheel ===
  [1, 26, 12, 12, "#111111"],  // Tire outer
  [2, 27, 10, 10, "#1a1a1a"],  // Tire mid
  [3, 28, 8, 8, "#333333"],    // Rim
  [5, 30, 4, 4, "#555555"],    // Hub
  [4, 29, 1, 6, "#444444"],    // Spoke
  [7, 28, 1, 2, "#444444"],    // Spoke top

  // === Front wheel ===
  [28, 26, 12, 12, "#111111"],
  [29, 27, 10, 10, "#1a1a1a"],
  [30, 28, 8, 8, "#333333"],
  [32, 30, 4, 4, "#555555"],
  [31, 29, 1, 6, "#444444"],
  [34, 28, 1, 2, "#444444"],

  // === Frame / body ===
  [10, 22, 20, 5, "#0088cc"],   // Main frame - bright cyan
  [8, 20, 6, 4, "#0077bb"],     // Rear frame section
  [26, 18, 6, 6, "#0077bb"],    // Front fork upper
  [28, 24, 3, 4, "#006699"],    // Front fork lower
  // Frame highlight (top edge catch light)
  [11, 22, 18, 1, "#33bbff"],

  // === Engine block ===
  [12, 25, 8, 4, "#444444"],
  [13, 26, 6, 2, "#555555"],    // Engine detail
  [11, 26, 2, 2, "#666666"],    // Cylinder fin

  // === Exhaust pipe ===
  [2, 24, 9, 2, "#777777"],
  [1, 23, 3, 2, "#888888"],
  [0, 22, 2, 2, "#aa3333"],     // Exhaust tip (hot)
  [0, 21, 1, 1, "#ff6644"],     // Exhaust glow

  // === Seat ===
  [14, 17, 12, 4, "#222222"],   // Seat base
  [15, 17, 10, 1, "#333333"],   // Seat highlight
  [14, 21, 2, 2, "#1a1a1a"],    // Seat back

  // === Handlebars ===
  [30, 14, 2, 6, "#555555"],    // Stem
  [29, 12, 4, 2, "#777777"],    // Crossbar
  [28, 11, 2, 2, "#888888"],    // Left grip
  [32, 11, 2, 2, "#888888"],    // Right grip
  [33, 10, 2, 1, "#999999"],    // Mirror

  // === Headlight ===
  [33, 19, 4, 3, "#ffee55"],    // Main beam
  [34, 20, 2, 1, "#ffffff"],    // Bright center
  [32, 18, 1, 1, "#ffcc33"],    // Housing edge

  // === Tail light ===
  [7, 20, 2, 2, "#ff2222"],
  [7, 21, 1, 1, "#ff4444"],     // Tail glow

  // === Rider torso ===
  [16, 7, 9, 10, "#1155aa"],    // Jacket body (dark blue)
  [17, 8, 7, 8, "#1166bb"],     // Jacket mid highlight
  [18, 9, 5, 4, "#1177cc"],     // Jacket bright center
  // Collar
  [18, 7, 5, 1, "#ffffff"],

  // === Rider head ===
  [18, 1, 6, 6, "#e8b88a"],     // Face/skin
  [19, 3, 1, 1, "#333333"],     // Eye

  // === Helmet ===
  [17, -1, 8, 4, "#cc1111"],    // Shell
  [18, -1, 6, 1, "#ff3333"],    // Top highlight
  [17, 2, 8, 1, "#aa0000"],     // Brim
  [24, 1, 2, 2, "#aaddff"],     // Visor

  // === Rider arms ===
  [24, 10, 3, 2, "#e8b88a"],    // Upper arm
  [27, 11, 3, 2, "#e8b88a"],    // Forearm reaching to handlebar
  [25, 9, 2, 2, "#1155aa"],     // Sleeve

  // === Rider legs ===
  [14, 14, 5, 8, "#223366"],    // Upper leg (dark jeans)
  [15, 15, 3, 6, "#2a3d77"],    // Leg highlight
  [19, 17, 4, 5, "#223366"],    // Lower leg
  [13, 21, 3, 2, "#111111"],    // Boot
  [19, 22, 3, 2, "#111111"],    // Boot

  // === Fender ===
  [27, 25, 6, 1, "#006699"],    // Front fender
  [6, 25, 5, 1, "#006699"],     // Rear fender
];

// ── Vinasun Taxi (white body with red/green stripes) ─────────────
export const TAXI_SPRITE: SpriteDefinition = [
  // === Body ===
  [0, 12, 52, 16, "#f0f0f0"],    // Main body white
  [0, 13, 52, 6, "#ffffff"],      // Upper body bright
  [0, 19, 52, 8, "#e0e0e0"],     // Lower body shadow

  // === Vinasun stripe (red + green) ===
  [0, 18, 52, 2, "#cc2222"],     // Red stripe
  [0, 20, 52, 2, "#22aa44"],     // Green stripe below

  // === Roof ===
  [8, 4, 32, 10, "#e8e8e8"],
  [9, 5, 30, 2, "#f5f5f5"],     // Roof highlight

  // === Taxi roof light ===
  [20, 0, 10, 5, "#ffffff"],
  [21, 1, 8, 3, "#ff3333"],     // TAXI sign lit red
  [22, 1, 6, 1, "#ff6666"],     // Light glow

  // === Windshield ===
  [36, 5, 8, 9, "#88ccff"],     // Glass
  [37, 6, 6, 7, "#aaddff"],     // Glass highlight
  [36, 5, 1, 9, "#cccccc"],     // Frame

  // === Rear window ===
  [10, 5, 8, 9, "#88ccff"],
  [11, 6, 6, 7, "#aaddff"],
  [17, 5, 1, 9, "#cccccc"],

  // === Side window ===
  [20, 6, 14, 7, "#88ccff"],
  [21, 7, 12, 5, "#99ddff"],

  // === Bumpers ===
  [48, 14, 6, 12, "#cccccc"],
  [49, 16, 4, 8, "#dddddd"],   // Bumper highlight
  [-2, 14, 4, 12, "#cccccc"],

  // === Front wheel ===
  [38, 26, 10, 10, "#111111"],
  [39, 27, 8, 8, "#2a2a2a"],
  [41, 29, 4, 4, "#444444"],    // Hub cap

  // === Rear wheel ===
  [6, 26, 10, 10, "#111111"],
  [7, 27, 8, 8, "#2a2a2a"],
  [9, 29, 4, 4, "#444444"],

  // === Headlights ===
  [50, 16, 4, 3, "#ffee55"],
  [51, 17, 2, 1, "#ffffff"],    // Bright center

  // === Tail lights ===
  [-2, 16, 3, 3, "#ff2222"],
  [-1, 17, 1, 1, "#ff6666"],   // Glow

  // === Door line + handle ===
  [24, 12, 1, 14, "#cccccc"],
  [25, 19, 2, 1, "#aaaaaa"],   // Handle

  // === Side mirror ===
  [36, 10, 3, 2, "#bbbbbb"],
];

// ── Pho Cart (wooden cart with pot, umbrella, steam) ────────────
export const PHO_CART_SPRITE: SpriteDefinition = [
  // === Cart body ===
  [4, 18, 28, 12, "#b85c2c"],   // Wood base
  [5, 19, 26, 4, "#cc6e3a"],    // Wood lighter panel
  [5, 23, 26, 4, "#a04e22"],    // Wood darker lower
  [4, 18, 28, 1, "#dd8844"],    // Top edge highlight

  // === Cart front panel ===
  [30, 16, 4, 16, "#9e4420"],
  [31, 17, 2, 14, "#b85c2c"],   // Panel highlight

  // === Cart legs ===
  [6, 30, 2, 6, "#555555"],
  [8, 30, 1, 6, "#666666"],
  [26, 30, 2, 6, "#555555"],
  [28, 30, 1, 6, "#666666"],

  // === Wheel ===
  [14, 32, 8, 8, "#333333"],    // Tire
  [15, 33, 6, 6, "#555555"],    // Rim
  [17, 35, 2, 2, "#777777"],    // Hub

  // === Large soup pot ===
  [8, 10, 14, 10, "#888888"],   // Pot body
  [9, 11, 12, 8, "#999999"],    // Pot highlight
  [7, 10, 16, 2, "#aaaaaa"],    // Pot rim
  [10, 18, 10, 2, "#777777"],   // Pot base

  // === Broth in pot (visible from top) ===
  [10, 12, 10, 3, "#cc8844"],   // Amber broth

  // === Bowl on counter ===
  [24, 14, 8, 4, "#dddddd"],    // Bowl
  [25, 14, 6, 1, "#ffffff"],    // Bowl rim highlight
  [25, 15, 6, 2, "#cc9955"],    // Noodle soup in bowl

  // === Condiment bottles ===
  [5, 14, 2, 4, "#884422"],     // Soy sauce
  [5, 13, 2, 1, "#aa5533"],     // Cap

  // === Steam puffs (semi-transparent) ===
  [11, 6, 4, 4, "#ffffff44"],
  [12, 4, 3, 3, "#ffffff33"],
  [16, 5, 3, 4, "#ffffff44"],
  [18, 2, 4, 3, "#ffffff22"],
  [13, 1, 3, 3, "#ffffff22"],
  [10, 3, 2, 2, "#ffffff18"],

  // === Umbrella pole ===
  [18, -10, 2, 22, "#664422"],
  [18, -10, 2, 1, "#886644"],   // Pole top highlight

  // === Umbrella (striped red/orange) ===
  [4, -14, 28, 5, "#ee4422"],   // Main canopy
  [6, -15, 24, 2, "#ff5533"],   // Top curve highlight
  [4, -14, 4, 5, "#ff6633"],    // Stripe 1
  [12, -14, 4, 5, "#ff6633"],   // Stripe 2
  [20, -14, 4, 5, "#ff6633"],   // Stripe 3
  [28, -14, 4, 5, "#ff6633"],   // Stripe 4
  // Umbrella edge shadow
  [4, -10, 28, 1, "#cc3311"],

  // === Hanging lantern (decorative) ===
  [1, 14, 3, 3, "#ff4444"],
  [1, 13, 3, 1, "#ffaa44"],
];

// ── HCMC Bus (Mai Linh style — long, green, windowed) ───────────
export const BUS_SPRITE: SpriteDefinition = [
  // === Main body ===
  [0, 6, 64, 22, "#1a8a3e"],      // Body green
  [0, 7, 64, 10, "#1fa048"],      // Upper body lighter
  [0, 17, 64, 10, "#148530"],     // Lower body darker

  // === White stripe ===
  [0, 16, 64, 2, "#ffffff"],
  [0, 15, 64, 1, "#dddddd"],      // Stripe shadow

  // === Roof ===
  [2, 2, 60, 6, "#178838"],
  [3, 2, 58, 1, "#22aa4a"],       // Roof top highlight
  // AC unit on roof
  [20, 0, 24, 3, "#cccccc"],
  [22, 0, 20, 1, "#dddddd"],

  // === Windshield (large, angled) ===
  [52, 7, 10, 14, "#77bbee"],
  [53, 8, 8, 12, "#99ddff"],
  [54, 9, 6, 4, "#aaeeff"],       // Reflection highlight

  // === Side windows (evenly spaced) ===
  [6, 8, 7, 7, "#77bbee"],
  [15, 8, 7, 7, "#77bbee"],
  [24, 8, 7, 7, "#77bbee"],
  [33, 8, 7, 7, "#77bbee"],
  [42, 8, 7, 7, "#77bbee"],
  // Window inner highlights
  [7, 9, 5, 5, "#88ccff"],
  [16, 9, 5, 5, "#88ccff"],
  [25, 9, 5, 5, "#88ccff"],
  [34, 9, 5, 5, "#88ccff"],
  [43, 9, 5, 5, "#88ccff"],

  // === Window dividers ===
  [13, 7, 2, 9, "#148530"],
  [22, 7, 2, 9, "#148530"],
  [31, 7, 2, 9, "#148530"],
  [40, 7, 2, 9, "#148530"],
  [49, 7, 2, 9, "#148530"],

  // === Door (middle, darker) ===
  [28, 12, 6, 16, "#0f6628"],
  [29, 13, 4, 14, "#117730"],

  // === Bumper ===
  [60, 10, 6, 16, "#bbbbbb"],
  [61, 12, 4, 12, "#cccccc"],

  // === Front wheel ===
  [50, 26, 10, 10, "#111111"],
  [51, 27, 8, 8, "#2a2a2a"],
  [53, 29, 4, 4, "#444444"],

  // === Rear wheel ===
  [6, 26, 10, 10, "#111111"],
  [7, 27, 8, 8, "#2a2a2a"],
  [9, 29, 4, 4, "#444444"],

  // === Headlights ===
  [62, 12, 4, 3, "#ffee55"],
  [63, 13, 2, 1, "#ffffff"],

  // === Tail lights ===
  [-2, 12, 3, 4, "#ff2222"],
  [-1, 14, 1, 1, "#ff5555"],

  // === Route number area (white box with "number" bars) ===
  [54, 2, 8, 5, "#ffffff"],
  [55, 3, 2, 3, "#222222"],      // "Route" digit 1
  [58, 3, 2, 3, "#222222"],      // "Route" digit 2

  // === Side mirrors ===
  [60, 8, 3, 2, "#999999"],

  // === Destination sign (above windshield) ===
  [52, 3, 10, 3, "#111111"],
  [53, 4, 8, 1, "#ffaa00"],     // LED text placeholder
];

// ── Cyclo (iconic Vietnamese three-wheeled pedicab) ─────────────
export const CYCLO_SPRITE: SpriteDefinition = [
  // === Passenger seat (front, wide wicker) ===
  [0, 12, 18, 14, "#8b6914"],    // Wicker body
  [1, 13, 16, 5, "#a07818"],     // Upper wicker lighter
  [1, 18, 16, 7, "#7a5c10"],     // Lower wicker darker
  // Seat cushion
  [2, 14, 14, 4, "#cc3333"],     // Red cushion
  [3, 14, 12, 1, "#dd4444"],     // Cushion highlight

  // === Canopy / shade ===
  [-2, 4, 22, 3, "#336633"],     // Canopy fabric
  [-1, 5, 20, 1, "#44774a"],     // Canopy highlight
  [-2, 7, 1, 7, "#444444"],      // Left canopy pole
  [19, 7, 1, 7, "#444444"],      // Right canopy pole

  // === Foot rest ===
  [0, 26, 16, 2, "#555555"],

  // === Front wheels (two side by side, we show one) ===
  [2, 28, 10, 10, "#111111"],
  [3, 29, 8, 8, "#333333"],
  [5, 31, 4, 4, "#555555"],

  // === Frame / chassis ===
  [16, 18, 12, 3, "#555555"],    // Connecting frame
  [17, 19, 10, 1, "#666666"],    // Frame highlight
  [26, 16, 2, 8, "#555555"],     // Vertical to seat post

  // === Driver seat (rear, higher) ===
  [24, 12, 8, 6, "#222222"],     // Seat
  [25, 12, 6, 1, "#333333"],     // Seat highlight

  // === Rear wheel ===
  [24, 28, 10, 10, "#111111"],
  [25, 29, 8, 8, "#333333"],
  [27, 31, 4, 4, "#555555"],

  // === Pedals / chain area ===
  [22, 22, 4, 3, "#666666"],
  [23, 24, 2, 2, "#888888"],

  // === Driver ===
  // Torso
  [25, 4, 6, 8, "#4a3728"],      // Dark shirt
  [26, 5, 4, 6, "#5a4738"],      // Shirt highlight
  // Head
  [26, -1, 5, 5, "#d4a574"],     // Face
  // Conical hat (non la)
  [24, -5, 9, 3, "#c4a45a"],     // Hat brim
  [26, -6, 5, 2, "#d4b46a"],     // Hat top
  [27, -7, 3, 1, "#c4a45a"],     // Hat peak
  // Arms on handlebars
  [22, 10, 3, 2, "#d4a574"],
  [20, 11, 3, 2, "#d4a574"],
  // Legs
  [24, 12, 3, 8, "#335577"],
  [27, 14, 3, 6, "#335577"],
  [23, 20, 3, 2, "#222222"],     // Shoe

  // === Handlebars ===
  [19, 12, 3, 1, "#888888"],
  [18, 13, 2, 1, "#999999"],
];

// ── Generic Obstacle (improved — crate / barrel stack) ──────────
export const GENERIC_OBSTACLE_SPRITE: SpriteDefinition = [
  // Bottom crate
  [0, 12, 24, 16, "#6b5b3a"],
  [1, 13, 22, 6, "#7d6b48"],    // Lighter top
  [1, 19, 22, 8, "#5a4c30"],    // Darker bottom
  // Crate slats
  [0, 12, 24, 1, "#8b7b5a"],    // Top edge
  [0, 20, 24, 1, "#4a3c22"],    // Mid line
  [11, 12, 2, 16, "#4a3c22"],   // Vertical slat

  // Top crate (smaller, offset)
  [3, 0, 18, 14, "#7d6b48"],
  [4, 1, 16, 6, "#8d7b58"],
  [4, 7, 16, 6, "#6b5b3a"],
  [3, 0, 18, 1, "#9b8b68"],
  [3, 7, 18, 1, "#5a4c30"],
  [11, 0, 2, 14, "#5a4c30"],

  // Danger marking
  [6, 3, 8, 4, "#ffcc00"],
  [8, 4, 4, 2, "#ff8800"],      // Inner warning

  // Bottom supports
  [2, 28, 4, 2, "#444444"],
  [18, 28, 4, 2, "#444444"],
];

// ── Map obstacle type to sprite ─────────────────────────────────
export function getSpriteForType(type: string): SpriteDefinition {
  switch (type) {
    case "slow_motorbike":
      return MOTORBIKE_SPRITE;
    case "taxi":
      return TAXI_SPRITE;
    case "pho_cart":
      return PHO_CART_SPRITE;
    case "bus":
      return BUS_SPRITE;
    case "cyclo":
      return CYCLO_SPRITE;
    default:
      return GENERIC_OBSTACLE_SPRITE;
  }
}

// Generate a dynamic colored sprite for AI-generated obstacles
// Uses the obstacle's color from AI to create a unique-looking obstacle
export function createDynamicSprite(color: string, width: "small" | "medium" | "large"): SpriteDefinition {
  const w = width === "small" ? 30 : width === "medium" ? 50 : 70;
  const h = width === "small" ? 20 : width === "medium" ? 28 : 35;
  // Darken and lighten the base color for depth
  const darken = (hex: string, amt: number) => {
    const n = parseInt(hex.replace("#", ""), 16);
    const r = Math.max(0, (n >> 16) - amt);
    const g = Math.max(0, ((n >> 8) & 0xff) - amt);
    const b = Math.max(0, (n & 0xff) - amt);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
  };
  const lighten = (hex: string, amt: number) => {
    const n = parseInt(hex.replace("#", ""), 16);
    const r = Math.min(255, (n >> 16) + amt);
    const g = Math.min(255, ((n >> 8) & 0xff) + amt);
    const b = Math.min(255, (n & 0xff) + amt);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
  };
  return [
    // Main body
    [2, 4, w - 4, h - 6, color],
    // Top highlight
    [2, 4, w - 4, 3, lighten(color, 40)],
    // Bottom shadow
    [2, h - 4, w - 4, 2, darken(color, 50)],
    // Left edge
    [0, 6, 3, h - 10, darken(color, 30)],
    // Right edge
    [w - 3, 6, 3, h - 10, darken(color, 30)],
    // Eye/detail left (gives it character)
    [Math.floor(w * 0.2), 8, 4, 4, "#ffffff"],
    [Math.floor(w * 0.2) + 1, 9, 2, 2, "#111111"],
    // Eye/detail right
    [Math.floor(w * 0.65), 8, 4, 4, "#ffffff"],
    [Math.floor(w * 0.65) + 1, 9, 2, 2, "#111111"],
    // "Mouth" or detail line
    [Math.floor(w * 0.3), 16, Math.floor(w * 0.4), 2, darken(color, 40)],
    // Wheels/feet
    [4, h - 2, 6, 3, "#222222"],
    [w - 10, h - 2, 6, 3, "#222222"],
  ];
}

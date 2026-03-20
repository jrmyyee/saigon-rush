// Saigon Rush — fillRect pixel art sprite definitions
// Each sprite is an array of [relX, relY, width, height, color] tuples
// All coordinates are relative to the sprite origin (top-left)

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

// Side-view motorbike with rider (~40px wide at scale 1)
export const MOTORBIKE_SPRITE: SpriteDefinition = [
  // Back wheel
  [2, 24, 10, 10, "#222222"],
  [3, 25, 8, 8, "#444444"],
  // Front wheel
  [28, 24, 10, 10, "#222222"],
  [29, 25, 8, 8, "#444444"],
  // Frame / body
  [8, 20, 22, 6, "#2266cc"],
  [6, 18, 8, 4, "#2266cc"],
  [24, 16, 8, 6, "#2266cc"],
  // Engine block
  [10, 24, 8, 4, "#555555"],
  // Exhaust pipe
  [2, 22, 8, 2, "#888888"],
  [0, 21, 3, 2, "#aa4444"],
  // Seat
  [14, 16, 10, 4, "#333333"],
  // Handlebars
  [30, 12, 3, 6, "#666666"],
  [31, 10, 4, 3, "#888888"],
  // Headlight
  [32, 18, 3, 3, "#ffee55"],
  // Rider torso
  [16, 6, 8, 10, "#dd5533"],
  // Rider head
  [17, 0, 6, 6, "#ffcc88"],
  // Helmet
  [16, -1, 8, 4, "#cc2222"],
  // Rider arm (on handlebars)
  [24, 10, 6, 3, "#ffcc88"],
  // Rider leg
  [14, 14, 4, 8, "#335588"],
  [18, 16, 4, 6, "#335588"],
];

// Yellow taxi — wider, recognizable cab shape
export const TAXI_SPRITE: SpriteDefinition = [
  // Body
  [0, 12, 50, 16, "#ffdd00"],
  // Roof
  [8, 4, 30, 10, "#ffdd00"],
  // Roof light
  [20, 0, 8, 5, "#ffffff"],
  [21, 1, 6, 3, "#ff4444"],
  // Windshield
  [34, 5, 6, 9, "#aaddff"],
  // Rear window
  [10, 5, 6, 9, "#aaddff"],
  // Front bumper
  [46, 14, 6, 10, "#cccccc"],
  // Rear bumper
  [-2, 14, 4, 10, "#cccccc"],
  // Front wheel
  [36, 26, 10, 10, "#222222"],
  [37, 27, 8, 8, "#444444"],
  // Rear wheel
  [6, 26, 10, 10, "#222222"],
  [7, 27, 8, 8, "#444444"],
  // Headlights
  [48, 16, 4, 4, "#ffee55"],
  // Tail lights
  [-2, 16, 3, 4, "#ff2222"],
  // Door line
  [22, 12, 2, 14, "#ccaa00"],
];

// Pho cart — smaller, orange/brown with umbrella
export const PHO_CART_SPRITE: SpriteDefinition = [
  // Cart body
  [4, 16, 28, 12, "#dd7733"],
  // Cart front panel
  [30, 14, 4, 16, "#cc6622"],
  // Cart legs
  [6, 28, 3, 6, "#666666"],
  [26, 28, 3, 6, "#666666"],
  // Wheel
  [14, 30, 8, 8, "#444444"],
  [15, 31, 6, 6, "#666666"],
  // Pot / steam bowl
  [10, 10, 12, 8, "#aaaaaa"],
  [12, 6, 8, 5, "#cccccc"],
  // Steam puffs
  [13, 2, 3, 4, "#ffffff88"],
  [18, 0, 3, 4, "#ffffff88"],
  // Umbrella pole
  [18, -8, 2, 18, "#886644"],
  // Umbrella
  [6, -12, 24, 5, "#ff6633"],
  [8, -13, 20, 3, "#ee5522"],
];

// Green bus — large, tall
export const BUS_SPRITE: SpriteDefinition = [
  // Main body
  [0, 6, 60, 22, "#33aa55"],
  // Roof
  [2, 2, 56, 6, "#2d9648"],
  // Windshield
  [50, 8, 8, 14, "#aaddff"],
  // Side windows
  [6, 8, 8, 8, "#aaddff"],
  [16, 8, 8, 8, "#aaddff"],
  [26, 8, 8, 8, "#aaddff"],
  [36, 8, 8, 8, "#aaddff"],
  // Window dividers
  [14, 8, 2, 8, "#2d9648"],
  [24, 8, 2, 8, "#2d9648"],
  [34, 8, 2, 8, "#2d9648"],
  [44, 8, 2, 8, "#2d9648"],
  // Bumper
  [56, 10, 6, 14, "#cccccc"],
  // Front wheel
  [46, 26, 10, 10, "#222222"],
  [47, 27, 8, 8, "#444444"],
  // Rear wheel
  [6, 26, 10, 10, "#222222"],
  [7, 27, 8, 8, "#444444"],
  // Headlights
  [58, 12, 4, 4, "#ffee55"],
  // Tail lights
  [-2, 12, 3, 4, "#ff2222"],
  // Route number area
  [52, 2, 6, 5, "#ffffff"],
];

// Generic fallback obstacle — simple colored rect stack
export const GENERIC_OBSTACLE_SPRITE: SpriteDefinition = [
  [0, 4, 24, 20, "#888888"],
  [2, 0, 20, 6, "#999999"],
  [4, 22, 6, 6, "#555555"],
  [14, 22, 6, 6, "#555555"],
  [8, 8, 8, 4, "#ffcc00"],
];

// Map obstacle type to sprite
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
    default:
      return GENERIC_OBSTACLE_SPRITE;
  }
}

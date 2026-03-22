// Saigon Rush — Game entities: Player, obstacles, road/background, particles
// Polished neon-on-dark aesthetic with gradient sky, lit buildings, streetlights

import type { GameObstacle } from "@shared/types";
import { type SpriteDefinition, drawSprite, getSpriteForType, MOTORBIKE_SPRITE } from "./sprites";
import { getLibrarySprite } from "./spriteLibrary";

// ── Obstacle Image Cache (fal.ai generated images) ────────
const imageCache = new Map<string, HTMLImageElement>();
const imageLoading = new Set<string>();

export function preloadObstacleImage(url: string): void {
  if (imageCache.has(url) || imageLoading.has(url)) return;
  imageLoading.add(url);
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    imageCache.set(url, img);
    imageLoading.delete(url);
  };
  img.onerror = () => {
    imageLoading.delete(url);
  };
  img.src = url;
}

export function getObstacleImage(url: string): HTMLImageElement | null {
  return imageCache.get(url) || null;
}

// ── Constants ──────────────────────────────────────────────
export const CANVAS_W = 960;
export const CANVAS_H = 640;
export const LANE_Y = [180, 320, 460]; // Top, middle, bottom lane center Y
export const PLAYER_X = CANVAS_W * 0.2; // Fixed X at 20% from left
export const WIDTH_MAP = { small: 40, medium: 80, large: 140 } as const;
const HITBOX_SCALE = 0.65; // 65% of visual size for generous collision

// ── Player ─────────────────────────────────────────────────
export interface Player {
  lane: number;
  y: number;
  targetY: number;
  hp: number;
  maxHp: number;
  invincible: boolean;
  invincibleTimer: number;
  score: number;
  distance: number;
  dodgeCombo: number;
}

export function createPlayer(): Player {
  return {
    lane: 1,
    y: LANE_Y[1],
    targetY: LANE_Y[1],
    hp: 5,
    maxHp: 5,
    invincible: false,
    invincibleTimer: 0,
    score: 0,
    distance: 0,
    dodgeCombo: 0,
  };
}

export function updatePlayer(p: Player, dt: number): void {
  // Smooth lane transition via lerp
  p.y += (p.targetY - p.y) * 10 * dt;
  // Invincibility countdown
  if (p.invincible) {
    p.invincibleTimer -= dt;
    if (p.invincibleTimer <= 0) {
      p.invincible = false;
      p.invincibleTimer = 0;
    }
  }
}

export function playerHit(p: Player): void {
  if (p.invincible) return;
  p.hp = Math.max(0, p.hp - 1);
  p.invincible = true;
  p.invincibleTimer = 1.0;
  p.dodgeCombo = 0;
}

export function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, frameCount: number): void {
  // Flash when invincible (blink every 4 frames)
  if (p.invincible && Math.floor(frameCount / 4) % 2 === 0) return;

  // Player glow effect (subtle cyan shadow underneath)
  ctx.fillStyle = "#0088cc18";
  ctx.fillRect(PLAYER_X - 28, p.y - 8, 50, 30);
  ctx.fillStyle = "#0088cc10";
  ctx.fillRect(PLAYER_X - 32, p.y - 4, 58, 24);

  drawSprite(ctx, MOTORBIKE_SPRITE, PLAYER_X - 20, p.y - 18, 1.1);

  // Headlight beam (forward cone of light)
  ctx.fillStyle = "#ffee5508";
  ctx.fillRect(PLAYER_X + 18, p.y - 4, 40, 8);
  ctx.fillStyle = "#ffee5504";
  ctx.fillRect(PLAYER_X + 18, p.y - 8, 60, 16);
}

// ── Active Obstacle (runtime state) ───────────────────────
export interface SnakeSegment {
  x: number;
  y: number;
}

export interface ActiveObstacle {
  data: GameObstacle;
  x: number;
  y: number;
  pixelWidth: number;
  pixelHeight: number;
  passed: boolean; // True once player has passed it (for dodge scoring)
  nearMissTriggered: boolean;
  movement: "straight" | "weave" | "drift";
  sinePhase: number;
  startY: number;
  driftTargetY: number;
  driftElapsed: number;
  // Snake mechanic: chain of connected segments
  snakeSegments?: SnakeSegment[];
  // Projectile shooter: countdown timer to next shot
  shootTimer?: number;
}

export function spawnObstacle(data: GameObstacle): ActiveObstacle {
  const pw = WIDTH_MAP[data.width];
  const y = LANE_Y[data.lane];

  // Determine movement type
  let movement: "straight" | "weave" | "drift";
  if (data.movement) {
    // Explicit movement from AI schema
    movement = data.movement;
  } else if (data.fromAudience) {
    // Audience obstacles: based on dangerLevel
    if (data.dangerLevel === 3) movement = "weave";
    else if (data.dangerLevel === 2) movement = Math.random() < 0.3 ? "drift" : "straight";
    else movement = "straight";
  } else {
    // Random-spawned obstacles
    const roll = Math.random();
    if (roll < 0.2) movement = "weave";
    else if (roll < 0.3) movement = "drift";
    else movement = "straight";
  }

  // Pick a random adjacent lane for drift target
  let driftTargetY = y;
  if (movement === "drift") {
    const adjacentLanes = data.lane === 0 ? [1] : data.lane === 2 ? [1] : [0, 2];
    const targetLane = adjacentLanes[Math.floor(Math.random() * adjacentLanes.length)];
    driftTargetY = LANE_Y[targetLane];
  }

  const obstacle: ActiveObstacle = {
    data,
    x: CANVAS_W + 50,
    y,
    pixelWidth: pw,
    pixelHeight: pw * 0.6 + 10,
    passed: false,
    nearMissTriggered: false,
    movement,
    sinePhase: 0,
    startY: y,
    driftTargetY,
    driftElapsed: 0,
  };

  // Initialize chain segments from behavior fields
  const chainCount = data.chainSegments || 0;
  if (chainCount >= 2) {
    const spacing = data.chainSpacing || 30;
    obstacle.snakeSegments = [];
    for (let i = 0; i < chainCount; i++) {
      obstacle.snakeSegments.push({
        x: CANVAS_W + 50 + i * spacing,
        y,
      });
    }
  }

  // Initialize projectile timer from behavior fields
  const shootInterval = data.projectileInterval || 0;
  if (shootInterval > 0) {
    obstacle.shootTimer = shootInterval * 0.5; // First shot at half interval (don't wait full cycle)
  }

  return obstacle;
}

/** Returns true if the obstacle should fire a projectile this frame */
export function updateObstacle(o: ActiveObstacle, baseSpeed: number, dt: number): boolean {
  o.x -= baseSpeed * o.data.speed * dt;

  // Chain movement: head follows sine wave, body segments lerp toward previous
  if (o.snakeSegments && o.snakeSegments.length > 0) {
    const amplitude = (o.data.chainAmplitude || 50) * 0.7; // Scale 0-100 → 0-70px
    o.sinePhase += dt * 2.5;
    o.y = o.startY + Math.sin(o.sinePhase) * amplitude;
    // Head = segment 0
    o.snakeSegments[0].x = o.x;
    o.snakeSegments[0].y = o.y;
    // Body segments follow with delay
    const spacing = o.data.chainSpacing || 30;
    for (let i = 1; i < o.snakeSegments.length; i++) {
      const prev = o.snakeSegments[i - 1];
      const seg = o.snakeSegments[i];
      seg.x += (prev.x + spacing - seg.x) * 6 * dt;
      seg.y += (prev.y - seg.y) * 6 * dt;
    }
  } else if (o.movement === "weave") {
    o.sinePhase += dt * 3;
    o.y = o.startY + Math.sin(o.sinePhase) * 50;
  } else if (o.movement === "drift") {
    o.driftElapsed += dt;
    const t = Math.min(1, o.driftElapsed / 3);
    o.y = o.startY + (o.driftTargetY - o.startY) * t;
  }

  // Projectile timer: fires when interval > 0 and timer expires
  const interval = o.data.projectileInterval || 0;
  if (interval > 0 && o.shootTimer !== undefined) {
    o.shootTimer -= dt;
    if (o.shootTimer <= 0) {
      o.shootTimer = interval;
      return true;
    }
  }

  return false;
}

export function isObstacleOffScreen(o: ActiveObstacle): boolean {
  // For chain obstacles, use last segment position (tail trails behind head)
  if (o.snakeSegments && o.snakeSegments.length > 0) {
    const lastSeg = o.snakeSegments[o.snakeSegments.length - 1];
    return lastSeg.x + 30 < -50;
  }
  return o.x + o.pixelWidth < -50;
}

export function drawObstacle(ctx: CanvasRenderingContext2D, o: ActiveObstacle, frameCount?: number): void {
  // Power-up rendering: glowing collectible
  if (o.data.isPowerup) {
    drawPowerup(ctx, o, frameCount || 0);
    return;
  }

  // Chain: render connected segments
  if (o.snakeSegments && o.snakeSegments.length > 0) {
    drawSnake(ctx, o);
    return;
  }

  // Wide: render across multiple lanes
  const laneSpan = o.data.laneSpan || 1;
  if (laneSpan > 1) {
    drawWideLane(ctx, o);
    return;
  }

  // Try to render generated image first
  if (o.data.imageUrl) {
    const img = getObstacleImage(o.data.imageUrl);
    if (img) {
      ctx.fillStyle = "#00000030";
      ctx.fillRect(o.x + 4, o.y + o.pixelHeight / 2 - 4, o.pixelWidth - 8, 6);
      const imgAspect = img.width / img.height;
      const drawW = o.pixelWidth;
      const drawH = drawW / imgAspect;
      ctx.drawImage(img, o.x, o.y - drawH / 2, drawW, drawH);
      if (o.data.label) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(o.data.label, o.x + o.pixelWidth / 2, o.y - drawH / 2 - 8);
        ctx.textAlign = "start";
      }
      return;
    }
  }

  // Sprite selection: AI spriteData → hand-crafted → generic crate fallback
  // Sprite selection: AI spriteData → library → hand-crafted → generic
  const knownTypes = ["slow_motorbike", "taxi", "pho_cart", "bus", "cyclo"];
  let sprite: SpriteDefinition;
  if (o.data.spriteData && o.data.spriteData.length > 0) {
    sprite = o.data.spriteData.map(r => [r.x, r.y, r.w, r.h, r.c] as [number, number, number, number, string]);
  } else {
    const lib = getLibrarySprite(o.data.type);
    if (lib) {
      sprite = lib.sprite;
    } else if (knownTypes.includes(o.data.type)) {
      sprite = getSpriteForType(o.data.type);
    } else {
      sprite = getSpriteForType("generic");
    }
  }
  const scale = o.pixelWidth / 40;

  // Projectile shooter: add cannon visual indicator
  if ((o.data.projectileInterval || 0) > 0) {
    // Cannon barrel pointing left (toward player)
    ctx.fillStyle = "#ff4444";
    ctx.fillRect(o.x - 8 * scale, o.y - 3, 10 * scale, 6);
    ctx.fillStyle = "#cc2222";
    ctx.fillRect(o.x - 6 * scale, o.y - 2, 8 * scale, 4);
    // Muzzle flash glow
    ctx.fillStyle = "#ff880022";
    ctx.fillRect(o.x - 14 * scale, o.y - 8, 12 * scale, 16);
  }

  // Ground shadow
  ctx.fillStyle = "#00000030";
  ctx.fillRect(o.x + 4 * scale, o.y + o.pixelHeight / 2 - 4 * scale, o.pixelWidth - 8 * scale, 6 * scale);

  drawSprite(ctx, sprite, o.x, o.y - o.pixelHeight / 2, scale);

  // Label above obstacle
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "center";
  ctx.fillText(o.data.label, o.x + o.pixelWidth / 2, o.y - o.pixelHeight / 2 - 6);
  ctx.textAlign = "left";
}

// Color utility functions for sprite shading
function darkenHex(hex: string, amt: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, (n >> 16) - amt);
  const g = Math.max(0, ((n >> 8) & 0xff) - amt);
  const b = Math.max(0, (n & 0xff) - amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
function lightenHex(hex: string, amt: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, (n >> 16) + amt);
  const g = Math.min(255, ((n >> 8) & 0xff) + amt);
  const b = Math.min(255, (n & 0xff) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function drawChainSegment(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, bodyColor: string, index: number, total: number): void {
  const t = index / total; // 0 = near head, 1 = tail
  const w = size;
  const h = size * 0.8;
  const dark = darkenHex(bodyColor, 40);
  const darker = darkenHex(bodyColor, 70);
  const light = lightenHex(bodyColor, 50);
  const lighter = lightenHex(bodyColor, 80);

  // Ground shadow
  ctx.fillStyle = "#00000030";
  ctx.fillRect(x - w / 2 + 2, y + h / 2 + 1, w, 3);

  // Main body — rounded via overlapping rects
  ctx.fillStyle = bodyColor;
  ctx.fillRect(x - w / 2 + 2, y - h / 2, w - 4, h);        // Core
  ctx.fillRect(x - w / 2, y - h / 2 + 2, w, h - 4);        // Wider middle
  // Top highlight
  ctx.fillStyle = light;
  ctx.fillRect(x - w / 2 + 2, y - h / 2, w - 4, 3);
  ctx.fillRect(x - w / 2 + 3, y - h / 2 + 3, w - 6, 1);
  // Bottom shadow
  ctx.fillStyle = dark;
  ctx.fillRect(x - w / 2 + 2, y + h / 2 - 3, w - 4, 3);
  // Left edge shadow
  ctx.fillStyle = dark;
  ctx.fillRect(x - w / 2, y - h / 2 + 3, 2, h - 6);
  // Right edge highlight
  ctx.fillStyle = lightenHex(bodyColor, 25);
  ctx.fillRect(x + w / 2 - 2, y - h / 2 + 3, 2, h - 6);

  // Scale/detail pattern (alternating rows give texture)
  ctx.fillStyle = darker + "44";
  const patternOffset = (index % 2) * 3;
  for (let py = y - h / 2 + 4 + patternOffset; py < y + h / 2 - 4; py += 6) {
    for (let px = x - w / 2 + 3; px < x + w / 2 - 3; px += 6) {
      ctx.fillRect(px, py, 3, 3);
    }
  }

  // Center spine/seam line
  ctx.fillStyle = lighter + "33";
  ctx.fillRect(x - 1, y - h / 2 + 1, 2, h - 2);

  // Belly underbelly (lighter center bottom)
  ctx.fillStyle = lighter + "22";
  ctx.fillRect(x - w / 4, y + 1, w / 2, h / 2 - 3);

  // Small decorative nub/fin on top for organic look (every other segment)
  if (index % 2 === 0 && t < 0.8) {
    ctx.fillStyle = light;
    ctx.fillRect(x - 2, y - h / 2 - 2, 4, 3);
    ctx.fillStyle = lighter;
    ctx.fillRect(x - 1, y - h / 2 - 2, 2, 1);
  }
}

function drawSnake(ctx: CanvasRenderingContext2D, o: ActiveObstacle): void {
  if (!o.snakeSegments) return;
  const segs = o.snakeSegments;
  const bodyColor = o.data.bodyColor || o.data.color || "#44aa44";

  // Draw connecting tissue between segments (thicker, styled)
  ctx.strokeStyle = darkenHex(bodyColor, 20);
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(segs[0].x, segs[0].y);
  for (let i = 1; i < segs.length; i++) {
    ctx.lineTo(segs[i].x, segs[i].y);
  }
  ctx.stroke();
  // Inner connector (lighter, thinner)
  ctx.strokeStyle = bodyColor + "88";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(segs[0].x, segs[0].y);
  for (let i = 1; i < segs.length; i++) {
    ctx.lineTo(segs[i].x, segs[i].y);
  }
  ctx.stroke();
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";

  // Draw body segments (back to front so head overlaps)
  // Check: AI segmentSpriteData → library segmentSprite → fallback drawChainSegment
  let segSpriteDef: SpriteDefinition | null = null;
  if (o.data.segmentSpriteData && o.data.segmentSpriteData.length > 0) {
    segSpriteDef = o.data.segmentSpriteData.map(r => [r.x, r.y, r.w, r.h, r.c] as [number, number, number, number, string]);
  } else {
    const lib = getLibrarySprite(o.data.type);
    if (lib?.segmentSprite) segSpriteDef = lib.segmentSprite;
  }
  for (let i = segs.length - 1; i >= 1; i--) {
    const seg = segs[i];
    if (segSpriteDef) {
      const taper = 1 - (i / segs.length) * 0.2;
      const scale = 0.5 * taper;
      drawSprite(ctx, segSpriteDef, seg.x - 12, seg.y - 12, scale);
    } else {
      const taper = 1 - (i / segs.length) * 0.35;
      const size = 18 * taper;
      drawChainSegment(ctx, seg.x, seg.y, size, bodyColor, i, segs.length);
    }
  }

  // Draw head — AI spriteData → library → detailed fallback
  const head = segs[0];
  let headSprite: SpriteDefinition | null = null;
  if (o.data.spriteData && o.data.spriteData.length > 0) {
    headSprite = o.data.spriteData.map(r => [r.x, r.y, r.w, r.h, r.c] as [number, number, number, number, string]);
  } else {
    const lib = getLibrarySprite(o.data.type);
    if (lib) headSprite = lib.sprite;
  }
  if (headSprite) {
    const scale = 0.6;
    drawSprite(ctx, headSprite, head.x - 15, head.y - 12, scale);
  } else {
    // Detailed fallback head
    const hs = 24;
    const light = lightenHex(bodyColor, 30);
    const dark = darkenHex(bodyColor, 40);
    // Shadow
    ctx.fillStyle = "#00000030";
    ctx.fillRect(head.x - hs / 2 + 2, head.y + hs / 2 + 1, hs, 4);
    // Head shape (slightly wider than body)
    ctx.fillStyle = bodyColor;
    ctx.fillRect(head.x - hs / 2 + 2, head.y - hs / 2, hs - 4, hs);
    ctx.fillRect(head.x - hs / 2, head.y - hs / 2 + 2, hs, hs - 4);
    // Top highlight
    ctx.fillStyle = light;
    ctx.fillRect(head.x - hs / 2 + 3, head.y - hs / 2, hs - 6, 3);
    // Bottom jaw
    ctx.fillStyle = dark;
    ctx.fillRect(head.x - hs / 2 + 2, head.y + hs / 2 - 4, hs - 4, 4);
    // Snout/nose extension
    ctx.fillStyle = bodyColor;
    ctx.fillRect(head.x - hs / 2 - 4, head.y - 3, 6, 6);
    ctx.fillStyle = dark;
    ctx.fillRect(head.x - hs / 2 - 4, head.y + 1, 6, 3);
    // Eyes (white with dark pupil, expressive)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(head.x - 6, head.y - 8, 6, 6);
    ctx.fillRect(head.x + 2, head.y - 8, 6, 6);
    ctx.fillStyle = "#111111";
    ctx.fillRect(head.x - 5, head.y - 7, 3, 4);
    ctx.fillRect(head.x + 3, head.y - 7, 3, 4);
    // Eye glint
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(head.x - 5, head.y - 7, 1, 1);
    ctx.fillRect(head.x + 3, head.y - 7, 1, 1);
    // Brow ridges
    ctx.fillStyle = dark;
    ctx.fillRect(head.x - 7, head.y - 9, 7, 2);
    ctx.fillRect(head.x + 1, head.y - 9, 7, 2);
    // Nostrils
    ctx.fillStyle = "#111111";
    ctx.fillRect(head.x - hs / 2 - 2, head.y - 1, 2, 2);
    // Teeth
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(head.x - hs / 2 - 2, head.y + 2, 2, 3);
    ctx.fillRect(head.x - hs / 2 + 1, head.y + 3, 2, 2);
  }

  // Label above head
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "center";
  ctx.fillText(o.data.label, head.x, head.y - 18);
  ctx.textAlign = "left";
}

function drawWideLane(ctx: CanvasRenderingContext2D, o: ActiveObstacle): void {
  // Build lane list from laneSpan starting at obstacle's lane
  const span = o.data.laneSpan || 2;
  const startLane = o.data.lane;
  const lanes: number[] = [];
  for (let i = 0; i < span; i++) {
    const l = startLane + i;
    if (l <= 2) lanes.push(l);
  }
  // If we'd go off the bottom, shift upward
  if (lanes.length < span) {
    lanes.length = 0;
    for (let i = 0; i < span; i++) {
      lanes.push(Math.max(0, 2 - span + 1 + i));
    }
  }
  const gapLane = (o.data.gapLane !== undefined && o.data.gapLane >= 0) ? o.data.gapLane : undefined;
  const color = o.data.color || "#cc3333";
  const darkColor = darkenHex(color, 40);
  const lightColor = lightenHex(color, 30);

  // Resolve sprite for this obstacle (same fallback chain as standard obstacles)
  let sprite: SpriteDefinition | null = null;
  if (o.data.spriteData && o.data.spriteData.length > 0) {
    sprite = o.data.spriteData.map(r => [r.x, r.y, r.w, r.h, r.c] as [number, number, number, number, string]);
  } else {
    const lib = getLibrarySprite(o.data.type);
    if (lib) sprite = lib.sprite;
  }

  for (const lane of lanes) {
    const laneY = LANE_Y[lane];
    const isGap = lane === gapLane;

    if (isGap) {
      // Gap lane: subtle pulsing arrow hint, no intrusive labels
      ctx.fillStyle = "#44ff8812";
      ctx.fillRect(o.x + 8, laneY - 20, o.pixelWidth - 16, 40);
    } else {
      // Ground shadow
      ctx.fillStyle = "#00000030";
      ctx.fillRect(o.x + 4, laneY + 26, o.pixelWidth - 8, 6);

      if (sprite) {
        // Draw the actual obstacle sprite in each blocked lane
        const scale = o.pixelWidth / 50;
        drawSprite(ctx, sprite, o.x, laneY - 20, scale);
      } else {
        // Themed barrier using obstacle's color (not hardcoded red)
        // Three-layer shading: dark base → obstacle color → light top edge
        ctx.fillStyle = darkColor;
        ctx.fillRect(o.x, laneY - 28, o.pixelWidth, 56);
        ctx.fillStyle = color;
        ctx.fillRect(o.x + 2, laneY - 26, o.pixelWidth - 4, 52);
        ctx.fillStyle = lightColor;
        ctx.fillRect(o.x + 2, laneY - 26, o.pixelWidth - 4, 2);
        // Hazard stripe at top and bottom edges
        ctx.fillStyle = "#ffcc0066";
        for (let sx = o.x; sx < o.x + o.pixelWidth; sx += 16) {
          ctx.fillRect(sx, laneY - 28, 8, 3);
          ctx.fillRect(sx + 8, laneY + 25, 8, 3);
        }
        // Darker center fill
        ctx.fillStyle = darkColor + "88";
        ctx.fillRect(o.x + 6, laneY - 18, o.pixelWidth - 12, 36);
      }
    }
  }

  // Label above the topmost lane
  const topLane = Math.min(...lanes);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "center";
  ctx.fillText(o.data.label, o.x + o.pixelWidth / 2, LANE_Y[topLane] - 36);
  ctx.textAlign = "left";
}

function drawPowerup(ctx: CanvasRenderingContext2D, o: ActiveObstacle, frameCount: number): void {
  const pulse = Math.sin(frameCount * 0.15) * 0.2 + 0.8;
  const size = 24;
  const cx = o.x + o.pixelWidth / 2;
  const cy = o.y;

  // Glow effect
  const glowColor = o.data.powerupType === "shield" ? "#00ff8818"
    : o.data.powerupType === "speed_boost" ? "#ff880018"
    : o.data.powerupType === "heal" ? "#ff448818"
    : "#aa44ff18";
  ctx.fillStyle = glowColor;
  ctx.fillRect(cx - size * pulse, cy - size * pulse, size * 2 * pulse, size * 2 * pulse);

  // Outer ring
  const ringColor = o.data.powerupType === "shield" ? "#00ff88"
    : o.data.powerupType === "speed_boost" ? "#ff8800"
    : o.data.powerupType === "heal" ? "#ff4488"
    : "#aa44ff";
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, size * pulse * 0.7, 0, Math.PI * 2);
  ctx.stroke();

  // Inner filled circle
  const fillColor = o.data.powerupType === "shield" ? "#00cc66"
    : o.data.powerupType === "speed_boost" ? "#ff6600"
    : o.data.powerupType === "heal" ? "#cc2255"
    : "#8833cc";
  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.5, 0, Math.PI * 2);
  ctx.fill();

  // Icon inside
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const icon = o.data.powerupType === "shield" ? "S"
    : o.data.powerupType === "speed_boost" ? ">"
    : o.data.powerupType === "heal" ? "+"
    : "M";
  ctx.fillText(icon, cx, cy);
  ctx.textBaseline = "alphabetic";

  // Label
  ctx.fillStyle = ringColor;
  ctx.font = "bold 10px monospace";
  ctx.fillText(o.data.label, cx, cy - size - 4);
  ctx.textAlign = "left";
}

// ── Collision Detection (AABB with generous hitbox) ───────
export function checkCollision(p: Player, o: ActiveObstacle): boolean {
  const pw = 30 * HITBOX_SCALE;
  const ph = 30 * HITBOX_SCALE;
  const px = PLAYER_X - pw / 2;
  const py = p.y - ph / 2;

  // Chain: check collision against ALL segments (takes priority over wide)
  if (o.snakeSegments && o.snakeSegments.length > 0) {
    for (const seg of o.snakeSegments) {
      const segSize = 16;
      const sx = seg.x - segSize / 2;
      const sy = seg.y - segSize / 2;
      if (px < sx + segSize && px + pw > sx && py < sy + segSize && py + ph > sy) {
        return true;
      }
    }
    return false;
  }

  // Wide obstacle: check if player lane is in the spanned lanes (and not in gap)
  const laneSpan = o.data.laneSpan || 1;
  if (laneSpan > 1) {
    const ow = o.pixelWidth * HITBOX_SCALE;
    const ox = o.x + (o.pixelWidth - ow) / 2;
    if (px < ox + ow && px + pw > ox) {
      const startLane = o.data.lane;
      const spanned: number[] = [];
      for (let i = 0; i < laneSpan; i++) {
        const l = startLane + i;
        if (l <= 2) spanned.push(l);
      }
      if (spanned.length < laneSpan) {
        spanned.length = 0;
        for (let i = 0; i < laneSpan; i++) {
          spanned.push(Math.max(0, 2 - laneSpan + 1 + i));
        }
      }
      const gap = (o.data.gapLane !== undefined && o.data.gapLane >= 0) ? o.data.gapLane : -1;
      return spanned.includes(p.lane) && p.lane !== gap;
    }
    return false;
  }

  // Standard AABB collision
  const ow = o.pixelWidth * HITBOX_SCALE;
  const oh = o.pixelHeight * HITBOX_SCALE;
  const ox = o.x + (o.pixelWidth - ow) / 2;
  const oy = o.y - oh / 2;

  return px < ox + ow && px + pw > ox && py < oy + oh && py + ph > oy;
}

// Near-miss: player passes close without collision
export function checkNearMiss(p: Player, o: ActiveObstacle): boolean {
  if (o.nearMissTriggered || o.passed) return false;
  // Check if obstacle just passed player X
  if (o.x + o.pixelWidth < PLAYER_X + 40 && o.x + o.pixelWidth > PLAYER_X - 10) {
    const vertDist = Math.abs(p.y - o.y);
    if (vertDist < o.pixelHeight * 0.8 && vertDist > o.pixelHeight * HITBOX_SCALE * 0.4) {
      o.nearMissTriggered = true;
      return true;
    }
  }
  return false;
}

// ── Background / Road ─────────────────────────────────────
export interface Building {
  x: number;
  width: number;
  height: number;
  color: string;
  windowSeed: number; // Deterministic seed for window placement
}

export interface Streetlight {
  x: number;
}

export interface ShopSign {
  x: number;
  y: number;
  width: number;
  color: string;
  label: string;
}

export interface RoadState {
  buildings: Building[];
  streetlights: Streetlight[];
  shopSigns: ShopSign[];
  dashOffset: number;
  dustOffset: number;
}

const BUILDING_COLORS = ["#0e0e22", "#121233", "#0c1e40", "#140e28", "#1e1035", "#0a1530"];
const SIGN_COLORS = ["#ff3355", "#ffaa22", "#33ff88", "#44aaff", "#ff55cc", "#ffdd00"];

// Simple deterministic hash for window placement (avoids flickering)
function hashWindows(seed: number, index: number): boolean {
  const v = Math.sin(seed * 127.1 + index * 311.7) * 43758.5453;
  return (v - Math.floor(v)) > 0.45;
}

export function createRoadState(): RoadState {
  const buildings: Building[] = [];
  for (let i = 0; i < 16; i++) {
    buildings.push({
      x: i * 70 - 40,
      width: 45 + Math.random() * 35,
      height: 70 + Math.random() * 130,
      color: BUILDING_COLORS[Math.floor(Math.random() * BUILDING_COLORS.length)],
      windowSeed: Math.floor(Math.random() * 10000),
    });
  }

  const streetlights: Streetlight[] = [];
  for (let i = 0; i < 6; i++) {
    streetlights.push({ x: i * 180 + 50 });
  }

  // Mix of Vietnamese street culture + sponsor/brand neon signs
  const SIGN_LABELS = [
    "PHỞ 24", "BIA HƠI", "CÀ PHÊ", "BÚN BÒ", "BÁNH MÌ",
    "AMANOTES", "OPENAI", "AWS", "COCA-COLA", "VNG",
    "GRAB", "KARAOKE", "NHÀ HÀNG", "SHOPEE",
  ];
  const shopSigns: ShopSign[] = [];
  for (let i = 0; i < 10; i++) {
    const label = SIGN_LABELS[i % SIGN_LABELS.length];
    shopSigns.push({
      x: i * 110 + 20 + Math.random() * 30,
      y: 112 + Math.random() * 22,
      width: Math.max(30, label.length * 5 + 10),
      color: SIGN_COLORS[Math.floor(Math.random() * SIGN_COLORS.length)],
      label,
    });
  }

  return { buildings, streetlights, shopSigns, dashOffset: 0, dustOffset: 0 };
}

export function updateRoad(road: RoadState, baseSpeed: number, dt: number): void {
  // Buildings parallax (0.2x)
  for (const b of road.buildings) {
    b.x -= baseSpeed * 0.2 * dt;
    if (b.x + b.width < -60) {
      b.x = CANVAS_W + 20 + Math.random() * 80;
      b.width = 45 + Math.random() * 35;
      b.height = 70 + Math.random() * 130;
      b.color = BUILDING_COLORS[Math.floor(Math.random() * BUILDING_COLORS.length)];
      b.windowSeed = Math.floor(Math.random() * 10000);
    }
  }

  // Streetlights parallax (0.3x — between buildings and road)
  for (const sl of road.streetlights) {
    sl.x -= baseSpeed * 0.3 * dt;
    if (sl.x < -20) {
      sl.x = CANVAS_W + 30 + Math.random() * 60;
    }
  }

  // Neon signs parallax (0.25x)
  const SIGN_LABELS = ["PHỞ 24","BIA HƠI","CÀ PHÊ","BÚN BÒ","BÁNH MÌ","AMANOTES","OPENAI","AWS","COCA-COLA","VNG","GRAB","KARAOKE","NHÀ HÀNG","SHOPEE"];
  for (const ss of road.shopSigns) {
    ss.x -= baseSpeed * 0.25 * dt;
    if (ss.x + ss.width < -30) {
      const label = SIGN_LABELS[Math.floor(Math.random() * SIGN_LABELS.length)];
      ss.x = CANVAS_W + 20 + Math.random() * 60;
      ss.width = Math.max(30, label.length * 5 + 10);
      ss.color = SIGN_COLORS[Math.floor(Math.random() * SIGN_COLORS.length)];
      ss.label = label;
    }
  }

  // Dashed line offset (1.0x)
  road.dashOffset = (road.dashOffset + baseSpeed * dt) % 40;
  // Dust layer (1.3x)
  road.dustOffset = (road.dustOffset + baseSpeed * 1.3 * dt) % 60;
}

export function drawRoad(ctx: CanvasRenderingContext2D, road: RoadState): void {
  // ── Sky gradient (deep navy → purple → warm orange at horizon) ──
  // Top band: deep navy
  ctx.fillStyle = "#06061a";
  ctx.fillRect(0, 0, CANVAS_W, 30);
  // Upper mid: dark navy-purple
  ctx.fillStyle = "#0a0a28";
  ctx.fillRect(0, 30, CANVAS_W, 25);
  // Mid: purple tint
  ctx.fillStyle = "#120a30";
  ctx.fillRect(0, 55, CANVAS_W, 20);
  // Lower mid: deep purple
  ctx.fillStyle = "#1a0e38";
  ctx.fillRect(0, 75, CANVAS_W, 20);
  // Near horizon: purple-warm
  ctx.fillStyle = "#2a1040";
  ctx.fillRect(0, 95, CANVAS_W, 15);
  // Horizon: warm orange glow
  ctx.fillStyle = "#3a1535";
  ctx.fillRect(0, 110, CANVAS_W, 10);
  ctx.fillStyle = "#4a2030";
  ctx.fillRect(0, 120, CANVAS_W, 10);
  ctx.fillStyle = "#5a2a28";
  ctx.fillRect(0, 130, CANVAS_W, 10);
  ctx.fillStyle = "#6a3520";
  ctx.fillRect(0, 140, CANVAS_W, 10);

  // ── Stars (tiny white dots in upper sky) ──
  ctx.fillStyle = "#ffffff33";
  // Fixed star positions (no flicker)
  const stars = [42, 130, 215, 310, 445, 520, 640, 730, 810, 880, 920, 70, 360, 600];
  for (let i = 0; i < stars.length; i++) {
    const sx = stars[i];
    const sy = 8 + (i * 7) % 60;
    ctx.fillRect(sx, sy, 1, 1);
  }

  // ── Building silhouettes ──
  for (const b of road.buildings) {
    // Main building body
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, 150 - b.height, b.width, b.height);

    // Building edge highlight (left side)
    ctx.fillStyle = "#ffffff06";
    ctx.fillRect(b.x, 150 - b.height, 1, b.height);

    // Building top edge
    ctx.fillStyle = "#ffffff08";
    ctx.fillRect(b.x, 150 - b.height, b.width, 1);

    // Deterministic lit windows (no flickering)
    let winIdx = 0;
    for (let wy = 150 - b.height + 8; wy < 142; wy += 14) {
      for (let wx = b.x + 6; wx < b.x + b.width - 6; wx += 12) {
        if (hashWindows(b.windowSeed, winIdx)) {
          // Window lit — warm yellow or cool white
          const warm = hashWindows(b.windowSeed, winIdx + 1000);
          ctx.fillStyle = warm ? "#ffcc4430" : "#aaddff20";
          ctx.fillRect(wx, wy, 5, 7);
          // Window frame (subtle)
          ctx.fillStyle = "#ffffff08";
          ctx.fillRect(wx, wy, 5, 1);
          ctx.fillRect(wx, wy, 1, 7);
        }
        winIdx++;
      }
    }
  }

  // ── Neon signs (Vietnamese shops + sponsor brands) ──
  for (const ss of road.shopSigns) {
    // Sign background
    ctx.fillStyle = ss.color + "88";
    ctx.fillRect(ss.x, ss.y, ss.width, 12);
    // Outer glow
    ctx.fillStyle = ss.color + "18";
    ctx.fillRect(ss.x - 3, ss.y - 3, ss.width + 6, 18);
    // Inner glow
    ctx.fillStyle = ss.color + "30";
    ctx.fillRect(ss.x - 1, ss.y - 1, ss.width + 2, 14);
    // Neon text
    ctx.fillStyle = ss.color;
    ctx.font = "bold 7px monospace";
    ctx.textAlign = "center";
    ctx.fillText(ss.label, ss.x + ss.width / 2, ss.y + 9);
    ctx.textAlign = "left";
  }

  // ── Streetlights ──
  for (const sl of road.streetlights) {
    // Pole
    ctx.fillStyle = "#44444488";
    ctx.fillRect(sl.x, 100, 2, 52);
    // Arm extending over road
    ctx.fillStyle = "#44444488";
    ctx.fillRect(sl.x - 8, 100, 12, 2);
    // Light housing
    ctx.fillStyle = "#666666";
    ctx.fillRect(sl.x - 6, 98, 8, 3);
    // Light glow (warm yellow circle approximation)
    ctx.fillStyle = "#ffdd4412";
    ctx.fillRect(sl.x - 16, 96, 28, 20);
    ctx.fillStyle = "#ffdd4418";
    ctx.fillRect(sl.x - 10, 98, 16, 12);
    ctx.fillStyle = "#ffee6630";
    ctx.fillRect(sl.x - 5, 100, 6, 4);
    // Light cone on road
    ctx.fillStyle = "#ffdd4406";
    ctx.fillRect(sl.x - 30, 152, 56, 20);
  }

  // ── Road surface ──
  // Main road with subtle blue tint
  ctx.fillStyle = "#222230";
  ctx.fillRect(0, 150, CANVAS_W, 380);

  // Subtle road texture variation (horizontal bands)
  ctx.fillStyle = "#1e1e2c";
  ctx.fillRect(0, 160, CANVAS_W, 2);
  ctx.fillRect(0, 200, CANVAS_W, 1);
  ctx.fillStyle = "#262636";
  ctx.fillRect(0, 280, CANVAS_W, 1);
  ctx.fillRect(0, 360, CANVAS_W, 1);
  ctx.fillStyle = "#1e1e2c";
  ctx.fillRect(0, 440, CANVAS_W, 1);
  ctx.fillRect(0, 500, CANVAS_W, 2);

  // ── Road edge lines (solid white) ──
  ctx.fillStyle = "#666666";
  ctx.fillRect(0, 150, CANVAS_W, 3);
  ctx.fillRect(0, 527, CANVAS_W, 3);
  // Inner edge highlight
  ctx.fillStyle = "#444450";
  ctx.fillRect(0, 153, CANVAS_W, 1);

  // ── Center divider (double yellow) ──
  const centerY = 318;
  for (let dx = -road.dashOffset; dx < CANVAS_W; dx += 40) {
    ctx.fillStyle = "#ccaa22";
    ctx.fillRect(dx, centerY - 2, 24, 2);
    ctx.fillRect(dx, centerY + 2, 24, 2);
  }

  // ── Lane dividers (dashed white, lighter) ──
  ctx.fillStyle = "#55555588";
  const laneLines = [248, 388];
  for (const ly of laneLines) {
    for (let dx = -road.dashOffset; dx < CANVAS_W; dx += 40) {
      ctx.fillRect(dx, ly - 1, 18, 2);
    }
  }

  // ── Bottom area (sidewalk) ──
  ctx.fillStyle = "#181820";
  ctx.fillRect(0, 530, CANVAS_W, 110);
  // Sidewalk edge / curb
  ctx.fillStyle = "#333340";
  ctx.fillRect(0, 530, CANVAS_W, 2);
  // Sidewalk texture
  ctx.fillStyle = "#1c1c26";
  ctx.fillRect(0, 545, CANVAS_W, 1);
  ctx.fillRect(0, 575, CANVAS_W, 1);
  ctx.fillRect(0, 605, CANVAS_W, 1);

  // ── Road dust / grit particles (subtle, 1.3x speed) ──
  ctx.fillStyle = "#ffffff06";
  for (let i = 0; i < 10; i++) {
    const dx = ((i * 137 + road.dustOffset * 2) % CANVAS_W) - 10;
    const dy = 158 + (i * 53) % 365;
    ctx.fillRect(dx, dy, 2 + (i % 3), 1);
  }
}

// ── Particles ─────────────────────────────────────────────
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  text?: string;
}

export function createDustParticle(x: number, y: number): Particle {
  return {
    x,
    y: y + 10 + Math.random() * 8,
    vx: -40 - Math.random() * 60,
    vy: (Math.random() - 0.5) * 20,
    life: 0.3 + Math.random() * 0.3,
    maxLife: 0.6,
    size: 2 + Math.random() * 3,
    color: "#887766",
  };
}

export function createSpeedLine(_y: number): Particle {
  return {
    x: CANVAS_W,
    y: 160 + Math.random() * 360,
    vx: -1000 - Math.random() * 600,
    vy: 0,
    life: 0.12 + Math.random() * 0.08,
    maxLife: 0.2,
    size: 1,
    color: "#44ddff",
  };
}

export function createHitParticle(x: number, y: number): Particle {
  const angle = Math.random() * Math.PI * 2;
  const speed = 100 + Math.random() * 150;
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 0.3 + Math.random() * 0.2,
    maxLife: 0.5,
    size: 3 + Math.random() * 4,
    color: Math.random() > 0.5 ? "#ff4444" : "#ff8822",
  };
}

export function createTextParticle(x: number, y: number, text: string): Particle {
  return {
    x,
    y,
    vx: 0,
    vy: -60,
    life: 0.8,
    maxLife: 0.8,
    size: 14,
    color: "#ffee00",
    text,
  };
}

export function updateParticle(p: Particle, dt: number): void {
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.life -= dt;
}

export function drawParticle(ctx: CanvasRenderingContext2D, p: Particle): void {
  const alpha = Math.max(0, p.life / p.maxLife);
  if (p.text) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.font = `bold ${p.size}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText(p.text, p.x, p.y);
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  } else {
    ctx.globalAlpha = alpha * 0.7;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
    ctx.globalAlpha = 1;
  }
}

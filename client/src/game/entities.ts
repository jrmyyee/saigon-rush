// Saigon Rush — Game entities: Player, obstacles, road/background, particles

import type { GameObstacle } from "@shared/types";
import { drawSprite, getSpriteForType, MOTORBIKE_SPRITE } from "./sprites";

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
    hp: 3,
    maxHp: 3,
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
  drawSprite(ctx, MOTORBIKE_SPRITE, PLAYER_X - 20, p.y - 18, 1.1);
}

// ── Active Obstacle (runtime state) ───────────────────────
export interface ActiveObstacle {
  data: GameObstacle;
  x: number;
  y: number;
  pixelWidth: number;
  pixelHeight: number;
  passed: boolean; // True once player has passed it (for dodge scoring)
  nearMissTriggered: boolean;
}

export function spawnObstacle(data: GameObstacle): ActiveObstacle {
  const pw = WIDTH_MAP[data.width];
  return {
    data,
    x: CANVAS_W + 50,
    y: LANE_Y[data.lane],
    pixelWidth: pw,
    pixelHeight: pw * 0.6 + 10,
    passed: false,
    nearMissTriggered: false,
  };
}

export function updateObstacle(o: ActiveObstacle, baseSpeed: number, dt: number): void {
  o.x -= baseSpeed * o.data.speed * dt;
}

export function isObstacleOffScreen(o: ActiveObstacle): boolean {
  return o.x + o.pixelWidth < -50;
}

export function drawObstacle(ctx: CanvasRenderingContext2D, o: ActiveObstacle): void {
  const sprite = getSpriteForType(o.data.type);
  const scale = o.pixelWidth / 40; // Normalize sprite to obstacle width
  drawSprite(ctx, sprite, o.x, o.y - o.pixelHeight / 2, scale);

  // Label above obstacle
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "center";
  ctx.fillText(o.data.label, o.x + o.pixelWidth / 2, o.y - o.pixelHeight / 2 - 6);
  ctx.textAlign = "left";
}

// ── Collision Detection (AABB with generous hitbox) ───────
export function checkCollision(p: Player, o: ActiveObstacle): boolean {
  // Player hitbox (centered on PLAYER_X, player Y)
  const pw = 30 * HITBOX_SCALE;
  const ph = 30 * HITBOX_SCALE;
  const px = PLAYER_X - pw / 2;
  const py = p.y - ph / 2;

  // Obstacle hitbox (centered)
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
}

export interface RoadState {
  buildings: Building[];
  dashOffset: number;
  dustOffset: number;
}

const BUILDING_COLORS = ["#1a1a2e", "#16213e", "#0f3460", "#1a1033", "#2a1a3e"];

export function createRoadState(): RoadState {
  const buildings: Building[] = [];
  for (let i = 0; i < 14; i++) {
    buildings.push({
      x: i * 80 - 40,
      width: 50 + Math.random() * 40,
      height: 80 + Math.random() * 120,
      color: BUILDING_COLORS[Math.floor(Math.random() * BUILDING_COLORS.length)],
    });
  }
  return { buildings, dashOffset: 0, dustOffset: 0 };
}

export function updateRoad(road: RoadState, baseSpeed: number, dt: number): void {
  // Buildings parallax (0.2x)
  for (const b of road.buildings) {
    b.x -= baseSpeed * 0.2 * dt;
    if (b.x + b.width < -60) {
      b.x = CANVAS_W + 20 + Math.random() * 80;
      b.width = 50 + Math.random() * 40;
      b.height = 80 + Math.random() * 120;
      b.color = BUILDING_COLORS[Math.floor(Math.random() * BUILDING_COLORS.length)];
    }
  }
  // Dashed line offset (1.0x)
  road.dashOffset = (road.dashOffset + baseSpeed * dt) % 40;
  // Dust layer (1.3x)
  road.dustOffset = (road.dustOffset + baseSpeed * 1.3 * dt) % 60;
}

export function drawRoad(ctx: CanvasRenderingContext2D, road: RoadState): void {
  // Sky gradient (simple two-tone)
  ctx.fillStyle = "#0d0d2b";
  ctx.fillRect(0, 0, CANVAS_W, 130);
  ctx.fillStyle = "#1a0a2e";
  ctx.fillRect(0, 130, CANVAS_W, 20);

  // Building silhouettes
  for (const b of road.buildings) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, 150 - b.height, b.width, b.height);
    // Lit windows
    ctx.fillStyle = "#ffdd4422";
    for (let wy = 150 - b.height + 10; wy < 140; wy += 20) {
      for (let wx = b.x + 8; wx < b.x + b.width - 8; wx += 16) {
        if (Math.random() > 0.4) {
          ctx.fillStyle = Math.random() > 0.5 ? "#ffdd4433" : "#ffaa2222";
          ctx.fillRect(wx, wy, 6, 8);
        }
      }
    }
  }

  // Road surface
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(0, 150, CANVAS_W, 380);

  // Road edge lines
  ctx.fillStyle = "#555555";
  ctx.fillRect(0, 150, CANVAS_W, 3);
  ctx.fillRect(0, 527, CANVAS_W, 3);

  // Lane dividers (dashed)
  ctx.fillStyle = "#555555";
  const laneLines = [250, 390];
  for (const ly of laneLines) {
    for (let dx = -road.dashOffset; dx < CANVAS_W; dx += 40) {
      ctx.fillRect(dx, ly - 1, 20, 2);
    }
  }

  // Bottom area (sidewalk)
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 530, CANVAS_W, 110);

  // Dust particles (1.3x speed layer)
  ctx.fillStyle = "#ffffff08";
  for (let i = 0; i < 8; i++) {
    const dx = ((i * 137 + road.dustOffset * 2) % CANVAS_W) - 10;
    const dy = 160 + (i * 53) % 360;
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
    color: "#aa9977",
  };
}

export function createSpeedLine(_y: number): Particle {
  return {
    x: CANVAS_W,
    y: 160 + Math.random() * 360,
    vx: -800 - Math.random() * 400,
    vy: 0,
    life: 0.15 + Math.random() * 0.1,
    maxLife: 0.25,
    size: 1,
    color: "#ffffff44",
  };
}

export function createHitParticle(x: number, y: number): Particle {
  const angle = Math.random() * Math.PI * 2;
  const speed = 80 + Math.random() * 120;
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 0.3 + Math.random() * 0.2,
    maxLife: 0.5,
    size: 3 + Math.random() * 4,
    color: "#ff4444",
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

// Saigon Rush — Game entities: Player, obstacles, road/background, particles
// Polished neon-on-dark aesthetic with gradient sky, lit buildings, streetlights

import type { GameObstacle } from "@shared/types";
import { createDynamicSprite, drawSprite, getSpriteForType, MOTORBIKE_SPRITE } from "./sprites";

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

  return {
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
}

export function updateObstacle(o: ActiveObstacle, baseSpeed: number, dt: number): void {
  o.x -= baseSpeed * o.data.speed * dt;

  if (o.movement === "weave") {
    o.sinePhase += dt * 3;
    o.y = o.startY + Math.sin(o.sinePhase) * 50;
  } else if (o.movement === "drift") {
    // Lerp from startY to driftTargetY over ~3 seconds
    o.driftElapsed += dt;
    const t = Math.min(1, o.driftElapsed / 3);
    o.y = o.startY + (o.driftTargetY - o.startY) * t;
  }
}

export function isObstacleOffScreen(o: ActiveObstacle): boolean {
  return o.x + o.pixelWidth < -50;
}

export function drawObstacle(ctx: CanvasRenderingContext2D, o: ActiveObstacle): void {
  const knownTypes = ["slow_motorbike", "taxi", "pho_cart", "bus", "cyclo"];
  const sprite = knownTypes.includes(o.data.type)
    ? getSpriteForType(o.data.type)
    : createDynamicSprite(o.data.color, o.data.width);
  const scale = o.pixelWidth / 40;

  // Ground shadow beneath obstacle
  ctx.fillStyle = "#00000030";
  ctx.fillRect(
    o.x + 4 * scale,
    o.y + o.pixelHeight / 2 - 4 * scale,
    o.pixelWidth - 8 * scale,
    6 * scale,
  );

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

  const shopSigns: ShopSign[] = [];
  for (let i = 0; i < 8; i++) {
    shopSigns.push({
      x: i * 130 + 20 + Math.random() * 40,
      y: 118 + Math.random() * 20,
      width: 20 + Math.random() * 20,
      color: SIGN_COLORS[Math.floor(Math.random() * SIGN_COLORS.length)],
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

  // Shop signs parallax (0.25x)
  for (const ss of road.shopSigns) {
    ss.x -= baseSpeed * 0.25 * dt;
    if (ss.x + ss.width < -30) {
      ss.x = CANVAS_W + 20 + Math.random() * 60;
      ss.width = 20 + Math.random() * 20;
      ss.color = SIGN_COLORS[Math.floor(Math.random() * SIGN_COLORS.length)];
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

  // ── Vietnamese shop signs ──
  for (const ss of road.shopSigns) {
    // Sign background
    ctx.fillStyle = ss.color + "88";
    ctx.fillRect(ss.x, ss.y, ss.width, 10);
    // Sign glow
    ctx.fillStyle = ss.color + "18";
    ctx.fillRect(ss.x - 2, ss.y - 2, ss.width + 4, 14);
    // "Text" bars on sign
    ctx.fillStyle = "#ffffff55";
    ctx.fillRect(ss.x + 3, ss.y + 3, ss.width * 0.6, 2);
    ctx.fillRect(ss.x + 3, ss.y + 6, ss.width * 0.4, 1);
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

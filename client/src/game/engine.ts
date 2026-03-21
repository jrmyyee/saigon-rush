// Saigon Rush — Game loop, state management, public API

import type { GameObstacle, GameState, GameStats, InputAction } from "@shared/types";
import {
  type ActiveObstacle,
  type Particle,
  type Player,
  type RoadState,
  CANVAS_H,
  CANVAS_W,
  LANE_Y,
  PLAYER_X,
  checkCollision,
  checkNearMiss,
  createDustParticle,
  createHitParticle,
  createPlayer,
  createRoadState,
  createSpeedLine,
  createTextParticle,
  drawObstacle,
  drawParticle,
  drawPlayer,
  drawRoad,
  isObstacleOffScreen,
  playerHit,
  preloadObstacleImage,
  spawnObstacle,
  updateObstacle,
  updateParticle,
  updatePlayer,
  updateRoad,
} from "./entities";
import { AudioManager } from "./audio";
import { getLibrarySprite } from "./spriteLibrary";

// ── Default obstacle templates for random spawner ─────────
const DEFAULT_OBSTACLES: Omit<GameObstacle, "id" | "lane" | "fromAudience" | "audienceMessage">[] = [
  { type: "slow_motorbike", displayName: "Slow Motorbike", width: "small", speed: 0.6, color: "#cc4444", dangerLevel: 1, label: "\ud83c\udfcd\ufe0f Motorbike", soundCategory: "vehicle" },
  { type: "pho_cart", displayName: "Ph\u1edf Cart", width: "medium", speed: 0.3, color: "#ff8844", dangerLevel: 1, label: "\ud83c\udf5c Ph\u1edf Cart", soundCategory: "food" },
  { type: "taxi", displayName: "Taxi", width: "large", speed: 0.8, color: "#ffdd00", dangerLevel: 2, label: "\ud83d\ude95 Taxi", soundCategory: "vehicle" },
];

let obstacleIdCounter = 0;
function nextId(): string {
  return `obs_${++obstacleIdCounter}`;
}

// ── Internal Game State ───────────────────────────────────
interface InternalState {
  phase: "waiting" | "playing" | "game_over";
  player: Player;
  obstacles: ActiveObstacle[];
  particles: Particle[];
  road: RoadState;
  baseSpeed: number;
  elapsed: number;
  spawnTimer: number;
  dustTimer: number;
  speedLineTimer: number;
  frameCount: number;
  shakeTimer: number;
  shakeIntensity: number;
  hitFlashTimer: number;
  hitstopFrames: number; // Freeze game for N frames on collision impact
  suggestionQueue: GameObstacle[];
  pendingWarnings: Array<{ obstacle: GameObstacle; timer: number; lane: number; tickerX: number; sirenTimer: number }>;
  announcements: Array<{ text: string; description: string; timer: number; maxTimer: number; color: string }>;
  obstaclesDodged: number;
  nearMisses: number;
  audienceChaos: number;
  totalHits: number;
  topSpeed: number;
  powerupSpawnTimer: number;
  powerups: PowerupEffects;
}

function createState(): InternalState {
  return {
    phase: "waiting",
    player: createPlayer(),
    obstacles: [],
    particles: [],
    road: createRoadState(),
    baseSpeed: 300,
    elapsed: 0,
    spawnTimer: 5, // 5-second grace period — no obstacles during intro countdown
    dustTimer: 0,
    speedLineTimer: 0,
    frameCount: 0,
    shakeTimer: 0,
    shakeIntensity: 0,
    hitFlashTimer: 0,
    hitstopFrames: 0,
    suggestionQueue: [],
    pendingWarnings: [],
    announcements: [],
    obstaclesDodged: 0,
    nearMisses: 0,
    audienceChaos: 0,
    totalHits: 0,
    topSpeed: 0,
    powerupSpawnTimer: 10,    // First power-up at ~10s
    powerups: { shieldActive: false, speedBoostTimer: 0, magnetCharges: 0 },
  };
}

// ── Power-up Effect Tracking ──────────────────────────────
interface PowerupEffects {
  shieldActive: boolean;
  speedBoostTimer: number;
  magnetCharges: number;
}

// ── Public API ────────────────────────────────────────────
export interface GameAPI {
  start(): void;
  handleInput(action: InputAction): void;
  addObstacle(obstacle: GameObstacle): void;
  updateObstacleImage(obstacleId: string, imageUrl: string): void;
  updateObstacleSpriteData(obstacleId: string, spriteData: Array<{ x: number; y: number; w: number; h: number; c: string }>, obstacleType?: string): void;
  getState(): GameState;
  destroy(): void;
}

export interface GameOptions {
  onGameOver?: (stats: GameStats) => void;
  testMode?: boolean; // Infinite HP for testing
}

export function createGame(canvas: HTMLCanvasElement, options?: GameOptions): GameAPI {
  const ctx = canvas.getContext("2d")!;
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;

  let state = createState();
  let rafId = 0;
  let lastTime = 0;
  let destroyed = false;
  const audio = new AudioManager();
  const testMode = options?.testMode ?? false;
  // Runtime sprite cache: stores Claude-generated sprites by type for reuse
  // When a sprite arrives after the obstacle is gone, cache it here for next spawn
  const runtimeSpriteCache = new Map<string, import("./sprites").SpriteDefinition>();

  // ── Update Logic ──────────────────────────────────────
  function update(dt: number): void {
    if (state.phase !== "playing") return;

    // Hitstop: freeze game for N frames on big impacts (makes hits feel devastating)
    if (state.hitstopFrames > 0) {
      state.hitstopFrames--;
      return; // Skip ALL game logic — everything freezes
    }

    state.elapsed += dt;
    state.frameCount++;

    // Speed ramp: increases over time
    state.baseSpeed = 300 + state.elapsed * 4;
    state.topSpeed = Math.max(state.topSpeed, state.baseSpeed);
    audio.setEngineSpeed(state.baseSpeed);
    // Music speeds up with game — mapped so it's noticeable but stays audible
    // baseSpeed 300 → 1.0x, 500 → 1.07x, 700 → 1.14x (cap at 200 BPM)
    audio.setMusicSpeed(1 + (state.baseSpeed - 300) / 3000);

    // Player distance / score
    state.player.distance += state.baseSpeed * dt;
    state.player.score = Math.floor(state.player.distance / 10);

    // Update player
    updatePlayer(state.player, dt);

    // Update road
    updateRoad(state.road, state.baseSpeed, dt);

    // Spawn obstacles
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      const spawnInterval = Math.max(0.5, 2.0 - state.elapsed * 0.015);
      state.spawnTimer = spawnInterval;
      spawnNextObstacle();
    }

    // Power-up timers
    if (state.powerups.speedBoostTimer > 0) {
      state.powerups.speedBoostTimer -= dt;
      state.baseSpeed += 120; // Temporary speed burst during boost
      if (state.powerups.speedBoostTimer <= 0) {
        state.powerups.speedBoostTimer = 0;
      }
    }

    // Ambient traffic sounds — random honks from on-screen vehicles
    if (state.frameCount % 60 === 0) { // Check every second
      const vehicles = state.obstacles.filter(o => o.x > 50 && o.x < CANVAS_W - 50 && !o.data.isPowerup && o.data.soundCategory === "vehicle");
      if (vehicles.length > 0 && Math.random() < 0.5) {
        audio.playTrafficHonk();
      }
      // Animals moo/growl less frequently
      const animals = state.obstacles.filter(o => o.x > 50 && o.x < CANVAS_W - 50 && !o.data.isPowerup && o.data.soundCategory === "animal");
      if (animals.length > 0 && Math.random() < 0.3) {
        audio.playCategorySound("animal");
      }
    }

    // Update obstacles
    const projectilesToSpawn: Array<{ x: number; y: number; lane: number; speed: number; pattern: string; color: string }> = [];
    for (const o of state.obstacles) {
      const shouldFire = updateObstacle(o, state.baseSpeed, dt);
      if (shouldFire) {
        projectilesToSpawn.push({
          x: o.x - 10,
          y: o.y,
          lane: o.data.lane,
          speed: o.data.projectileSpeed || 2.0,
          pattern: o.data.projectilePattern || "forward",
          color: o.data.projectileColor || "#ff4444",
        });
      }

      // Check collision
      if (!o.passed && checkCollision(state.player, o)) {
        // Power-up: apply effect instead of damage
        if (o.data.isPowerup) {
          o.passed = true;
          applyPowerup(o.data.powerupType || "shield");
          audio.playDodge(); // Satisfying pickup sound
          state.particles.push(
            createTextParticle(PLAYER_X + 40, state.player.y - 30, `${o.data.label}`),
          );
          continue;
        }

        // Magnet auto-dodge: consume a charge to skip this collision
        if (state.powerups.magnetCharges > 0) {
          state.powerups.magnetCharges--;
          o.passed = true;
          state.obstaclesDodged++;
          state.particles.push(
            createTextParticle(PLAYER_X + 40, state.player.y - 30, "MAGNET!"),
          );
          audio.playDodge();
          continue;
        }

        // Shield absorbs one hit
        if (state.powerups.shieldActive) {
          state.powerups.shieldActive = false;
          o.passed = true;
          state.particles.push(
            createTextParticle(PLAYER_X + 40, state.player.y - 30, "SHIELD!"),
          );
          // Small shake but no damage
          state.shakeTimer = 0.1;
          state.shakeIntensity = 4;
          for (let i = 0; i < 4; i++) {
            state.particles.push(createHitParticle(PLAYER_X, state.player.y));
          }
          continue;
        }

        if (!state.player.invincible) {
          // Speed boost grants invincibility
          if (state.powerups.speedBoostTimer > 0) {
            o.passed = true;
            continue;
          }

          playerHit(state.player);
          state.totalHits++;
          state.shakeTimer = 0.2;
          state.shakeIntensity = 8;
          state.hitFlashTimer = 0.1;
          state.hitstopFrames = 4; // 4-frame freeze — makes impacts feel devastating
          audio.silenceAll();
          audio.playCrash();
          for (let i = 0; i < 8; i++) {
            state.particles.push(createHitParticle(PLAYER_X, state.player.y));
          }
          if (state.player.hp <= 0) {
            if (testMode) {
              state.player.hp = 3;
            } else {
              endGame();
              return;
            }
          }
        }
        o.passed = true;
      }

      // Check near miss
      if (checkNearMiss(state.player, o)) {
        state.nearMisses++;
        state.player.dodgeCombo++;
        const bonus = 50 * state.player.dodgeCombo;
        state.player.score += bonus;
        audio.playDodge();
        state.particles.push(
          createTextParticle(PLAYER_X + 40, state.player.y - 30, `CLOSE! +${bonus}`),
        );
      }

      // Mark dodged — for chains, use last segment position
      if (!o.passed) {
        let passedX = o.x + o.pixelWidth;
        if (o.snakeSegments && o.snakeSegments.length > 0) {
          const lastSeg = o.snakeSegments[o.snakeSegments.length - 1];
          passedX = lastSeg.x + 20;
        }
        if (passedX < PLAYER_X - 20) {
          o.passed = true;
          state.obstaclesDodged++;
          if (o.data.fromAudience) state.audienceChaos++;
        }
      }
    }

    // Spawn projectiles from shooters
    for (const proj of projectilesToSpawn) {
      audio.playProjectile();
      const pattern = proj.pattern || "forward";
      const projSpeed = proj.speed || 2.0;
      const projColor = proj.color || "#ff4444";

      // Determine how many projectiles and their Y-offsets
      const spawns: Array<{ yOffset: number }> =
        pattern === "spread" ? [{ yOffset: -60 }, { yOffset: 0 }, { yOffset: 60 }]
        : [{ yOffset: 0 }];

      for (const spawn of spawns) {
        const projectileData: GameObstacle = {
          id: nextId(),
          type: "projectile",
          displayName: "Projectile",
          lane: proj.lane as 0 | 1 | 2,
          width: "small",
          speed: projSpeed,
          color: projColor,
          dangerLevel: 1,
          label: "",
          audienceMessage: "",
          fromAudience: false,
        };
        const projectile = spawnObstacle(projectileData);
        projectile.x = proj.x;
        projectile.pixelWidth = 12;
        projectile.pixelHeight = 8;

        if (pattern === "aimed") {
          // Track player's current lane
          projectile.y = proj.y;
          projectile.startY = proj.y;
          projectile.driftTargetY = state.player.y;
          projectile.driftElapsed = 0;
          projectile.movement = "drift";
        } else {
          // Forward or spread — fixed Y trajectory
          projectile.y = proj.y + spawn.yOffset;
          projectile.startY = proj.y + spawn.yOffset;
        }

        state.obstacles.push(projectile);
      }
    }

    // Remove off-screen obstacles
    state.obstacles = state.obstacles.filter((o) => !isObstacleOffScreen(o));

    // Power-up spawning
    spawnPowerups(dt);

    // Dust trail particles
    state.dustTimer -= dt;
    if (state.dustTimer <= 0) {
      state.dustTimer = 0.05;
      state.particles.push(createDustParticle(PLAYER_X - 20, state.player.y));
    }

    // Speed lines at high velocity — more frequent and multi-line at extreme speeds
    state.speedLineTimer -= dt;
    if (state.baseSpeed > 400 && state.speedLineTimer <= 0) {
      const speedFactor = Math.min(1, (state.baseSpeed - 400) / 300);
      state.speedLineTimer = 0.1 - speedFactor * 0.06; // 0.1s down to 0.04s
      state.particles.push(createSpeedLine(state.player.y));
      // Extra speed lines at very high speeds
      if (state.baseSpeed > 550) {
        state.particles.push(createSpeedLine(state.player.y));
      }
    }

    // Update particles
    for (const p of state.particles) updateParticle(p, dt);
    state.particles = state.particles.filter((p) => p.life > 0);

    // Screen shake decay
    if (state.shakeTimer > 0) state.shakeTimer -= dt;
    if (state.hitFlashTimer > 0) state.hitFlashTimer -= dt;

    // Update pending warnings (obstacle telegraph system)
    for (const w of state.pendingWarnings) {
      w.timer -= dt;
      w.tickerX -= 200 * dt; // Scroll ticker text left
      w.sirenTimer += dt;
      // Replay siren every 0.6 seconds during warning phase
      if (w.sirenTimer >= 0.6) {
        w.sirenTimer = 0;
        audio.playWarning();
      }
      if (w.timer <= 0) {
        // Warning expired — spawn the obstacle
        state.obstacles.push(spawnObstacle(w.obstacle));
        // Play category-mapped obstacle sound
        if (w.obstacle.soundCategory) {
          audio.playCategorySound(w.obstacle.soundCategory);
        }
        // Play ElevenLabs SFX if available
        if (w.obstacle.soundEffectAudio) {
          audio.playSoundEffect(w.obstacle.soundEffectAudio);
        }
        // Announcement banner for audience obstacles
        if (w.obstacle.fromAudience) {
          state.announcements.push({
            text: w.obstacle.label,
            description: w.obstacle.audienceMessage || w.obstacle.displayName,
            timer: 3.0,
            maxTimer: 3.0,
            color: w.obstacle.color || "#ff4444",
          });
        }
      }
    }
    state.pendingWarnings = state.pendingWarnings.filter((w) => w.timer > 0);

    // Update announcements (decay + remove)
    for (const a of state.announcements) a.timer -= dt;
    state.announcements = state.announcements.filter((a) => a.timer > 0);

    // Game ends only when HP hits 0 — no time limit
  }

  function spawnNextObstacle(): void {
    let data: GameObstacle;
    if (state.suggestionQueue.length > 0) {
      data = state.suggestionQueue.shift()!;
    } else {
      const template = DEFAULT_OBSTACLES[Math.floor(Math.random() * DEFAULT_OBSTACLES.length)];
      const lane = (Math.floor(Math.random() * 3)) as 0 | 1 | 2;
      data = {
        ...template,
        id: nextId(),
        lane,
        fromAudience: false,
        audienceMessage: "",
      };
    }
    state.obstacles.push(spawnObstacle(data));
  }

  function applyPowerup(type: string): void {
    switch (type) {
      case "shield":
        state.powerups.shieldActive = true;
        break;
      case "speed_boost":
        state.powerups.speedBoostTimer = 3.0; // 3-second boost
        break;
      case "magnet":
        state.powerups.magnetCharges = 3; // Auto-dodge next 3 obstacles (legacy)
        break;
      case "heal":
        state.player.hp = Math.min(state.player.maxHp, state.player.hp + 1);
        break;
      case "mega_honk":
        // MEGA HONK: push all on-screen obstacles away with a blast
        audio.playMegaHonk();
        state.shakeTimer = 0.15;
        state.shakeIntensity = 6;
        for (const o of state.obstacles) {
          if (!o.data.isPowerup && o.x > -50 && o.x < CANVAS_W + 50) {
            // Push obstacles away from player — move them right (backward)
            o.x += 200;
            // Also push vertically away from player
            if (o.y < state.player.y) o.y -= 60;
            else o.y += 60;
            o.passed = true;
            state.obstaclesDodged++;
          }
        }
        // Big visual feedback
        for (let i = 0; i < 12; i++) {
          state.particles.push(createHitParticle(PLAYER_X + 30, state.player.y));
        }
        state.particles.push(
          createTextParticle(PLAYER_X + 60, state.player.y - 40, "MEGA HONK!"),
        );
        break;
    }
  }

  function spawnPowerups(dt: number): void {
    if (state.elapsed < 10) return;
    state.powerupSpawnTimer -= dt;
    if (state.powerupSpawnTimer <= 0) {
      state.powerupSpawnTimer = 12 + Math.random() * 8;
      const types: Array<{ type: "shield" | "speed_boost" | "mega_honk" | "heal"; label: string; color: string }> = [
        { type: "shield", label: "\ud83d\udee1\ufe0f Shield", color: "#00ff88" },
        { type: "speed_boost", label: "\u26a1 Speed!", color: "#ff8800" },
        { type: "mega_honk", label: "\ud83d\udce2 MEGA HONK", color: "#ffaa00" },
        { type: "heal", label: "\u2764\ufe0f +1 Life", color: "#ff4488" },
      ];
      const pick = types[Math.floor(Math.random() * types.length)];
      const lane = (Math.floor(Math.random() * 3)) as 0 | 1 | 2;
      state.obstacles.push(spawnObstacle({
        id: nextId(),
        type: "powerup",
        displayName: pick.label,
        lane,
        width: "small",
        speed: 0.8,
        color: pick.color,
        dangerLevel: 1,
        label: pick.label,
        audienceMessage: "",
        fromAudience: false,
        movement: "straight",
        isPowerup: true,
        powerupType: pick.type,
      }));
    }
  }

  function endGame(): void {
    state.phase = "game_over";
    audio.stopEngine();
    audio.stopMusic();
    const stats = buildStats();
    options?.onGameOver?.(stats);
  }

  function buildStats(): GameStats {
    const d = state.player.distance;
    const dodged = state.obstaclesDodged;
    let rating: GameStats["rating"];
    if (state.player.score > 3000) rating = "Traffic Legend";
    else if (state.player.score > 1500) rating = "Saigon Local";
    else if (state.player.score > 600) rating = "Xe Om Driver";
    else rating = "Tourist";
    return {
      distance: Math.floor(d),
      obstaclesDodged: dodged,
      audienceChaos: state.audienceChaos,
      nearMisses: state.nearMisses,
      topSpeed: Math.floor(state.topSpeed),
      totalHits: state.totalHits,
      survivalTime: Math.floor(state.elapsed * 10) / 10,
      rating,
    };
  }

  // ── Render Logic ──────────────────────────────────────

  // Scanlines moved to CSS (zero canvas cost) — see index.css .scanlines class

  function drawVignette(ctx: CanvasRenderingContext2D): void {
    // Corner darkening — 4 rectangles fading inward
    // Top edge
    ctx.fillStyle = "#00000044";
    ctx.fillRect(0, 0, CANVAS_W, 20);
    ctx.fillStyle = "#00000022";
    ctx.fillRect(0, 20, CANVAS_W, 20);
    // Bottom edge
    ctx.fillStyle = "#00000044";
    ctx.fillRect(0, CANVAS_H - 20, CANVAS_W, 20);
    ctx.fillStyle = "#00000022";
    ctx.fillRect(0, CANVAS_H - 40, CANVAS_W, 20);
    // Left edge
    ctx.fillStyle = "#00000033";
    ctx.fillRect(0, 0, 30, CANVAS_H);
    ctx.fillStyle = "#00000018";
    ctx.fillRect(30, 0, 30, CANVAS_H);
    // Right edge
    ctx.fillStyle = "#00000033";
    ctx.fillRect(CANVAS_W - 30, 0, 30, CANVAS_H);
    ctx.fillStyle = "#00000018";
    ctx.fillRect(CANVAS_W - 60, 0, 30, CANVAS_H);
    // Corners extra dark
    ctx.fillStyle = "#00000033";
    ctx.fillRect(0, 0, 60, 40);
    ctx.fillRect(CANVAS_W - 60, 0, 60, 40);
    ctx.fillRect(0, CANVAS_H - 40, 60, 40);
    ctx.fillRect(CANVAS_W - 60, CANVAS_H - 40, 60, 40);
  }

  function drawIncomingWarning(ctx: CanvasRenderingContext2D, s: InternalState): void {
    // Show "INCOMING!" for audience-spawned obstacles that are still off-screen
    for (const o of s.obstacles) {
      if (!o.data.fromAudience || o.x < CANVAS_W - 40) continue;
      // Pulsing warning
      const pulse = Math.sin(s.frameCount * 0.3) * 0.3 + 0.7;
      const yBase = LANE_Y[o.data.lane];
      // Warning flash bar across the lane
      ctx.fillStyle = `rgba(255, 50, 50, ${0.08 * pulse})`;
      ctx.fillRect(0, yBase - 40, CANVAS_W, 80);
      // Arrow indicators (right edge)
      ctx.fillStyle = `rgba(255, 100, 50, ${0.7 * pulse})`;
      ctx.fillRect(CANVAS_W - 20, yBase - 8, 16, 4);
      ctx.fillRect(CANVAS_W - 14, yBase - 14, 10, 4);
      ctx.fillRect(CANVAS_W - 14, yBase + 10, 10, 4);
      // "INCOMING!" text
      ctx.globalAlpha = pulse;
      ctx.fillStyle = "#ff4444";
      ctx.font = "bold 18px monospace";
      ctx.textAlign = "center";
      ctx.fillText("INCOMING!", CANVAS_W - 80, yBase + 5);
      // Audience message below
      if (o.data.audienceMessage) {
        ctx.fillStyle = "#ffaa44";
        ctx.font = "bold 12px monospace";
        ctx.fillText(o.data.audienceMessage, CANVAS_W - 80, yBase + 22);
      }
      ctx.textAlign = "left";
      ctx.globalAlpha = 1;
    }
  }

  function render(): void {
    ctx.save();

    // Screen shake offset
    let shakeX = 0, shakeY = 0;
    if (state.shakeTimer > 0) {
      shakeX = (Math.random() - 0.5) * state.shakeIntensity * 2;
      shakeY = (Math.random() - 0.5) * state.shakeIntensity * 2;
      ctx.translate(shakeX, shakeY);
    }

    // Clear
    ctx.fillStyle = "#060610";
    ctx.fillRect(-10, -10, CANVAS_W + 20, CANVAS_H + 20);

    if (state.phase === "waiting") {
      drawRoad(ctx, state.road);
      drawWaitingScreen(ctx);
    } else if (state.phase === "playing" || state.phase === "game_over") {
      // Background + road
      drawRoad(ctx, state.road);

      // Speed lines overlay at high speeds (dramatic streaks)
      if (state.baseSpeed > 500) {
        const intensity = Math.min(1, (state.baseSpeed - 500) / 300);
        ctx.fillStyle = `rgba(68, 221, 255, ${0.02 * intensity})`;
        for (let i = 0; i < 4; i++) {
          const ly = 160 + ((state.frameCount * 7 + i * 167) % 360);
          ctx.fillRect(0, ly, CANVAS_W, 1);
        }
      }

      // Obstacles
      for (const o of state.obstacles) drawObstacle(ctx, o, state.frameCount);

      // Warning zones for pending audience obstacles (telegraph system)
      for (const w of state.pendingWarnings) {
        const laneY = LANE_Y[w.lane];
        const pulseAlpha = 0.15 + 0.15 * Math.sin(state.elapsed * 10);
        // Flashing red zone on the right edge of the target lane
        ctx.fillStyle = `rgba(255, 0, 0, ${pulseAlpha})`;
        ctx.fillRect(CANVAS_W - 160, laneY - 40, 160, 80);
        // Red border
        ctx.strokeStyle = `rgba(255, 50, 50, ${pulseAlpha + 0.2})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(CANVAS_W - 160, laneY - 40, 160, 80);
        // "!" warning icon
        ctx.fillStyle = `rgba(255, 255, 0, ${pulseAlpha + 0.3})`;
        ctx.font = "bold 28px monospace";
        ctx.textAlign = "center";
        ctx.fillText("!", CANVAS_W - 80, laneY + 10);
        ctx.textAlign = "left";
      }
      // News ticker for pending warnings
      if (state.pendingWarnings.length > 0) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(0, 50, CANVAS_W, 24);
        ctx.fillStyle = "#ff4444";
        ctx.font = "bold 14px monospace";
        for (const w of state.pendingWarnings) {
          const text = `INCOMING: ${w.obstacle.label}`;
          ctx.fillText(text, w.tickerX, 66);
        }
      }

      // Incoming warnings for audience obstacles already spawned but still off-screen
      drawIncomingWarning(ctx, state);

      // Player
      drawPlayer(ctx, state.player, state.frameCount);

      // Particles
      for (const p of state.particles) drawParticle(ctx, p);

      // Hit flash overlay
      if (state.hitFlashTimer > 0) {
        ctx.fillStyle = `rgba(255, 0, 0, ${state.hitFlashTimer * 3})`;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      }

      // Post-processing: scanlines + vignette

      drawVignette(ctx);

      // HUD (drawn after post-processing so it's crisp)
      drawHUD(ctx, state);

      // Cinematic intro sequence (first 5 seconds)
      if (state.elapsed < 5.5) {
        const t = state.elapsed;
        // Phase 1 (0-1.8s): Title slam + subtitle
        if (t < 1.8) {
          const scale = t < 0.2 ? t / 0.2 : 1; // Slam in over 200ms
          const alpha = t < 0.2 ? t / 0.2 : (t > 1.4 ? 1 - (t - 1.4) / 0.4 : 1);
          ctx.globalAlpha = Math.max(0, alpha);
          ctx.fillStyle = "#000000aa";
          ctx.fillRect(CANVAS_W / 2 - 260, CANVAS_H / 2 - 55, 520, 100);
          ctx.fillStyle = "#00ff88";
          ctx.font = `bold ${Math.floor(40 * scale)}px monospace`;
          ctx.textAlign = "center";
          ctx.fillText("SAIGON RUSH", CANVAS_W / 2, CANVAS_H / 2 - 10);
          ctx.fillStyle = "#ffcc00";
          ctx.font = "bold 16px monospace";
          ctx.fillText("SURVIVE THE TRAFFIC!", CANVAS_W / 2, CANVAS_H / 2 + 22);
          ctx.textAlign = "left";
          ctx.globalAlpha = 1;
        }
        // Phase 2 (2.0-4.4s): "3... 2... 1..." countdown — 0.8s per number
        else if (t < 4.5) {
          const countT = t - 2.0;
          const num = countT < 0.8 ? "3" : countT < 1.6 ? "2" : "1";
          const beatT = countT % 0.8; // time within each beat
          const beatScale = beatT < 0.15 ? 1 + (1 - beatT / 0.15) * 0.5 : 1; // Punch in
          const alpha = beatT < 0.6 ? 1 : 1 - (beatT - 0.6) / 0.2;
          ctx.globalAlpha = Math.max(0, alpha);
          ctx.fillStyle = "#ffcc00";
          ctx.font = `bold ${Math.floor(72 * Math.min(beatScale, 1.5))}px monospace`;
          ctx.textAlign = "center";
          ctx.fillText(num, CANVAS_W / 2, CANVAS_H / 2 + 24);
          ctx.textAlign = "left";
          ctx.globalAlpha = 1;
        }
        // Phase 3 (4.5-5.5s): "GO!" flash + expand
        else {
          const goT = t - 4.5;
          const alpha = 1 - goT / 1.0;
          const scale = 1 + goT * 0.6;
          ctx.globalAlpha = Math.max(0, alpha);
          ctx.fillStyle = "#00ff88";
          ctx.font = `bold ${Math.floor(80 * scale)}px monospace`;
          ctx.textAlign = "center";
          ctx.fillText("GO!", CANVAS_W / 2, CANVAS_H / 2 + 24);
          ctx.textAlign = "left";
          ctx.globalAlpha = 1;
        }
      }

      // Announcement banners for audience-spawned obstacles
      for (let i = 0; i < state.announcements.length; i++) {
        const a = state.announcements[i];
        const progress = 1 - a.timer / a.maxTimer; // 0→1
        // Slide in from top over 0.3s, hold, fade out last 0.5s
        const slideIn = Math.min(1, progress * (a.maxTimer / 0.3));
        const fadeOut = a.timer < 0.5 ? a.timer / 0.5 : 1;
        const yOffset = -60 + slideIn * 60 + i * 56;
        ctx.globalAlpha = fadeOut;
        // Measure description to fit — wrap or truncate
        ctx.font = "11px monospace";
        const desc = a.description;
        const maxDescW = 400;
        let descLine = desc;
        if (ctx.measureText(desc).width > maxDescW) {
          // Truncate with ellipsis at character level
          let fit = desc;
          while (fit.length > 10 && ctx.measureText(fit + "...").width > maxDescW) fit = fit.slice(0, -1);
          descLine = fit + "...";
        }
        // Banner background
        ctx.fillStyle = "#000000cc";
        ctx.fillRect(CANVAS_W / 2 - 220, 76 + yOffset, 440, 48);
        // Colored accent bar
        ctx.fillStyle = a.color;
        ctx.fillRect(CANVAS_W / 2 - 220, 76 + yOffset, 4, 48);
        ctx.fillRect(CANVAS_W / 2 + 216, 76 + yOffset, 4, 48);
        // Obstacle name
        ctx.fillStyle = a.color;
        ctx.font = "bold 18px monospace";
        ctx.textAlign = "center";
        ctx.fillText(a.text, CANVAS_W / 2, 98 + yOffset);
        // Description
        ctx.fillStyle = "#ffffff99";
        ctx.font = "11px monospace";
        ctx.fillText(descLine, CANVAS_W / 2, 116 + yOffset);
        ctx.textAlign = "left";
        ctx.globalAlpha = 1;
      }
    }

    if (state.phase === "game_over") {
      drawGameOverOverlay(ctx, state);
    }

    ctx.restore();
  }

  function drawWaitingScreen(ctx: CanvasRenderingContext2D): void {
    // Dark overlay behind title
    ctx.fillStyle = "#00000088";
    ctx.fillRect(CANVAS_W / 2 - 260, CANVAS_H / 2 - 80, 520, 180);
    // Border glow
    ctx.fillStyle = "#00ff8822";
    ctx.fillRect(CANVAS_W / 2 - 262, CANVAS_H / 2 - 82, 524, 2);
    ctx.fillRect(CANVAS_W / 2 - 262, CANVAS_H / 2 + 98, 524, 2);
    ctx.fillRect(CANVAS_W / 2 - 262, CANVAS_H / 2 - 82, 2, 182);
    ctx.fillRect(CANVAS_W / 2 + 260, CANVAS_H / 2 - 82, 2, 182);

    // Title glow
    ctx.fillStyle = "#00ff8818";
    ctx.fillRect(CANVAS_W / 2 - 200, CANVAS_H / 2 - 62, 400, 30);
    // Title
    ctx.fillStyle = "#00ff88";
    ctx.font = "bold 48px monospace";
    ctx.textAlign = "center";
    ctx.fillText("SAIGON RUSH", CANVAS_W / 2, CANVAS_H / 2 - 36);
    // Subtitle
    ctx.fillStyle = "#ffcc00";
    ctx.font = "bold 20px monospace";
    ctx.fillText("Survive Ho Chi Minh City traffic!", CANVAS_W / 2, CANVAS_H / 2 + 14);
    // Blink "press start"
    if (Math.floor(Date.now() / 500) % 2 === 0) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px monospace";
      ctx.fillText("Press any key or scan QR to start", CANVAS_W / 2, CANVAS_H / 2 + 60);
    }

    // Vignette (scanlines handled by CSS .scanlines class)
    drawVignette(ctx);

    ctx.textAlign = "left";
  }

  function drawHUD(ctx: CanvasRenderingContext2D, s: InternalState): void {
    // HUD background strips (semi-transparent)
    ctx.fillStyle = "#00000044";
    ctx.fillRect(0, 0, CANVAS_W, 50);
    ctx.fillStyle = "#00000022";
    ctx.fillRect(0, 50, CANVAS_W, 2);

    // HP hearts — improved pixel heart shape
    for (let i = 0; i < s.player.maxHp; i++) {
      const hx = 20 + i * 32;
      const filled = i < s.player.hp;
      const c1 = filled ? "#ff2244" : "#333333";
      const c2 = filled ? "#ff4466" : "#3a3a3a";
      const c3 = filled ? "#cc1133" : "#2a2a2a";
      // Heart shape (pixel art)
      ctx.fillStyle = c1;
      ctx.fillRect(hx + 2, 14, 6, 2);   // Left bump
      ctx.fillRect(hx + 10, 14, 6, 2);  // Right bump
      ctx.fillRect(hx + 1, 16, 16, 2);  // Wide middle
      ctx.fillRect(hx + 2, 18, 14, 2);
      ctx.fillRect(hx + 3, 20, 12, 2);
      ctx.fillRect(hx + 4, 22, 10, 2);
      ctx.fillRect(hx + 5, 24, 8, 2);
      ctx.fillRect(hx + 6, 26, 6, 2);
      ctx.fillRect(hx + 7, 28, 4, 2);
      // Highlight
      if (filled) {
        ctx.fillStyle = c2;
        ctx.fillRect(hx + 3, 14, 4, 2);
        ctx.fillRect(hx + 2, 16, 6, 2);
      }
      // Shadow
      ctx.fillStyle = c3;
      ctx.fillRect(hx + 7, 26, 4, 2);
      ctx.fillRect(hx + 7, 28, 4, 2);
    }

    // Score with glow
    ctx.fillStyle = "#ffcc0033";
    ctx.fillRect(CANVAS_W - 140, 10, 130, 32);
    ctx.fillStyle = "#ffcc00";
    ctx.font = "bold 24px monospace";
    ctx.textAlign = "right";
    ctx.fillText(`${s.player.score}`, CANVAS_W - 20, 36);

    // Elapsed time
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${Math.floor(s.elapsed)}s`, CANVAS_W / 2, 36);

    // Speed indicator with bar
    const speedPct = Math.min(1, s.baseSpeed / 600);
    ctx.fillStyle = "#222230";
    ctx.fillRect(16, CANVAS_H - 28, 100, 10);
    ctx.fillStyle = speedPct > 0.8 ? "#ff4444" : "#44ff88";
    ctx.fillRect(16, CANVAS_H - 28, 100 * speedPct, 10);
    ctx.fillStyle = "#88ff88";
    ctx.font = "11px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`${Math.floor(s.baseSpeed / 5)} km/h`, 122, CANVAS_H - 19);

    // Combo (pulsing)
    if (s.player.dodgeCombo >= 2) {
      const comboPulse = Math.sin(s.frameCount * 0.2) * 0.15 + 0.85;
      ctx.globalAlpha = comboPulse;
      ctx.fillStyle = "#ff44ff22";
      ctx.fillRect(CANVAS_W / 2 - 60, 46, 120, 20);
      ctx.fillStyle = "#ff88ff";
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${s.player.dodgeCombo}x COMBO`, CANVAS_W / 2, 62);
      ctx.globalAlpha = 1;
    }

    // Power-up status indicators (bottom-right)
    let pIdx = 0;
    if (s.powerups.shieldActive) {
      ctx.fillStyle = "#00ff8844";
      ctx.fillRect(CANVAS_W - 110, CANVAS_H - 28 - pIdx * 18, 100, 16);
      ctx.fillStyle = "#00ff88";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "right";
      ctx.fillText("\ud83d\udee1\ufe0f SHIELD", CANVAS_W - 14, CANVAS_H - 16 - pIdx * 18);
      pIdx++;
    }
    if (s.powerups.speedBoostTimer > 0) {
      ctx.fillStyle = "#ff880044";
      ctx.fillRect(CANVAS_W - 110, CANVAS_H - 28 - pIdx * 18, 100, 16);
      ctx.fillStyle = "#ff8800";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`\u26a1 ${s.powerups.speedBoostTimer.toFixed(1)}s`, CANVAS_W - 14, CANVAS_H - 16 - pIdx * 18);
      pIdx++;
    }
    if (s.powerups.magnetCharges > 0) {
      ctx.fillStyle = "#aa44ff44";
      ctx.fillRect(CANVAS_W - 110, CANVAS_H - 28 - pIdx * 18, 100, 16);
      ctx.fillStyle = "#aa44ff";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`\ud83e\uddf2 x${s.powerups.magnetCharges}`, CANVAS_W - 14, CANVAS_H - 16 - pIdx * 18);
    }

    // Control hints (bottom center, subtle, fade out after 8 seconds)
    if (s.elapsed < 8) {
      const hintAlpha = s.elapsed < 6 ? 0.5 : 0.5 * (1 - (s.elapsed - 6) / 2);
      ctx.globalAlpha = hintAlpha;
      ctx.fillStyle = "#ffffff";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText("W/S or \u2191/\u2193: DODGE", CANVAS_W / 2, CANVAS_H - 8);
      ctx.globalAlpha = 1;
    }

    ctx.textAlign = "left";
  }

  function drawGameOverOverlay(ctx: CanvasRenderingContext2D, s: InternalState): void {
    // Static/glitch bands (CRT death effect)
    ctx.fillStyle = "rgba(0, 0, 0, 0.80)";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    // Glitch scanline bands
    for (let i = 0; i < 6; i++) {
      const y = (s.frameCount * 3 + i * 107) % CANVAS_H;
      ctx.fillStyle = `rgba(255, 0, 0, ${0.03 + Math.random() * 0.04})`;
      ctx.fillRect(0, y, CANVAS_W, 2 + Math.random() * 8);
    }
    // Red vignette pulse
    const pulse = Math.sin(s.frameCount * 0.08) * 0.08 + 0.12;
    ctx.fillStyle = `rgba(255, 0, 0, ${pulse})`;
    ctx.fillRect(0, 0, CANVAS_W, 40);
    ctx.fillRect(0, CANVAS_H - 40, CANVAS_W, 40);

    // Panel
    ctx.fillStyle = "#060610";
    ctx.fillRect(CANVAS_W / 2 - 280, CANVAS_H / 2 - 120, 560, 260);
    // Red border glow
    ctx.fillStyle = "#ff2222";
    ctx.fillRect(CANVAS_W / 2 - 282, CANVAS_H / 2 - 122, 564, 2);
    ctx.fillRect(CANVAS_W / 2 - 282, CANVAS_H / 2 + 138, 564, 2);
    ctx.fillRect(CANVAS_W / 2 - 282, CANVAS_H / 2 - 122, 2, 262);
    ctx.fillRect(CANVAS_W / 2 + 280, CANVAS_H / 2 - 122, 2, 262);
    // Inner border
    ctx.fillStyle = "#ff222244";
    ctx.fillRect(CANVAS_W / 2 - 276, CANVAS_H / 2 - 116, 552, 1);
    ctx.fillRect(CANVAS_W / 2 - 276, CANVAS_H / 2 + 133, 552, 1);

    // "WIPEOUT!" with glow
    ctx.fillStyle = "#ff111122";
    ctx.fillRect(CANVAS_W / 2 - 200, CANVAS_H / 2 - 108, 400, 52);
    ctx.fillStyle = "#ff4444";
    ctx.font = "bold 56px monospace";
    ctx.textAlign = "center";
    ctx.fillText("WIPEOUT!", CANVAS_W / 2, CANVAS_H / 2 - 66);

    // Score — large and golden
    ctx.fillStyle = "#ffcc0022";
    ctx.fillRect(CANVAS_W / 2 - 120, CANVAS_H / 2 - 44, 240, 40);
    ctx.fillStyle = "#ffcc00";
    ctx.font = "bold 36px monospace";
    ctx.fillText(`${s.player.score}`, CANVAS_W / 2, CANVAS_H / 2 - 12);
    ctx.fillStyle = "#ffcc0088";
    ctx.font = "10px monospace";
    ctx.fillText("SCORE", CANVAS_W / 2, CANVAS_H / 2 - 46);

    // Stats row
    const stats = [
      { label: "DODGED", value: `${s.obstaclesDodged}`, color: "#00ff88" },
      { label: "NEAR MISS", value: `${s.nearMisses}`, color: "#44ddff" },
      { label: "HITS", value: `${s.totalHits}`, color: "#ff6644" },
    ];
    const statW = 140;
    const statStartX = CANVAS_W / 2 - (stats.length * statW) / 2;
    for (let i = 0; i < stats.length; i++) {
      const sx = statStartX + i * statW + statW / 2;
      ctx.fillStyle = stats[i].color + "11";
      ctx.fillRect(sx - 55, CANVAS_H / 2 + 10, 110, 36);
      ctx.fillStyle = stats[i].color;
      ctx.font = "bold 22px monospace";
      ctx.fillText(stats[i].value, sx, CANVAS_H / 2 + 34);
      ctx.fillStyle = stats[i].color + "88";
      ctx.font = "8px monospace";
      ctx.fillText(stats[i].label, sx, CANVAS_H / 2 + 14);
    }

    // Survival + speed
    const surv = Math.floor(s.elapsed * 10) / 10;
    ctx.fillStyle = "#ffffff66";
    ctx.font = "12px monospace";
    ctx.fillText(`Survived ${surv}s  \u2022  Top speed ${Math.floor(s.topSpeed / 5)} km/h`, CANVAS_W / 2, CANVAS_H / 2 + 72);

    // Rating
    const rating = s.player.score > 3000 ? "TRAFFIC LEGEND"
      : s.player.score > 1500 ? "SAIGON LOCAL"
      : s.player.score > 600 ? "XE OM DRIVER" : "TOURIST";
    ctx.fillStyle = "#ffcc00";
    ctx.font = "bold 14px monospace";
    ctx.fillText(`\u2605 ${rating} \u2605`, CANVAS_W / 2, CANVAS_H / 2 + 100);

    // "Press any key" blink
    if (Math.floor(s.frameCount / 30) % 2 === 0) {
      ctx.fillStyle = "#ffffff55";
      ctx.font = "11px monospace";
      ctx.fillText("PRESS ANY KEY FOR TRAFFIC REPORT", CANVAS_W / 2, CANVAS_H / 2 + 126);
    }

    drawVignette(ctx);
    ctx.textAlign = "left";
  }

  // ── Game Loop ─────────────────────────────────────────
  function loop(timestamp: number): void {
    if (destroyed) return;
    if (lastTime === 0) lastTime = timestamp;
    let dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    // Cap dt to prevent spiral of death
    if (dt > 0.05) dt = 0.05;

    update(dt);
    render();
    rafId = requestAnimationFrame(loop);
  }

  // Start the render loop immediately (shows waiting screen)
  rafId = requestAnimationFrame(loop);

  // ── Public API ────────────────────────────────────────
  return {
    start() {
      if (state.phase !== "waiting") return;
      state.phase = "playing";
      state.elapsed = 0;
      audio.init();
      audio.playEngine();
      // Countdown beeps synced with intro visuals (title 0-1.8s, countdown 2.0-4.4s)
      setTimeout(() => audio.playCountdownBeep(3), 2000);
      setTimeout(() => audio.playCountdownBeep(2), 2800);
      setTimeout(() => audio.playCountdownBeep(1), 3600);
      setTimeout(() => { audio.playCountdownBeep(0); audio.startMusic(); }, 4500);
      setTimeout(() => audio.playHorn(), 4600);
    },

    handleInput(action: InputAction) {
      if (state.phase !== "playing") {
        if (state.phase === "waiting") this.start();
        return;
      }
      const p = state.player;
      if (action === "lane_up") {
        p.lane = Math.max(0, p.lane - 1);
        p.targetY = LANE_Y[p.lane];
      } else if (action === "lane_down") {
        p.lane = Math.min(2, p.lane + 1);
        p.targetY = LANE_Y[p.lane];
      } else if (action === "boost") {
        // Temporary speed boost
        state.baseSpeed += 80;
        audio.playBoost();
      }
    },

    addObstacle(obstacle: GameObstacle) {
      // Upgrade low-quality GPT sprites (≤12 rects) with better sources:
      // Priority: runtime cache (previous Opus result) → sprite library → keep GPT fallback
      if (!obstacle.spriteData || obstacle.spriteData.length <= 12) {
        if (runtimeSpriteCache.has(obstacle.type)) {
          const cached = runtimeSpriteCache.get(obstacle.type)!;
          obstacle.spriteData = cached.map(([x, y, w, h, c]) => ({ x, y, w, h, c }));
        } else {
          const lib = getLibrarySprite(obstacle.type);
          if (lib) {
            obstacle.spriteData = lib.sprite.map(([x, y, w, h, c]) => ({ x, y, w, h, c }));
            if (lib.segmentSprite && !obstacle.segmentSpriteData) {
              obstacle.segmentSpriteData = lib.segmentSprite.map(([x, y, w, h, c]) => ({ x, y, w, h, c }));
            }
          }
        }
      }
      if (obstacle.fromAudience) {
        // Preload fal.ai image during the 3.5-second warning phase
        if (obstacle.imageUrl) {
          preloadObstacleImage(obstacle.imageUrl);
        }
        // Telegraph: 3.5-second warning before spawning (gives DALL-E time to generate image)
        state.pendingWarnings.push({
          obstacle,
          timer: 3.5,
          lane: obstacle.lane,
          tickerX: CANVAS_W,
          sirenTimer: 0,
        });
        audio.playWarning();
        if (obstacle.announcementAudio) {
          audio.playAnnouncementAudio(obstacle.announcementAudio);
        }
      } else {
        state.suggestionQueue.push(obstacle);
      }
    },

    updateObstacleImage(obstacleId: string, imageUrl: string) {
      preloadObstacleImage(imageUrl);
      for (const o of state.obstacles) {
        if (o.data.id === obstacleId) { o.data.imageUrl = imageUrl; return; }
      }
      for (const w of state.pendingWarnings) {
        if (w.obstacle.id === obstacleId) { w.obstacle.imageUrl = imageUrl; return; }
      }
    },

    updateObstacleSpriteData(obstacleId: string, spriteData: Array<{ x: number; y: number; w: number; h: number; c: string }>, obstacleType?: string) {
      // Try to update the live obstacle with the high-quality sprite
      for (const o of state.obstacles) {
        if (o.data.id === obstacleId) { o.data.spriteData = spriteData; return; }
      }
      for (const w of state.pendingWarnings) {
        if (w.obstacle.id === obstacleId) { w.obstacle.spriteData = spriteData; return; }
      }
      for (const q of state.suggestionQueue) {
        if (q.id === obstacleId) { q.spriteData = spriteData; return; }
      }
      // Obstacle already gone — cache in runtime sprite map so NEXT spawn of this type uses it
      if (obstacleType) {
        runtimeSpriteCache.set(obstacleType, spriteData.map(r => [r.x, r.y, r.w, r.h, r.c] as [number, number, number, number, string]));
      }
    },

    getState(): GameState {
      return {
        player: {
          lane: state.player.lane,
          hp: state.player.hp,
          score: state.player.score,
          distance: Math.floor(state.player.distance),
          speed: Math.floor(state.baseSpeed),
        },
        obstacles: state.obstacles.map((o) => o.data),
        speed: state.baseSpeed,
        phase: state.phase,
        elapsed: state.elapsed,
        suggestionFeed: [],
      };
    },

    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      audio.destroy();
    },
  };
}

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
  spawnObstacle,
  updateObstacle,
  updateParticle,
  updatePlayer,
  updateRoad,
} from "./entities";
import { AudioManager } from "./audio";

// ── Default obstacle templates for random spawner ─────────
const DEFAULT_OBSTACLES: Omit<GameObstacle, "id" | "lane" | "fromAudience" | "audienceMessage">[] = [
  { type: "slow_motorbike", displayName: "Slow Motorbike", width: "small", speed: 0.6, color: "#cc4444", dangerLevel: 1, label: "\ud83c\udfcd\ufe0f Motorbike" },
  { type: "pho_cart", displayName: "Ph\u1edf Cart", width: "medium", speed: 0.3, color: "#ff8844", dangerLevel: 1, label: "\ud83c\udf5c Ph\u1edf Cart" },
  { type: "taxi", displayName: "Taxi", width: "large", speed: 0.8, color: "#ffdd00", dangerLevel: 2, label: "\ud83d\ude95 Taxi" },
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
  suggestionQueue: GameObstacle[];
  pendingWarnings: Array<{ obstacle: GameObstacle; timer: number; lane: number; tickerX: number; sirenTimer: number }>;
  obstaclesDodged: number;
  nearMisses: number;
  audienceChaos: number;
  totalHits: number;
  topSpeed: number;
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
    spawnTimer: 0,
    dustTimer: 0,
    speedLineTimer: 0,
    frameCount: 0,
    shakeTimer: 0,
    shakeIntensity: 0,
    hitFlashTimer: 0,
    suggestionQueue: [],
    pendingWarnings: [],
    obstaclesDodged: 0,
    nearMisses: 0,
    audienceChaos: 0,
    totalHits: 0,
    topSpeed: 0,
  };
}

// ── Public API ────────────────────────────────────────────
export interface GameAPI {
  start(): void;
  handleInput(action: InputAction): void;
  addObstacle(obstacle: GameObstacle): void;
  getState(): GameState;
  destroy(): void;
}

export interface GameOptions {
  onGameOver?: (stats: GameStats) => void;
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

  // ── Update Logic ──────────────────────────────────────
  function update(dt: number): void {
    if (state.phase !== "playing") return;

    state.elapsed += dt;
    state.frameCount++;

    // Speed ramp: increases over time
    state.baseSpeed = 300 + state.elapsed * 4;
    state.topSpeed = Math.max(state.topSpeed, state.baseSpeed);
    audio.setEngineSpeed(state.baseSpeed);

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

    // Update obstacles
    for (const o of state.obstacles) {
      updateObstacle(o, state.baseSpeed, dt);

      // Check collision
      if (!o.passed && checkCollision(state.player, o)) {
        if (!state.player.invincible) {
          playerHit(state.player);
          state.totalHits++;
          state.shakeTimer = 0.2;
          state.shakeIntensity = 8;
          state.hitFlashTimer = 0.1;
          audio.playCrash();
          // Hit particles
          for (let i = 0; i < 8; i++) {
            state.particles.push(createHitParticle(PLAYER_X, state.player.y));
          }
          // Check game over
          if (state.player.hp <= 0) {
            endGame();
            return;
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

      // Mark dodged
      if (!o.passed && o.x + o.pixelWidth < PLAYER_X - 20) {
        o.passed = true;
        state.obstaclesDodged++;
        if (o.data.fromAudience) state.audienceChaos++;
      }
    }

    // Remove off-screen obstacles
    state.obstacles = state.obstacles.filter((o) => !isObstacleOffScreen(o));

    // Dust trail particles
    state.dustTimer -= dt;
    if (state.dustTimer <= 0) {
      state.dustTimer = 0.05;
      state.particles.push(createDustParticle(PLAYER_X - 20, state.player.y));
    }

    // Speed lines at high velocity
    state.speedLineTimer -= dt;
    if (state.baseSpeed > 450 && state.speedLineTimer <= 0) {
      state.speedLineTimer = 0.08;
      state.particles.push(createSpeedLine(state.player.y));
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
      }
    }
    state.pendingWarnings = state.pendingWarnings.filter((w) => w.timer > 0);

    // Timer game over (60-second rounds)
    if (state.elapsed >= 60) {
      endGame();
    }
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

  function endGame(): void {
    state.phase = "game_over";
    audio.stopEngine();
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
      survivalTime: Math.min(60, Math.floor(state.elapsed * 10) / 10),
      rating,
    };
  }

  // ── Render Logic ──────────────────────────────────────
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
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(-10, -10, CANVAS_W + 20, CANVAS_H + 20);

    if (state.phase === "waiting") {
      drawRoad(ctx, state.road);
      drawWaitingScreen(ctx);
    } else if (state.phase === "playing" || state.phase === "game_over") {
      // Background + road
      drawRoad(ctx, state.road);
      // Obstacles
      for (const o of state.obstacles) drawObstacle(ctx, o);
      // Warning zones for pending audience obstacles
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
      // Player
      drawPlayer(ctx, state.player, state.frameCount);
      // Particles
      for (const p of state.particles) drawParticle(ctx, p);
      // Hit flash overlay
      if (state.hitFlashTimer > 0) {
        ctx.fillStyle = `rgba(255, 0, 0, ${state.hitFlashTimer * 3})`;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      }
      // HUD
      drawHUD(ctx, state);
    }

    if (state.phase === "game_over") {
      drawGameOverOverlay(ctx, state);
    }

    ctx.restore();
  }

  function drawWaitingScreen(ctx: CanvasRenderingContext2D): void {
    // Title
    ctx.fillStyle = "#00ff88";
    ctx.font = "bold 48px monospace";
    ctx.textAlign = "center";
    ctx.fillText("SAIGON RUSH", CANVAS_W / 2, CANVAS_H / 2 - 40);
    // Subtitle
    ctx.fillStyle = "#ffcc00";
    ctx.font = "bold 20px monospace";
    ctx.fillText("Survive Ho Chi Minh City traffic!", CANVAS_W / 2, CANVAS_H / 2 + 10);
    // Blink "press start"
    if (Math.floor(Date.now() / 500) % 2 === 0) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px monospace";
      ctx.fillText("Waiting for controller...", CANVAS_W / 2, CANVAS_H / 2 + 60);
    }
    ctx.textAlign = "left";
  }

  function drawHUD(ctx: CanvasRenderingContext2D, s: InternalState): void {
    // HP hearts
    const heartSize = 22;
    for (let i = 0; i < s.player.maxHp; i++) {
      ctx.fillStyle = i < s.player.hp ? "#ff4444" : "#333333";
      ctx.fillRect(20 + i * (heartSize + 8), 16, heartSize, heartSize);
      // Heart shape approximation with small rects
      ctx.fillRect(22 + i * (heartSize + 8), 14, heartSize - 4, 4);
    }

    // Score
    ctx.fillStyle = "#ffcc00";
    ctx.font = "bold 24px monospace";
    ctx.textAlign = "right";
    ctx.fillText(`${s.player.score}`, CANVAS_W - 20, 36);

    // Timer
    const remaining = Math.max(0, 60 - s.elapsed);
    ctx.fillStyle = remaining < 10 ? "#ff4444" : "#ffffff";
    ctx.font = "bold 20px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${Math.ceil(remaining)}s`, CANVAS_W / 2, 36);

    // Speed indicator
    ctx.fillStyle = "#88ff88";
    ctx.font = "12px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`${Math.floor(s.baseSpeed / 5)} km/h`, 20, CANVAS_H - 16);

    // Combo
    if (s.player.dodgeCombo >= 2) {
      ctx.fillStyle = "#ff88ff";
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${s.player.dodgeCombo}x COMBO`, CANVAS_W / 2, 60);
    }

    ctx.textAlign = "left";
  }

  function drawGameOverOverlay(ctx: CanvasRenderingContext2D, s: InternalState): void {
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = "#ff4444";
    ctx.font = "bold 52px monospace";
    ctx.textAlign = "center";
    if (s.player.hp <= 0) {
      ctx.fillText("WIPEOUT!", CANVAS_W / 2, CANVAS_H / 2 - 40);
    } else {
      ctx.fillStyle = "#00ff88";
      ctx.fillText("TIME'S UP!", CANVAS_W / 2, CANVAS_H / 2 - 40);
    }
    ctx.fillStyle = "#ffcc00";
    ctx.font = "bold 28px monospace";
    ctx.fillText(`Score: ${s.player.score}`, CANVAS_W / 2, CANVAS_H / 2 + 20);
    ctx.fillStyle = "#ffffff";
    ctx.font = "16px monospace";
    ctx.fillText(`Dodged: ${s.obstaclesDodged}  Near-misses: ${s.nearMisses}  Hits: ${s.totalHits}`, CANVAS_W / 2, CANVAS_H / 2 + 60);
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
      audio.playHorn();
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
      if (obstacle.fromAudience) {
        // Telegraph: 2-second warning before spawning
        state.pendingWarnings.push({
          obstacle,
          timer: 2.0,
          lane: obstacle.lane,
          tickerX: CANVAS_W,
          sirenTimer: 0,
        });
        audio.playWarning();
      } else {
        state.suggestionQueue.push(obstacle);
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

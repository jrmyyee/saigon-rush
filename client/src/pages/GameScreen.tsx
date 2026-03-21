import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { createWSClient } from "../lib/ws";
import { createGame } from "../game/engine";
import type { GameStats, SuggestionFeedItem, WSMessage } from "@shared/types";
import type { GameAPI } from "../game/engine";

function SpritePreview({ spriteData }: { spriteData: SuggestionFeedItem['spriteData'] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !spriteData?.length) return;
    ctx.clearRect(0, 0, 80, 60);
    const scale = 1.2;
    for (const { x, y, w, h, c } of spriteData) {
      ctx.fillStyle = c;
      ctx.fillRect(x * scale + 10, y * scale + 20, w * scale, h * scale);
    }
  }, [spriteData]);
  if (!spriteData?.length) return null;
  return <canvas ref={canvasRef} width={80} height={60} className="block" />;
}

export function GameScreen() {
  const [params] = useSearchParams();
  const testMode = params.get("test") === "1";
  const sessionId = useMemo(() => {
    return params.get("session") || Math.random().toString(36).slice(2, 6).toUpperCase();
  }, []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameAPI | null>(null);
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"lobby" | "playing" | "game_over">("lobby");
  const [feed, setFeed] = useState<SuggestionFeedItem[]>([]);
  const [audienceCount, setAudienceCount] = useState(0);
  const [topVoted, setTopVoted] = useState<{ label: string; votes: number; color: string } | null>(null);
  const wsRef = useRef<ReturnType<typeof createWSClient> | null>(null);

  const baseUrl = window.location.origin;
  const audienceUrl = `${baseUrl}/audience?session=${sessionId}`;

  // Mount game engine when phase is playing
  useEffect(() => {
    if (phase !== "playing" || !canvasRef.current || gameRef.current) return;
    const game = createGame(canvasRef.current, {
      testMode,
      onGameOver: (stats: GameStats) => {
        navigate(`/results?distance=${stats.distance}&dodged=${stats.obstaclesDodged}&chaos=${stats.audienceChaos}&misses=${stats.nearMisses}&speed=${stats.topSpeed}&hits=${stats.totalHits}&time=${stats.survivalTime}&rating=${encodeURIComponent(stats.rating)}`);
      },
    });
    gameRef.current = game;
    game.start();
    return () => { game.destroy(); gameRef.current = null; };
  }, [phase, navigate, testMode]);

  // WebSocket connection — stays alive across lobby → playing
  useEffect(() => {
    const ws = createWSClient("display", sessionId);
    wsRef.current = ws;
    ws.onMessage((msg: any) => {
      if (msg.type === "audience_count") {
        setAudienceCount(msg.count);
      }
      if (msg.type === "input" && gameRef.current) {
        gameRef.current.handleInput(msg.action);
      }
      if (msg.type === "new_obstacle" && gameRef.current) {
        gameRef.current.addObstacle(msg.obstacle);
      }
      if (msg.type === "suggestion_accepted") {
        setFeed((f) => [{
          text: msg.original,
          result: msg.result.label,
          timestamp: Date.now(),
          spriteData: msg.result.spriteData,
          color: msg.result.color,
        }, ...f].slice(0, 5));
      }
      if (msg.type === "obstacle_sprite_ready" && gameRef.current) {
        gameRef.current.updateObstacleSpriteData(msg.obstacleId, msg.spriteData, msg.obstacleType);
      }
      if (msg.type === "obstacle_sfx_ready" && gameRef.current) {
        try {
          const audio = new Audio(`data:audio/mpeg;base64,${msg.soundEffectAudio}`);
          audio.volume = 0.5;
          audio.play().catch(() => {});
        } catch {}
      }
      if (msg.type === "vote_update") {
        const sorted = [...msg.votes].sort((a: any, b: any) => b.votes - a.votes);
        if (sorted[0]?.votes > 0) {
          setTopVoted({ label: sorted[0].label, votes: sorted[0].votes, color: sorted[0].color });
        }
      }
    });
    return () => ws.close();
  }, [sessionId]);

  // Keyboard controls during gameplay
  useEffect(() => {
    if (phase !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      if (!gameRef.current) return;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") gameRef.current.handleInput("lane_up");
      else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") gameRef.current.handleInput("lane_down");
      else if (e.key === " ") { e.preventDefault(); gameRef.current.handleInput("boost"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  // ── LOBBY SCREEN ──────────────────────────────────────────
  if (phase === "lobby") {
    return (
      <div className="w-full h-full flex flex-col bg-saigon-dark overflow-hidden relative">
        {/* Animated road background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Road surface */}
          <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-[#222230]" />
          {/* Lane dividers (animated) */}
          <div className="absolute bottom-[32%] left-0 right-0 h-[2px] bg-[#555555] opacity-40" />
          <div className="absolute bottom-[20%] left-0 right-0 h-[2px] bg-[#555555] opacity-40" />
          {/* Center line */}
          <div className="absolute bottom-[26%] left-0 right-0 h-[2px]"
            style={{ background: "repeating-linear-gradient(90deg, #ccaa22 0px, #ccaa22 24px, transparent 24px, transparent 40px)" }} />
          {/* Skyline silhouette */}
          <div className="absolute bottom-[40%] left-0 right-0 h-[20%]"
            style={{ background: "linear-gradient(to top, #0e0e22, transparent)" }} />
          {/* Neon glow strips */}
          <div className="absolute top-[15%] left-[10%] w-[20%] h-[3px] bg-neon-green/20 blur-sm" />
          <div className="absolute top-[20%] right-[15%] w-[15%] h-[3px] bg-neon-yellow/20 blur-sm" />
          <div className="absolute top-[25%] left-[30%] w-[10%] h-[2px] bg-neon-red/20 blur-sm" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-6 px-8">
          {/* Title */}
          <div className="text-center">
            <h1 className="font-pixel text-neon-green text-5xl md:text-7xl tracking-wider drop-shadow-[0_0_30px_rgba(0,255,136,0.3)]">
              SAIGON RUSH
            </h1>
            <p className="text-neon-yellow font-pixel text-sm md:text-base mt-2 tracking-wide">
              SURVIVE HO CHI MINH CITY TRAFFIC
            </p>
          </div>

          {/* Main card — QR + info */}
          <div className="flex flex-col md:flex-row items-center gap-8 bg-black/60 border border-neon-green/20 rounded-lg px-8 py-6 backdrop-blur-sm max-w-2xl">
            {/* QR Code */}
            <div className="flex flex-col items-center gap-3">
              <QRCodeSVG value={audienceUrl} size={180} bgColor="#0a0a0f" fgColor="#ffdd00" />
              <p className="text-neon-yellow font-pixel text-[10px] tracking-wider">SCAN TO JOIN</p>
            </div>

            {/* Info panel */}
            <div className="flex flex-col gap-4 text-center md:text-left">
              <div>
                <p className="text-white/40 text-xs mb-1">HOW IT WORKS</p>
                <p className="text-white/80 text-sm leading-relaxed">
                  You dodge traffic on the big screen.<br />
                  The audience designs the obstacles.<br />
                  <span className="text-neon-yellow">Type anything</span> — it appears on the road.
                </p>
              </div>

              {/* Audience counter */}
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${audienceCount > 0 ? "bg-neon-green animate-pulse" : "bg-white/20"}`} />
                <span className="text-white text-lg font-pixel">
                  {audienceCount === 0 ? "Waiting for audience..." : `${audienceCount} ${audienceCount === 1 ? "player" : "players"} joined`}
                </span>
              </div>

              {/* Session code */}
              <p className="text-white/30 text-xs font-mono">Room: {sessionId}</p>
            </div>
          </div>

          {/* START button */}
          <button
            onClick={() => setPhase("playing")}
            className="group relative px-12 py-4 font-pixel text-2xl tracking-wider transition-all duration-200 hover:scale-105 active:scale-95"
          >
            {/* Glow background */}
            <div className="absolute inset-0 bg-neon-green/20 rounded-lg blur-xl group-hover:bg-neon-green/30 transition-colors" />
            {/* Button body */}
            <div className="relative bg-neon-green text-saigon-dark rounded-lg px-12 py-4 border-2 border-neon-green shadow-[0_0_20px_rgba(0,255,136,0.3)] group-hover:shadow-[0_0_40px_rgba(0,255,136,0.5)]">
              START GAME
            </div>
          </button>

          {testMode && <p className="text-neon-red font-pixel text-xs">TEST MODE — INFINITE LIVES</p>}

          {/* Bottom hint */}
          <p className="text-white/20 text-xs">
            W/S or Arrow keys to dodge
          </p>
        </div>
      </div>
    );
  }

  // ── GAMEPLAY SCREEN ───────────────────────────────────────
  return (
    <div className="w-full h-full flex bg-saigon-dark">
      <div className="flex-1 flex items-center justify-center relative scanlines">
        <canvas ref={canvasRef} width={960} height={640} className="max-w-full max-h-full border-2 border-neon-green/40 shadow-[0_0_40px_rgba(0,255,136,0.15)]" style={{ imageRendering: "pixelated" }} />
        <div className="absolute bottom-2 left-2 bg-saigon-dark/80 px-2 py-1 rounded flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${audienceCount > 0 ? "bg-neon-green" : "bg-white/20"}`} />
          <p className="text-white/40 text-[9px] font-pixel">{audienceCount} watching</p>
        </div>
      </div>
      <div className="w-56 bg-saigon-sky/80 p-3 flex flex-col gap-2 overflow-hidden">
        <h2 className="font-pixel text-neon-yellow text-[10px]">CHAOS FEED</h2>
        <div className="mb-2">
          <QRCodeSVG value={audienceUrl} size={80} bgColor="#1a1a2e" fgColor="#ffdd00" />
          <p className="text-white/40 text-[8px] mt-1">Scan to send chaos</p>
        </div>
        {topVoted && (
          <div className="bg-saigon-dark/80 rounded px-2 py-1.5 border border-neon-yellow/30">
            <p className="text-neon-yellow font-pixel text-[8px]">AUDIENCE FAVORITE</p>
            <p className="text-white text-sm" style={{ color: topVoted.color }}>{topVoted.label}</p>
            <p className="text-neon-yellow text-[10px]">+{topVoted.votes} votes</p>
          </div>
        )}
        {feed.length === 0 && <p className="text-white/30 text-[9px] mt-2">Waiting for suggestions...</p>}
        {feed.map((item, i) => (
          <div key={i} className="bg-saigon-dark/60 rounded px-2 py-1 relative group">
            <p className="text-white/50 text-xs truncate">{item.text}</p>
            <p className="text-neon-green text-sm">{item.result}</p>
            {item.spriteData && (
              <div className="absolute hidden group-hover:block bottom-full left-0 mb-1 bg-saigon-dark border border-neon-green/30 rounded p-1 z-10">
                <SpritePreview spriteData={item.spriteData} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

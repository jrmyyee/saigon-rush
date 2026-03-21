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
  const [phase, setPhase] = useState<"waiting" | "playing" | "game_over">("waiting");
  const [feed, setFeed] = useState<SuggestionFeedItem[]>([]);
  const [topVoted, setTopVoted] = useState<{ label: string; votes: number; color: string } | null>(null);

  const baseUrl = window.location.origin;
  const controlUrl = `${baseUrl}/control?session=${sessionId}`;
  const audienceUrl = `${baseUrl}/audience?session=${sessionId}`;

  // Mount game engine when canvas is available and phase is playing
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

  useEffect(() => {
    const ws = createWSClient("display", sessionId);
    ws.onMessage((msg: any) => {
      if (msg.type === "player_joined" && msg.role === "controller") setPhase("playing");
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
      // Claude Opus high-quality sprite arrived (progressive enhancement)
      if (msg.type === "obstacle_sprite_ready" && gameRef.current) {
        gameRef.current.updateObstacleSpriteData(msg.obstacleId, msg.spriteData, msg.obstacleType);
      }
      // Vote update — track audience favorite
      if (msg.type === "vote_update") {
        const sorted = [...msg.votes].sort((a: any, b: any) => b.votes - a.votes);
        if (sorted[0]?.votes > 0) {
          setTopVoted({ label: sorted[0].label, votes: sorted[0].votes, color: sorted[0].color });
        }
      }
      // ElevenLabs SFX arrived
      if (msg.type === "obstacle_sfx_ready" && gameRef.current) {
        try {
          const audio = new Audio(`data:audio/mpeg;base64,${msg.soundEffectAudio}`);
          audio.volume = 0.5;
          audio.play().catch(() => {});
        } catch {}
      }
    });
    return () => ws.close();
  }, [sessionId]);

  // Also support keyboard directly on the game screen for testing
  useEffect(() => {
    if (phase !== "playing" && phase !== "waiting") return;
    const onKey = (e: KeyboardEvent) => {
      // Start game on any key if waiting
      if (phase === "waiting") {
        setPhase("playing");
        return;
      }
      if (!gameRef.current) return;
      if (e.key === "ArrowUp" || e.key === "w") gameRef.current.handleInput("lane_up");
      else if (e.key === "ArrowDown" || e.key === "s") gameRef.current.handleInput("lane_down");
      else if (e.key === " ") { e.preventDefault(); gameRef.current.handleInput("boost"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  if (phase === "waiting") {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center gap-6 bg-saigon-dark cursor-pointer"
        onClick={() => setPhase("playing")}
      >
        <h1 className="font-pixel text-neon-green text-3xl md:text-5xl tracking-wider">SAIGON RUSH</h1>
        {testMode && <p className="text-neon-red font-pixel text-xs">TEST MODE — INFINITE LIVES</p>}
        <p className="text-white/60 font-pixel text-xs">Session: {sessionId}</p>
        <div className="flex gap-8">
          <div className="flex flex-col items-center gap-2">
            <QRCodeSVG value={controlUrl} size={160} bgColor="#0a0a0f" fgColor="#00ff88" />
            <span className="text-neon-green font-pixel text-[10px]">PLAYER</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <QRCodeSVG value={audienceUrl} size={160} bgColor="#0a0a0f" fgColor="#ffdd00" />
            <span className="text-neon-yellow font-pixel text-[10px]">AUDIENCE</span>
          </div>
        </div>
        <p className="text-white/40 font-pixel text-xs animate-pulse">
          Click anywhere, press any key, or scan QR to start
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex bg-saigon-dark">
      <div className="flex-1 flex items-center justify-center relative scanlines">
        <canvas ref={canvasRef} width={960} height={640} className="max-w-full max-h-full border-2 border-neon-green/40 shadow-[0_0_40px_rgba(0,255,136,0.15)]" style={{ imageRendering: "pixelated" }} />
        <div className="absolute bottom-2 left-2 bg-saigon-dark/80 px-2 py-1 rounded">
          <p className="text-white/40 text-[9px] font-pixel">AUDIENCE: {audienceUrl.replace(window.location.origin, '...')}</p>
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

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { createWSClient } from "../lib/ws";
import { createGame } from "../game/engine";
import type { GameStats, SuggestionFeedItem, WSMessage } from "@shared/types";
import type { GameAPI } from "../game/engine";

export function GameScreen() {
  const [params] = useSearchParams();
  const testMode = params.get("test") === "1";
  const sessionId = useMemo(() => Math.random().toString(36).slice(2, 6).toUpperCase(), []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameAPI | null>(null);
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"waiting" | "playing" | "game_over">("waiting");
  const [feed, setFeed] = useState<SuggestionFeedItem[]>([]);

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
    ws.onMessage((msg: WSMessage) => {
      if (msg.type === "player_joined" && msg.role === "controller") setPhase("playing");
      if (msg.type === "input" && gameRef.current) {
        gameRef.current.handleInput(msg.action);
      }
      if (msg.type === "new_obstacle" && gameRef.current) {
        gameRef.current.addObstacle(msg.obstacle);
      }
      if (msg.type === "suggestion_accepted") {
        setFeed((f) => [{ text: msg.original, result: msg.result.label, timestamp: Date.now() }, ...f].slice(0, 5));
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
      <div className="flex-1 flex items-center justify-center">
        <canvas ref={canvasRef} width={960} height={640} className="max-w-full max-h-full" style={{ imageRendering: "pixelated" }} />
      </div>
      {feed.length > 0 && (
        <div className="w-56 bg-saigon-sky/80 p-3 flex flex-col gap-2 overflow-hidden">
          <h2 className="font-pixel text-neon-yellow text-[10px]">CHAOS FEED</h2>
          {feed.map((item, i) => (
            <div key={i} className="bg-saigon-dark/60 rounded px-2 py-1">
              <p className="text-white/50 text-xs truncate">{item.text}</p>
              <p className="text-neon-green text-sm">{item.result}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

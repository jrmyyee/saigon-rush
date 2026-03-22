import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { createWSClient } from "../lib/ws";
import { createGame } from "../game/engine";
import { AudioManager } from "../game/audio";
import type { GameStats, SuggestionFeedItem } from "@shared/types";
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
  const [allVotes, setAllVotes] = useState<Array<{ id: string; label: string; color: string; votes: number }>>([]);
  const [joinedPlayers, setJoinedPlayers] = useState<Array<{ name: string; color: string; joinedAt: number }>>([]);
  const [lobbyMusicStarted, setLobbyMusicStarted] = useState(false);
  const wsRef = useRef<ReturnType<typeof createWSClient> | null>(null);
  const lobbyAudioRef = useRef<AudioManager | null>(null);

  const baseUrl = window.location.origin;
  const audienceUrl = `${baseUrl}/audience?session=${sessionId}`;

  // Start lobby music on first user interaction (required by browser autoplay policy)
  useEffect(() => {
    if (phase !== "lobby") return;
    const startLobbyAudio = () => {
      if (lobbyAudioRef.current || lobbyMusicStarted) return;
      const audio = new AudioManager();
      lobbyAudioRef.current = audio;
      audio.startLobbyMusic();
      setLobbyMusicStarted(true);
    };
    window.addEventListener("click", startLobbyAudio, { once: true });
    window.addEventListener("keydown", startLobbyAudio, { once: true });
    return () => {
      window.removeEventListener("click", startLobbyAudio);
      window.removeEventListener("keydown", startLobbyAudio);
    };
  }, [phase, lobbyMusicStarted]);

  // Stop lobby music when game starts
  useEffect(() => {
    if (phase === "playing" && lobbyAudioRef.current) {
      lobbyAudioRef.current.stopLobbyMusic();
      lobbyAudioRef.current.destroy();
      lobbyAudioRef.current = null;
    }
  }, [phase]);

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
      if (msg.type === "audience_joined") {
        const colors = ["#ff4488", "#44aaff", "#ffaa00", "#00ff88", "#ff6644", "#aa44ff", "#44ffaa", "#ff44cc"];
        setJoinedPlayers(prev => [...prev, {
          name: msg.name,
          color: colors[prev.length % colors.length],
          joinedAt: Date.now(),
        }].slice(-20));
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
          senderName: msg.senderName,
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
        setAllVotes([...msg.votes].sort((a: any, b: any) => b.votes - a.votes));
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
      <div className="w-full h-full flex flex-col bg-saigon-dark overflow-hidden relative scanlines">
        <style>{`
          @keyframes road-scroll {
            from { transform: translateX(0); }
            to   { transform: translateX(-50%); }
          }
          @keyframes title-flicker {
            0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% { opacity: 1; }
            20%, 22%, 24%, 55% { opacity: 0.85; }
          }
          @keyframes neon-pulse {
            0%, 100% {
              text-shadow:
                0 0 6px  #00ff88,
                0 0 14px #00ff88,
                0 0 30px #00ff88,
                0 0 60px #00ff88,
                0 0 90px #00ff8844;
            }
            50% {
              text-shadow:
                0 0 4px  #00ff88,
                0 0 10px #00ff88,
                0 0 20px #00ff88,
                0 0 40px #00ff88;
            }
          }
          @keyframes subtitle-glow {
            0%, 100% { text-shadow: 0 0 8px #ffdd00, 0 0 18px #ffdd0066; }
            50%       { text-shadow: 0 0 4px #ffdd00, 0 0 10px #ffdd0033; }
          }
          @keyframes bike-bob {
            0%, 100% { transform: translateY(0px)   rotate(-1deg); }
            50%       { transform: translateY(-6px) rotate(1deg);  }
          }
          @keyframes wheel-spin {
            from { transform: rotate(0deg);   }
            to   { transform: rotate(360deg); }
          }
          @keyframes exhaust-puff {
            0%   { opacity: 0.7; transform: scale(1)   translateX(0);  }
            100% { opacity: 0;   transform: scale(2.5) translateX(-18px); }
          }
          @keyframes vehicle-scroll {
            from { transform: translateX(110vw); }
            to   { transform: translateX(-20vw); }
          }
          @keyframes btn-pulse {
            0%, 100% { box-shadow: 0 0 18px #00ff88, 0 0 40px #00ff8844; }
            50%       { box-shadow: 0 0 30px #00ff88, 0 0 70px #00ff8866; }
          }
          @keyframes sign-flicker {
            0%, 96%, 100% { opacity: 1; }
            97%           { opacity: 0.3; }
            98%           { opacity: 1; }
            99%           { opacity: 0.5; }
          }
          @keyframes qr-border-spin {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
          }
          @keyframes count-pop {
            0%   { transform: scale(1); }
            50%  { transform: scale(1.15); }
            100% { transform: scale(1); }
          }
        `}</style>

        {/* ── BACKGROUND LAYER ───────────────────────────────── */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">

          {/* Sky gradient */}
          <div className="absolute inset-0" style={{
            background: "linear-gradient(180deg, #05050f 0%, #0a0a1f 45%, #111128 60%, #222230 100%)"
          }} />

          {/* Distant city skyline — stacked building silhouettes */}
          {[
            { left:"3%",  w:28, h:90,  delay:0 },
            { left:"5%",  w:16, h:140, delay:0 },
            { left:"10%", w:22, h:80,  delay:0 },
            { left:"13%", w:12, h:110, delay:0 },
            { left:"18%", w:30, h:100, delay:0 },
            { left:"22%", w:18, h:130, delay:0 },
            { left:"27%", w:24, h:70,  delay:0 },
            { left:"32%", w:14, h:120, delay:0 },
            { left:"36%", w:32, h:95,  delay:0 },
            { left:"43%", w:20, h:150, delay:0 },
            { left:"48%", w:26, h:85,  delay:0 },
            { left:"54%", w:16, h:115, delay:0 },
            { left:"59%", w:34, h:90,  delay:0 },
            { left:"65%", w:18, h:140, delay:0 },
            { left:"70%", w:22, h:75,  delay:0 },
            { left:"74%", w:12, h:105, delay:0 },
            { left:"79%", w:28, h:125, delay:0 },
            { left:"84%", w:16, h:88,  delay:0 },
            { left:"88%", w:24, h:135, delay:0 },
            { left:"93%", w:20, h:95,  delay:0 },
            { left:"97%", w:14, h:110, delay:0 },
          ].map((b, i) => (
            <div key={i} className="absolute bottom-[38%]" style={{
              left: b.left,
              width: b.w,
              height: b.h,
              background: "#0d0d20",
              boxShadow: i % 3 === 0 ? "inset 0 0 0 1px #1a1a33" : undefined,
            }}>
              {/* Tiny window lights */}
              {Array.from({ length: Math.floor(b.h / 18) }).map((_, r) =>
                Array.from({ length: Math.floor(b.w / 10) }).map((_, c) =>
                  Math.random() > 0.45 ? (
                    <div key={`${r}-${c}`} style={{
                      position: "absolute",
                      top: 8 + r * 16,
                      left: 4 + c * 9,
                      width: 4,
                      height: 4,
                      background: ["#ffdd0066","#00ff8844","#00ddff44","#ff444433"][Math.floor((i*r*c)%4)],
                    }} />
                  ) : null
                )
              )}
            </div>
          ))}

          {/* Neon signs on buildings */}
          {[
            { left: "8%",  bottom: "52%", text: "PHỞ 24",   color: "#ff4444" },
            { left: "29%", bottom: "54%", text: "BIA HƠI",  color: "#00ff88" },
            { left: "55%", bottom: "50%", text: "CÀ PHÊ",   color: "#00ddff" },
            { left: "76%", bottom: "53%", text: "BÚN BÒ",   color: "#ffdd00" },
          ].map((s, i) => (
            <div key={i} className="absolute font-pixel text-[9px] px-1 py-0.5 border" style={{
              left: s.left, bottom: s.bottom, color: s.color,
              borderColor: s.color + "88",
              textShadow: `0 0 6px ${s.color}, 0 0 14px ${s.color}66`,
              animation: `sign-flicker ${3 + i * 1.3}s ${i * 0.7}s infinite`,
              background: s.color + "11",
            }}>
              {s.text}
            </div>
          ))}

          {/* Road surface */}
          <div className="absolute bottom-0 left-0 right-0 h-[38%]" style={{ background: "#1c1c2a" }} />
          <div className="absolute bottom-[38%] left-0 right-0 h-[3px]" style={{ background: "#333345" }} />

          {/* Lane stripe lines */}
          <div className="absolute bottom-[28%] left-0 right-0 h-[2px]" style={{ background: "#2a2a3a" }} />
          <div className="absolute bottom-[16%] left-0 right-0 h-[2px]" style={{ background: "#2a2a3a" }} />

          {/* Scrolling center dashes */}
          <div className="absolute bottom-[22%] left-0 right-0 h-[3px] overflow-hidden">
            <div style={{
              display: "flex",
              width: "200%",
              height: "100%",
              animation: "road-scroll 0.8s linear infinite",
            }}>
              {Array.from({ length: 40 }).map((_, i) => (
                <div key={i} style={{
                  flex: "0 0 40px", height: "100%",
                  background: i % 2 === 0 ? "#ffdd0099" : "transparent",
                }} />
              ))}
            </div>
          </div>

          {/* Scrolling outer edge dashes */}
          <div className="absolute bottom-[37%] left-0 right-0 h-[2px] overflow-hidden">
            <div style={{
              display: "flex", width: "200%", height: "100%",
              animation: "road-scroll 1.2s linear infinite",
            }}>
              {Array.from({ length: 60 }).map((_, i) => (
                <div key={i} style={{
                  flex: "0 0 24px", height: "100%",
                  background: i % 2 === 0 ? "#ffffff22" : "transparent",
                }} />
              ))}
            </div>
          </div>

          {/* Road gutter glow */}
          <div className="absolute bottom-0 left-0 right-0 h-[38%]" style={{
            background: "linear-gradient(to top, #00ff8808 0%, transparent 40%)"
          }} />

          {/* Background traffic vehicles scrolling across road */}
          {[
            { bottom: "28%", duration: "4.2s", delay: "0s",   color: "#ff6644", w: 22, h: 12 },
            { bottom: "16%", duration: "3.1s", delay: "1.4s", color: "#4488ff", w: 18, h: 10 },
            { bottom: "22%", duration: "5.8s", delay: "0.6s", color: "#ffdd00", w: 14, h: 8  },
            { bottom: "28%", duration: "3.8s", delay: "2.2s", color: "#cc44ff", w: 16, h: 10 },
            { bottom: "16%", duration: "4.9s", delay: "3.5s", color: "#00ffcc", w: 20, h: 11 },
            { bottom: "22%", duration: "3.3s", delay: "0.9s", color: "#ff4488", w: 12, h: 8  },
            { bottom: "28%", duration: "6.1s", delay: "4.1s", color: "#ffaa00", w: 18, h: 10 },
            { bottom: "16%", duration: "4.5s", delay: "1.8s", color: "#00ff88", w: 14, h: 8  },
          ].map((v, i) => (
            <div key={i} style={{
              position: "absolute",
              bottom: v.bottom,
              width: v.w,
              height: v.h,
              background: v.color,
              boxShadow: `0 0 8px ${v.color}`,
              animation: `vehicle-scroll ${v.duration} ${v.delay} linear infinite`,
              opacity: 0.7,
            }} />
          ))}
        </div>

        {/* ── MAIN CONTENT ───────────────────────────────────── */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-between py-5 px-6 overflow-hidden">

          {/* ── TITLE BLOCK ── */}
          <div className="flex flex-col items-center gap-1 mt-2">
            {/* Vietnamese flag accent line */}
            <div className="flex gap-1 mb-2">
              {["#da251d","#da251d","#ffff00","#da251d","#da251d"].map((c,i) => (
                <div key={i} style={{ width: i === 2 ? 12 : 28, height: 4, background: c, boxShadow: `0 0 6px ${c}` }} />
              ))}
            </div>

            <h1 className="font-pixel tracking-widest select-none" style={{
              fontSize: "clamp(2.4rem, 6vw, 5.5rem)",
              color: "#00ff88",
              animation: "neon-pulse 2.4s ease-in-out infinite, title-flicker 8s 3s infinite",
              letterSpacing: "0.12em",
            }}>
              SAIGON RUSH
            </h1>

            <p className="font-pixel tracking-widest" style={{
              fontSize: "clamp(0.5rem, 1.4vw, 0.85rem)",
              color: "#ffdd00",
              animation: "subtitle-glow 3s ease-in-out infinite",
              letterSpacing: "0.18em",
            }}>
              SURVIVE HO CHI MINH CITY TRAFFIC
            </p>

            {/* INSERT COIN blink */}
            <p className="font-pixel mt-1" style={{
              fontSize: "0.6rem",
              color: "#ffffff88",
              animation: "title-flicker 1.2s ease-in-out infinite",
              letterSpacing: "0.2em",
            }}>
              — INSERT COIN TO PLAY —
            </p>
          </div>

          {/* ── MIDDLE ROW: BIKE + QR + HOW IT WORKS ── */}
          <div className="flex items-center justify-center gap-6 w-full max-w-5xl">

            {/* ── CSS PIXEL MOTORBIKE ── */}
            <div className="flex-shrink-0 flex flex-col items-center" style={{
              animation: "bike-bob 1.1s ease-in-out infinite",
            }}>
              {/* Rider helmet */}
              <div style={{ position: "relative", width: 80, height: 110 }}>
                {/* Helmet */}
                <div style={{ position:"absolute", left:32, top:0, width:22, height:16, background:"#ffdd00", borderRadius:"6px 6px 0 0", boxShadow:"0 0 8px #ffdd0088" }} />
                {/* Helmet visor */}
                <div style={{ position:"absolute", left:34, top:6, width:14, height:7, background:"#00ddff", borderRadius:2, boxShadow:"0 0 4px #00ddff" }} />
                {/* Body / jacket */}
                <div style={{ position:"absolute", left:28, top:14, width:30, height:26, background:"#cc2222", borderRadius:"3px 3px 0 0", boxShadow:"0 0 6px #cc222266" }} />
                {/* Arm */}
                <div style={{ position:"absolute", left:18, top:18, width:14, height:8, background:"#cc2222", borderRadius:4 }} />
                {/* Hand on handlebar */}
                <div style={{ position:"absolute", left:14, top:18, width:8, height:6, background:"#e8c080", borderRadius:3 }} />

                {/* Bike body — main chassis */}
                <div style={{ position:"absolute", left:10, top:38, width:64, height:14, background:"#00ff88", borderRadius:"4px 8px 4px 4px", boxShadow:"0 0 12px #00ff8888" }} />
                {/* Fuel tank hump */}
                <div style={{ position:"absolute", left:26, top:32, width:24, height:10, background:"#00dd77", borderRadius:"4px 4px 2px 2px" }} />
                {/* Headlight */}
                <div style={{ position:"absolute", left:68, top:40, width:10, height:8, background:"#ffffaa", borderRadius:"0 4px 4px 0", boxShadow:"0 0 14px #ffff88" }} />
                {/* Tail fairing */}
                <div style={{ position:"absolute", left:8, top:40, width:12, height:8, background:"#009955", borderRadius:"4px 0 0 4px" }} />
                {/* Seat */}
                <div style={{ position:"absolute", left:22, top:36, width:30, height:6, background:"#222", borderRadius:3 }} />

                {/* Exhaust pipe */}
                <div style={{ position:"absolute", left:4, top:48, width:16, height:4, background:"#888", borderRadius:2 }} />
                {/* Exhaust puff 1 */}
                <div style={{ position:"absolute", left:-4, top:44, width:8, height:8, borderRadius:"50%", background:"#ffffff22", animation:"exhaust-puff 0.9s 0s ease-out infinite" }} />
                {/* Exhaust puff 2 */}
                <div style={{ position:"absolute", left:-4, top:44, width:8, height:8, borderRadius:"50%", background:"#ffffff18", animation:"exhaust-puff 0.9s 0.3s ease-out infinite" }} />
                {/* Exhaust puff 3 */}
                <div style={{ position:"absolute", left:-4, top:44, width:8, height:8, borderRadius:"50%", background:"#ffffff10", animation:"exhaust-puff 0.9s 0.6s ease-out infinite" }} />

                {/* Front wheel */}
                <div style={{ position:"absolute", left:56, top:46, width:22, height:22, borderRadius:"50%", border:"4px solid #aaaaaa", boxShadow:"0 0 6px #aaaaaa55" }}>
                  <div style={{ position:"absolute", inset:3, borderRadius:"50%", border:"2px solid #555" }}>
                    <div style={{ position:"absolute", top:"50%", left:0, right:0, height:2, background:"#666", transform:"translateY(-50%)", animation:"wheel-spin 0.4s linear infinite" }} />
                    <div style={{ position:"absolute", left:"50%", top:0, bottom:0, width:2, background:"#666", transform:"translateX(-50%)", animation:"wheel-spin 0.4s linear infinite" }} />
                  </div>
                </div>
                {/* Rear wheel */}
                <div style={{ position:"absolute", left:2, top:46, width:22, height:22, borderRadius:"50%", border:"4px solid #aaaaaa", boxShadow:"0 0 6px #aaaaaa55" }}>
                  <div style={{ position:"absolute", inset:3, borderRadius:"50%", border:"2px solid #555" }}>
                    <div style={{ position:"absolute", top:"50%", left:0, right:0, height:2, background:"#666", transform:"translateY(-50%)", animation:"wheel-spin 0.4s linear infinite" }} />
                    <div style={{ position:"absolute", left:"50%", top:0, bottom:0, width:2, background:"#666", transform:"translateX(-50%)", animation:"wheel-spin 0.4s linear infinite" }} />
                  </div>
                </div>

                {/* Speed lines */}
                {[0, 10, 20].map((offset, i) => (
                  <div key={i} style={{
                    position:"absolute", left: -30 - offset, top: 40 + i * 7,
                    width: 22 + offset, height: 2,
                    background: `linear-gradient(to right, transparent, ${"#00ff88".replace("88", ["88","66","44"][i])})`,
                    opacity: 0.6,
                  }} />
                ))}
              </div>

              <p className="font-pixel mt-3" style={{ fontSize:"0.55rem", color:"#00ff8888", letterSpacing:"0.15em" }}>YOUR RIDE</p>
            </div>

            {/* ── QR CODE PANEL ── */}
            <div className="flex flex-col items-center gap-3 px-6 py-5 relative" style={{
              background: "#0a0a0f",
              border: "2px solid #ffdd0066",
              boxShadow: "0 0 24px #ffdd0022, inset 0 0 20px #0a0a0f",
            }}>
              {/* Corner decorations */}
              {[
                { top:0, left:0, borderTop:"2px solid #ffdd00", borderLeft:"2px solid #ffdd00" },
                { top:0, right:0, borderTop:"2px solid #ffdd00", borderRight:"2px solid #ffdd00" },
                { bottom:0, left:0, borderBottom:"2px solid #ffdd00", borderLeft:"2px solid #ffdd00" },
                { bottom:0, right:0, borderBottom:"2px solid #ffdd00", borderRight:"2px solid #ffdd00" },
              ].map((s, i) => (
                <div key={i} style={{ position:"absolute", width:12, height:12, ...s }} />
              ))}

              <p className="font-pixel" style={{ fontSize:"0.6rem", color:"#ffdd00", letterSpacing:"0.2em",
                textShadow:"0 0 8px #ffdd00" }}>
                AUDIENCE JOIN
              </p>

              {/* QR with glow border — large enough to scan from distance */}
              <div style={{ padding:8, background:"#0a0a0f", boxShadow:"0 0 24px #ffdd0044" }}>
                <QRCodeSVG value={audienceUrl} size={220} bgColor="#0a0a0f" fgColor="#ffdd00" />
              </div>

              <p className="font-pixel" style={{ fontSize:"0.55rem", color:"#ffdd0099", letterSpacing:"0.15em" }}>
                SCAN TO SEND CHAOS
              </p>

              {/* Audience live counter */}
              <div className="flex items-center gap-2 px-3 py-1.5" style={{
                background: audienceCount > 0 ? "#00ff8815" : "#ffffff08",
                border: `1px solid ${audienceCount > 0 ? "#00ff8844" : "#ffffff22"}`,
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius:"50%",
                  background: audienceCount > 0 ? "#00ff88" : "#ffffff44",
                  boxShadow: audienceCount > 0 ? "0 0 8px #00ff88" : "none",
                  animation: audienceCount > 0 ? "count-pop 1s ease-in-out infinite" : "none",
                }} />
                <span className="font-pixel" style={{
                  fontSize: "0.6rem",
                  color: audienceCount > 0 ? "#00ff88" : "#ffffff55",
                  textShadow: audienceCount > 0 ? "0 0 8px #00ff88" : "none",
                }}>
                  {audienceCount === 0
                    ? "WAITING..."
                    : `${audienceCount} ${audienceCount === 1 ? "RIDER" : "RIDERS"} READY`}
                </span>
              </div>

              {/* Session code */}
              <div className="flex items-center gap-2">
                <span style={{ fontSize:"0.5rem", color:"#ffffff33", fontFamily:"monospace" }}>ROOM</span>
                <span className="font-pixel" style={{
                  fontSize:"0.75rem", color:"#ffffff88", letterSpacing:"0.25em",
                  fontFamily:"monospace",
                }}>
                  {sessionId}
                </span>
              </div>

              {/* Joined players */}
              {joinedPlayers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {joinedPlayers.map((p, i) => (
                    <div key={i} className="flex items-center gap-1 px-2 py-0.5" style={{
                      background: p.color + "18",
                      border: `1px solid ${p.color}44`,
                      animation: "result-slide-up 0.3s ease-out",
                    }}>
                      {/* Mini pixel motorbike icon */}
                      <div style={{ width: 10, height: 8, position: "relative" }}>
                        <div style={{ position:"absolute", width:4, height:4, background: p.color, left:3, top:0 }} />
                        <div style={{ position:"absolute", width:3, height:3, background:"#333", left:0, top:5, borderRadius:"50%" }} />
                        <div style={{ position:"absolute", width:3, height:3, background:"#333", left:7, top:5, borderRadius:"50%" }} />
                      </div>
                      <span className="font-pixel" style={{ fontSize:"0.5rem", color: p.color }}>{p.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── HOW IT WORKS ── */}
            <div className="flex flex-col gap-3 max-w-xs">
              <p className="font-pixel" style={{ fontSize:"0.6rem", color:"#ffffff44", letterSpacing:"0.2em" }}>
                HOW IT WORKS
              </p>
              {[
                { num:"01", icon:"🏍", color:"#00ff88", text:"You ride a motorbike through Ho Chi Minh City traffic on the big screen." },
                { num:"02", icon:"📱", color:"#ffdd00", text:"The audience scans the QR code and types ANYTHING they want to throw at you." },
                { num:"03", icon:"🤖", color:"#00ddff", text:"AI converts their suggestions into real obstacles that spawn on the road." },
                { num:"04", icon:"💀", color:"#ff4444", text:"3 lives. Dodge everything. Survive as long as you can." },
              ].map((step) => (
                <div key={step.num} className="flex items-start gap-3" style={{
                  padding:"8px 10px",
                  background: step.color + "08",
                  border: `1px solid ${step.color}22`,
                }}>
                  <span className="font-pixel flex-shrink-0" style={{ fontSize:"0.55rem", color: step.color, marginTop:2 }}>
                    {step.num}
                  </span>
                  <p style={{ fontSize:"0.72rem", color:"#ffffffbb", lineHeight:1.5, margin:0 }}>
                    {step.text}
                  </p>
                </div>
              ))}

              <div style={{
                padding:"6px 10px",
                background:"#ffdd0010",
                border:"1px solid #ffdd0033",
                marginTop:4,
              }}>
                <p style={{ fontSize:"0.65rem", color:"#ffdd00bb", margin:0 }}>
                  <span className="font-pixel" style={{ fontSize:"0.55rem" }}>TIP </span>
                  Type: <span style={{ color:"#ffdd00" }}>"giant pho cart"</span>, <span style={{ color:"#00ff88" }}>"traffic cop"</span>, <span style={{ color:"#ff4444" }}>"runaway buffalo"</span>...
                </p>
              </div>
            </div>
          </div>

          {/* ── BOTTOM ROW: START BUTTON ── */}
          <div className="flex flex-col items-center gap-3 mb-2">
            {testMode && (
              <p className="font-pixel" style={{ fontSize:"0.6rem", color:"#ff4444",
                textShadow:"0 0 8px #ff4444", letterSpacing:"0.15em" }}>
                TEST MODE — INFINITE LIVES
              </p>
            )}

            <button
              onClick={() => setPhase("playing")}
              className="font-pixel relative overflow-hidden"
              style={{
                fontSize: "clamp(1rem, 2.5vw, 1.5rem)",
                letterSpacing: "0.2em",
                padding: "16px 56px",
                background: "#00ff88",
                color: "#0a0a0f",
                border: "none",
                cursor: "pointer",
                animation: "btn-pulse 1.8s ease-in-out infinite",
                transition: "transform 0.1s ease",
                clipPath: "polygon(8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px)",
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.06)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
              onMouseDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
              onMouseUp={e => (e.currentTarget.style.transform = "scale(1.06)")}
            >
              START GAME
            </button>

            <p style={{ fontSize:"0.55rem", color:"#ffffff33", fontFamily:"monospace", letterSpacing:"0.12em" }}>
              W / S  OR  ARROW KEYS TO DODGE  —  SPACE TO BOOST
            </p>
          </div>

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
      <div className="w-60 bg-[#0c0c18] p-3 flex flex-col gap-2 overflow-hidden border-l border-neon-green/10">
        {/* Room + QR */}
        <div className="flex items-center gap-2 pb-2 border-b border-white/10">
          <div className="p-1" style={{ border: "1px solid #ffdd0044", boxShadow: "0 0 8px #ffdd0022" }}>
            <QRCodeSVG value={audienceUrl} size={56} bgColor="#0c0c18" fgColor="#ffdd00" />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="font-pixel text-neon-yellow text-[8px]" style={{ textShadow: "0 0 6px #ffdd00" }}>JOIN THE CHAOS</p>
            <p className="font-mono text-white/60 text-[10px]">Room: <span className="text-white font-bold tracking-wider">{sessionId}</span></p>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${audienceCount > 0 ? "bg-neon-green animate-pulse" : "bg-white/20"}`} />
              <p className="text-white/40 font-pixel text-[8px]">{audienceCount} watching</p>
            </div>
          </div>
        </div>

        {/* Votes leaderboard */}
        {allVotes.length > 0 && (
          <div className="flex flex-col gap-1">
            <h2 className="font-pixel text-neon-yellow text-[9px]" style={{ textShadow: "0 0 4px #ffdd00" }}>AUDIENCE VOTES</h2>
            {allVotes.filter(v => v.votes > 0).slice(0, 5).map((v, i) => (
              <div key={v.id} className="flex items-center gap-1.5 px-1.5 py-1" style={{
                background: i === 0 ? "#ffdd0012" : "#ffffff06",
                border: i === 0 ? "1px solid #ffdd0033" : "1px solid transparent",
              }}>
                <span className="font-pixel text-[8px] w-3 text-right" style={{ color: i === 0 ? "#ffdd00" : "#ffffff44" }}>
                  {i === 0 ? "★" : `${i + 1}`}
                </span>
                <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: v.color }} />
                <span className="text-white text-[10px] flex-1 truncate">{v.label}</span>
                <span className="font-pixel text-[9px]" style={{ color: i === 0 ? "#ffdd00" : "#00ff88" }}>+{v.votes}</span>
              </div>
            ))}
          </div>
        )}

        {/* Chaos feed */}
        <h2 className="font-pixel text-neon-green text-[9px] mt-1" style={{ textShadow: "0 0 4px #00ff88" }}>CHAOS FEED</h2>
        <div className="flex-1 overflow-y-auto flex flex-col gap-1.5">
          {feed.length === 0 && <p className="text-white/30 text-[9px] mt-2">Waiting for suggestions...</p>}
          {feed.map((item, i) => (
            <div key={i} className="bg-white/5 rounded px-2 py-1 relative group border border-white/5">
              <div className="flex items-center gap-1">
                {item.senderName && <span className="text-neon-yellow text-[9px] font-pixel">{item.senderName}</span>}
                <p className="text-white/40 text-[10px] truncate flex-1">{item.text}</p>
              </div>
              <p className="text-neon-green text-xs">{item.result}</p>
              {item.spriteData && (
                <div className="absolute hidden group-hover:block bottom-full left-0 mb-1 bg-saigon-dark border border-neon-green/30 rounded p-1 z-10">
                  <SpritePreview spriteData={item.spriteData} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

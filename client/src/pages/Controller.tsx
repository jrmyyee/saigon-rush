import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { createWSClient } from "../lib/ws";
import type { InputAction } from "@shared/types";

type Status = "connecting" | "connected" | "ready";

export function Controller() {
  const [params] = useSearchParams();
  const sessionId = params.get("session") ?? "";
  const [status, setStatus] = useState<Status>("connecting");
  const wsRef = useRef<ReturnType<typeof createWSClient> | null>(null);

  useEffect(() => {
    const vp = document.querySelector('meta[name="viewport"]');
    if (vp) vp.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no");
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const ws = createWSClient("controller", sessionId);
    wsRef.current = ws;
    const check = setInterval(() => {
      if (ws.isConnected()) {
        setStatus("connected");
        setTimeout(() => setStatus("ready"), 800);
        clearInterval(check);
      }
    }, 100);
    return () => { clearInterval(check); ws.close(); };
  }, [sessionId]);

  useEffect(() => {
    const send = (action: InputAction) => wsRef.current?.send({ type: "input", action });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") send("lane_up");
      else if (e.key === "ArrowDown") send("lane_down");
      else if (e.key === " ") { e.preventDefault(); send("boost"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const flash = (el: HTMLElement) => {
    el.classList.add("brightness-150");
    setTimeout(() => el.classList.remove("brightness-150"), 100);
  };

  const handleTouch = (action: InputAction) => (e: React.TouchEvent) => {
    e.preventDefault();
    navigator.vibrate?.(50);
    flash(e.currentTarget as HTMLElement);
    wsRef.current?.send({ type: "input", action });
  };

  if (!sessionId) {
    return <div className="w-full h-full flex items-center justify-center bg-saigon-dark"><p className="text-neon-red font-pixel text-sm">No session ID</p></div>;
  }

  if (status !== "ready") {
    return (
      <div className="w-full h-full flex items-center justify-center bg-saigon-dark">
        <p className="text-neon-cyan font-pixel text-sm animate-pulse">{status === "connecting" ? "Connecting..." : "Connected!"}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col select-none" style={{ touchAction: "none" }}>
      <div className="flex-1 flex items-center justify-center bg-saigon-dark border-b-2 border-neon-cyan/30 transition-all" onTouchStart={handleTouch("lane_up")}>
        <span className="font-pixel text-neon-cyan text-lg pointer-events-none">LANE UP</span>
      </div>
      <div className="flex-1 flex items-center justify-center bg-saigon-sky border-b-2 border-neon-green/30 transition-all" onTouchStart={handleTouch("boost")}>
        <span className="font-pixel text-neon-green text-lg pointer-events-none">BOOST</span>
      </div>
      <div className="flex-1 flex items-center justify-center bg-saigon-dark transition-all" onTouchStart={handleTouch("lane_down")}>
        <span className="font-pixel text-neon-cyan text-lg pointer-events-none">LANE DOWN</span>
      </div>
    </div>
  );
}

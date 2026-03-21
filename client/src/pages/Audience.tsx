import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { createWSClient } from "../lib/ws";
import type { SuggestionFeedItem, WSMessage } from "@shared/types";

const INSPIRATION_CHIPS = [
  "dragon", "karaoke truck", "angry grandma", "durian cart",
  "water buffalo", "conga line", "fireworks", "street dog",
];

interface VotableObstacle {
  id: string;
  label: string;
  color: string;
  votes: number;
}

export function Audience() {
  const [params] = useSearchParams();
  const sessionId = params.get("session") ?? "";
  const [text, setText] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [feed, setFeed] = useState<SuggestionFeedItem[]>([]);
  const [votables, setVotables] = useState<VotableObstacle[]>([]);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const wsRef = useRef<ReturnType<typeof createWSClient> | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const ws = createWSClient("audience", sessionId);
    wsRef.current = ws;
    ws.onMessage((msg: WSMessage) => {
      if (msg.type === "suggestion_accepted") {
        setGenerating(false);
        setFeed((f) => [{
          text: msg.original,
          result: msg.result.label,
          timestamp: Date.now(),
          obstacleId: msg.result.id,
          color: msg.result.color,
        }, ...f].slice(0, 20));
      }
      if (msg.type === "suggestion_rejected") {
        setGenerating(false);
        setError(msg.reason);
      }
      if (msg.type === "vote_update") {
        setVotables(msg.votes);
      }
    });
    return () => ws.close();
  }, [sessionId]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const submit = (value?: string) => {
    const msg = (value || text).trim();
    if (!msg || cooldown > 0) return;
    wsRef.current?.send({ type: "suggestion", text: msg });
    setText("");
    setError("");
    setGenerating(true);
    setCooldown(15);
  };

  const vote = (obstacleId: string) => {
    if (votedIds.has(obstacleId)) return;
    wsRef.current?.send({ type: "vote", obstacleId });
    setVotedIds((s) => new Set(s).add(obstacleId));
  };

  if (!sessionId) {
    return <div className="w-full h-full flex items-center justify-center bg-saigon-dark"><p className="text-neon-red font-pixel text-sm">No session ID</p></div>;
  }

  // Sort votables by votes descending for display
  const sortedVotables = [...votables].sort((a, b) => b.votes - a.votes);

  return (
    <div className="w-full h-full flex flex-col bg-saigon-dark p-4 gap-3 overflow-hidden">
      <h1 className="font-pixel text-neon-yellow text-xl text-center">SEND CHAOS</h1>

      {/* Inspiration chips */}
      <div className="flex flex-wrap gap-1.5 justify-center">
        {INSPIRATION_CHIPS.map((chip) => (
          <button
            key={chip}
            className="bg-saigon-road/80 text-white/70 text-xs px-2.5 py-1 rounded-full border border-white/10 active:bg-neon-yellow/20 active:border-neon-yellow/40 disabled:opacity-30"
            onClick={() => { setText(chip); submit(chip); }}
            disabled={cooldown > 0}
          >
            {chip}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 bg-saigon-road text-white px-3 py-2 rounded border border-neon-yellow/30 focus:border-neon-yellow outline-none"
          placeholder="What should appear on the road?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          maxLength={100}
          disabled={cooldown > 0}
        />
        <button
          className="bg-neon-yellow text-saigon-dark font-bold px-4 py-2 rounded disabled:opacity-40 font-pixel text-xs"
          onClick={() => submit()}
          disabled={!text.trim() || cooldown > 0}
        >
          {cooldown > 0 ? `${cooldown}s` : "SEND"}
        </button>
      </div>

      {/* Generating indicator */}
      {generating && (
        <div className="flex items-center gap-2 px-2">
          <div className="w-3 h-3 border-2 border-neon-yellow border-t-transparent rounded-full animate-spin" />
          <p className="text-neon-yellow text-xs animate-pulse">Generating obstacle...</p>
        </div>
      )}

      {error && <p className="text-neon-red text-xs">{error}</p>}

      {/* Voting section */}
      {sortedVotables.length > 0 && (
        <div className="flex flex-col gap-1">
          <h2 className="font-pixel text-white/50 text-[10px]">VOTE YOUR FAVORITE</h2>
          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
            {sortedVotables.map((ob) => {
              const hasVoted = votedIds.has(ob.id);
              return (
                <button
                  key={ob.id}
                  className={`flex items-center gap-2 rounded px-2 py-1.5 text-left transition-colors ${
                    hasVoted ? "bg-white/10" : "bg-saigon-road/60 active:bg-white/10"
                  }`}
                  onClick={() => vote(ob.id)}
                  disabled={hasVoted}
                >
                  <span
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: ob.color }}
                  />
                  <span className="text-white text-xs flex-1 truncate">{ob.label}</span>
                  <span className={`font-pixel text-xs ${ob.votes > 0 ? "text-neon-yellow" : "text-white/30"}`}>
                    {ob.votes > 0 ? `+${ob.votes}` : "vote"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent feed */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2">
        {feed.map((item, i) => (
          <div key={i} className="bg-saigon-road/60 rounded px-3 py-2">
            <p className="text-white/50 text-xs">{item.text}</p>
            <p className="text-neon-green text-sm">{item.result}</p>
          </div>
        ))}
        {feed.length === 0 && !generating && <p className="text-white/30 text-center text-sm mt-8">No suggestions yet. Be the first!</p>}
      </div>
    </div>
  );
}

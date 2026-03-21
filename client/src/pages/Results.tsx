import { useSearchParams, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";

const RATING_DATA: Record<string, { title: string; viet: string; color: string; stars: number }> = {
  "Tourist":        { title: "TOURIST",        viet: "Du Kh\u00e1ch",        color: "#888888", stars: 1 },
  "Xe Om Driver":   { title: "XE \u00d4M DRIVER",   viet: "T\u00e0i X\u1ebf Xe \u00d4m",   color: "#44aaff", stars: 2 },
  "Saigon Local":   { title: "SAIGON LOCAL",   viet: "D\u00e2n S\u00e0i G\u00f2n",   color: "#00ff88", stars: 3 },
  "Traffic Legend":  { title: "TRAFFIC LEGEND", viet: "Huy\u1ec1n Tho\u1ea1i Giao Th\u00f4ng", color: "#ffcc00", stars: 4 },
};

export function Results() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const distance = Number(params.get("distance") ?? 0);
  const dodged = Number(params.get("dodged") ?? 0);
  const chaos = Number(params.get("chaos") ?? 0);
  const misses = Number(params.get("misses") ?? 0);
  const speed = Number(params.get("speed") ?? 0);
  const hits = Number(params.get("hits") ?? 0);
  const time = Number(params.get("time") ?? 0);
  const rating = params.get("rating") ?? "Tourist";

  const rd = RATING_DATA[rating] ?? RATING_DATA["Tourist"];
  const baseUrl = window.location.origin;

  return (
    <div className="w-full h-full flex items-center justify-center bg-saigon-dark overflow-hidden relative scanlines">
      <style>{`
        @keyframes result-slide-up {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes rating-glow {
          0%, 100% { text-shadow: 0 0 8px var(--rc), 0 0 20px var(--rc), 0 0 40px var(--rc); }
          50%       { text-shadow: 0 0 4px var(--rc), 0 0 12px var(--rc); }
        }
        @keyframes stamp-slam {
          0%   { opacity: 0; transform: scale(3) rotate(-15deg); }
          60%  { opacity: 1; transform: scale(0.95) rotate(-12deg); }
          80%  { transform: scale(1.05) rotate(-12deg); }
          100% { transform: scale(1) rotate(-12deg); }
        }
        @keyframes stat-count {
          from { opacity: 0; transform: translateX(-10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes neon-border {
          0%, 100% { box-shadow: 0 0 12px var(--rc), inset 0 0 12px #00000088; }
          50%       { box-shadow: 0 0 24px var(--rc), 0 0 48px var(--rc-dim), inset 0 0 12px #00000088; }
        }
      `}</style>

      {/* Background texture */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse at center, #0f0f20 0%, #060610 70%)"
      }} />

      {/* Report card */}
      <div className="relative z-10 w-full max-w-lg mx-4" style={{
        animation: "result-slide-up 0.6s ease-out",
        // @ts-ignore
        "--rc": rd.color,
        "--rc-dim": rd.color + "44",
      } as React.CSSProperties}>

        {/* Main card */}
        <div style={{
          background: "#0a0a16",
          border: `2px solid ${rd.color}88`,
          animation: "neon-border 2s ease-in-out infinite",
          padding: "0",
        }}>

          {/* Header bar */}
          <div className="flex items-center justify-between px-5 py-3" style={{
            background: rd.color + "15",
            borderBottom: `1px solid ${rd.color}44`,
          }}>
            <div>
              <h1 className="font-pixel tracking-wider" style={{
                fontSize: "clamp(1rem, 3vw, 1.4rem)",
                color: rd.color,
                textShadow: `0 0 8px ${rd.color}`,
              }}>
                TRAFFIC REPORT
              </h1>
              <p style={{ fontSize: "0.6rem", color: "#ffffff44", fontFamily: "monospace", letterSpacing: "0.15em" }}>
                SAIGON RUSH — HO CHI MINH CITY
              </p>
            </div>
            <div className="font-pixel" style={{
              fontSize: "0.55rem",
              color: "#ffffff33",
              textAlign: "right",
              lineHeight: 1.6,
            }}>
              <div>CASE #{Math.floor(Math.random() * 9000 + 1000)}</div>
              <div>{new Date().toLocaleDateString()}</div>
            </div>
          </div>

          {/* Rating stamp */}
          <div className="relative px-5 py-5 flex items-center justify-center" style={{
            borderBottom: `1px solid ${rd.color}22`,
            minHeight: 100,
          }}>
            {/* Rating title + stars (stamped together) */}
            <div className="flex flex-col items-center" style={{
              animation: "stamp-slam 0.5s 0.3s ease-out both",
            }}>
              {/* Star field */}
              <div className="flex gap-2 items-center mb-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <span key={i} style={{
                    fontSize: "1.6rem",
                    color: i < rd.stars ? rd.color : "#ffffff15",
                    textShadow: i < rd.stars ? `0 0 8px ${rd.color}` : "none",
                  }}>
                    ★
                  </span>
                ))}
              </div>

              <div className="font-pixel px-4 py-2" style={{
                fontSize: "clamp(1.2rem, 4vw, 2rem)",
                color: rd.color,
                border: `3px solid ${rd.color}`,
                letterSpacing: "0.15em",
                // @ts-ignore
                animation: "rating-glow 2s ease-in-out infinite",
                textShadow: `0 0 8px ${rd.color}, 0 0 20px ${rd.color}`,
              } as React.CSSProperties}>
                {rd.title}
              </div>
              <p className="text-center mt-1" style={{
                fontSize: "0.7rem",
                color: rd.color + "aa",
                fontStyle: "italic",
              }}>
                {rd.viet}
              </p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-0" style={{ borderBottom: `1px solid ${rd.color}22` }}>
            <StatCell label="SURVIVAL TIME" value={`${time}s`} color="#ffffff" delay={0} highlight />
            <StatCell label="SCORE" value={`${(dodged * 100 + misses * 50).toLocaleString()}`} color="#ffcc00" delay={1} highlight />
            <StatCell label="OBSTACLES DODGED" value={`${dodged}`} color="#00ff88" delay={2} />
            <StatCell label="NEAR MISSES" value={`${misses}`} color="#44ddff" delay={3} />
            <StatCell label="TOP SPEED" value={`${speed} km/h`} color="#ff8844" delay={4} />
            <StatCell label="HITS TAKEN" value={`${hits}`} color="#ff4444" delay={5} />
            <StatCell label="DISTANCE" value={`${distance.toLocaleString()}m`} color="#aa88ff" delay={6} />
            <StatCell label="AUDIENCE CHAOS" value={`${chaos}`} color="#ffdd00" delay={7} />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex flex-col items-center gap-1.5">
              <div style={{ padding: 3, border: `1px solid ${rd.color}44` }}>
                <QRCodeSVG value={baseUrl} size={72} bgColor="#0a0a16" fgColor={rd.color} />
              </div>
              <p style={{ fontSize: "0.5rem", color: "#ffffff33", fontFamily: "monospace" }}>PLAY AGAIN</p>
            </div>

            <div className="flex flex-col gap-2 items-end">
              <button
                onClick={() => navigate("/play")}
                className="font-pixel px-6 py-2"
                style={{
                  fontSize: "0.85rem",
                  background: rd.color,
                  color: "#0a0a0f",
                  border: "none",
                  cursor: "pointer",
                  letterSpacing: "0.15em",
                  boxShadow: `0 0 12px ${rd.color}88`,
                  clipPath: "polygon(6px 0%, calc(100% - 6px) 0%, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0% calc(100% - 6px), 0% 6px)",
                }}
              >
                RIDE AGAIN
              </button>
              <p style={{ fontSize: "0.5rem", color: "#ffffff22", fontFamily: "monospace", letterSpacing: "0.1em" }}>
                LOTUSHACKS 2026
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCell({ label, value, color, delay, highlight }: {
  label: string;
  value: string;
  color: string;
  delay: number;
  highlight?: boolean;
}) {
  return (
    <div className="px-4 py-3" style={{
      borderRight: "1px solid #ffffff08",
      borderBottom: "1px solid #ffffff08",
      background: highlight ? `${color}08` : "transparent",
      animation: `stat-count 0.4s ${0.4 + delay * 0.08}s ease-out both`,
    }}>
      <p style={{
        fontSize: "0.5rem",
        color: color + "77",
        fontFamily: "monospace",
        letterSpacing: "0.15em",
        marginBottom: 4,
      }}>
        {label}
      </p>
      <p className="font-pixel" style={{
        fontSize: highlight ? "1.3rem" : "1.1rem",
        color,
        textShadow: highlight ? `0 0 8px ${color}44` : "none",
      }}>
        {value}
      </p>
    </div>
  );
}

import { useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";

const RATINGS: Record<string, string> = {
  Tourist: "Tourist",
  "Xe Om Driver": "Xe Om Driver",
  "Saigon Local": "Saigon Local",
  "Traffic Legend": "Traffic Legend",
};

const STARS: Record<string, number> = { Tourist: 1, "Xe Om Driver": 2, "Saigon Local": 3, "Traffic Legend": 4 };

export function Results() {
  const [params] = useSearchParams();
  const distance = Number(params.get("distance") ?? 0);
  const dodged = Number(params.get("dodged") ?? 0);
  const chaos = Number(params.get("chaos") ?? 0);
  const misses = Number(params.get("misses") ?? 0);
  const speed = Number(params.get("speed") ?? 0);
  const hits = Number(params.get("hits") ?? 0);
  const time = Number(params.get("time") ?? 0);
  const rating = params.get("rating") ?? "Tourist";

  const stars = STARS[rating] ?? 1;
  const baseUrl = window.location.origin;

  return (
    <div className="w-full h-full flex items-center justify-center bg-saigon-dark p-4">
      <div className="w-full max-w-sm border-2 border-neon-green rounded-lg bg-saigon-dark p-6 flex flex-col gap-4">
        <h1 className="font-pixel text-neon-green text-lg text-center tracking-wide">TRAFFIC REPORT</h1>
        <div className="border-t border-neon-green/30" />
        <div className="flex flex-col gap-2 text-sm">
          <Row label="Distance" value={`${distance.toLocaleString()}m`} />
          <Row label="Obstacles Dodged" value={String(dodged)} />
          <Row label="Audience Chaos" value={String(chaos)} />
          <Row label="Near Misses" value={String(misses)} />
          <Row label="Top Speed" value={`${speed} km/h`} />
          <Row label="Hits Taken" value={String(hits)} />
          <Row label="Survival Time" value={`${time}s`} />
        </div>
        <div className="border-t border-neon-green/30" />
        <div className="text-center">
          <p className="font-pixel text-neon-yellow text-sm">
            {"*".repeat(stars)} {RATINGS[rating] ?? rating}
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 mt-2">
          <QRCodeSVG value={baseUrl} size={100} bgColor="#0a0a0f" fgColor="#00ff88" />
          <p className="text-white/40 text-xs">saigonrush.vercel.app</p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-white/60">{label}</span>
      <span className="text-white font-bold">{value}</span>
    </div>
  );
}

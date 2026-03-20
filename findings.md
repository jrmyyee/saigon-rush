# Research Findings — Saigon Rush

## Hackathon Strategy Findings

### What Wins Hackathons (from research agents)
1. **Demo is 50%+ of the score.** Plan backward from a compelling 3-minute demo.
2. **Build 10% of the product, make it fully work.** Polished small > broken ambitious.
3. **Sponsor prize stacking** is the meta-strategy — integrate multiple sponsor APIs as visible game mechanics.
4. **Walking skeleton in first 3-4 hours** — end-to-end flow working even if ugly.
5. **Code freeze at T-minus 4 hours** — last hours for demo prep, not coding.
6. **Hard-code aggressively.** One level. Pre-defined layouts. Mock what isn't core.

### Judge Panel Analysis
| Judge | Role | What They Want |
|---|---|---|
| Bill Vo | Chairman, Amanotes (3B+ downloads) | Instant readability, one-finger input, game feel, viral potential |
| Tingxi Tan | Former NVIDIA Dir. SWE | Technical depth, real-time systems, scalable engineering |
| Gabriel Chua | OpenAI DevEx | Creative, genuine AI integration (not decorative) |
| Nghi Bui | Google Research | Scalability, clean engineering, polished UX |
| Hung Nguyen | Amazon SA Vietnam | Cloud architecture, practical deployment, AWS services used well |
| Thanh Nguyen | McKinsey CTO | Business impact, market viability, clear value proposition |
| Rahul Shinde | Coca-Cola CIO Vietnam | Practical brand utility, engagement data, consumer experience |
| Louis Vichy | OpenRouter Co-Founder | Multi-model AI, interoperability, creative AI usage |

### Critical Question to Prepare For
> "If I remove the AI, what breaks?"
**Answer**: Everything. Without AI, audience text suggestions can't become game obstacles. The core mechanic doesn't exist. The AI isn't decoration — it's the conversion engine.

### The "Boarding Pass" Share Artifact
Design a Vietnamese-flavored result screen — shareable, contains a QR code to play.

## Concept Evolution

### How We Got Here
1. **Original idea**: Airport rush game (race through check-in → security → immigration → gate)
2. **Game designer feedback**: Queue/lane-picking is a *waiting* mechanic, not a *racing* mechanic. Players standing still = broken game. Needs constant forward motion.
3. **Pivot to runner**: Constant forward motion, obstacle dodging, never standing still. Airport stages are cosmetic flavor, not simulation.
4. **Brand strategist feedback**: "Viral brand engagement platform" is an aspiration dressed as a product. Judges will see through it.
5. **Devil's advocate feedback**: "It solves a problem nobody has." AI integration as described is lipstick on a pig. The technical complexity is in the wrong place (invisible netcode vs visible AI).
6. **Key insight from user**: What if audience can inject obstacles in real-time? AI converts their suggestions. Content introduced dynamically.
7. **Final concept**: HCMC traffic runner with audience-driven chaos via AI pipeline. The AI IS the product — without it, audience text can't become game obstacles.

### Why HCMC Traffic (Not Airport)
- User literally just experienced Saigon traffic arriving at the hackathon
- Every judge at VNG has experienced HCMC traffic — viscerally relatable
- Visually rich: motorbikes, street vendors, cyclos, pho carts, water buffalo
- Inherently funny and chaotic — comedy drives shareability
- Natural audience suggestions: everyone can think of Vietnamese traffic obstacles

## Specialist Agent Insights

### Brand Strategist — Key Takeaways
- Viral games don't spread because they're fun. They spread because they produce a **shareable social artifact** (Wordle grid), a **story worth telling** (McDonald's Monopoly near-miss), or a **competitive social dynamic**
- **You don't currently have a viral loop.** Multiplayer is not a viral loop. "It's fun" is not a viral loop.
- **Strongest positioning**: "Instant multiplayer experiences for live audiences" — NOT "viral brand engagement platform"
- **Real brand buyers**: Airlines (gate dwell time), airports (retail dwell time), event organizers, travel platforms
- **What Coca-Cola CIO would want**: Zero-friction QR join (genuine differentiator), data capture proof (even tiny numbers showing viral coefficient), clear brand integration point (product appears in-game natively, not as banner ad)
- **Be honest about the gap** between prototype and product. Judges respect teams that understand the difference.

### Game Designer — Key Takeaways
- **Constant forward motion is mandatory.** If a player is stationary for >1 second, the game is broken. This is a runner, not a queue simulator.
- **Lane-switching alone feels like luck, not skill.** Need a secondary skill mechanic: shove timing, stamina/boost management, or item pickups.
- **The "Traffic Report" result screen IS the viral loop** — shareable boarding-pass-style card with absurd stats ("NPCs Shoved: 47"), embedded QR code to play. This is the Wordle grid equivalent.
- **Design the result screen BEFORE writing game code.** If you can't picture the screenshot people share, you have a tech demo, not a viral game.
- **Bill Vo (Amanotes) checklist**: Instant readability (understand in 3s), one-finger input, juice/polish on every input, the "again" impulse after each round.
- **Scope**: One continuous level, NOT discrete stages. 3 NPC types max. Rectangles with color differentiation. Game loop working by hour 18 or it's too late.
- **Biggest design risk**: The game might not feel like a race. Big screen must show all players without zooming out too much.

### Devil's Advocate Judge — Key Takeaways
- **3 biggest weaknesses**: (1) Solves a problem nobody has, (2) Technical complexity in wrong place (invisible netcode vs visible AI), (3) Demo is high-risk (live multiplayer on hackathon WiFi)
- **Competing archetypes that usually win**: AI agents for useful workflows, health/social impact plays, infra/dev tools, "holy shit" demo moments
- **The "AI-powered" claim must be genuine.** If removing AI doesn't meaningfully change the game, it's decoration. The audience→AI→obstacle pipeline is the ONE thing that makes this genuine.
- **What would make AI integration truly real**: Adaptive per-player difficulty, RL-trained AI opponents, CV integration, or (best for this project) **real-time AI commentator** generating context-aware funny commentary
- **The single best strategic change**: "Flip the hierarchy. The game is the demo; the platform is the product."
- **The killer judge question**: "If I take away the AI components, what breaks?" Your answer must be: "The entire audience interaction mechanic. Without AI, text suggestions can't become game obstacles."
- **Second killer question**: "How many people will still be playing tomorrow?" Pivot to B2B: "Individual retention isn't the metric — deployment frequency is."

## Pitch Strategy

### Positioning (Do NOT say "viral brand engagement platform")
**Say**: "A real-time audience interaction engine — AI converts crowd suggestions into live game content"
**The game is the demo. The engine is the product.**

### Pitch Structure (3 minutes)
| Time | What | Purpose |
|---|---|---|
| 0:00-0:15 | "I landed in Vietnam. Immigration queue was insane. Traffic was worse. So I built a game about it. Scan this QR." | Personal hook, QR up immediately |
| 0:15-0:30 | Audience joins suggestion page, types obstacles | Show the interaction mechanic |
| 0:30-1:30 | Play live. Audience obstacles appear. React to chaos. | The "wow" moment |
| 1:30-2:00 | Result screen. "Traffic Report" with shareable stats + QR | Show viral loop |
| 2:00-2:30 | "AI converts ANY text into a game obstacle. Without AI, this doesn't exist." | Answer the AI question preemptively |
| 2:30-2:50 | "This engine works for any context. Events, brands, conferences. The game is the demo." | Platform vision |
| 2:50-3:00 | "Built solo in 36 hours. Saigon Rush." | Close with impact |

### Per-Judge Framing
| Judge | What they should hear |
|---|---|
| Bill Vo (Amanotes) | Fun runner, instant readability, audience participation, mobile-first |
| Tingxi Tan (NVIDIA) | Real-time AI pipeline, WebSocket architecture, Canvas rendering |
| Gabriel Chua (OpenAI) | Genuine AI integration — structured outputs, content generation, not decorative |
| Hung Nguyen (AWS) | Scalable deployment architecture, could use AWS services in production |
| Thanh Nguyen (McKinsey) | Platform play — events, brands, conferences. Clear buyer. |
| Rahul Shinde (Coca-Cola) | Brand content injection, audience engagement metrics, zero-friction QR |
| Louis Vichy (OpenRouter) | Multi-model potential for content generation |

## Technical Research Findings

### duck.baby Analysis (Completed)
- React 19.1.1 + Vite + Tailwind CSS v4.1.14
- Custom Canvas 2D engine (960x704), no game framework
- ALL pixel art drawn procedurally via fillRect (96 calls, 39 game-related)
- ALL audio synthesized via Web Audio API (square + sawtooth oscillators, white noise)
- Zero external game assets — everything is code
- tRPC + TanStack Query for backend
- Deployed on Vercel, assets on CloudFront
- Built with Manus AI assistance

### WebSocket Architecture (Finalized)

**Server: Bun.serve() with native WebSockets**
- Skip Socket.IO (45KB client bundle, overkill protocol), skip `ws` (needs Node.js, manual upgrade)
- Bun has built-in pub/sub: `ws.subscribe("game-room")` + `server.publish("game-room", data)`
- `ws.data` attaches role on upgrade: `{ role: "display" | "controller" | "audience", sessionId }`
- Single `fetch` handler for HTTP (OpenAI proxy) + WebSocket upgrade
- Server is ~150-200 lines total

**Deployment: Railway for WS server**
- `railway up` deploys in <2 min, auto-detects Bun
- Native WebSocket support (persistent connections)
- $5 free trial credit (no credit card needed)
- Auto HTTPS → wss:// included
- NOT Render (15-min spin-down kills WS), NOT EC2 (too much setup), NOT Fly.io (heavier setup)

**Frontend: Vercel**
- Vite + React app, 3 routes: /play, /control, /audience
- Connects to Railway WS server via wss://

**WS Protocol:**
```
Phone → Server: { type: "input", action: "lane_up" | "lane_down" | "boost" }
Server → Game:  { type: "game_state", ... }
Audience → Server: { type: "suggestion", text: "a water buffalo" }
Server → OpenAI: structured output call
Server → Game:  { type: "new_obstacle", obstacle: { type, lane, speed, color, label, ... } }
Server → Audience: { type: "suggestion_accepted", original, result }
```

**OpenAI Pipeline: gpt-4o-mini with Structured Outputs**
- `response_format: { type: "json_schema", json_schema: {...} }` — guaranteed valid JSON
- Schema uses enums not pixel values: width: "small"|"medium"|"large", speed: 0.5-2.0
- System prompt constrains to valid game objects, rejects inappropriate content
- Rate limit: 1 suggestion per 15 seconds per user (in-memory Map)
- Cost: <$1 for entire hackathon

**QR Code: `qrcode.react`**
- `<QRCodeSVG value={url} size={256} />` — one component, zero config
- SVG for sharp display on projectors

### Canvas 2D Game Patterns (Finalized)

**Game Loop:** requestAnimationFrame + delta time, cap dt at 0.05s
- Separate update() and render() — never mutate state during render

**Scrolling:** Nothing actually scrolls. Everything moves left at different speeds.
- Background (buildings): 0.2x base speed, recycle when off-screen
- Mid-ground (road + obstacles): 1.0x base speed
- Foreground (road markings): 1.3x base speed
- Use fillRect for all layers — no images needed

**Lane System:** 3 fixed Y positions, lerp for smooth switching
```
playerY += (targetY - playerY) * 10 * dt;  // snappy ease-out
```

**Sprites:** fillRect compositions — arrays of [x, y, w, h, color] tuples
- Helper: `drawSprite(ctx, sprite, posX, posY, scale)`
- Motorbike: ~20 rects, Taxi: ~15 rects, Pho cart: ~10 rects
- Player hitbox = 60-70% of visual size (generous = feels fair)

**Collision:** Simple AABB with shrunken hitbox
```
function collides(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x &&
         a.y < b.y + b.height && a.y + a.height > b.y;
}
```

**Obstacle Spawner:** Timer-based, checks suggestion queue first, then random
```
spawnInterval = Math.max(0.4, 2.0 - elapsedTime * 0.01)
```

**Audio Recipes (Web Audio API):**
| Sound | Recipe |
|---|---|
| Engine hum | Sawtooth 80-120Hz, modulate freq with speed |
| Crash | Noise burst 0.3s + square 100→40Hz descending |
| Dodge/near miss | Triangle 400→800Hz sweep over 0.15s |
| Boost | Sawtooth 200→600Hz over 0.3s |
| Horn honk | Square 350Hz for 0.2s (random from passing vehicles) |
| Pickup/coin | Square C5(523Hz) → E5(659Hz), 0.05s each |

**Juice Priority (impact per hour):**
1. Screen shake on collision (5 lines of code, massive impact)
2. Speed lines (white rects flying across at 2-3x speed)
3. Dust particles behind motorbike
4. Score pop on milestones
5. Near-miss "CLOSE!" bonus text
6. Hit flash (white → red tint for 2-3 frames)
7. Sky color shift: blue → orange → red as speed increases

**Performance:** 200+ fillRect calls per frame is fine at 60fps. This game will use ~100-150 max. No concerns.

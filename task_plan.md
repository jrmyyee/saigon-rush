# Task Plan — Saigon Rush

## Project Overview

**Saigon Rush** — A real-time 2D runner game where you dodge through HCMC traffic on a motorbike. The twist: the audience controls the chaos. Spectators type obstacle suggestions ("add a water buffalo", "add a pho cart"), AI converts them into game-compatible obstacles, and they're injected into the live game in real-time.

### One-Line Pitch
> "A real-time runner where the audience IS the game designer — AI converts their suggestions into obstacles you have to dodge."

### Why This Wins
- **AI is essential, not decorative** — without it, audience text can't become game elements
- **Audience participation** — spectators are active, not passive (Twitch Plays model)
- **Brand-friendly** — brands inject sponsored obstacles/powerups natively
- **Vietnam-relevant** — HCMC traffic is universally relatable to every judge in the room
- **Technically impressive** — real-time AI pipeline + WebSocket game + Canvas renderer, solo, in 36 hours

---

## Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  BIG SCREEN  │◄────│  WS SERVER   │◄────│  PHONE CTRL     │
│  (Game View) │     │  (Bun/Node)  │     │  (Touch Input)  │
│  Canvas 2D   │     │              │     │  Mobile Web      │
└─────────────┘     │              │     └─────────────────┘
                    │              │
┌─────────────┐     │              │     ┌─────────────────┐
│  AUDIENCE    │────►│              │────►│  OpenAI API     │
│  (Suggest)   │     │              │     │  gpt-4o-mini    │
│  Web Form    │     └──────────────┘     └─────────────────┘
└─────────────┘
```

### Three Client Types (Same React App, Route-Based)
1. **`/play`** — Big screen game display (Canvas 2D renderer)
2. **`/control`** — Phone controller (touch input, swipe to lane-switch)
3. **`/audience`** — Spectator suggestion page (text input, see feed)

### Tech Stack Decisions

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite | Fast scaffold, known stack |
| Styling | Tailwind CSS v4 | Utility-first, fast iteration |
| Game Renderer | Custom Canvas 2D | Full control, no framework overhead, proven by duck.baby |
| WebSocket Server | Bun.serve() native WebSocket | Built-in pub/sub, single file, fastest option |
| WS Deployment | Railway | `railway up` in 2 min, free $5 credit, native WS support |
| AI Pipeline | OpenAI gpt-4o-mini | Fast, cheap, structured JSON output |
| Voice (stretch) | ElevenLabs API | Vietnamese street vendor calls, PA announcements |
| Frontend Deploy | Vercel | Instant deploy, free tier |
| QR Code | `qrcode.react` package | Simple, no server needed |

---

## Phase Breakdown

### PHASE 1: Scaffold + WebSocket Foundation (Hours 0-2)
**Goal**: Project running, WebSocket server connected, canvas rendering a moving background.

- [ ] `npm create vite@latest saigon-rush -- --template react-ts`
- [ ] Install deps: tailwindcss, qrcode.react, ws client library
- [ ] Set up project structure:
  ```
  src/
    game/           # Game engine (Canvas 2D)
      engine.ts     # Game loop, rendering
      entities.ts   # Player, obstacles, road
      audio.ts      # Procedural Web Audio
      sprites.ts    # fillRect sprite definitions
    server/         # WebSocket server
      index.ts      # WS server entry
      rooms.ts      # Game room management
    pages/
      GameScreen.tsx   # /play — big screen
      Controller.tsx   # /control — phone
      Audience.tsx     # /audience — suggestions
      Results.tsx      # /results — shareable result
    components/
      QRCode.tsx
      SuggestionFeed.tsx
    lib/
      ws.ts           # WebSocket client wrapper
      openai.ts       # OpenAI suggestion pipeline
    App.tsx           # Router
  ```
- [ ] Basic WebSocket server running (accept connections, echo messages)
- [ ] Canvas rendering: scrolling road with parallax background
- [ ] Deploy frontend to Vercel, WS server to chosen platform
- [ ] Verify: open browser → see scrolling road

**Decision**: Monorepo with `/client` and `/server` dirs.
→ Client: Vite + React app deployed to Vercel (3 routes: /play, /control, /audience)
→ Server: Single Bun.serve() file deployed to Railway (~150-200 lines)
→ Server handles WebSocket connections + OpenAI API calls (keeps API key server-side)

---

### PHASE 2: Core Game Loop (Hours 2-6)
**Goal**: Playable single-player runner — player moves, obstacles scroll, collision works, score ticks.

- [ ] **Player entity**: Motorbike sprite (fillRect composition), 3 lanes, smooth lane switching
- [ ] **Road system**: Infinite scrolling road, lane markings, building silhouettes in background
- [ ] **Obstacle system**:
  - Data structure: `{ id, type, lane, x, speed, width, height, color, label }`
  - Spawn from right, scroll left, despawn when off-screen
  - Start with 3 hardcoded types: slow_motorbike, pho_cart, taxi
- [ ] **Collision detection**: Simple AABB per lane (player box vs obstacle box)
- [ ] **Game states**: MENU → PLAYING → GAME_OVER → RESULTS
- [ ] **Score**: Distance-based (increases with time alive) + dodge bonuses
- [ ] **Speed ramp**: Game gradually speeds up over 60 seconds
- [ ] **HP system**: 3 lives (hits reduce HP, 0 = game over) — more forgiving than instant death

**Playtest checkpoint**: Is dodging obstacles fun? Is the speed curve right? If this isn't fun with rectangles, pixel art won't save it.

---

### PHASE 3: Audience Suggestion Pipeline (Hours 6-10)
**Goal**: Audience types a suggestion → AI converts it → obstacle appears in game.

- [ ] **Audience page (`/audience`)**:
  - Text input: "What should appear on the road?"
  - Submit button
  - Live feed of suggestions + what they became in-game
  - Rate limit: 1 suggestion per 15 seconds per user
- [ ] **OpenAI pipeline** (server-side):
  ```
  User input: "a water buffalo"
  → OpenAI gpt-4o-mini with structured output
  → Response: {
      type: "water_buffalo",
      lane: 1,
      speed: 0.3,        // slow (0-1 scale)
      width: 3,          // grid units
      height: 2,
      color: "#8B7355",
      label: "Water Buffalo 🐃",
      points: 50,
      dangerous: true
    }
  ```
- [ ] **Prompt engineering**: System prompt constrains output to valid game objects. Rejects inappropriate content. Maps creative suggestions to game-compatible params.
- [ ] **Suggestion queue**: Server maintains a queue. Game pulls from queue every few seconds. Shows "INCOMING: [suggestion]" warning on screen before spawning.
- [ ] **Feed display**: Big screen shows a scrolling feed of suggestions on the side
- [ ] **Moderation**: OpenAI's built-in content filtering + simple blocklist

**This is the "AI is essential" moment.** Without this pipeline, the core mechanic doesn't exist.

---

### PHASE 4: Multi-Screen + Phone Controller (Hours 10-14)
**Goal**: QR code → phone connects as controller → input drives game on big screen.

- [ ] **Room system**: Server creates a game room with a 4-char code (e.g., "RUSH")
- [ ] **QR code**: Big screen displays QR code pointing to `/control?room=RUSH`
- [ ] **Phone controller page**:
  - Swipe left/right → lane change
  - Tap → boost/brake
  - Tilt (stretch goal) → fine movement
  - Minimal UI: just lane indicators and score
- [ ] **WebSocket protocol**:
  ```
  Phone → Server: { type: "input", action: "lane_left" | "lane_right" | "boost" }
  Server → Game:  { type: "game_state", player: {...}, obstacles: [...], score: N }
  Audience → Server: { type: "suggestion", text: "a wedding procession" }
  Server → Game:  { type: "new_obstacle", obstacle: {...} }
  Server → Audience: { type: "suggestion_accepted", original: "...", result: {...} }
  ```
- [ ] **Reconnection handling**: If phone disconnects, game pauses briefly, phone can rejoin
- [ ] **Multiple players** (stretch): If time, support 2-4 simultaneous players split into lanes

---

### PHASE 5: Polish + Game Feel (Hours 14-18)
**Goal**: The game FEELS good. Juice, audio, visual flair.

- [ ] **Procedural audio** (Web Audio API):
  - Engine hum: low-frequency oscillator, pitch rises with speed
  - Dodge sound: quick ascending square wave blip
  - Crash: sawtooth buzz + noise burst
  - Boost: ascending arpeggio
  - Audience obstacle incoming: alert chime
  - Background music: simple chiptune loop (4-bar, square + triangle)
- [ ] **Visual juice**:
  - Screen shake on collision
  - Speed lines at high velocity
  - Flash on dodge (near miss)
  - Particle trail behind motorbike
  - "INCOMING!" text animation when audience obstacle queued
  - Obstacle labels floating above sprites (emoji + text from AI)
- [ ] **Vietnamese flavor**:
  - NPC dialogue bubbles in Vietnamese ("Ối!" "Cẩn thận!" "Bíp bíp!")
  - Street signs, shop names in Vietnamese
  - Motorbike horn sound on boost
- [ ] **Result screen** ("Traffic Report"):
  ```
  ╔═══════════════════════════════════╗
  ║  🏍️ TRAFFIC REPORT               ║
  ║  Driver: [name]                   ║
  ║  Distance: 2,847m                 ║
  ║  ───────────────────              ║
  ║  Obstacles Dodged: 34             ║
  ║  Audience Chaos Survived: 12      ║
  ║  Near Misses: 8                   ║
  ║  Top Speed: 127 km/h              ║
  ║  Rating: ⭐⭐⭐⭐ Saigon Local     ║
  ║                                   ║
  ║  [QR CODE to play]               ║
  ║  saigonrush.vercel.app            ║
  ╚═══════════════════════════════════╝
  ```

---

### PHASE 6: Sponsor Integrations (Hours 18-22)
**Goal**: Meaningful integration with sponsor APIs for prize eligibility.

- [ ] **OpenAI** (PRIORITY — ChatGPT Pro prize worth $200/mo):
  - Core: suggestion→obstacle pipeline (already built in Phase 3)
  - Stretch: AI generates Vietnamese commentary on game events
  - Stretch: AI dynamically adjusts difficulty based on player performance
- [ ] **ElevenLabs** (6 months Scale tier per member):
  - Vietnamese street vendor voices: "Phở đây! Phở đây!" when a pho cart spawns
  - Traffic announcer voice: "Incoming obstacle from the audience!"
  - Victory/defeat voice lines
  - Pre-generate a few clips, don't rely on real-time generation during demo
- [ ] **AWS** (open category):
  - If WS server is on AWS (EC2/Lambda): document the architecture
  - DynamoDB for leaderboard persistence
  - S3/CloudFront for static assets (if any)
  - At minimum: clearly articulate the AWS deployment architecture in the pitch
- [ ] **Brand injection demo**:
  - Show a "brand mode" where the audience page has a "Sponsored" section
  - Brand obstacle example: "Grab bike" with Grab-green color, gives speed boost
  - Even if hardcoded, demonstrates the concept

---

### PHASE 7: CODE FREEZE + Demo Prep (Hours 22-26)
**Goal**: Stop coding. Prepare an unbreakable demo.

- [ ] **Record backup video**: 60-second screen recording of gameplay working perfectly
- [ ] **Test on multiple phones**: At least 3 different devices (Android Chrome, iOS Safari)
- [ ] **Prepare QR codes**: Print physical QR cards, have URL in large text
- [ ] **Demo script** (3 minutes):
  | Time | What |
  |---|---|
  | 0:00-0:15 | Hook: "I landed in Vietnam, the immigration queue was insane, the traffic was worse. So I built a game about it. Scan this QR." |
  | 0:15-0:30 | Audience joins suggestion page. Type obstacles. |
  | 0:30-1:30 | Play live. Audience obstacles appear. React to chaos. |
  | 1:30-2:00 | Show result screen. Explain the viral share mechanic. |
  | 2:00-2:30 | "The AI converts any text into a game obstacle. Without AI, this doesn't work." Show the pipeline. |
  | 2:30-2:50 | "Any brand can inject content. Any event can deploy this. This is the engine." |
  | 2:50-3:00 | "Built solo in 36 hours. Saigon Rush." |
- [ ] **Rehearse 5 times**
- [ ] **Prepare for failure**: WiFi backup (mobile hotspot), pre-loaded game state, video fallback
- [ ] **Devpost submission**: Write description, upload screenshots, record demo video

---

### PHASE 8: Sleep + Final Prep (Hours 26-30)
- [ ] Sleep 3-4 hours
- [ ] Final device testing
- [ ] Arrive at judging fresh

---

## Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| WiFi fails during demo | Fatal | Bring mobile hotspot. Test venue WiFi. Have video backup. |
| OpenAI API slow/down | High | Cache 10-15 pre-generated obstacles as fallback. Game works without audience. |
| WebSocket server crashes | High | Simple reconnection logic. Game continues with pre-queued obstacles. |
| Canvas performance | Medium | Keep sprite count under 50. Profile early. |
| Phone controller latency | Medium | Send input at 10Hz max. Predict movement client-side. |
| Scope creep | High | **One player, one level, one AI pipeline. That's the MVP.** |

---

## Definition of Done (Minimum Demo)

The demo works if ALL of these are true:
1. ✅ Big screen shows a running game with a motorbike dodging obstacles
2. ✅ Phone controller moves the player via swipe
3. ✅ Audience page accepts text suggestions
4. ✅ AI converts suggestion to obstacle that appears in-game within 5 seconds
5. ✅ Game ends with a shareable result screen + QR code
6. ✅ The whole flow takes under 10 seconds from QR scan to playing

Everything else is bonus.

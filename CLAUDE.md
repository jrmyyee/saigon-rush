# Saigon Rush — CLAUDE.md

## Project Context
**Saigon Rush** — Real-time 2D runner game (HCMC traffic on a motorbike) where audience injects obstacles via AI. Built solo at LotusHacks 36hr hackathon, VNG Campus HCMC, March 2026.

**Constraint**: Solo developer, ~30 hours. Every decision optimizes for speed-to-demo, not elegance.

## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity
- Reference `task_plan.md` before starting any phase

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for this project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run the dev server, check the browser, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it
- **HACKATHON EXCEPTION**: Speed > elegance when the alternative is not shipping

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management

1. **Plan First**: Write plan to `task_plan.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete in `task_plan.md` and `progress.md` as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to task_plan.md
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Only touch what's necessary. No side effects with new bugs.
- **Demo-First Thinking**: Every decision serves the 3-minute demo. If it doesn't make the demo better, cut it.
- **One Player, One Level, One AI Pipeline**: That's the MVP. Everything else is bonus.

## Tech Stack (Locked — Do Not Change)

| Layer | Choice |
|---|---|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS v4 |
| Game Renderer | Custom Canvas 2D (fillRect sprites, no game framework) |
| WebSocket Server | Bun.serve() native WebSocket (built-in pub/sub) |
| WS Deployment | Railway |
| AI Pipeline | OpenAI gpt-4o-mini with Structured Outputs |
| Frontend Deploy | Vercel |
| QR Code | qrcode.react |
| Audio | Web Audio API oscillators (procedural, no audio files) |

## Project Structure

```
saigon-rush/
  client/               # Vite + React app (deployed to Vercel)
    src/
      game/             # Canvas 2D game engine
        engine.ts       # Game loop, rendering, state
        entities.ts     # Player, obstacles, road
        sprites.ts      # fillRect sprite definitions
        audio.ts        # Procedural Web Audio
      pages/
        GameScreen.tsx  # /play — big screen display
        Controller.tsx  # /control — phone touch controller
        Audience.tsx    # /audience — suggestion form
        Results.tsx     # /results — shareable "Traffic Report"
      components/
      lib/
        ws.ts           # WebSocket client wrapper
      App.tsx           # Router
  server/               # Bun WebSocket server (deployed to Railway)
    index.ts            # Single file: WS handler + OpenAI proxy
  task_plan.md          # Build phases + checklists
  findings.md           # All research + specialist insights
  progress.md           # Session log
  tasks/lessons.md      # Self-improvement rules
```

## Key Architecture Decisions

- **3 client types, 1 React app**: /play (big screen), /control (phone), /audience (spectators)
- **Server is ~150-200 lines**: Bun.serve() handles HTTP + WebSocket in one `fetch` handler
- **Game loop**: requestAnimationFrame + delta time, capped at 0.05s
- **Scrolling**: Fixed camera, everything moves left at different parallax speeds
- **Lane system**: 3 fixed Y positions, lerp smoothing (`playerY += (targetY - playerY) * 10 * dt`)
- **Sprites**: fillRect compositions as `[x, y, w, h, color]` tuple arrays
- **Collision**: AABB with hitbox at 60-70% of visual size (generous = fair)
- **Obstacle spawner**: Checks audience suggestion queue first, then random pool
- **OpenAI**: Structured Outputs guarantee valid JSON. Schema uses enums not pixel values.
- **Rate limiting**: 1 audience suggestion per 15 seconds per user

## Definition of Done (MVP)

ALL of these must be true for a valid demo:
1. Big screen shows a running game with a motorbike dodging obstacles
2. Phone controller moves the player via swipe
3. Audience page accepts text suggestions
4. AI converts suggestion to obstacle that appears in-game within 5 seconds
5. Game ends with a shareable "Traffic Report" result screen + QR code
6. QR scan to playing takes under 10 seconds

Everything else is bonus. Do not scope-creep past these 6 items until they ALL work.

## Game Design Rules

- **Player must NEVER be stationary for >1 second.** Constant forward motion. This is a runner.
- **One-finger input only.** Swipe up/down for lanes, tap for action. Nothing more.
- **3 hardcoded obstacle types first** (slow_motorbike, pho_cart, taxi). AI-generated obstacles are additive.
- **3 HP, not instant death.** More forgiving = more fun during demo.
- **60-second rounds max.** Short enough for demo, long enough for audience suggestions to matter.
- **The "Traffic Report" result screen is as important as the game itself.** It's the viral share artifact.

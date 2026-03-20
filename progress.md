# Progress Log — Saigon Rush

## Session 1: 2026-03-21 (Hackathon Day 2)

### Context
- Solo developer at LotusHacks (36hr hackathon, VNG Campus HCMC)
- Hackathon started March 20 evening, ~30 hours remaining
- AWS open category track selected
- Targeting sponsor tracks: OpenAI, ElevenLabs, Agora, AWS

### Key Decisions Made
- **Theme**: HCMC traffic runner (inspired by real immigration queue + traffic experience arriving in Vietnam)
- **Core mechanic**: Audience injects obstacles in real-time via AI → game pipeline
- **Architecture**: React + TypeScript + Vite + Canvas 2D + WebSocket + OpenAI
- **Solo constraint**: Every decision optimized for speed-to-demo, not elegance

### Planning Phase
- [x] Concept validation (brand strategist, game designer, devil's advocate agents)
- [x] Technical research launched (WebSocket architecture, Canvas 2D patterns)
- [x] Tech research complete — Bun WS on Railway, custom Canvas 2D, gpt-4o-mini structured outputs
- [x] Task plan finalized
- [ ] Project scaffolded
- [ ] Implementation started

### Finalized Tech Decisions
- **WS Server**: Bun.serve() native WebSocket (built-in pub/sub)
- **WS Deploy**: Railway (`railway up`, free $5 credit)
- **Frontend**: Vite + React + TS on Vercel
- **Game**: Custom Canvas 2D, fillRect sprites, 3-lane runner with lerp
- **AI**: OpenAI gpt-4o-mini, Structured Outputs (guaranteed JSON schema)
- **Audio**: Web Audio API oscillators (square, sawtooth, triangle + noise)
- **QR**: qrcode.react

### Milestones
| Target Hour | Milestone | Status |
|---|---|---|
| H+2 | Project scaffolded, WebSocket connected, canvas rendering | |
| H+6 | Core game loop: player moves, obstacles scroll, collision works | |
| H+10 | Audience suggestion page + AI pipeline working | |
| H+14 | QR join flow, phone controller, big screen display | |
| H+18 | Polish: audio, visual juice, result screen | |
| H+22 | Sponsor integrations: ElevenLabs voice, brand injection demo | |
| H+26 | CODE FREEZE. Demo prep, backup video, pitch rehearsal | |
| H+30 | Judging | |

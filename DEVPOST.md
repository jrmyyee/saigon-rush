# Saigon Rush — DevPost Submission
# LotusHacks x HackHarvard x GenAI Fund 2026

**Submission link**: https://devpost.com/submit-to/27990-lotushacks-x-hackharvard-x-genai-fund-vietnam-hackathon/manage/submissions
**Basic submission deadline**: 7:00 PM Saturday March 21 (project name, pitch, team)
**Full submission deadline**: 9:00 AM Sunday March 22 (everything else)

---

## Project Name
**Saigon Rush**

## Elevator Pitch (for the basic submission — 200 char cap)
Audience types anything, AI turns it into an interactive game element. Real-time HCMC motorbike runner with AI-generated pixel art, sound effects, and gameplay behaviors.

## Tagline
The audience types it. AI builds it. You dodge it.

---

## Inspiration

My first time in HCMC, and both shocked and in awe of the traffic and how some drivers are able to weave through it. The skilled motorbike driver became the inspiration for this project.

Games have always been better with a crowd. But usually the crowd can only choose from options someone already built. I wanted to see what happens when you let the audience type anything and AI makes it real inside the game.

What if someone types "dragon" and a fire-breathing parade snake blocks two lanes? What if someone types "angry grandma" and she's sitting on a plastic stool throwing slippers at you?

---

## What it does

**Player** plays the game on their laptop. Swipe or arrow keys to dodge, tap to boost.

**Audience** (any number of people) opens a URL on their phone, types anything, and it appears on screen as a real obstacle with AI-generated pixel art, sound effects, and behaviors. "Dragon" gets a 7-segment chain that breathes fire. "Angry grandma" sits on a plastic stool throwing slippers at you. "Traffic jam" blocks all three lanes with one gap to squeeze through.

The whole thing takes about 3 seconds from suggestion to obstacle.

After 60 seconds, the game shows a "Traffic Report" — your stats, your rating (from "Tourist" to "Huyền Thoại Giao Thông"), and a QR code so the next person can play.

**[INSERT GIF: someone typing "angry grandma" on the audience page → obstacle appearing on game screen]**

**[INSERT SCREENSHOT: Traffic Report results screen]**

**[INSERT SCREENSHOT: Game in action with audience feed sidebar]**

---

## How we built it

Solo. ~30 hours. Claude Code for the entire codebase.

```
Phone (Controller)  ──┐
                      ├──  Bun WebSocket Server  ──  Big Screen (Game)
Phone (Audience)    ──┘         │
                          ┌─────┴─────┐
                    OpenAI GPT    Claude Opus    ElevenLabs
                   (game design)   (pixel art)     (SFX)
```

When someone types a suggestion, three things happen:

**Phase 1** (~2s): GPT designs the obstacle. How it moves, what it throws, how dangerous it is. Structured Outputs guarantee valid game objects every time. The obstacle appears in-game immediately with a simple fallback sprite.

**Phase 2** (background): Claude Opus draws a detailed pixel art sprite (35-50 colored rectangles), hot-swapped onto the obstacle via WebSocket. Sometimes the player sees the sprite upgrade mid-dodge.

**Phase 3** (background): ElevenLabs generates a sound effect. Type "dragon", hear a dragon.

The trick: show something immediately, upgrade it in the background. The audience gets instant feedback and the game never stalls.

The game engine, music, and traffic honks are all procedural. No image files, no audio files in the build. The soundtrack is Web Audio oscillators doing their best impression of Vietnamese chiptune.

---

## Challenges we ran into

The engine sound was supposed to be a satisfying motorcycle putt-putt. Instead it sounded like a dying robot bee. I spent an hour trying to fix it before accepting the noble engineering solution: deleting it entirely.

The horn synthesis went through three rewrites. Started with bandpass filters (too artificial), then tried FM synthesis (too sci-fi), finally landed on amplitude modulation with a 6Hz wobble that actually sounds like a Vietnamese motorbike horn. Small win but I smiled.

Sprite quality from AI prompts was terrible at first. Colored blobs. Ended up writing a 200-line prompt spec with mandatory construction passes and minimum rectangle counts before the output was usable.

Scope. One person, 30 hours, and the temptation to add "just one more feature" at 3am. I put a rule in my spec doc: "If it doesn't make the 3-minute demo better, cut it." I cut a lot.

---

## Accomplishments that we're proud of

Someone types "angry grandma" and 3 seconds later, a grandma on a plastic stool is throwing pixel-art slippers at the player. The moment that first worked, I knew the project was worth finishing.

The zero-asset thing still surprises me. Not a single PNG or MP3 in the build. Every pixel is a `fillRect()` call, every sound is an oscillator. The game ships as plain JavaScript — no assets to load.

The progressive enhancement pattern turned out to be more than a latency workaround. Watching sprites upgrade mid-game is fun in a way I didn't plan for.

---

## What we learned

Progressive enhancement was a latency workaround that accidentally became the best feature. I built it because I couldn't make the AI fast enough. Turns out watching sprites upgrade mid-game is more interesting than if they just loaded perfectly.

The other thing: I've playtested this dozens of times and it's different every time, because the audience is different every time. When AI is in the gameplay loop, you stop designing levels and start designing systems. That was new to me.

---

## What's next for Saigon Rush

**Streaming integration** — Twitch/YouTube chat as the audience input. Every streamer becomes a game show host.

**Events** — Team buildings, product launches, conferences. QR scan to playing in 10 seconds, no setup needed. People at LotusHacks already asked if they could use this for their company events.

**Other cities** — Bangkok, Jakarta, Mumbai. Same engine, different chaos. The prompts just need local flavor.

---

## Built With

- OpenAI GPT (Structured Outputs — core obstacle generation)
- ElevenLabs (real-time sound effect generation)
- Claude Code (primary development tool)
- Claude Opus (AI pixel art sprite generation)
- React 19 + TypeScript + Vite
- Tailwind CSS v4
- Bun (WebSocket server)
- Canvas 2D API (custom game renderer)
- Web Audio API (procedural audio synthesis)
- Vercel + Railway (deployment)
- qrcode.react

---

## Sponsor Tracks

### ElevenLabs — Best Use of ElevenLabs
Every audience-submitted obstacle generates a unique sound effect via ElevenLabs Sound Generation API. Type "dragon" — hear a dragon. Type "karaoke truck" — hear karaoke blasting. The SFX arrives via WebSocket as part of the progressive enhancement pipeline and plays when the obstacle enters the viewport. Every game session sounds different because every audience is different.

### OpenAI — Best Use of Codex
OpenAI is the CORE gameplay mechanic — without it, there is no game. GPT with Structured Outputs designs every obstacle's personality, movement, danger level, and behavior composition in real-time from arbitrary audience text. The JSON Schema enforcement guarantees valid game objects on every call — critical for a live game where a parsing error means a broken session. The composable behavior schema (chain segments, projectile patterns, lane-spanning) acts as a creative constraint that channels GPT into producing playable, balanced, surprising game content. "My ex" gets aimed projectiles throwing your belongings. "Traffic jam" gets 3-lane span with one gap. The AI doesn't generate data — it designs gameplay.

### HRG — Best Indie Hacker
Built entirely solo in ~30 hours. Custom Canvas 2D game engine, procedural Web Audio synthesis, AI-generated pixel art, WebSocket multiplayer, audience participation UI, shareable results screen — one person with Claude Code. The project is designed to be maintainable by one person: single-file server (~200 lines), no game framework dependencies, zero external assets to manage. I plan to keep building this after the hackathon — the streaming integration angle has real legs.

### Fal — Best Use of Fal
*(Add after integration — infrastructure already exists)*
Fal powers the highest-fidelity visual tier in the progressive enhancement pipeline. Obstacle sprites evolve through three stages in real-time: simple rectangles (instant) → detailed pixel art via Claude (background) → AI-generated image via Fal (background). Players watch obstacles visually upgrade while dodging them.

### OpenRouter — Best Use of OpenRouter
*(Add after integration)*
OpenRouter powers the obstacle generation pipeline, enabling model-agnostic AI routing. The game can dynamically select models — GPT for speed, Claude for creativity, Qwen for cost — without changing game code. For a real-time game where latency matters, being able to fall back to faster models is the difference between a responsive experience and a broken one.

---

## Try it out

- **Live Demo**: *(URL)*
- **Source Code**: *(GitHub repo link)*
- **Demo Video**: *(YouTube link — UNLISTED, not private, marked Not for Kids)*

---

## Demo Video Script (under 3 min)

**0:00-0:05** — Hook: "What happens when you let the audience design the game?"

**0:05-0:20** — Show the game running. Player dodging obstacles. Don't explain anything yet. Let the visuals work.

**0:20-0:50** — The magic moment. Cut to audience phone. Type "dragon". Cut to game screen — dragon appears. Type "angry grandma". Grandma appears throwing slippers. Show the sprite upgrading in real-time. This is the money shot.

**0:50-1:20** — Quick explanation. "Audience types anything. GPT designs the obstacle. Claude draws the sprite. ElevenLabs creates the sound. All in parallel. The obstacle appears in 3 seconds — then upgrades in the background."

**1:20-1:40** — Show the architecture diagram. "One server, three screens, zero assets. Every pixel and every sound is generated."

**1:40-2:00** — Show the Traffic Report. Show the QR code flow. "Scan to play in 10 seconds."

**2:00-2:20** — Business angle. "This works for live events, corporate team building, streamer content. The audience-as-game-designer model turns passive viewers into active participants."

**2:20-2:30** — Close. "Built solo in 30 hours. Saigon Rush."

---

## Live Pitch Notes (for stage)

**THE CRITICAL MOVE: Hand a judge's phone the audience URL during the pitch. Let THEM type something. When their suggestion appears as an obstacle on screen — that's the moment. Interactive demos win hackathons.**

### 3-minute structure:
1. **0:00-0:30** — Start the game live. Get judges to type on the audience page. Say nothing. Let the reaction happen.
2. **0:30-1:00** — Name the insight: "Every audience participation game before this — Jackbox, Twitch Plays Pokemon, Crowd Control — gives the crowd a menu. Pick A, B, or C. We removed the menu. The audience types anything and AI generates it in 3 seconds."
3. **1:00-1:30** — Tech: "Three AI models in parallel. GPT designs gameplay. Claude draws pixel art. ElevenLabs creates sound. The obstacle appears immediately and upgrades in the background."
4. **1:30-2:00** — Business: "Jackbox proved this model works — 200 million players, phones + shared screen. But their content is hand-authored. Ours is generated. That means infinite replayability, instant localization, and white-label for events and brands."
5. **2:00-2:30** — "Built solo in 30 hours. No image files, no audio files. Everything generated."
6. **2:30-3:00** — "Starting with games because it's the hardest proof point for real-time AI content generation. If the pipeline works here — multiplayer, multi-modal, 3-second latency — it works for events, streaming, and interactive entertainment."

### If a judge asks "but this is a game, not enterprise":
"Jackbox sells to corporate event planners and team-building companies. That's a B2B sale. We're the AI-native version with better unit economics — our content is generated, not authored."

### If a judge asks "what's the moat":
"Anyone can call one API. Orchestrating three models into a coherent real-time output under a 3-second latency budget is the hard part. And as we accumulate data on what audience inputs create the best engagement, that becomes a feedback loop no one else has."

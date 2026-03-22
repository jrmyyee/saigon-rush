# Saigon Rush — Prize Stacking Strategy
# LotusHacks x HackHarvard x GenAI Fund 2026

## Deadlines
- **7:00 PM Sat March 21**: Basic submission (project name, elevator pitch, team) — MANDATORY or DQ
- **9:00 AM Sun March 22**: Full submission (all details, demo video, sponsor tracks)
- DevPost link: https://devpost.com/submit-to/27990-lotushacks-x-hackharvard-x-genai-fund-vietnam-hackathon/manage/submissions

## The Goal: Maximum Prize Stacking

You can win MULTIPLE prizes simultaneously. Here's the map.

---

## TIER 1: Already Eligible (No Code Changes)

### 1. Top 3 Main Prize (50M / 35M / 20M VND + massive credits)
**Status: CORE TARGET**
- This is what the whole submission is optimized for
- Strongest angles: AI-in-the-loop gameplay, solo build, technical ambition, crowd energy at demo
- The demo IS the pitch. When judges see someone type "angry grandma" and it appears on screen in 3 seconds, you win the room

### 2. HRG Best Indie Hacker — $1,000 cash + Da Nang trip
**Status: FREE WIN**
- Prize literally says "Best solo/indie hacker project"
- You built the entire thing solo in 30 hours
- Custom game engine, 3-model AI pipeline, procedural audio, WebSocket multiplayer — ONE PERSON
- This is the easiest prize on the board. Just submit.

### 3. ElevenLabs Best Use — 3 months Pro + swag
**Status: STRONG FIT**
- Already using ElevenLabs Sound Generation API for per-obstacle SFX
- Every audience suggestion generates a unique sound effect
- Frame it: "ElevenLabs makes every obstacle feel alive — type 'dragon' and you HEAR the dragon before you see it"
- The progressive enhancement angle is strong: obstacle appears visually first, then the ElevenLabs SFX arrives and adds another sensory layer

### 4. OpenAI Best Use of Codex — 1 year ChatGPT Pro/member (up to $2,400/person! Top 5 teams awarded)
**Status: STRONG — FRAME AS CORE GAMEPLAY**
- OpenAI Codex workshop happened TODAY at the hackathon — Gabriel from OpenAI presented, so judges are primed for this
- You use `gpt-5.4-mini` with **Structured Outputs** (JSON Schema) as the CORE gameplay mechanic — not a bolt-on
- Frame: "Without OpenAI, there is no game. Every obstacle's behavior composition, danger level, sprite, personality, and audience message comes from GPT's structured output. The JSON schema enforcement is what makes real-time AI-generated content reliable enough for gameplay — guaranteed valid game objects on every call, zero parsing errors."
- The composable behavior schema (chainSegments, projectileInterval, laneSpan, etc.) is a creative constraint that channels GPT's imagination into playable, balanced game content
- Top 5 teams get awarded — wider net than other sponsors, good odds
- If "Codex" specifically means the coding agent product, you also built the entire project with Claude Code (AI coding tool), showing the full AI-dev-to-AI-runtime pipeline

---

## TIER 2: Easy Integrations (< 1 hour of work each)

### 5. Fal Best Use — $1,000 USD credits
**Status: INFRASTRUCTURE ALREADY EXISTS**
- `GameObstacle.imageUrl` field already exists in types.ts
- `obstacle_image_ready` WebSocket message type already defined
- You literally have the progressive enhancement pipeline built for this
- **Integration**: Add a Phase 2b that calls fal.ai to generate a real image of the obstacle, which renders as a higher-fidelity version on top of the pixel art
- ~30 min of work: one fetch call to fal.ai's fast image gen, send result via existing `obstacle_image_ready` message
- Frame: "Fal provides the final visual evolution — pixel art fallback → detailed fillRect sprite → photorealistic fal.ai render. Three stages of progressive enhancement."

### 6. OpenRouter Best Use — $1,000 / $400 / $100 credits
**Status: TRIVIAL SWAP**
- OpenRouter is an API gateway that routes to multiple models
- Change the OpenAI base URL to OpenRouter's endpoint for the obstacle generation call
- ~15 min of work: swap `new OpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey: OPENROUTER_KEY })`
- Frame: "OpenRouter powers our real-time obstacle generation, giving us model flexibility — we can hot-swap between GPT, Claude, and Qwen for obstacle design without changing a line of game code"
- Bonus: if you route through OpenRouter, you can also claim you tested multiple models

### 7. Qwen Best Use — $500 / $300 / $200 credits
**Status: EASY IF USING OPENROUTER**
- If you integrate OpenRouter (#6), you can route some calls to Qwen models
- Could use Qwen specifically for the obstacle description/audienceMessage generation
- Or use Qwen as a "second opinion" model that generates alternative obstacle interpretations
- Frame: "Qwen handles creative writing for obstacle announcements, bringing bilingual Vietnamese-English humor to audience messages"

---

## TIER 3: Moderate Effort Integrations

### 8. Agora Best Use — up to $990 in Convo AI minutes
**Status: COOL FEATURE ADD**
- Add real-time voice chat so audience can HECKLE the player
- "Audience screams 'WATCH OUT FOR THE DRAGON!' through Agora voice while the player dodges"
- Would genuinely improve the game experience
- ~2-3 hours of work
- Frame: "Agora's real-time voice turns spectators into active participants — they don't just create obstacles, they narrate the chaos"

### 9. Social & Mobility Track (Tasco) — up to $500K investment
**Status: STRETCH BUT HIGH REWARD**
- Criteria: "Drivers Behaviors, Traffic Congestion, User Trust"
- Saigon Rush gamifies traffic awareness. Players learn Vietnamese traffic patterns through gameplay
- Could add a "traffic education" mode where real HCMC traffic data influences obstacle spawning
- Frame: "Saigon Rush makes traffic education viral — players share their Traffic Reports, spreading awareness of Vietnamese road safety through humor and competition"
- The Tasco criteria mentions "MAU to DAU" — a mobile game with QR-code sharing is inherently high-frequency
- Weakness: it's a game, not infrastructure. But the viral/education angle has legs

### 10. AWS Technology & Consumer — $5,000 credits
**Status: REQUIRES MIGRATION**
- Would need to deploy WebSocket server on AWS (Lambda + API Gateway WebSocket, or EC2/ECS)
- ~2-4 hours of work
- Frame: "AWS Lambda handles WebSocket connections while API Gateway manages the multi-device session routing"
- Only worth it if you have time and it doesn't break anything

---

## TIER 4: Probably Skip

- **TinyFish (Enterprises)**: Requires TinyFish API as CORE + social media posts. Too constraining.
- **Etest (Edtech)**: Not an edtech project.
- **VALSEA**: Unknown API, risky time investment.
- **BrightData**: Web scraping doesn't fit the game concept.
- **Trae**: IDE/dev tool, would need to have built with it.
- **Exa**: Search API, no natural fit.
- **Interfaze/JigsawStack**: Would need to investigate API.

---

## Recommended Prize Stack (Maximum ROI)

### Must Submit (already eligible, just check the boxes):
| # | Prize | Status | Action |
|---|-------|--------|--------|
| 1 | **Top 3 Main** (50M VND+) | Ready | Submit full DevPost |
| 2 | **HRG Best Indie Hacker** ($1K + Da Nang) | Auto-win material | Check the box, solo = instant eligibility |
| 3 | **ElevenLabs Best Use** (3mo Pro + swag) | Already integrated | Check the box |
| 4 | **OpenAI Codex** (1yr ChatGPT Pro) | Strong fit | Check the box, Top 5 awarded = good odds |

### Quick Integrations (< 1 hour, high ROI):
| # | Prize | Work | Value |
|---|-------|------|-------|
| 5 | **Fal** ($1K credits) | Wire one fetch call, infrastructure exists | High — progressive enhancement story is perfect |
| 6 | **OpenRouter** ($1K credits) | Swap base URL | Very high — 15 min of work |
| 7 | **Qwen** ($500 credits) | Free once OpenRouter integrated | Free money |

### Stretch (2-4 hours, do only if time allows):
| # | Prize | Work | Value |
|---|-------|------|-------|
| 8 | **Agora** ($990 in minutes) | Add voice chat | Cool feature but time-intensive |
| 9 | **AWS** ($5K credits) | Migrate server to Lambda | Risky near deadline |

### Total Potential Haul (Top 3 + all bounties):
```
Main 1st:        50M VND cash (~$2,000 USD)
                 $15-25K OpenAI credits (docs show both $15K and $25K)
                 $10K Redis credits
                 $1K JigsawStack credits
                 $500 Exa credits
                 3mo ElevenLabs Scale Tier
                 100K Agora minutes ($990)
                 Apple Mac Mini M4
HRG:             $1,000 cash + Da Nang residency trip
ElevenLabs:      3mo Pro + swag
OpenAI Codex:    1yr ChatGPT Pro ($2,400/person)
Fal:             $1,000 credits
OpenRouter:      $1,000 credits
Qwen:            $500 credits
FastTrack:       Up to $1M compute credits + mentorship

= ~$35K+ in credits + 50M VND cash + hardware + accelerator
```

---

---

## Judge Intelligence

### GenAI Fund (Kai Yong — anchor judge, organizer)
- **Enterprise-first investor.** Portfolio: Blaze AI (voice), Revve AI (sales agents), Tribee (smart sales), Presight (analytics). All B2B vertical AI.
- **What they want:** Investable startups, not just demos. Projects that can close a paid enterprise PoC.
- **Risk for Saigon Rush:** It's a consumer game, not B2B SaaS.
- **Counter-framing:** Position as AI-powered interactive entertainment PLATFORM for enterprise events, brand activation, team building, streamer content. "The technology is a real-time AI content generation pipeline — games are just the first vertical."
- **FastTrack Accelerator** (up to $1M in compute) is the real prize for top 3.

### Travis Fischer (HRG judge — indie hacker prize)
- Ex-Microsoft, ex-Amazon. Created the ChatGPT npm package in 48 hours. Runs ChatGPTHackers.dev (9,500+ devs). Won "Best Indie Hacker" at Cursor x Anthropic Hackathon.
- **What he values:** Craft. Shipping fast. Solo-founder viability. Products you'd actually keep building.
- **Saigon Rush fit:** PERFECT. Solo build, real product, continuation potential (streaming integration). This is exactly what HRG rewards.
- **Talk to him like a builder, not a pitch deck.** He'll appreciate the technical choices (custom engine, procedural audio, zero assets) more than business projections.

### HackHarvard format
- Past winners: polished, functional, clear user journey. TeleSpeech (2023 grand prize) was a Chrome extension — clever, usable, immediately demo-able.
- **Saigon Rush fit:** Strong. The 3-device flow is a clear user journey. The live demo is inherently compelling.

### What this means for the pitch:
- For **main stage**: Lead with the experience (interactive demo), then the tech, then the business angle for GenAI Fund judges
- For **Travis/HRG**: Talk craft. Mention the procedural audio, the custom engine, the sprite design system. He'll geek out.
- For **sponsor judges**: Show deep integration, not surface-level API calls

---

## Demo Strategy

**THE SINGLE MOST IMPORTANT THING: Let a judge type something on the audience page during your pitch. When their suggestion appears on screen, that's the moment you win.**

Research confirms: "A mediocre project with an amazing pitch beats an amazing project with a mediocre pitch." Interactive demos > passive demos, every time.

### 3-minute pitch sequence:
1. **0:00-0:15** — Game running on screen. Don't explain. Let visuals hook.
2. **0:15-0:45** — Hand a judge the audience URL. Let THEM type something. Wait for reaction.
3. **0:45-1:15** — "GPT designs it. Claude draws it. ElevenLabs voices it. 3 seconds."
4. **1:15-1:45** — "Zero assets. Not one PNG or MP3. Everything generated." Drop the solo bomb.
5. **1:45-2:15** — Traffic Report. QR flow. "Scan to playing in 10 seconds."
6. **2:15-2:45** — Business: events, streaming, city expansion.
7. **2:45-3:00** — "Built solo in 30 hours. Saigon Rush."

### Critical prep:
- [ ] Game running and stable before judges arrive
- [ ] Audience URL ready on a phone/tablet to hand to judge
- [ ] Backup: pre-recorded demo video in case WiFi dies
- [ ] Have 3-4 fun suggestions ready to type if the judge freezes ("try typing 'BLACKPINK' or 'water buffalo'")

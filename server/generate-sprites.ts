#!/usr/bin/env bun
/**
 * Batch sprite generator — populates spriteLibrary.ts using Claude Opus.
 *
 * Usage:
 *   cd server && bun run generate-sprites.ts
 *
 * This script generates sprites for all SPRITE_TYPES using the same
 * Opus prompt from the game server, then writes the results to
 * client/src/game/spriteLibrary.ts in the correct format.
 */

// ── Types to generate ───────────────────────────────────────
interface SpriteType {
  key: string;          // spriteLibrary key (snake_case)
  displayName: string;  // Prompt description
  color: string;        // Theme color
  description: string;  // Cultural/visual context for the prompt
  isChain?: boolean;    // Generate head + body segment
  chainSegments?: number;
  bodyColor?: string;
}

const SPRITE_TYPES: SpriteType[] = [
  {
    key: "water_buffalo",
    displayName: "Vietnamese Water Buffalo",
    color: "#6B4426",
    description: "Large, powerful water buffalo (trâu) commonly seen in Vietnamese countryside. Dark brown hide, wide curved horns, muscular body. Side view walking right.",
  },
  {
    key: "dragon",
    displayName: "Vietnamese Dragon Head",
    color: "#cc2222",
    description: "Head of a Vietnamese dragon (rồng) — golden horns, flowing whiskers, fierce eyes, red/gold scales. This is the head of a chain obstacle. Ornate and mythical, not cartoon.",
    isChain: true,
    chainSegments: 7,
    bodyColor: "#cc2222",
  },
  {
    key: "grandma",
    displayName: "Angry Vietnamese Grandma",
    color: "#cc3366",
    description: "Fierce Vietnamese grandma (bà ngoại) in traditional áo dài, hair in bun, angry expression, raised arm throwing a slipper (dép). Cultural icon of Vietnamese discipline.",
  },
  {
    key: "durian",
    displayName: "Durian Cart",
    color: "#8B9B3E",
    description: "Wooden street vendor cart piled with spiky durian fruit. Has a small wheel, stink wavy lines rising from the fruit. Iconic Southeast Asian street vendor.",
  },
  {
    key: "karaoke",
    displayName: "Karaoke Truck",
    color: "#cc44cc",
    description: "Modified truck with massive speakers on the side, neon pink/purple paint, musical notes floating above. Vietnamese mobile karaoke. Garish and loud.",
  },
  {
    key: "dog",
    displayName: "Vietnamese Street Dog",
    color: "#C4883E",
    description: "Friendly stray dog (chó) trotting across the road. Golden-tan coat, tongue hanging out, alert ears. Common sight in HCMC streets.",
  },
  {
    key: "chicken",
    displayName: "Street Chicken",
    color: "#f5f5f0",
    description: "White chicken crossing the road with red comb and wattle, orange beak and feet, tail feathers. Classic road obstacle.",
  },
  {
    key: "delivery",
    displayName: "Delivery Bike",
    color: "#ff6600",
    description: "Motorbike with oversized delivery box on the back (orange, like Grab/ShopeeFood). Rider in helmet. Common sight dodging through HCMC traffic.",
  },
  {
    key: "elephant",
    displayName: "Parade Elephant",
    color: "#888899",
    description: "Large grey elephant with decorative blanket on its back. Trunk, tusks, big ears. Walking side view. Festival parade animal.",
  },
  {
    key: "banh_mi",
    displayName: "Bánh Mì Cart",
    color: "#dda844",
    description: "Vietnamese street vendor glass-sided cart filled with bánh mì sandwiches. Has a striped umbrella on top, small wheels. Iconic HCMC street food.",
  },
  {
    key: "firecracker",
    displayName: "Firecracker Bundle",
    color: "#dd2222",
    description: "Bundle of red firecrackers with gold bands, lit fuse at top with sparks flying. Tết (New Year) celebration item. Bright red with gold detailing.",
  },
  {
    key: "xe_om",
    displayName: "Xe Ôm (Motorbike Taxi)",
    color: "#00aa44",
    description: "Vietnamese motorbike taxi with green-jacketed rider (Grab-style) and passenger behind. Both wearing helmets. Side view facing right.",
  },
  {
    key: "construction",
    displayName: "Construction Barrier",
    color: "#ff8800",
    description: "Orange and white striped construction barrier with flashing warning light on top. Metal posts and concrete base. Road work ahead.",
  },
  {
    key: "fruit_cart",
    displayName: "Fruit Vendor Cart",
    color: "#ffcc00",
    description: "Vietnamese street vendor cart piled with tropical fruit — mangoes, dragon fruit, rambutan. Has a green umbrella on top. Wooden cart with wheel.",
  },
  {
    key: "conga",
    displayName: "Conga Line Dancer",
    color: "#ff44cc",
    description: "Festive person in colorful clothes with party hat, dancing with arms reaching back. Happy expression. This is the head of a conga line chain.",
    isChain: true,
    chainSegments: 5,
    bodyColor: "#44ccff",
  },
  {
    key: "scooter",
    displayName: "Electric Scooter",
    color: "#333333",
    description: "Modern electric kick-scooter with LED strip on the platform, sleek stem and handlebars. No rider. Side view facing right.",
  },
];

// ── Read the prompt from the server source ──────────────────
const serverSource = await Bun.file(import.meta.dir + "/index.ts").text();
const promptMatch = serverSource.match(/const SPRITE_DESIGNER_PROMPT = `([\s\S]*?)`;/);
if (!promptMatch) {
  console.error("Could not extract SPRITE_DESIGNER_PROMPT from index.ts");
  process.exit(1);
}
const PROMPT = promptMatch[1];

type SpriteRect = { x: number; y: number; w: number; h: number; c: string };

function extractFromAnswer(output: string): string {
  const answerMatch = output.match(/<answer>([\s\S]*?)<\/answer>/);
  return answerMatch ? answerMatch[1] : output;
}

async function generateSprite(type: SpriteType): Promise<{ sprite: SpriteRect[]; segmentSprite?: SpriteRect[] } | null> {
  let userPrompt: string;

  if (type.isChain) {
    userPrompt = `${PROMPT}

<chain_instructions>
This is a CHAIN obstacle with a HEAD and ${type.chainSegments || 5} trailing BODY segments connected in a snake-like formation.

Instead of a single JSON array, output a JSON object with two keys inside your <answer> tags:
{"head":[...rects...],"body":[...rects...]}

HEAD sprite: The front/face of the creature/thing. 35-50 rects, ~50x40px canvas, facing RIGHT.
BODY segment sprite: ONE segment that repeats for each trailing part. 15-25 rects, ~25x25px canvas, centered.

The body segment must look like a REAL anatomical part of this creature — dragon scales with ridges, etc. NOT a generic blob.
Use the same color palette for both head and body.
</chain_instructions>

<request>
Design: "${type.displayName}"
Description: ${type.description}
Theme color: ${type.color}
Body color: ${type.bodyColor || type.color}
Chain length: ${type.chainSegments || 5} segments
</request>`;
  } else {
    userPrompt = `${PROMPT}

<request>
Design a sprite for: "${type.displayName}"
Description: ${type.description}
Theme color: ${type.color}
Size: ~50x40px canvas.

35-50 rectangles, facing RIGHT. Apply all five passes. Make this instantly recognizable and visually memorable.
</request>`;
  }

  try {
    console.log(`  Generating ${type.key}...`);
    const proc = Bun.spawn(
      ["claude", "--print", "--model", "claude-opus-4-6", "-p", userPrompt],
      { stdout: "pipe", stderr: "pipe" },
    );

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      console.error(`  ERROR ${type.key}: exit ${exitCode} — ${stderr.slice(0, 200)}`);
      return null;
    }

    const answer = extractFromAnswer(output);

    if (type.isChain) {
      const objMatch = answer.match(/\{[\s\S]*"head"[\s\S]*"body"[\s\S]*\}/);
      if (objMatch) {
        const parsed = JSON.parse(objMatch[0]);
        if (parsed.head?.length > 0) {
          console.log(`  ✓ ${type.key}: head=${parsed.head.length} rects, body=${parsed.body?.length || 0} rects`);
          return { sprite: parsed.head, segmentSprite: parsed.body };
        }
      }
      // Fallback: just grab any array
      const arrMatch = answer.match(/\[[\s\S]*\]/);
      if (arrMatch) {
        const parsed = JSON.parse(arrMatch[0]);
        console.log(`  ✓ ${type.key}: ${parsed.length} rects (head only, no body segment)`);
        return { sprite: parsed };
      }
      console.error(`  ERROR ${type.key}: no JSON found in output`);
      return null;
    }

    const match = answer.match(/\[[\s\S]*\]/);
    if (!match) {
      console.error(`  ERROR ${type.key}: no JSON array found`);
      return null;
    }
    const parsed = JSON.parse(match[0]);
    console.log(`  ✓ ${type.key}: ${parsed.length} rects`);
    return { sprite: parsed };
  } catch (err) {
    console.error(`  ERROR ${type.key}:`, err);
    return null;
  }
}

function rectToTuple(r: SpriteRect): string {
  return `[${r.x}, ${r.y}, ${r.w}, ${r.h}, ${JSON.stringify(r.c)}]`;
}

function formatLibraryEntry(key: string, data: { sprite: SpriteRect[]; segmentSprite?: SpriteRect[] }): string {
  let out = `  // ── ${key} ──\n`;
  out += `  "${key}": {\n`;
  out += `    sprite: [\n`;
  for (const r of data.sprite) {
    out += `      ${rectToTuple(r)},\n`;
  }
  out += `    ],\n`;
  if (data.segmentSprite && data.segmentSprite.length > 0) {
    out += `    segmentSprite: [\n`;
    for (const r of data.segmentSprite) {
      out += `      ${rectToTuple(r)},\n`;
    }
    out += `    ],\n`;
  }
  out += `  },\n`;
  return out;
}

// ── Main ────────────────────────────────────────────────────
console.log(`\nSaigon Rush — Batch Sprite Generator`);
console.log(`Generating ${SPRITE_TYPES.length} sprites via Claude Opus...\n`);

const results = new Map<string, { sprite: SpriteRect[]; segmentSprite?: SpriteRect[] }>();

// Generate 3 at a time to avoid overwhelming the API
const CONCURRENCY = 3;
for (let i = 0; i < SPRITE_TYPES.length; i += CONCURRENCY) {
  const batch = SPRITE_TYPES.slice(i, i + CONCURRENCY);
  const promises = batch.map(async (type) => {
    const result = await generateSprite(type);
    if (result) results.set(type.key, result);
  });
  await Promise.all(promises);
}

console.log(`\n${results.size}/${SPRITE_TYPES.length} sprites generated successfully.\n`);

if (results.size === 0) {
  console.error("No sprites generated. Check API access.");
  process.exit(1);
}

// Build the output file
let fileContent = `// Saigon Rush — Pre-generated sprite library for demo reliability
// Generated via Claude Opus batch sprite generator
// Keyed by obstacleType (snake_case, matching GPT output)

import type { SpriteDefinition } from "./sprites";

export interface LibraryEntry {
  sprite: SpriteDefinition;
  segmentSprite?: SpriteDefinition; // For chain obstacles (body segments)
}

// Pre-built sprites for common audience suggestions
const SPRITE_LIBRARY: Record<string, LibraryEntry> = {

`;

for (const [key, data] of results) {
  fileContent += formatLibraryEntry(key, data);
  fileContent += "\n";
}

fileContent += `};

/**
 * Look up a pre-built sprite by obstacle type.
 * Returns null if no library match — caller should fall through to AI/generic.
 */
export function getLibrarySprite(type: string): LibraryEntry | null {
  // Exact match
  if (SPRITE_LIBRARY[type]) return SPRITE_LIBRARY[type];

  // Fuzzy match: check if the type CONTAINS a library key
  // e.g. "angry_water_buffalo" matches "water_buffalo"
  for (const key of Object.keys(SPRITE_LIBRARY)) {
    if (type.includes(key)) return SPRITE_LIBRARY[key];
  }

  return null;
}
`;

const outPath = import.meta.dir + "/../client/src/game/spriteLibrary.ts";
await Bun.write(outPath, fileContent);
console.log(`Written to: ${outPath}`);
console.log(`\nSprite counts:`);
for (const [key, data] of results) {
  const segInfo = data.segmentSprite ? ` + ${data.segmentSprite.length} segment` : "";
  console.log(`  ${key}: ${data.sprite.length} rects${segInfo}`);
}

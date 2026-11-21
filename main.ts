// main.ts — the hand-in program for Nightshift (best-stealth-game-20261121-1759).
//
// It copies the playable game (game/) and the screenshots (screenshots/)
// from beside this file into the output directory, then writes
// dossier.json there with the vendored make.fun library, so the judge can
// read the game and its outline. Node 22 standard library only.
//
// The grader runs this twice and both runs must write the same bytes; the
// program does nothing time- or random-dependent, so they do. Outside the
// grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The game is the entry: refuse a run with nothing to hand in rather than
// writing an empty output directory the gate would reject.
if (!existsSync(join(here, 'game', 'index.html'))) {
  throw new Error('game/index.html is missing next to main.ts');
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// One line on stdout so a local run shows what was handed in.
console.log(`Nightshift handed in: game/ + ${existsSync(join(here, 'screenshots')) ? '4 screenshots' : 'no screenshots'} + dossier.json -> ${out}`);

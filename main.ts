// Palma Bay: Neon Tide — entry program for make.fun's gta6-01 bounty.
// Node 22, standard library only. It hands in the game built in this
// repository: game/ (plain static files that play offline in desktop
// Chrome) and screenshots/ are copied into the output directory, and
// dossier.json is written there with the vendored make.fun library so
// the gate can rebuild it byte for byte and compare.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail early with a plain message when the repository is incomplete,
// instead of copying a broken entry and letting buildDossier discover
// it halfway through the handoff.
function requirePath(path, what) {
  if (!existsSync(path)) {
    throw new Error(`main.ts: missing ${what} at ${path} — the entry is incomplete`);
  }
}

requirePath(join(here, 'game', 'index.html'), 'the game page (game/index.html)');
requirePath(join(here, 'screenshots'), 'the screenshots directory');

const screenshotNames = readdirSync(join(here, 'screenshots'))
  .filter((name) => /\.(?:png|jpe?g)$/i.test(name) && !name.startsWith('.'))
  .sort();
if (screenshotNames.length < 3 || screenshotNames.length > 4) {
  throw new Error(`main.ts: screenshots/ must hold 3 or 4 images, found ${screenshotNames.length}`);
}
for (const name of screenshotNames) {
  const bytes = statSync(join(here, 'screenshots', name)).size;
  if (bytes > 262144) {
    throw new Error(`main.ts: screenshots/${name} is ${bytes} bytes, over the 256 KiB cap`);
  }
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The gate's own caps: passing them here makes this program refuse an
// entry the scorer would refuse, instead of handing in a broken one.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

console.log(
  `Palma Bay: Neon Tide handed in: game/ + ${screenshotNames.length} screenshots ` +
  `(${screenshotNames.join(', ')}) -> ${out}, dossier.json ${dossier.length} bytes`,
);

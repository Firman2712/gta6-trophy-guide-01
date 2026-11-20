// Entry program for the GTA 6 trophy guide (Node 22, standard library only).
// Round 2 note: the guide itself is plain static files under app/ — an index
// page, a stylesheet, one module script and the trophy data — with no build
// step, so handing it in is just copying. This program copies app/ and
// screenshots/ from the repository root into the output directory (by default
// /output, or whatever MAKEFUN_OUTPUT_DIR names when the grader is not
// running it) and then writes dossier.json there, built by the vendored
// make.fun library. vendor/makefun-frontend.ts is the kit's copy and must
// stay untouched: the scorer rebuilds the dossier with its own copy and
// compares the two bytes.
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

// Directory this file lives in — the repository root.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
// Where the handed-in entry goes.
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });

// Round 2: fail loudly before copying anything if the app entry point is
// missing, instead of handing in an output directory with no guide in it.
if (!existsSync(join(repoRoot, 'app', 'index.html'))) {
  throw new Error('Refusing to build: app/index.html is missing from the repository.');
}
if (!existsSync(join(repoRoot, 'app', 'data', 'trophies.json'))) {
  throw new Error('Refusing to build: app/data/trophies.json is missing from the repository.');
}

// The whole app, exactly as it is served.
cpSync(join(repoRoot, 'app'), join(outputDir, 'app'), { recursive: true });

// Screenshots of the app running, if the folder is there.
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The dossier the judge reads: screenshots plus a text summary of the entry.
// The limits mirror the scorer's own caps, so a build that passes here will
// not trip them there (at most 4 screenshots, each at most 256 KiB; app/ at
// most 993 files and directories and 48 MiB in total).
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
  }),
);

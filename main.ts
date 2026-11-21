import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier as vendorBuildDossier } from './vendor/makefun-frontend.ts';

// Dossier builder for the Leonida Ledger guide: validates the guide's own
// inputs (55 trophies, the app files, the shots manifest) then delegates the
// dossier itself to the vendored make.fun library. Run: `node main.ts`.
export function buildDossier(dir: string, caps = { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 } }) {
  const root = resolve(dir);
  if (!existsSync(join(root, 'screenshots'))) {
    throw new Error('screenshots/: no such directory: the dossier needs screenshots of the running app');
  }
  const trophies = JSON.parse(readFileSync(join(root, 'app/data/trophies.json'), 'utf8'));
  const list = Array.isArray(trophies) ? trophies : trophies.trophies;
  if (!Array.isArray(list) || list.length !== 55) {
    throw new Error(`trophies: expected 55 trophies, found ${Array.isArray(list) ? list.length : 'none'}`);
  }
  for (const f of ['app/index.html', 'app/style.css', 'app/app.js', 'shots.json']) {
    readFileSync(join(root, f));
  }
  return vendorBuildDossier(root, caps);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
  writeFileSync(join(root, 'dossier.json'), buildDossier(root));
  console.log('dossier.json written');
}
